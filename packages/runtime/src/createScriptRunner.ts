// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Bar,
    CompiledScriptObject,
    ComputeFn,
    ScriptManifest,
} from "@invinite-org/chartlang-core";
import type {
    CandleEvent,
    Capabilities,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";

import {
    drain as drainImpl,
    dispose as disposeImpl,
    onBarClose as onBarCloseImpl,
    onBarTick as onBarTickImpl,
    onHistory as onHistoryImpl,
} from "./execution";
import {
    appendSecondaryBar,
    appendSecondaryHistory,
    replaceSecondaryHead,
} from "./execution/secondaryStream";
import type { MutableRunnerEmissions, RuntimeContext } from "./runtimeContext";
import { resolveInputs } from "./inputs";
import type { PersistentStateStore } from "./persistentStateStore";
import {
    PERSISTENCE_INTERVAL_MS,
    maybeSaveStateSnapshot,
    restoreStateSnapshot,
    saveStateSnapshot,
} from "./persistentStateStore.runtime";
import { validateSnapshot } from "./persistentStateStore.validate";
import { pushDiagnostic } from "./emit";
import { inMemoryStateStore, type StateStore } from "./stateStore";
import { createStreamState, type StreamState } from "./streamState";
import { createRuntimeViews, makeSymInfoView, type AdapterSymInfo } from "./views";

/**
 * Internal handle the execution functions read and mutate per step. Lives
 * inside `createScriptRunner`'s closure; never exposed on the public
 * barrel. `barIndex` is the only mutable field — `onBarClose` increments
 * it; `onBarTick` does not.
 *
 * @since 0.1
 * @example
 *     // RunnerState is internal — execution functions accept it as
 *     // their first argument:
 *     //   await onBarClose(state, rawBar);
 */
export type RunnerState = {
    readonly manifest: ScriptManifest;
    readonly compute: ComputeFn;
    readonly capabilities: Capabilities;
    readonly stateStore: StateStore;
    readonly persistenceIntervalMs: number;
    readonly now: () => number;
    readonly mainStream: StreamState;
    readonly runtimeContext: RuntimeContext;
    readonly emissions: MutableRunnerEmissions;
    barIndex: number;
};

/**
 * The user-facing handle `createScriptRunner` returns. Hosts (Worker,
 * QuickJS, conformance harness) drive a `ScriptRunner` through the
 * standard lifecycle: `load → onHistory → onBarClose × N → onBarTick × M
 * → drain → dispose`. PLAN §6.1 fixes this shape; consumer-repo hosts
 * pin against it.
 *
 * `onHistory` / `onBarClose` / `onBarTick` return `Promise<void>` — the
 * runtime allows compute bodies to `await` (Phase 1 doesn't, but the
 * surface is forward-compatible with Phase-5 `request.security` warmup).
 *
 * @since 0.1
 * @example
 *     // import { createScriptRunner }
 *     //     from "@invinite-org/chartlang-runtime";
 *     // const runner = createScriptRunner({ compiled, capabilities });
 *     // await runner.onHistory(historicalBars);
 *     // const emissions = runner.drain();
 *     // runner.dispose();
 */
export type ScriptRunner = {
    onHistory(bars: ReadonlyArray<Bar>): Promise<void>;
    onBarClose(bar: Bar): Promise<void>;
    onBarTick(bar: Bar): Promise<void>;
    push(event: CandleEvent): Promise<void>;
    warmStart(currentMainBarTime: number): Promise<void>;
    drain(): RunnerEmissions;
    dispose(): Promise<void>;
};

/**
 * Constructor arguments for {@link createScriptRunner}. `stateStore`
 * defaults to {@link inMemoryStateStore} so callers without persistence
 * needs can omit it. `symInfo` defaults to empty sentinels and is gated
 * by `capabilities.symInfoFields` at mount. `resolveInputs` is called
 * once at mount with `manifest.name`; worker-backed callers can pass an
 * already structured-cloned `inputOverrides` record instead.
 * `persistentStateStore` is the PLAN §6.9 cross-mount snapshot store;
 * `persistenceIntervalMs` defaults to 60 seconds.
 *
 * @since 0.1
 * @example
 *     // const args: CreateScriptRunnerArgs = {
 *     //     compiled,
 *     //     capabilities,
 *     //     stateStore: inMemoryStateStore(),
 *     // };
 */
export type CreateScriptRunnerArgs = {
    readonly compiled: CompiledScriptObject;
    readonly capabilities: Capabilities;
    readonly stateStore?: StateStore;
    readonly persistentStateStore?: PersistentStateStore;
    readonly persistenceIntervalMs?: number;
    readonly now?: () => number;
    readonly symInfo?: AdapterSymInfo;
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    readonly inputOverrides?: Readonly<Record<string, unknown>>;
};

function resolveCapacity(manifest: ScriptManifest): number {
    const requested = manifest.seriesCapacities.ohlcv;
    const fallback = manifest.maxLookback + 1;
    return Math.max(1, requested ?? fallback);
}

function createSecondaryStreams(
    manifest: ScriptManifest,
    capacity: number,
): Map<string, StreamState> {
    const streams = new Map<string, StreamState>();
    for (const interval of manifest.requestedIntervals) {
        if (streams.has(interval)) continue;
        streams.set(interval, createStreamState({ interval, capacity, symbol: "" }));
    }
    return streams;
}

async function pushMainEvent(state: RunnerState, event: CandleEvent): Promise<void> {
    switch (event.kind) {
        case "history":
            await onHistoryImpl(state, event.bars);
            return;
        case "close":
            await onBarCloseImpl(state, event.bar);
            await maybeSaveStateSnapshot(state, state.now(), state.persistenceIntervalMs);
            return;
        case "tick":
            await onBarTickImpl(state, event.bar);
            return;
    }
}

function pushUnknownSecondaryDiagnostic(state: RunnerState, streamKey: string): void {
    pushDiagnostic(state.emissions, {
        kind: "diagnostic",
        severity: "warning",
        code: "unknown-secondary-stream",
        message: `Secondary stream "${streamKey}" was not registered by the script manifest`,
        slotId: null,
        bar: state.barIndex,
    });
}

function pushSecondaryEvent(state: RunnerState, streamKey: string, event: CandleEvent): void {
    const stream = state.runtimeContext.secondaryStreams.get(streamKey);
    if (stream === undefined) {
        pushUnknownSecondaryDiagnostic(state, streamKey);
        return;
    }
    switch (event.kind) {
        case "history":
            appendSecondaryHistory(stream, event.bars);
            return;
        case "close":
            appendSecondaryBar(stream, event.bar);
            return;
        case "tick":
            replaceSecondaryHead(stream, event.bar);
            return;
    }
}

/**
 * Build a `ScriptRunner` for a compiled chartlang script. The runner
 * owns one `StreamState`, one `MutableRunnerEmissions` queue set, and
 * the `RuntimeContext` Task 7-8 primitives read through
 * `ACTIVE_RUNTIME_CONTEXT`. Phase 1 ships a single-stream model; the
 * `requestedIntervals` field on the manifest is always empty.
 *
 * Capacity sizing follows PLAN §6.6: prefer
 * `manifest.seriesCapacities.ohlcv` (compiler-emitted per-series
 * lookback) and fall back to `manifest.maxLookback + 1`, clamped to a
 * minimum of 1 so an empty-history script still has a valid head slot.
 *
 * @since 0.1
 * @example
 *     // import { createScriptRunner } from "@invinite-org/chartlang-runtime";
 *     // const runner = createScriptRunner({ compiled, capabilities });
 *     // await runner.onHistory([]);
 *     // runner.drain();
 *     // runner.dispose();
 */
export function createScriptRunner(args: CreateScriptRunnerArgs): ScriptRunner {
    const capacity = resolveCapacity(args.compiled.manifest);
    const mainStream = createStreamState({ interval: "", capacity, symbol: "" });
    const secondaryStreams = createSecondaryStreams(args.compiled.manifest, capacity);
    const stateStore = args.stateStore ?? inMemoryStateStore();
    const now = args.now ?? Date.now;
    const views = createRuntimeViews({
        syminfo: makeSymInfoView(args.symInfo ?? {}, args.capabilities.symInfoFields),
    });
    const emissions: MutableRunnerEmissions = {
        plots: [],
        drawings: [],
        alerts: [],
        alertConditions: [],
        logs: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
    const alertConditions = new Map(
        (args.compiled.manifest.alertConditions ?? []).map((condition) => [
            condition.id,
            condition,
        ]),
    );

    const state: RunnerState = {
        manifest: args.compiled.manifest,
        compute: args.compiled.compute,
        capabilities: args.capabilities,
        stateStore,
        persistenceIntervalMs: args.persistenceIntervalMs ?? PERSISTENCE_INTERVAL_MS,
        now,
        mainStream,
        runtimeContext: {
            stream: mainStream,
            stateStore,
            ...(args.persistentStateStore === undefined
                ? {}
                : { persistentStateStore: args.persistentStateStore }),
            lastPersistTime: 0,
            capabilities: args.capabilities,
            emissions,
            barIndex: () => state.barIndex,
            isTick: false,
            drawingSlots: new Map(),
            drawingSubIdCounters: new Map(),
            drawingBucketCounters: {
                lines: 0,
                labels: 0,
                boxes: 0,
                polylines: 0,
                other: 0,
            },
            scriptMaxDrawings: args.compiled.manifest.maxDrawings ?? null,
            stateSlots: new Map(),
            secondaryStreams,
            requestSecurityBars: new Map(),
            requestSecurityAlignments: new Map(),
            requestSecurityAscendingBars: new Map(),
            diagnosedRequestKeys: new Set(),
            alertConditions,
            diagnosedAlertConditionKeys: new Set(),
            logBudget: 0,
            logBudgetExceededDiagnosed: false,
            resolvedInputs: Object.freeze({}),
            diagnosedInputKeys: new Set(),
            views,
        },
        emissions,
        barIndex: 0,
    };
    const overrides =
        args.inputOverrides ??
        args.resolveInputs?.(args.compiled.manifest.name) ??
        Object.freeze({});
    state.runtimeContext.resolvedInputs = resolveInputs(
        args.compiled.manifest,
        overrides,
        state.runtimeContext,
    );

    return Object.freeze({
        async onHistory(bars) {
            await onHistoryImpl(state, bars);
        },
        async onBarClose(bar) {
            await onBarCloseImpl(state, bar);
            await maybeSaveStateSnapshot(state, state.now(), state.persistenceIntervalMs);
        },
        async onBarTick(bar) {
            await onBarTickImpl(state, bar);
        },
        async push(event) {
            if (event.streamKey === undefined) {
                await pushMainEvent(state, event);
                return;
            }
            pushSecondaryEvent(state, event.streamKey, event);
        },
        async warmStart(currentMainBarTime) {
            const store = state.runtimeContext.persistentStateStore;
            if (store === undefined) return;
            const snap = await store.load();
            if (snap === null) return;
            if (!validateSnapshot(snap)) return;
            if (snap.lastBarTime >= currentMainBarTime) {
                pushDiagnostic(state.emissions, {
                    kind: "diagnostic",
                    severity: "warning",
                    code: "state-snapshot-future-dated",
                    message: "persistent state snapshot is ahead of the current bar cursor",
                    slotId: null,
                    bar: state.barIndex,
                });
                try {
                    await store.clear();
                } catch (err) {
                    pushDiagnostic(state.emissions, {
                        kind: "diagnostic",
                        severity: "warning",
                        code: "state-snapshot-save-failed",
                        message: err instanceof Error ? err.message : String(err),
                        slotId: null,
                        bar: state.barIndex,
                    });
                }
                return;
            }
            restoreStateSnapshot(state, snap);
            state.runtimeContext.lastPersistTime = snap.savedAt;
            pushDiagnostic(state.emissions, {
                kind: "diagnostic",
                severity: "info",
                code: "state-snapshot-restored",
                message: `persistent state snapshot restored through bar ${snap.lastBarTime}`,
                slotId: null,
                bar: state.barIndex,
            });
        },
        drain() {
            return drainImpl(state);
        },
        async dispose() {
            const finalSave = saveStateSnapshot(state, state.now());
            disposeImpl(state);
            await finalSave;
        },
    });
}

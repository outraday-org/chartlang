// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CandleEvent,
    Capabilities,
    PlotOverride,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";
import type {
    Bar,
    CompiledScriptBundle,
    CompiledScriptObject,
    ComputeFn,
    ScriptManifest,
} from "@invinite-org/chartlang-core";
import { isCompiledScriptBundle } from "@invinite-org/chartlang-core";

import {
    type DepOutputStore,
    type DepRunner,
    type SiblingRunner,
    createDepOutputStore,
    createDepRunner,
    createSiblingRunner,
    installDepOutputGlobal,
} from "./dep/index.js";
import { pushDiagnostic, resolveDefaultPane, resolveScriptPane } from "./emit/index.js";
import {
    dispose as disposeImpl,
    drain as drainImpl,
    onBarClose as onBarCloseImpl,
    onBarTick as onBarTickImpl,
    onHistory as onHistoryImpl,
} from "./execution/index.js";
import {
    appendSecondaryBar,
    appendSecondaryHistory,
    replaceSecondaryHead,
} from "./execution/secondaryStream.js";
import { resolveInputs } from "./inputs/index.js";
import {
    buildSecurityExprRunners,
    driveSecurityExpressions,
} from "./request/securityExprRunner.js";
import type { PersistentStateStore } from "./persistentStateStore.js";
import {
    PERSISTENCE_INTERVAL_MS,
    maybeSaveStateSnapshot,
    restoreStateSnapshot,
    saveStateSnapshot,
} from "./persistentStateStore.runtime.js";
import { validateSnapshot } from "./persistentStateStore.validate.js";
import type { MutableRunnerEmissions, RuntimeContext } from "./runtimeContext.js";
import { type StateStore, inMemoryStateStore } from "./stateStore.js";
import { type StreamState, createStreamState } from "./streamState.js";
import { type AdapterSymInfo, createRuntimeViews, makeSymInfoView } from "./views/index.js";

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
    /**
     * Sub-runners for every private dep entry of a
     * `CompiledScriptBundle`. Empty array for single-script callers.
     * Walked in declaration order before the primary's compute each
     * bar. @since 0.7
     */
    readonly depRunners: ReadonlyArray<DepRunner>;
    /**
     * Sub-runners for every drawn named-export entry of a
     * `CompiledScriptBundle`. Empty for single-script callers.
     * Walked in declaration order after deps, before the primary's
     * compute. @since 0.7
     */
    readonly siblingRunners: ReadonlyArray<SiblingRunner>;
    /**
     * Shared titled-output buffer for the bundle. `null` for
     * single-script callers (no deps to read from). @since 0.7
     */
    readonly depOutputStore: DepOutputStore | null;
    /**
     * Per-bar flag set by `runDepStep` when any dep halts. Read by
     * `onBarClose` / `onBarTick` after the primary's compute returns,
     * clearing the primary's plot/drawing/alert queues. Reset at the
     * top of every bar. @since 0.7
     */
    depErroredThisBar: boolean;
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
    /**
     * Replace the per-slot presentation override map live. Cheap and
     * recompute-free — the swap takes effect on the NEXT push's
     * `compute`; the just-pushed bar's drain returns the pre-swap
     * emissions (already baked during that bar's `compute`). Entries
     * are frozen on assignment; overrides are presentation-only and
     * never feed `compute`.
     *
     * @since 0.8
     * @stable
     * @example
     *     // runner.setPlotOverrides({ "ema.chart.ts:12:5#0": { visible: false } });
     */
    setPlotOverrides(next: Readonly<Record<string, PlotOverride>>): void;
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
    /**
     * Either a single `CompiledScriptObject` (Phase-1 contract — preserved
     * byte-identically) or a `CompiledScriptBundle` whose primary script
     * is mounted alongside one `DepRunner` per private dep entry and one
     * `SiblingRunner` per drawn named export.
     *
     * @since 0.1 — widened to bundle in 0.7
     */
    readonly compiled: CompiledScriptObject | CompiledScriptBundle;
    readonly capabilities: Capabilities;
    readonly stateStore?: StateStore;
    readonly persistentStateStore?: PersistentStateStore;
    readonly persistenceIntervalMs?: number;
    readonly now?: () => number;
    readonly symInfo?: AdapterSymInfo;
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    readonly inputOverrides?: Readonly<Record<string, unknown>>;
    readonly resolvePlotOverrides?: (scriptId: string) => Readonly<Record<string, PlotOverride>>;
    readonly plotOverrides?: Readonly<Record<string, PlotOverride>>;
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
    const ctx = state.runtimeContext;
    switch (event.kind) {
        case "history":
            // History bars are finalised HTF closes: fill the buffer, then
            // drive every registered runner once per bar in source order (a
            // no-op until the main compute captures the callback).
            appendSecondaryHistory(stream, event.bars);
            for (const bar of event.bars) {
                driveSecurityExpressions(ctx, streamKey, "close", bar);
            }
            return;
        case "close":
            appendSecondaryBar(stream, event.bar);
            driveSecurityExpressions(ctx, streamKey, "close", event.bar);
            return;
        case "tick":
            replaceSecondaryHead(stream, event.bar);
            driveSecurityExpressions(ctx, streamKey, "tick", event.bar);
            return;
    }
}

function primaryOf(compiled: CompiledScriptObject | CompiledScriptBundle): CompiledScriptObject {
    return isCompiledScriptBundle(compiled) ? compiled.primary : compiled;
}

function buildPrimaryState(
    args: CreateScriptRunnerArgs,
    primary: CompiledScriptObject,
): RunnerState {
    const capacity = resolveCapacity(primary.manifest);
    const mainStream = createStreamState({ interval: "", capacity, symbol: "" });
    const secondaryStreams = createSecondaryStreams(primary.manifest, capacity);
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
        (primary.manifest.alertConditions ?? []).map((condition) => [condition.id, condition]),
    );

    const state: RunnerState = {
        manifest: primary.manifest,
        compute: primary.compute,
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
            scriptMaxDrawings: primary.manifest.maxDrawings ?? null,
            stateSlots: new Map(),
            secondaryStreams,
            requestSecurityBars: new Map(),
            requestSecurityAlignments: new Map(),
            requestSecurityAscendingBars: new Map(),
            requestLowerTfViews: new Map(),
            diagnosedRequestKeys: new Set(),
            alertConditions,
            diagnosedAlertConditionKeys: new Set(),
            logBudget: 0,
            logBudgetExceededDiagnosed: false,
            resolvedInputs: Object.freeze({}),
            defaultPane: resolveDefaultPane(primary.manifest),
            scriptPane: resolveScriptPane(primary.manifest),
            plotOverrides: Object.freeze({}),
            diagnosedInputKeys: new Set(),
            views,
        },
        emissions,
        depRunners: [],
        siblingRunners: [],
        depOutputStore: null,
        depErroredThisBar: false,
        barIndex: 0,
    };
    const overrides =
        args.inputOverrides ?? args.resolveInputs?.(primary.manifest.name) ?? Object.freeze({});
    state.runtimeContext.resolvedInputs = resolveInputs(
        primary.manifest,
        overrides,
        state.runtimeContext,
    );
    state.runtimeContext.plotOverrides =
        args.plotOverrides ??
        args.resolvePlotOverrides?.(primary.manifest.name) ??
        Object.freeze({});
    const exprRunners = buildSecurityExprRunners(primary.manifest, state.runtimeContext, capacity);
    state.runtimeContext.securityExprRunners = exprRunners.bySlot;
    state.runtimeContext.securityExprRunnersByInterval = exprRunners.byInterval;
    state.runtimeContext.requestSecurityExprSeries = new Map();
    return state;
}

function attachBundle(
    primary: RunnerState,
    bundle: CompiledScriptBundle,
    capabilities: Capabilities,
    now: () => number,
): void {
    const consumerLookback = Math.max(
        primary.manifest.maxLookback,
        ...bundle.siblings.map((s) => s.compiled.manifest.maxLookback),
    );
    const storeCapacity = Math.max(1, consumerLookback + 1);
    const producers = [
        ...bundle.dependencies.map((d) => ({
            producerId: d.localId,
            outputs: (d.compiled.manifest.outputs ?? []).map((o) => ({
                title: o.title,
            })),
        })),
        ...bundle.siblings.map((s) => ({
            producerId: s.exportName,
            outputs: (s.compiled.manifest.outputs ?? []).map((o) => ({
                title: o.title,
            })),
        })),
    ];
    const store = createDepOutputStore({ producers, capacity: storeCapacity });
    const depRunners: DepRunner[] = bundle.dependencies.map((entry) =>
        createDepRunner({
            compiled: entry.compiled,
            localId: entry.localId,
            parentCapabilities: capabilities,
            mainStream: primary.mainStream,
            secondaryStreams: primary.runtimeContext.secondaryStreams,
            depOutputStore: store,
            inputOverrides: entry.inputOverrides ?? Object.freeze({}),
            now,
        }),
    );
    const siblingRunners: SiblingRunner[] = bundle.siblings.map((entry) =>
        createSiblingRunner({
            compiled: entry.compiled,
            exportName: entry.exportName,
            parentCapabilities: capabilities,
            mainStream: primary.mainStream,
            secondaryStreams: primary.runtimeContext.secondaryStreams,
            depOutputStore: store,
            inputOverrides: Object.freeze({}),
            now,
        }),
    );
    Object.assign(primary, {
        depRunners,
        siblingRunners,
        depOutputStore: store,
    });
    primary.runtimeContext.depOutputStore = store;
    installDepOutputGlobal();
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
 * @since 0.1 — widened to accept `CompiledScriptBundle` in 0.7.
 * @example
 *     // import { createScriptRunner } from "@invinite-org/chartlang-runtime";
 *     // const runner = createScriptRunner({ compiled, capabilities });
 *     // await runner.onHistory([]);
 *     // runner.drain();
 *     // runner.dispose();
 */
export function createScriptRunner(args: CreateScriptRunnerArgs): ScriptRunner {
    const primary = primaryOf(args.compiled);
    const state = buildPrimaryState(args, primary);
    if (isCompiledScriptBundle(args.compiled)) {
        attachBundle(state, args.compiled, args.capabilities, state.now);
    }

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
        setPlotOverrides(next) {
            state.runtimeContext.plotOverrides = Object.freeze({ ...next });
        },
        async dispose() {
            const finalSave = saveStateSnapshot(state, state.now());
            disposeImpl(state);
            await finalSave;
        },
    });
}

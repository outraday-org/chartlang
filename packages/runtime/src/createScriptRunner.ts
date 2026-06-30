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
    ExternalSeriesFeedMap,
    RequestedFeed,
    ScriptManifest,
} from "@invinite-org/chartlang-core";
import { feedKey, isCompiledScriptBundle } from "@invinite-org/chartlang-core";

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
    createExternalSeriesSlots,
    isExternalSeriesFeed,
    replaceExternalSeriesFeedMap,
} from "./inputs/externalSeriesFeeds.js";
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
import type { PersistentStateStore } from "./persistentStateStore.js";
import {
    PERSISTENCE_INTERVAL_MS,
    maybeSaveStateSnapshot,
    restoreStateSnapshot,
    saveStateSnapshot,
} from "./persistentStateStore.runtime.js";
import { validateSnapshot } from "./persistentStateStore.validate.js";
import {
    buildSecurityExprRunners,
    driveSecurityExpressions,
} from "./request/securityExprRunner.js";
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
    /**
     * Replace the complete external-series feed map live. The swap is
     * recompute-free and affects the next `compute`; partial maps are not
     * merged with previous feeds.
     *
     * @since 1.9
     * @stable
     * @example
     *     // runner.setExternalSeries({ earnings: { values: [1, 2, 3] } });
     */
    setExternalSeries(feeds: ExternalSeriesFeedMap): void;
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
    readonly resolveExternalSeries?: (scriptId: string) => ExternalSeriesFeedMap;
    readonly externalSeriesFeeds?: ExternalSeriesFeedMap;
    readonly resolvePlotOverrides?: (scriptId: string) => Readonly<Record<string, PlotOverride>>;
    readonly plotOverrides?: Readonly<Record<string, PlotOverride>>;
};

function resolveCapacity(manifest: ScriptManifest): number {
    const { ohlcv, dynamicFallback } = manifest.seriesCapacities;
    const fallback = manifest.maxLookback + 1;
    // `dynamicFallback` is the compiler's §6.6 safety net: a non-literal
    // series index (e.g. `trend[LOOKBACK]` with `const LOOKBACK = 20`)
    // cannot be sized statically, so `extractMaxLookback` emits a 5000-slot
    // request instead of bumping `maxLookback`. Honour it here — otherwise
    // the buffer collapses to `maxLookback + 1` and every dynamic-index read
    // past slot 0 returns NaN (the "forecast line never drawn" bug).
    return Math.max(1, ohlcv ?? fallback, dynamicFallback ?? 0);
}

// A manifest produced BEFORE the multi-symbol feature has no `requestedFeeds`
// field but may carry `requestedIntervals`; projecting the interval list to
// symbol-omitted feeds keeps such a manifest mounting its main-symbol HTF
// streams. This `requestedFeeds ?? …` fallback is the apiVersion-1
// forward-compat seam; because `feedKey(undefined, iv) === iv`, the resulting
// keys equal today's interval keys exactly.
function legacyFeedsFromIntervals(manifest: ScriptManifest): RequestedFeed[] {
    return manifest.requestedIntervals.map((interval) => ({ interval }));
}

function createSecondaryStreams(
    manifest: ScriptManifest,
    capacity: number,
    chartSymbol: string,
): Map<string, StreamState> {
    const streams = new Map<string, StreamState>();
    const feeds = manifest.requestedFeeds ?? legacyFeedsFromIntervals(manifest);
    for (const feed of feeds) {
        // Collapse a feed whose symbol IS the chart symbol (omitted, or the
        // author passed the chart's own ticker explicitly) to `undefined`
        // BEFORE keying, mirroring `requestNamespace`'s resolution: `feedKey`
        // then yields the bare interval, so both spellings hit one stream and
        // the chart-symbol path stays byte-identical to the baseline. A
        // genuinely different symbol survives as `"<symbol>@<interval>"`.
        const resolved =
            feed.symbol === undefined || feed.symbol === chartSymbol ? undefined : feed.symbol;
        const key = feedKey(resolved, feed.interval);
        if (streams.has(key)) continue;
        const symbol = feed.symbol ?? chartSymbol;
        streams.set(key, createStreamState({ interval: feed.interval, capacity, symbol }));
    }
    return streams;
}

function externalSeriesDescriptors(
    manifest: ScriptManifest,
): ReadonlyArray<Readonly<{ inputKey: string; feedName: string }>> {
    const descriptors: Array<Readonly<{ inputKey: string; feedName: string }>> = [];
    for (const [inputKey, descriptor] of Object.entries(manifest.inputs)) {
        if (descriptor.kind === "external-series") {
            descriptors.push(Object.freeze({ inputKey, feedName: descriptor.name }));
        }
    }
    return Object.freeze(descriptors);
}

function externalSeriesFeedsFromInputOverrides(
    manifest: ScriptManifest,
    overrides: Readonly<Record<string, unknown>>,
): ExternalSeriesFeedMap {
    const feeds: Record<string, ExternalSeriesFeedMap[string]> = {};
    for (const [inputKey, descriptor] of Object.entries(manifest.inputs)) {
        if (descriptor.kind !== "external-series") continue;
        const override = overrides[inputKey];
        if (isExternalSeriesFeed(override)) feeds[descriptor.name] = override;
    }
    return replaceExternalSeriesFeedMap(feeds);
}

function resolveInitialExternalSeriesFeeds(
    args: CreateScriptRunnerArgs,
    manifest: ScriptManifest,
    inputOverrides: Readonly<Record<string, unknown>>,
): ExternalSeriesFeedMap {
    if (args.externalSeriesFeeds !== undefined) {
        return replaceExternalSeriesFeedMap(args.externalSeriesFeeds);
    }
    const resolved = args.resolveExternalSeries?.(manifest.name);
    if (resolved !== undefined) {
        return replaceExternalSeriesFeedMap(resolved);
    }
    return externalSeriesFeedsFromInputOverrides(manifest, inputOverrides);
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
    // The chart symbol is the adapter's `syminfo.ticker` when supplied — the
    // single existing mount-time source (the main stream's `symbol` is `""`
    // until bars flow). A symbol-omitted / explicit-chart-symbol request
    // collapses against this value to the bare-interval feed key.
    const chartSymbol = args.symInfo?.ticker ?? "";
    const mainStream = createStreamState({ interval: "", capacity, symbol: "" });
    const secondaryStreams = createSecondaryStreams(primary.manifest, capacity, chartSymbol);
    const stateStore = args.stateStore ?? inMemoryStateStore();
    const now = args.now ?? Date.now;
    const overrides =
        args.inputOverrides ?? args.resolveInputs?.(primary.manifest.name) ?? Object.freeze({});
    const externalSeriesSlots = createExternalSeriesSlots(
        externalSeriesDescriptors(primary.manifest),
        capacity,
    );
    const externalSeriesFeeds = resolveInitialExternalSeriesFeeds(
        args,
        primary.manifest,
        overrides,
    );
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
            seriesSlots: new Map(),
            arraySlots: new Map(),
            mapSlots: new Map(),
            objectSeriesSlots: new Map(),
            chartSymbol,
            secondaryStreams,
            requestSecurityBars: new Map(),
            requestSecurityAlignments: new Map(),
            requestSecurityAscendingBars: new Map(),
            requestLowerTfViews: new Map(),
            diagnosedRequestKeys: new Set(),
            diagnosedTzKeys: new Set(),
            alertConditions,
            diagnosedAlertConditionKeys: new Set(),
            logBudget: 0,
            logBudgetExceededDiagnosed: false,
            resolvedInputs: Object.freeze({}),
            externalSeriesFeeds,
            externalSeriesSlots,
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
    state.runtimeContext.securityExprRunnersByFeed = exprRunners.byFeed;
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
    const { chartSymbol } = primary.runtimeContext;
    const depRunners: DepRunner[] = bundle.dependencies.map((entry) =>
        createDepRunner({
            compiled: entry.compiled,
            localId: entry.localId,
            parentCapabilities: capabilities,
            chartSymbol,
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
            chartSymbol,
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
 * Capacity sizing follows PLAN §6.6: take the max of
 * `manifest.seriesCapacities.ohlcv` (compiler-emitted per-series
 * lookback) or the `manifest.maxLookback + 1` floor, and
 * `manifest.seriesCapacities.dynamicFallback` (the 5000-slot safety net the
 * compiler emits when a series is read at a non-literal index it cannot size
 * statically), clamped to a minimum of 1 so an empty-history script still has
 * a valid head slot.
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
        setExternalSeries(feeds) {
            state.runtimeContext.externalSeriesFeeds = replaceExternalSeriesFeedMap(feeds);
        },
        async dispose() {
            const finalSave = saveStateSnapshot(state, state.now());
            disposeImpl(state);
            await finalSave;
        },
    });
}

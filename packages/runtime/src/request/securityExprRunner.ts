// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Bar,
    ScriptManifest,
    SecurityBar,
    SecurityExpr,
    Series,
} from "@invinite-org/chartlang-core";
import { feedKey } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { Float64RingBuffer } from "../ringBuffer.js";
import { advanceSeriesSlots, commitSeriesSlots, resetSeriesHeads } from "../state/index.js";
import { inMemoryStateStore } from "../stateStore.js";
import {
    type StreamState,
    appendBarToStream,
    createStreamState,
    replaceStreamHead,
} from "../streamState.js";
import { createRuntimeViews } from "../views/index.js";
import { barFromStream, makeConstantStringSeries } from "./streamBars.js";

/**
 * One mounted higher-timeframe expression unit. The compiler records each
 * `request.security({ interval }, (bar) => …)` callsite in
 * `manifest.securityExpressions`; the runtime mounts one runner per entry.
 *
 * The runner owns a dedicated fold {@link StreamState} clocked on the HTF
 * `interval`, a `Float64RingBuffer` output buffer (one sampled value per HTF
 * bar), a fold {@link SecurityBar} view backed by the fold stream's head, and
 * a private {@link RuntimeContext} (`stream = foldStream`,
 * `slotIdPrefix = "security:<slotId>/"`) so `ta.*` inside the callback
 * accumulate on the HTF clock without colliding with the main stream.
 *
 * `callback` is captured lazily the first time the main compute body calls
 * `request.security(slotId, opts, expr)`. `processedHtfCount` tracks how many
 * HTF bars have already been folded into `output` so replay catches up history
 * exactly once.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const runner = createSecurityExprRunner({ slotId: "s#0", interval: "1W",
 *     //     capacity: 64, parent });
 *     const slotId = "s#0";
 *     void slotId;
 */
export type SecurityExprRunner = {
    readonly slotId: string;
    readonly interval: string;
    readonly foldStream: StreamState;
    readonly foldBar: SecurityBar;
    readonly ctx: RuntimeContext;
    readonly output: Float64RingBuffer;
    callback?: SecurityExpr;
    processedHtfCount: number;
};

/**
 * The pair of lookup maps the runtime threads onto its {@link RuntimeContext}:
 * `bySlot` keyed by `slotId` (overload dispatch + capture) and `byFeed` keyed
 * by the composite `feedKey(symbol, interval)` (the fan-out from a secondary
 * close, whose `streamKey` carries that same composite key).
 *
 * @since 0.7
 * @stable
 * @example
 *     const registry: SecurityExprRegistry = {
 *         bySlot: new Map(),
 *         byFeed: new Map(),
 *     };
 *     void registry;
 */
export type SecurityExprRegistry = {
    readonly bySlot: Map<string, SecurityExprRunner>;
    readonly byFeed: ReadonlyMap<string, ReadonlyArray<SecurityExprRunner>>;
};

function makeFoldBar(foldStream: StreamState, symbol: string, interval: string): SecurityBar {
    const { seriesViews } = foldStream;
    return Object.freeze({
        time: seriesViews.time,
        open: seriesViews.open,
        high: seriesViews.high,
        low: seriesViews.low,
        close: seriesViews.close,
        volume: seriesViews.volume,
        hl2: seriesViews.hl2,
        hlc3: seriesViews.hlc3,
        ohlc4: seriesViews.ohlc4,
        hlcc4: seriesViews.hlcc4,
        symbol: makeConstantStringSeries(symbol),
        interval: makeConstantStringSeries(interval),
    });
}

function buildExprContext(
    parent: RuntimeContext,
    slotId: string,
    foldStream: StreamState,
): RuntimeContext {
    return {
        stream: foldStream,
        stateStore: inMemoryStateStore(),
        lastPersistTime: 0,
        capabilities: parent.capabilities,
        // A throwaway bag — the callback may not emit (Task 2 forbids
        // non-`ta` refs), but an isolated queue guards if it somehow does.
        emissions: {
            plots: [],
            drawings: [],
            alerts: [],
            alertConditions: [],
            logs: [],
            diagnostics: [],
            fromBar: 0,
            toBar: 0,
        },
        barIndex: () => foldStream.ohlcv.close.length - 1,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
        seriesSlots: new Map(),
        arraySlots: new Map(),
        chartSymbol: parent.chartSymbol,
        secondaryStreams: parent.secondaryStreams,
        requestSecurityBars: new Map(),
        requestSecurityAlignments: new Map(),
        requestSecurityAscendingBars: new Map(),
        requestLowerTfViews: new Map(),
        diagnosedRequestKeys: new Set(),
        logBudget: 0,
        logBudgetExceededDiagnosed: false,
        resolvedInputs: parent.resolvedInputs,
        defaultPane: parent.defaultPane,
        scriptPane: parent.scriptPane,
        plotOverrides: Object.freeze({}),
        diagnosedInputKeys: new Set(),
        views: createRuntimeViews(),
        slotIdPrefix: `security:${slotId}/`,
    };
}

/**
 * Construct one {@link SecurityExprRunner}. The fold stream and output buffer
 * share the secondary stream's `capacity` so a deep-lookback callback
 * (`ta.sma(bar.close, 50)`) has enough HTF history to warm up.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const runner = createSecurityExprRunner({ slotId: "s#0",
 *     //     interval: "1W", capacity: 64, parent });
 *     const interval = "1W";
 *     void interval;
 */
export function createSecurityExprRunner(args: {
    readonly slotId: string;
    readonly symbol: string;
    readonly interval: string;
    readonly capacity: number;
    readonly parent: RuntimeContext;
}): SecurityExprRunner {
    const { slotId, symbol, interval, capacity, parent } = args;
    const foldStream = createStreamState({ interval, capacity, symbol });
    return {
        slotId,
        interval,
        foldStream,
        foldBar: makeFoldBar(foldStream, symbol, interval),
        ctx: buildExprContext(parent, slotId, foldStream),
        output: new Float64RingBuffer(capacity),
        processedHtfCount: 0,
    };
}

/**
 * Mount one runner per `manifest.securityExpressions` entry and return the
 * `bySlot` / `byFeed` lookup maps. Returns empty maps when the manifest
 * declares no expression callsites (the common single-timeframe case), so the
 * secondary-close drive pays a single empty-map check.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const registry = buildSecurityExprRunners(manifest, ctx, 64);
 *     const built = "bySlot + byFeed";
 *     void built;
 */
export function buildSecurityExprRunners(
    manifest: ScriptManifest,
    parent: RuntimeContext,
    capacity: number,
): SecurityExprRegistry {
    const bySlot = new Map<string, SecurityExprRunner>();
    const byFeed = new Map<string, SecurityExprRunner[]>();
    for (const descriptor of manifest.securityExpressions ?? []) {
        // Index by the composite feed key (the same key the secondary stream is
        // registered under and `CandleEvent.streamKey` carries). Collapse a
        // chart-symbol descriptor (omitted, or the chart's own ticker passed
        // explicitly) to `undefined` BEFORE keying — mirroring
        // `createSecondaryStreams` — so the omitted-symbol path stays
        // byte-identical to the pre-multi-symbol baseline. The fold stream
        // carries the RESOLVED symbol (chart symbol when omitted).
        const resolved =
            descriptor.symbol === undefined || descriptor.symbol === parent.chartSymbol
                ? undefined
                : descriptor.symbol;
        const key = feedKey(resolved, descriptor.interval);
        const runner = createSecurityExprRunner({
            slotId: descriptor.slotId,
            symbol: descriptor.symbol ?? parent.chartSymbol,
            interval: descriptor.interval,
            capacity,
            parent,
        });
        bySlot.set(descriptor.slotId, runner);
        const list = byFeed.get(key);
        if (list === undefined) {
            byFeed.set(key, [runner]);
        } else {
            list.push(runner);
        }
    }
    return { bySlot, byFeed };
}

function sampleOutput(result: Series<number> | number): number {
    return typeof result === "number" ? result : result.current;
}

function evaluate(runner: SecurityExprRunner, callback: SecurityExpr, isTick: boolean): number {
    const previous = ACTIVE_RUNTIME_CONTEXT.current;
    ACTIVE_RUNTIME_CONTEXT.current = runner.ctx;
    runner.ctx.isTick = isTick;
    // `state.series` inside the callback accumulates on the HTF clock, so it
    // advances/commits in lockstep with the fold stream — the same close/tick
    // discipline `runComputeBody` applies to the main compute.
    if (isTick) resetSeriesHeads(runner.ctx);
    else advanceSeriesSlots(runner.ctx);
    try {
        return sampleOutput(callback(runner.foldBar));
    } finally {
        if (!isTick) commitSeriesSlots(runner.ctx);
        runner.ctx.isTick = false;
        ACTIVE_RUNTIME_CONTEXT.current = previous;
    }
}

function foldClose(runner: SecurityExprRunner, bar: Bar): void {
    if (runner.callback === undefined) return;
    appendBarToStream(runner.foldStream, bar);
    runner.output.append(evaluate(runner, runner.callback, false));
    runner.processedHtfCount += 1;
}

function foldTick(runner: SecurityExprRunner, bar: Bar): void {
    if (runner.callback === undefined) return;
    replaceStreamHead(runner.foldStream, bar);
    runner.output.replaceHead(evaluate(runner, runner.callback, true));
}

/**
 * Drive every runner registered on the composite feed key `streamKey` for one
 * secondary event. `streamKey` is the `feedKey(symbol, interval)` the secondary
 * stream is registered under (and that `CandleEvent.streamKey` carries). A
 * `"close"` folds the bar into the fold stream and appends one sampled output;
 * a `"tick"` replaces the fold head and the output head without advancing
 * length. Runners whose callback is not yet captured are skipped — the first
 * main compute replays their backlog via {@link captureAndCatchUp}.
 *
 * @since 0.7
 * @stable
 * @example
 *     // driveSecurityExpressions(ctx, "1W", "close", weeklyBar);
 *     const mode = "close";
 *     void mode;
 */
export function driveSecurityExpressions(
    parent: RuntimeContext,
    streamKey: string,
    mode: "close" | "tick",
    bar: Bar,
): void {
    const runners = parent.securityExprRunnersByFeed?.get(streamKey);
    if (runners === undefined) return;
    for (const runner of runners) {
        if (mode === "close") {
            foldClose(runner, bar);
        } else {
            foldTick(runner, bar);
        }
    }
}

/**
 * Store the callback the first time main compute provides it, then replay the
 * real secondary stream oldest→newest through the runner's fold stream until
 * `processedHtfCount === secondary.length`. Idempotent once the backlog is
 * drained, so later calls in the same bar are no-ops.
 *
 * @since 0.7
 * @stable
 * @example
 *     // captureAndCatchUp(runner, expr, secondaryStream);
 *     const replayed = "oldest -> newest";
 *     void replayed;
 */
export function captureAndCatchUp(
    runner: SecurityExprRunner,
    expr: SecurityExpr,
    secondary: StreamState,
): void {
    if (runner.callback === undefined) runner.callback = expr;
    const length = secondary.ohlcv.close.length;
    while (runner.processedHtfCount < length) {
        const age = length - 1 - runner.processedHtfCount;
        foldClose(runner, barFromStream(secondary, age));
    }
}

/**
 * Materialise a `Float64RingBuffer`'s values oldest→newest. Used as the
 * `htfSeries` source when aligning a runner's output buffer to the main
 * timeline.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const values = ascendingValues(runner.output);
 *     const order = "oldest -> newest";
 *     void order;
 */
export function ascendingValues(buffer: Float64RingBuffer): ReadonlyArray<number> {
    const values: number[] = [];
    for (let age = buffer.length - 1; age >= 0; age -= 1) {
        values.push(buffer.at(age));
    }
    return values;
}

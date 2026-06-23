// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest, Series } from "@invinite-org/chartlang-core";
import { feedKey } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

import { appendSecondaryBar, replaceSecondaryHead } from "../execution/secondaryStream.js";
import { ema } from "../ta/ema.js";
import { sma } from "../ta/sma.js";
import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext.js";
import { inMemoryStateStore } from "../stateStore.js";
import { createStreamState } from "../streamState.js";
import { createRuntimeViews } from "../views/index.js";
import { makeSecurityExprSeries } from "./security.js";
import {
    type SecurityExprRunner,
    ascendingValues,
    buildSecurityExprRunners,
    captureAndCatchUp,
    createSecurityExprRunner,
    driveSecurityExpressions,
} from "./securityExprRunner.js";

const HTF = "1D";

function makeCapabilities(multiTimeframe: boolean, multiSymbol = false): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [{ value: HTF, label: "1 day", group: "daily" }],
        multiTimeframe,
        multiSymbol,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function makeEmissions(): MutableRunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        alertConditions: [],
        logs: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
}

function manifestWithExpr(slotId: string): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name: "htf-expr",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [HTF],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 64 },
        maxLookback: 63,
        securityExpressions: [{ slotId, interval: HTF, paramName: "bar" }],
    };
}

function makeContext(multiTimeframe = true, multiSymbol = false): RuntimeContext {
    const stream = createStreamState({ interval: "1m", capacity: 64, symbol: "AAPL" });
    const secondary = createStreamState({ interval: HTF, capacity: 64, symbol: "AAPL" });
    const ctx: RuntimeContext = {
        stream,
        stateStore: inMemoryStateStore(),
        lastPersistTime: 0,
        capabilities: makeCapabilities(multiTimeframe, multiSymbol),
        emissions: makeEmissions(),
        barIndex: () => stream.ohlcv.close.length - 1,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
        chartSymbol: "AAPL",
        secondaryStreams: new Map([[HTF, secondary]]),
        requestSecurityBars: new Map(),
        requestSecurityAlignments: new Map(),
        requestSecurityAscendingBars: new Map(),
        requestSecurityExprSeries: new Map(),
        requestLowerTfViews: new Map(),
        diagnosedRequestKeys: new Set(),
        diagnosedTzKeys: new Set(),
        logBudget: 0,
        logBudgetExceededDiagnosed: false,
        resolvedInputs: Object.freeze({}),
        defaultPane: "overlay",
        scriptPane: "script:htf",
        plotOverrides: Object.freeze({}),
        diagnosedInputKeys: new Set(),
        views: createRuntimeViews(),
    };
    return ctx;
}

function mountRunner(ctx: RuntimeContext, slotId: string): SecurityExprRunner {
    const built = buildSecurityExprRunners(manifestWithExpr(slotId), ctx, 64);
    ctx.securityExprRunners = built.bySlot;
    ctx.securityExprRunnersByFeed = built.byFeed;
    const runner = built.bySlot.get(slotId);
    if (runner === undefined) throw new Error("runner not mounted");
    return runner;
}

function htfBar(time: number, close: number): Bar {
    return {
        time,
        open: close,
        high: close + 1,
        low: close - 1,
        close,
        volume: 100,
        symbol: "AAPL",
        interval: HTF,
    };
}

function pushHtfClose(ctx: RuntimeContext, time: number, close: number): void {
    const stream = ctx.secondaryStreams.get(HTF);
    if (stream === undefined) throw new Error("missing secondary stream");
    const bar = htfBar(time, close);
    appendSecondaryBar(stream, bar);
    driveSecurityExpressions(ctx, HTF, "close", bar);
}

function pushMainClose(ctx: RuntimeContext, time: number, close: number): void {
    const s = ctx.stream;
    s.ohlcv.time.append(time);
    s.ohlcv.open.append(close);
    s.ohlcv.high.append(close);
    s.ohlcv.low.append(close);
    s.ohlcv.close.append(close);
    s.ohlcv.volume.append(1);
    s.ohlcv.hl2.append(close);
    s.ohlcv.hlc3.append(close);
    s.ohlcv.ohlc4.append(close);
    s.ohlcv.hlcc4.append(close);
    s.bar.time = time;
    s.bar.close = close;
}

/** Reference SMA-seeded EMA over a closed array, mirroring `ta/ema.ts`. */
function referenceEma(values: ReadonlyArray<number>, length: number): number[] {
    const alpha = 2 / (length + 1);
    const out: number[] = [];
    let prev = Number.NaN;
    let seedSum = 0;
    for (let i = 0; i < values.length; i += 1) {
        if (i < length - 1) {
            seedSum += values[i];
            out.push(Number.NaN);
        } else if (i === length - 1) {
            seedSum += values[i];
            prev = seedSum / length;
            out.push(prev);
        } else {
            prev = values[i] * alpha + prev * (1 - alpha);
            out.push(prev);
        }
    }
    return out;
}

const EMA_LENGTH = 3;

function emaCallback(slot: string): (bar: { close: Series<number> }) => Series<number> {
    return (bar) => ema(`${slot}/ema`, bar.close, EMA_LENGTH);
}

describe("buildSecurityExprRunners", () => {
    it("returns empty maps when the manifest declares no expressions", () => {
        const ctx = makeContext();
        const built = buildSecurityExprRunners(
            {
                apiVersion: 1,
                kind: "indicator",
                name: "plain",
                inputs: {},
                capabilities: ["indicators"],
                requestedIntervals: [],
                userPickableInterval: false,
                seriesCapacities: { ohlcv: 8 },
                maxLookback: 7,
            },
            ctx,
            8,
        );
        expect(built.bySlot.size).toBe(0);
        expect(built.byFeed.size).toBe(0);
    });

    it("indexes multiple runners on the same interval", () => {
        const ctx = makeContext();
        const manifest: ScriptManifest = {
            ...manifestWithExpr("a#0"),
            securityExpressions: [
                { slotId: "a#0", interval: HTF, paramName: "bar" },
                { slotId: "b#0", interval: HTF, paramName: "bar" },
            ],
        };
        const built = buildSecurityExprRunners(manifest, ctx, 64);
        expect(built.bySlot.size).toBe(2);
        expect(built.byFeed.get(HTF)).toHaveLength(2);
    });

    it("indexes a different-symbol descriptor under its composite feed key", () => {
        const ctx = makeContext();
        const manifest: ScriptManifest = {
            ...manifestWithExpr("spy#0"),
            securityExpressions: [
                // Chart symbol (omitted) collapses to the bare interval; the
                // explicit chart ticker collapses identically; a DIFFERENT
                // symbol keys as the composite `<symbol>@<interval>`.
                { slotId: "chart#0", interval: HTF, paramName: "bar" },
                { slotId: "explicit#0", symbol: "AAPL", interval: HTF, paramName: "bar" },
                { slotId: "spy#0", symbol: "AMEX:SPY", interval: HTF, paramName: "bar" },
            ],
        };
        const built = buildSecurityExprRunners(manifest, ctx, 64);
        expect(built.byFeed.get(HTF)).toHaveLength(2);
        expect(built.byFeed.get(feedKey("AMEX:SPY", HTF))).toHaveLength(1);
        expect(built.bySlot.get("spy#0")?.foldBar.symbol.current).toBe("AMEX:SPY");
    });
});

describe("driveSecurityExpressions + makeSecurityExprSeries", () => {
    afterEach(() => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
    });

    it("captures one EMA-over-HTF output per HTF close", () => {
        const slot = "expr#0";
        const ctx = makeContext();
        const runner = mountRunner(ctx, slot);
        captureAndCatchUp(
            runner,
            emaCallback(slot),
            ctx.secondaryStreams.get(HTF) ?? runner.foldStream,
        );

        const closes = [10, 12, 11, 14, 13, 16, 15, 18];
        closes.forEach((close, i) => pushHtfClose(ctx, i * 86_400_000, close));

        const expected = referenceEma(closes, EMA_LENGTH);
        const got = ascendingValues(runner.output);
        expect(got).toHaveLength(closes.length);
        got.forEach((value, i) => {
            if (Number.isNaN(expected[i])) expect(Number.isNaN(value)).toBe(true);
            else expect(value).toBeCloseTo(expected[i], 10);
        });
        expect(runner.processedHtfCount).toBe(closes.length);
    });

    it("returns a no-lookahead aligned main series that differs from a same-length main EMA", () => {
        const slot = "expr#1";
        const ctx = makeContext();
        const runner = mountRunner(ctx, slot);
        captureAndCatchUp(
            runner,
            emaCallback(slot),
            ctx.secondaryStreams.get(HTF) ?? runner.foldStream,
        );

        // 4 HTF (daily) bars; 8 main (intraday) bars, two per HTF bucket.
        const htfCloses = [10, 20, 30, 40];
        htfCloses.forEach((c, i) => pushHtfClose(ctx, i * 86_400_000, c));
        const mainCloses = [10, 11, 20, 21, 30, 31, 40, 41];
        mainCloses.forEach((c, i) => pushMainClose(ctx, i * 43_200_000, c));

        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const series = makeSecurityExprSeries(ctx, runner, HTF, false);

        // Stair-stepped: within an HTF bucket the value holds (the most recent
        // HTF EMA at or before the main bar's time).
        const htfEma = referenceEma(htfCloses, EMA_LENGTH);
        expect(series.length).toBe(mainCloses.length);
        // last two main bars fall in the 4th HTF bucket → htfEma[3]
        expect(series.current).toBeCloseTo(htfEma[3], 10);
        expect(series[1]).toBeCloseTo(htfEma[3], 10);
        // bars 5,4 (index from head) fall in the 3rd bucket → htfEma[2]
        expect(series[3]).toBeCloseTo(htfEma[2], 10);

        // Differs from a same-length EMA computed on the MAIN clock.
        const mainEma = referenceEma(mainCloses, EMA_LENGTH);
        expect(series.current).not.toBeCloseTo(mainEma[mainEma.length - 1], 6);
    });

    it("caches the returned Series identity per slot|interval within a bar", () => {
        const slot = "expr#cache";
        const ctx = makeContext();
        const runner = mountRunner(ctx, slot);
        captureAndCatchUp(
            runner,
            emaCallback(slot),
            ctx.secondaryStreams.get(HTF) ?? runner.foldStream,
        );
        pushHtfClose(ctx, 0, 10);
        pushMainClose(ctx, 0, 10);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        const first = makeSecurityExprSeries(ctx, runner, HTF, false);
        const second = makeSecurityExprSeries(ctx, runner, HTF, false);
        expect(second).toBe(first);
    });

    it("replays buffered HTF history on first capture (capture-after-close ordering)", () => {
        const slot = "expr#replay";
        const ctx = makeContext();
        const runner = mountRunner(ctx, slot);
        const secondary = ctx.secondaryStreams.get(HTF);
        if (secondary === undefined) throw new Error("missing stream");

        // Secondary closes arrive BEFORE the callback is captured — they only
        // buffer the real stream; the runner stays idle.
        const closes = [10, 12, 11, 14];
        closes.forEach((c, i) => pushHtfClose(ctx, i * 86_400_000, c));
        expect(runner.processedHtfCount).toBe(0);
        expect(runner.output.length).toBe(0);

        // First main compute captures the callback and replays history.
        captureAndCatchUp(runner, emaCallback(slot), secondary);
        const expected = referenceEma(closes, EMA_LENGTH);
        expect(ascendingValues(runner.output)).toHaveLength(closes.length);
        expect(runner.output.at(0)).toBeCloseTo(expected[expected.length - 1], 10);

        // A second capture is a no-op (backlog already drained).
        captureAndCatchUp(runner, emaCallback(slot), secondary);
        expect(runner.processedHtfCount).toBe(closes.length);
    });

    it("replaces the output head on a secondary tick without advancing length", () => {
        const slot = "expr#tick";
        const ctx = makeContext();
        const runner = mountRunner(ctx, slot);
        captureAndCatchUp(
            runner,
            emaCallback(slot),
            ctx.secondaryStreams.get(HTF) ?? runner.foldStream,
        );
        [10, 12, 11].forEach((c, i) => pushHtfClose(ctx, i * 86_400_000, c));
        const beforeLen = runner.output.length;
        const beforeHead = runner.output.at(0);

        const secondary = ctx.secondaryStreams.get(HTF);
        if (secondary === undefined) throw new Error("missing stream");
        const tick = htfBar(2 * 86_400_000, 20);
        replaceSecondaryHead(secondary, tick);
        driveSecurityExpressions(ctx, HTF, "tick", tick);

        expect(runner.output.length).toBe(beforeLen);
        expect(runner.output.at(0)).not.toBe(beforeHead);
    });

    it("does not drive runners on an interval with no registered runners", () => {
        const ctx = makeContext();
        const runner = mountRunner(ctx, "expr#x");
        captureAndCatchUp(
            runner,
            emaCallback("expr#x"),
            ctx.secondaryStreams.get(HTF) ?? runner.foldStream,
        );
        driveSecurityExpressions(ctx, "1W", "close", htfBar(0, 10));
        expect(runner.output.length).toBe(0);
    });

    it("skips runners whose callback is not captured yet", () => {
        const ctx = makeContext();
        const runner = mountRunner(ctx, "expr#nocb");
        driveSecurityExpressions(ctx, HTF, "close", htfBar(0, 10));
        driveSecurityExpressions(ctx, HTF, "tick", htfBar(0, 11));
        expect(runner.output.length).toBe(0);
        expect(runner.processedHtfCount).toBe(0);
    });

    it("samples a raw-number callback return into the output buffer", () => {
        const ctx = makeContext();
        const runner = mountRunner(ctx, "expr#num");
        captureAndCatchUp(
            runner,
            (bar) => bar.close.current * 2,
            ctx.secondaryStreams.get(HTF) ?? runner.foldStream,
        );
        [5, 7, 9].forEach((c, i) => pushHtfClose(ctx, i * 86_400_000, c));
        expect(ascendingValues(runner.output)).toEqual([10, 14, 18]);
    });

    it("produces finite output for a deep-lookback callback over enough HTF bars", () => {
        const slot = "expr#deep";
        const ctx = makeContext();
        const runner = mountRunner(ctx, slot);
        captureAndCatchUp(
            runner,
            (bar) => sma(`${slot}/sma`, bar.close, 50),
            ctx.secondaryStreams.get(HTF) ?? runner.foldStream,
        );
        for (let i = 0; i < 60; i += 1) pushHtfClose(ctx, i * 86_400_000, 100 + i);
        expect(Number.isFinite(runner.output.at(0))).toBe(true);
    });
});

describe("makeSecurityExprSeries fallbacks", () => {
    afterEach(() => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
    });

    it("returns an all-NaN series and one diagnostic when multiTimeframe is off", () => {
        const ctx = makeContext(false);
        const runner = mountRunner(ctx, "expr#nomtf");
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        const series = makeSecurityExprSeries(ctx, runner, HTF, false);
        expect(Number.isNaN(series.current)).toBe(true);
        // The NaN fallback is the zero-length sentinel series (matches
        // `makeNanSecurityBar`): indexed access reads `undefined`.
        expect(series[0]).toBeUndefined();
        expect(series.length).toBe(0);
        // Cache hit on the second call (no second diagnostic).
        makeSecurityExprSeries(ctx, runner, HTF, false);
        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "multi-timeframe-not-supported",
                message: "Adapter declares multiTimeframe: false; request.security returns NaN",
                slotId: "expr#nomtf",
                bar: -1,
            },
        ]);
    });

    it("emits unsupported-interval for an interval absent from capabilities", () => {
        const ctx = makeContext(true);
        // The runner's own interval (`1W`) is what the capability check reads;
        // mount it directly so the unsupported interval is the runner's, not an
        // arbitrary feed key.
        const runner = createSecurityExprRunner({
            slotId: "expr#badint",
            symbol: "",
            interval: "1W",
            capacity: 8,
            parent: ctx,
        });
        ctx.securityExprRunners = new Map([[runner.slotId, runner]]);
        ctx.secondaryStreams.set(
            "1W",
            createStreamState({ interval: "1W", capacity: 8, symbol: "" }),
        );
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        const series = makeSecurityExprSeries(ctx, runner, "1W", false);
        expect(Number.isNaN(series.current)).toBe(true);
        expect(ctx.emissions.diagnostics[0].code).toBe("unsupported-interval");
    });

    it("emits unknown-secondary-stream when no secondary stream is registered", () => {
        const ctx = makeContext(true);
        const runner = mountRunner(ctx, "expr#nostream");
        ctx.secondaryStreams.clear();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        const series = makeSecurityExprSeries(ctx, runner, HTF, false);
        expect(Number.isNaN(series.current)).toBe(true);
        expect(ctx.emissions.diagnostics[0].code).toBe("unknown-secondary-stream");
    });

    it("emits multi-symbol-not-supported once for a different symbol when multiSymbol is off", () => {
        // multiTimeframe ON, multiSymbol OFF: a DIFFERENT-symbol expression
        // request trips the symbol gate before any interval/stream check.
        const ctx = makeContext(true, false);
        const runner = mountRunner(ctx, "expr#nosym");
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const feed = feedKey("AMEX:SPY", HTF);

        const series = makeSecurityExprSeries(ctx, runner, feed, true);
        expect(Number.isNaN(series.current)).toBe(true);
        expect(series.length).toBe(0);
        // Cache hit on the second call → still one diagnostic.
        makeSecurityExprSeries(ctx, runner, feed, true);
        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "multi-symbol-not-supported",
                message:
                    "Adapter declares multiSymbol: false; request.security for a different symbol returns NaN",
                slotId: "expr#nosym",
                bar: -1,
            },
        ]);
    });

    it("allows a different symbol at the chart interval when multiSymbol is on", () => {
        const ctx = makeContext(true, true);
        const runner = mountRunner(ctx, "expr#sym");
        const feed = feedKey("AMEX:SPY", HTF);
        ctx.secondaryStreams.set(
            feed,
            createStreamState({ interval: HTF, capacity: 8, symbol: "AMEX:SPY" }),
        );
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        const series = makeSecurityExprSeries(ctx, runner, feed, true);
        // No symbol/timeframe diagnostic: the gate passed and the registered
        // (empty) stream yields an all-NaN-but-non-diagnostic aligned series.
        expect(ctx.emissions.diagnostics).toEqual([]);
        void series;
    });
});

describe("createSecurityExprRunner", () => {
    it("builds a fold stream and context on the declared interval", () => {
        const ctx = makeContext();
        const runner = createSecurityExprRunner({
            slotId: "r#0",
            symbol: "",
            interval: HTF,
            capacity: 8,
            parent: ctx,
        });
        expect(runner.foldStream.interval).toBe(HTF);
        expect(runner.ctx.stream).toBe(runner.foldStream);
        expect(runner.ctx.slotIdPrefix).toBe("security:r#0/");
        expect(runner.foldBar.interval.current).toBe(HTF);
        // Constant string series: zero length, indexed access mirrors current,
        // and the symbol series is the empty sentinel.
        expect(runner.foldBar.interval.length).toBe(0);
        expect(runner.foldBar.interval[0]).toBe(HTF);
        expect(runner.foldBar.symbol.current).toBe("");
        expect(runner.output.capacity).toBe(8);
        expect(runner.ctx.barIndex()).toBe(-1);
    });
});

describe("no-lookahead property", () => {
    it("every main bar reads the most recent HTF output at or before its time", () => {
        fc.assert(
            fc.property(
                fc.array(fc.double({ min: 1, max: 1000, noNaN: true }), {
                    minLength: 4,
                    maxLength: 20,
                }),
                fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 4, maxLength: 20 }),
                (htfCloses, subdivisions) => {
                    const slot = "prop#0";
                    const ctx = makeContext();
                    const runner = mountRunner(ctx, slot);
                    const secondary = ctx.secondaryStreams.get(HTF);
                    if (secondary === undefined) throw new Error("missing stream");
                    captureAndCatchUp(runner, emaCallback(slot), secondary);

                    const htfTimes: number[] = [];
                    htfCloses.forEach((c, i) => {
                        const time = i * 86_400_000;
                        htfTimes.push(time);
                        pushHtfClose(ctx, time, c);
                    });
                    const htfEma = referenceEma(htfCloses, EMA_LENGTH);

                    // Build main bars strictly inside / after each HTF bucket.
                    const mainTimes: number[] = [];
                    htfTimes.forEach((time, i) => {
                        const subs = subdivisions[i % subdivisions.length];
                        for (let k = 0; k < subs; k += 1) {
                            const mt = time + (k * 86_400_000) / (subs + 1);
                            mainTimes.push(mt);
                            pushMainClose(ctx, mt, htfCloses[i]);
                        }
                    });

                    ACTIVE_RUNTIME_CONTEXT.current = ctx;
                    const series = makeSecurityExprSeries(ctx, runner, HTF, false);
                    ACTIVE_RUNTIME_CONTEXT.current = null;

                    for (let head = 0; head < mainTimes.length; head += 1) {
                        const mainTime = mainTimes[mainTimes.length - 1 - head];
                        // Index of the latest HTF bar at or before this main bar.
                        let idx = -1;
                        for (let j = 0; j < htfTimes.length; j += 1) {
                            if (htfTimes[j] <= mainTime) idx = j;
                        }
                        const expected = idx === -1 ? Number.NaN : htfEma[idx];
                        const actual = series[head] as number;
                        if (Number.isNaN(expected)) {
                            expect(Number.isNaN(actual)).toBe(true);
                        } else {
                            expect(actual).toBeCloseTo(expected, 8);
                        }
                    }
                },
            ),
            { seed: 42, numRuns: 25 },
        );
    });
});

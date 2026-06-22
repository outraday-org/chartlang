// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type {
    Bar,
    RequestLowerTfOpts,
    RequestSecurityOpts,
    SecurityBar,
    Series,
} from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import { appendSecondaryBar } from "../execution/secondaryStream.js";
import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext.js";
import { inMemoryStateStore } from "../stateStore.js";
import { createStreamState } from "../streamState.js";
import { createRuntimeViews } from "../views/index.js";
import { buildRequestNamespace } from "./requestNamespace.js";

type RuntimeRequestNamespace = {
    readonly security: (
        slotId: string,
        opts: RequestSecurityOpts,
        expr?: (bar: SecurityBar) => Series<number> | number,
    ) => SecurityBar;
    readonly lowerTf: (slotId: string, opts: RequestLowerTfOpts) => Series<ReadonlyArray<Bar>>;
};

function makeCapabilities(multiTimeframe: boolean, multiSymbol = false): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [
            { value: "30s", label: "30 seconds", group: "second" },
            { value: "1m", label: "1 minute", group: "minute" },
            { value: "1D", label: "1 day", group: "daily" },
        ],
        multiTimeframe,
        multiSymbol,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: {
            lines: 0,
            labels: 0,
            boxes: 0,
            polylines: 0,
            other: 0,
        },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function makeEmissions(): MutableRunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
}

function makeContext(multiTimeframe = true, multiSymbol = true): RuntimeContext {
    const stream = createStreamState({ interval: "1m", capacity: 5, symbol: "AAPL" });
    stream.bar.time = 1_700_000_000_000;
    const secondary = createStreamState({ interval: "1D", capacity: 5, symbol: "AAPL" });
    const ltf = createStreamState({ interval: "30s", capacity: 10, symbol: "AAPL" });
    const secondaryStreams = new Map([
        ["1D", secondary],
        ["30s", ltf],
    ]);
    return {
        stream,
        stateStore: inMemoryStateStore(),
        capabilities: makeCapabilities(multiTimeframe, multiSymbol),
        emissions: makeEmissions(),
        barIndex: () => 3,
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
        scriptMaxDrawings: null,
        stateSlots: new Map(),
        chartSymbol: "AAPL",
        secondaryStreams,
        requestSecurityBars: new Map(),
        requestSecurityAlignments: new Map(),
        requestSecurityAscendingBars: new Map(),
        requestLowerTfViews: new Map(),
        diagnosedRequestKeys: new Set(),
        resolvedInputs: Object.freeze({}),
        diagnosedInputKeys: new Set(),
        views: createRuntimeViews(),
    };
}

function pushBars(ctx: RuntimeContext): void {
    appendSecondaryBar(
        ctx.secondaryStreams.get("1D") ??
            createStreamState({ interval: "1D", capacity: 5, symbol: "AAPL" }),
        {
            time: 1_700_000_000_000,
            open: 200,
            high: 205,
            low: 195,
            close: 202,
            volume: 10_000,
            symbol: "AAPL",
            interval: "1D",
        },
    );
    ctx.stream.ohlcv.time.append(1_700_000_000_000);
    ctx.stream.ohlcv.open.append(100);
    ctx.stream.ohlcv.high.append(101);
    ctx.stream.ohlcv.low.append(99);
    ctx.stream.ohlcv.close.append(100.5);
    ctx.stream.ohlcv.volume.append(1_000);
    ctx.stream.ohlcv.hl2.append(100);
    ctx.stream.ohlcv.hlc3.append(100.16666666666667);
    ctx.stream.ohlcv.ohlc4.append(100.125);
    ctx.stream.ohlcv.hlcc4.append(100.25);
}

function pushMainClose(ctx: RuntimeContext, time: number): void {
    ctx.stream.ohlcv.time.append(time);
    ctx.stream.ohlcv.open.append(100);
    ctx.stream.ohlcv.high.append(101);
    ctx.stream.ohlcv.low.append(99);
    ctx.stream.ohlcv.close.append(100.5);
    ctx.stream.ohlcv.volume.append(1_000);
    ctx.stream.ohlcv.hl2.append(100);
    ctx.stream.ohlcv.hlc3.append(100.16666666666667);
    ctx.stream.ohlcv.ohlc4.append(100.125);
    ctx.stream.ohlcv.hlcc4.append(100.25);
}

function pushLtfClose(ctx: RuntimeContext, time: number): void {
    const stream = ctx.secondaryStreams.get("30s");
    if (stream === undefined) throw new Error("missing 30s stream");
    appendSecondaryBar(stream, {
        time,
        open: 50,
        high: 51,
        low: 49,
        close: 50.5,
        volume: 500,
        symbol: "AAPL",
        interval: "30s",
    });
}

function runtimeRequest(): RuntimeRequestNamespace {
    return buildRequestNamespace() as unknown as RuntimeRequestNamespace;
}

describe("buildRequestNamespace", () => {
    afterEach(() => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
    });

    it("throws the runtime sentinel outside an active script step", () => {
        expect(() => runtimeRequest().security("slot#0", { interval: "1D" })).toThrow(
            "request.security called outside an active script step",
        );
    });

    it("returns a live aligned bar without diagnostics for known intervals when multi-timeframe is enabled", () => {
        const ctx = makeContext(true);
        pushBars(ctx);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        const bar = runtimeRequest().security("slot#0", { interval: "1D" });

        expect(bar.close.current).toBe(202);
        expect(bar.high.current).toBe(205);
        expect(bar.close[0]).toBe(202);
        expect(bar.symbol.current).toBe("AAPL");
        expect(bar.interval.current).toBe("1D");
        expect(ctx.emissions.diagnostics).toEqual([]);
    });

    it("returns NaN current values for known secondary streams before HTF bars arrive", () => {
        const ctx = makeContext(true);
        ctx.stream.ohlcv.time.append(1_700_000_000_000);
        ctx.stream.ohlcv.close.append(100);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        const bar = runtimeRequest().security("slot#0", { interval: "1D" });

        expect(Number.isNaN(bar.close.current)).toBe(true);
        expect(bar.close.length).toBe(1);
    });

    it("returns NaN for current and indexed access when no LTF alignment exists yet", () => {
        const ctx = makeContext(true);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        const bar = runtimeRequest().security("slot#0", { interval: "1D" });

        expect(Number.isNaN(bar.close.current)).toBe(true);
        expect(Number.isNaN(bar.close[0])).toBe(true);
        expect(bar.close.length).toBe(0);
    });

    it("emits unsupported-interval once per slot and interval", () => {
        const ctx = makeContext(true);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        const first = request.security("slot#0", { interval: "1W" });
        const second = request.security("slot#0", { interval: "1W" });

        expect(second).toBe(first);
        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "unsupported-interval",
                message: 'Requested interval "1W" is not in Capabilities.intervals',
                slotId: "slot#0",
                bar: 3,
            },
        ]);
    });

    it("emits multi-timeframe-not-supported once for supported intervals when disabled", () => {
        const ctx = makeContext(false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        request.security("slot#0", { interval: "1D" });
        request.security("slot#0", { interval: "1D" });

        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "multi-timeframe-not-supported",
                message: "Adapter declares multiTimeframe: false; request.security returns NaN",
                slotId: "slot#0",
                bar: 3,
            },
        ]);
    });

    it("emits unknown-secondary-stream once when the manifest did not register the interval", () => {
        const ctx = makeContext(true);
        ctx.secondaryStreams.clear();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        request.security("slot#0", { interval: "1D" });
        ctx.requestSecurityBars.clear();
        request.security("slot#0", { interval: "1D" });

        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "unknown-secondary-stream",
                message: 'Requested interval "1D" has no registered secondary stream',
                slotId: "slot#0",
                bar: 3,
            },
        ]);
    });

    it("keeps distinct SecurityBar identities and diagnostics for different slots", () => {
        const ctx = makeContext(false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        const left = request.security("slot#0", { interval: "1D" });
        const right = request.security("slot#1", { interval: "1D" });

        expect(left).not.toBe(right);
        expect(ctx.emissions.diagnostics.map((diagnostic) => diagnostic.slotId)).toEqual([
            "slot#0",
            "slot#1",
        ]);
    });

    it("uses interval as part of the cache and diagnostic dedupe key", () => {
        const ctx = makeContext(false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        const first = request.security("slot#0", { interval: "1m" });
        const second = request.security("slot#0", { interval: "1D" });

        expect(first).not.toBe(second);
        expect(ctx.emissions.diagnostics).toHaveLength(2);
        expect(ctx.diagnosedRequestKeys).toEqual(
            new Set([
                "multi-timeframe-not-supported|slot#0|1m|security",
                "multi-timeframe-not-supported|slot#0|1D|security",
            ]),
        );
    });

    it("returns bucketed lower timeframe bars", () => {
        const ctx = makeContext(true);
        pushMainClose(ctx, 0);
        pushMainClose(ctx, 60_000);
        pushMainClose(ctx, 120_000);
        pushLtfClose(ctx, 0);
        pushLtfClose(ctx, 30_000);
        pushLtfClose(ctx, 60_000);
        pushLtfClose(ctx, 90_000);
        pushLtfClose(ctx, 120_000);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        const series = runtimeRequest().lowerTf("slot#ltf", { interval: "30s" });

        expect(series.current.map((bar) => bar.time)).toEqual([120_000]);
        expect(series[1].map((bar) => bar.time)).toEqual([60_000, 90_000]);
        expect(series[2].map((bar) => bar.time)).toEqual([0, 30_000]);
        expect(series[10]).toEqual([]);
        expect(series.length).toBe(3);
        expect(runtimeRequest().lowerTf("slot#ltf", { interval: "30s" })).toBe(series);
    });

    it("returns empty lower timeframe buckets with deduped diagnostics", () => {
        const ctx = makeContext(false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        expect(request.lowerTf("slot#ltf", { interval: "30s" }).current).toEqual([]);
        expect(request.lowerTf("slot#ltf", { interval: "30s" }).current).toEqual([]);

        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "multi-timeframe-not-supported",
                message:
                    "Adapter declares multiTimeframe: false; request.lowerTf returns empty buckets",
                slotId: "slot#ltf",
                bar: 3,
            },
        ]);
    });

    it("emits unsupported-interval once for lower timeframe requests", () => {
        const ctx = makeContext(true);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        expect(request.lowerTf("slot#ltf", { interval: "15s" }).current).toEqual([]);
        expect(request.lowerTf("slot#ltf", { interval: "15s" }).current).toEqual([]);

        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "unsupported-interval",
                message: 'Requested interval "15s" is not in Capabilities.intervals',
                slotId: "slot#ltf",
                bar: 3,
            },
        ]);
    });

    it("emits unknown-secondary-stream once for unregistered lower timeframe streams", () => {
        const ctx = makeContext(true);
        ctx.secondaryStreams.clear();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        expect(request.lowerTf("slot#ltf", { interval: "30s" }).current).toEqual([]);
        expect(request.lowerTf("slot#ltf", { interval: "30s" }).current).toEqual([]);

        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "unknown-secondary-stream",
                message: 'Requested interval "30s" has no registered secondary stream',
                slotId: "slot#ltf",
                bar: 3,
            },
        ]);
    });

    it("does not re-emit when the diagnostic key is already known", () => {
        const ctx = makeContext(false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        request.security("slot#0", { interval: "1D" });
        ctx.requestSecurityBars.clear();
        const next = request.security("slot#0", { interval: "1D" });

        expect(Number.isNaN(next.close.current)).toBe(true);
        expect(ctx.emissions.diagnostics).toHaveLength(1);
    });

    it("routes a different-symbol request to its composite feed and back-compat collapses the chart symbol", () => {
        const ctx = makeContext(true);
        // SPY @ 1D registered under the composite key; AAPL @ 1D under the bare
        // interval (chart symbol). `feedKey` builds both.
        const spy = createStreamState({ interval: "1D", capacity: 5, symbol: "AMEX:SPY" });
        appendSecondaryBar(spy, {
            time: 1_700_000_000_000,
            open: 400,
            high: 405,
            low: 395,
            close: 402,
            volume: 5_000,
            symbol: "AMEX:SPY",
            interval: "1D",
        });
        ctx.secondaryStreams.set("AMEX:SPY@1D", spy);
        pushBars(ctx);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        const spyBar = request.security("slot#0", { symbol: "AMEX:SPY", interval: "1D" });
        const aaplOmitted = request.security("slot#1", { interval: "1D" });
        // Passing the chart's own ticker explicitly must collapse to the bare
        // interval — the SAME cached bar as the omitted-symbol form, no
        // duplicate stream allocation.
        const aaplExplicit = request.security("slot#1", { symbol: "AAPL", interval: "1D" });

        // Two distinct symbols do not cross-talk.
        expect(spyBar.close.current).toBe(402);
        expect(spyBar.symbol.current).toBe("AMEX:SPY");
        expect(aaplOmitted.close.current).toBe(202);
        expect(aaplOmitted.symbol.current).toBe("AAPL");
        // Explicit chart symbol === omitted: identical cached SecurityBar.
        expect(aaplExplicit).toBe(aaplOmitted);
        expect(ctx.emissions.diagnostics).toEqual([]);
    });

    it("keys the diagnostic dedupe per feed: same interval, different symbols emit twice", () => {
        const ctx = makeContext(false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        request.security("slot#0", { interval: "1D" });
        request.security("slot#0", { symbol: "AMEX:SPY", interval: "1D" });

        expect(ctx.emissions.diagnostics).toHaveLength(2);
        expect(ctx.diagnosedRequestKeys).toEqual(
            new Set([
                "multi-timeframe-not-supported|slot#0|1D|security",
                "multi-timeframe-not-supported|slot#0|AMEX:SPY@1D|security",
            ]),
        );
    });

    it("returns an all-NaN bar with one multi-symbol-not-supported when multiSymbol is off", () => {
        // multiTimeframe ON, multiSymbol OFF: a DIFFERENT symbol trips the
        // symbol gate first and returns NaN with a single deduped diagnostic.
        const ctx = makeContext(true, false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        const first = request.security("slot#0", { symbol: "AMEX:SPY", interval: "1D" });
        const second = request.security("slot#0", { symbol: "AMEX:SPY", interval: "1D" });

        expect(Number.isNaN(first.close.current)).toBe(true);
        // Cache hit: same SecurityBar identity, one diagnostic.
        expect(second).toBe(first);
        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "multi-symbol-not-supported",
                message:
                    "Adapter declares multiSymbol: false; request.security for a different symbol returns NaN",
                slotId: "slot#0",
                bar: 3,
            },
        ]);
    });

    it("leaves a chart-symbol request on the multiTimeframe gate when multiSymbol is off", () => {
        // multiTimeframe OFF, multiSymbol OFF: an omitted symbol (chart symbol)
        // must NOT trip the symbol gate — it stays multiTimeframe-gated,
        // byte-identical to the pre-multi-symbol baseline.
        const ctx = makeContext(false, false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        request.security("slot#0", { interval: "1D" });

        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "multi-timeframe-not-supported",
                message: "Adapter declares multiTimeframe: false; request.security returns NaN",
                slotId: "slot#0",
                bar: 3,
            },
        ]);
    });

    it("trips the symbol gate before the timeframe gate for a both-different request", () => {
        // Different symbol AND different interval against multiSymbol:false:
        // ONE multi-symbol-not-supported, not also multi-timeframe-not-supported.
        const ctx = makeContext(false, false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        request.security("slot#0", { symbol: "AMEX:SPY", interval: "1m" });

        expect(ctx.emissions.diagnostics).toHaveLength(1);
        expect(ctx.diagnosedRequestKeys).toEqual(
            new Set(["multi-symbol-not-supported|slot#0|AMEX:SPY@1m|security"]),
        );
    });

    it("dedupes multi-symbol-not-supported per feed: two unsupported symbols warn twice", () => {
        const ctx = makeContext(true, false);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        request.security("slot#0", { symbol: "AMEX:SPY", interval: "1D" });
        request.security("slot#0", { symbol: "NASDAQ:QQQ", interval: "1D" });

        expect(ctx.emissions.diagnostics).toHaveLength(2);
        expect(ctx.diagnosedRequestKeys).toEqual(
            new Set([
                "multi-symbol-not-supported|slot#0|AMEX:SPY@1D|security",
                "multi-symbol-not-supported|slot#0|NASDAQ:QQQ@1D|security",
            ]),
        );
    });

    it("allows a different symbol at a different interval only via multiTimeframe", () => {
        // multiSymbol ON, multiTimeframe OFF: the symbol gate passes; the
        // different interval still needs multiTimeframe and trips its diagnostic.
        const ctx = makeContext(false, true);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const request = runtimeRequest();

        request.security("slot#0", { symbol: "AMEX:SPY", interval: "1D" });

        expect(ctx.emissions.diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "multi-timeframe-not-supported",
                message: "Adapter declares multiTimeframe: false; request.security returns NaN",
                slotId: "slot#0",
                bar: 3,
            },
        ]);
    });

    it("falls back to NaN numeric series when a defensive numeric lookup misses", () => {
        const ctx = makeContext(true);
        pushBars(ctx);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const originalGet = Map.prototype.get;
        const missing = new Set([
            "time",
            "open",
            "high",
            "low",
            "close",
            "volume",
            "hl2",
            "hlc3",
            "ohlc4",
            "hlcc4",
        ]);
        Map.prototype.get = function patchedGet(this: Map<unknown, unknown>, key: unknown) {
            if (missing.has(String(key))) {
                return undefined;
            }
            return originalGet.call(this, key);
        };
        try {
            const bar = runtimeRequest().security("slot#0", { interval: "1D" });
            expect(Number.isNaN(bar.time.current)).toBe(true);
            expect(Number.isNaN(bar.open.current)).toBe(true);
            expect(Number.isNaN(bar.high.current)).toBe(true);
            expect(Number.isNaN(bar.low.current)).toBe(true);
            expect(Number.isNaN(bar.volume.current)).toBe(true);
            expect(Number.isNaN(bar.hl2.current)).toBe(true);
            expect(Number.isNaN(bar.hlc3.current)).toBe(true);
            expect(Number.isNaN(bar.ohlc4.current)).toBe(true);
            expect(Number.isNaN(bar.hlcc4.current)).toBe(true);
            expect(Number.isNaN(bar.close.current)).toBe(true);
            expect(bar.close.length).toBe(0);
            expect(bar.symbol.length).toBe(0);
            expect(bar.symbol[0]).toBe("AAPL");
        } finally {
            Map.prototype.get = originalGet;
        }
    });
});

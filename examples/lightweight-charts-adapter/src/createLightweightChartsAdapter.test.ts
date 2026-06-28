// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CandleEvent,
    DrawingEmission,
    PlotEmission,
    PlotStyle,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";
import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import type { ScriptHost } from "@invinite-org/chartlang-host-worker";
import { describe, expect, it, vi } from "vitest";

import {
    type LwcAdapterHandle,
    createLightweightChartsAdapter,
    runRendererLoop,
} from "./createLightweightChartsAdapter.js";
import { MockLwcApi } from "./testing.js";

// ---------------------------------------------------------------------------
// Builders — all emissions are valid per adapter-kit `validateEmission`.
// ---------------------------------------------------------------------------

function bar(time: number, close = 10): Bar {
    return {
        time,
        open: close,
        high: close + 1,
        low: close - 1,
        close,
        volume: 100,
        symbol: "DEMO",
        interval: "1D",
        hl2: close,
        hlc3: close,
        ohlc4: close,
        hlcc4: close,
    };
}

// A candle source over an explicit event list (`mockCandleSource` only
// yields bars; the factory needs close / tick / streamKey / history shapes).
function eventSource(events: ReadonlyArray<CandleEvent>): AsyncIterable<CandleEvent> {
    return {
        async *[Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
            for (const e of events) yield e;
        },
    };
}

function plot(style: PlotStyle, overrides: Partial<PlotEmission> = {}): PlotEmission {
    return {
        kind: "plot",
        slotId: overrides.slotId ?? "demo.ts:1:1#0",
        title: "Demo",
        style,
        bar: 0,
        time: 1_000,
        value: 42,
        color: "#3b82f6",
        meta: {},
        pane: "overlay",
        ...overrides,
    };
}

function emissions(overrides: Partial<RunnerEmissions> = {}): RunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        alertConditions: [],
        logs: [],
        diagnostics: [],
        ...overrides,
    };
}

const LINE_STYLE: PlotStyle = { kind: "line", lineWidth: 1, lineStyle: "solid" };

function stubHost(): ScriptHost {
    return {
        load: vi.fn(async () => {}),
        push: vi.fn(async () => {}),
        setPlotOverrides: vi.fn(),
        drain: vi.fn(async () => emissions()),
        dispose: vi.fn(),
        limits: {
            maxHeapBytes: 0,
            maxCpuMsPerStep: 0,
            maxRingBufferBars: 0,
            maxLoadTimeoutMs: 0,
        },
    };
}

function build(overrides: Partial<Parameters<typeof createLightweightChartsAdapter>[0]> = {}): {
    handle: LwcAdapterHandle;
    chart: MockLwcApi;
} {
    const chart = new MockLwcApi();
    const handle = createLightweightChartsAdapter({
        chartApi: chart,
        candleSource: mockCandleSource([]),
        host: stubHost(),
        ...overrides,
    });
    return { handle, chart };
}

// Drive a single bar + one drained frame of `plots` through the loop.
async function runWithPlots(
    plots: PlotEmission[],
    events: ReadonlyArray<CandleEvent> = [{ kind: "close", bar: bar(1) }],
): Promise<MockLwcApi> {
    const chart = new MockLwcApi();
    const host = stubHost();
    (host.drain as ReturnType<typeof vi.fn>).mockResolvedValue(emissions({ plots }));
    const handle = createLightweightChartsAdapter({
        chartApi: chart,
        candleSource: eventSource(events),
        host,
    });
    await runRendererLoop(handle);
    return chart;
}

describe("createLightweightChartsAdapter — construction", () => {
    it("resolves the injected chartApi seam", () => {
        const { handle } = build();
        expect(handle.id).toBe("lightweight-charts-reference");
        expect(handle.host).toBeDefined();
    });

    it("builds a chart from a container via an injected createChart", () => {
        const chart = new MockLwcApi();
        const container = { tagName: "DIV" } as unknown as HTMLElement;
        const createChart = vi.fn(() => chart);
        const handle = createLightweightChartsAdapter({
            container,
            createChart,
            candleSource: mockCandleSource([]),
            host: stubHost(),
        });
        expect(createChart).toHaveBeenCalledWith(container);
        expect(handle.id).toBe("lightweight-charts-reference");
    });

    it("uses the real createChart fallback when only a container is given (throws in Node)", () => {
        // No `opts.createChart` → the `?? defaultCreateChart` fallback runs the
        // real lightweight-charts `createChart`, which needs a DOM and throws
        // here. This lights the fallback branch without a browser.
        expect(() =>
            createLightweightChartsAdapter({
                container: { tagName: "DIV" } as unknown as HTMLElement,
                candleSource: mockCandleSource([]),
                host: stubHost(),
            }),
        ).toThrow();
    });

    it("throws when neither chartApi nor container is supplied", () => {
        expect(() =>
            createLightweightChartsAdapter({
                candleSource: mockCandleSource([]),
                host: stubHost(),
            }),
        ).toThrow(/opts.chartApi/);
    });

    it("builds a real worker host via the workerLike seam (no resolveInputs)", () => {
        const channel = new MessageChannel();
        const worker = {
            addEventListener: () => {},
            postMessage: () => {},
            terminate: () => {
                channel.port1.close();
                channel.port2.close();
            },
        };
        const { handle } = build({ host: undefined, workerLike: worker });
        expect(handle.resolveInputs).toBeUndefined();
        expect(handle.host.limits.maxCpuMsPerStep).toBeGreaterThan(0);
        handle.dispose?.();
    });

    it("threads resolveInputs through the workerLike branch", () => {
        const channel = new MessageChannel();
        const worker = {
            addEventListener: () => {},
            postMessage: () => {},
            terminate: () => {
                channel.port1.close();
                channel.port2.close();
            },
        };
        const { handle } = build({
            host: undefined,
            workerLike: worker,
            resolveInputs: () => ({ len: 9 }),
        });
        expect(handle.resolveInputs?.("x")).toEqual({ len: 9 });
        handle.dispose?.();
    });

    it("falls back to a default Worker (throws in Node) with and without resolveInputs", () => {
        // The no-workerLike branch calls the real `new Worker(...)`, which is
        // undefined in Node — asserting the throw lights up both sub-branches
        // (resolveInputs supplied / omitted) of the worker-host construction.
        expect(() =>
            createLightweightChartsAdapter({
                chartApi: new MockLwcApi(),
                candleSource: mockCandleSource([]),
                resolveInputs: () => ({ len: 5 }),
            }),
        ).toThrow();
        expect(() =>
            createLightweightChartsAdapter({
                chartApi: new MockLwcApi(),
                candleSource: mockCandleSource([]),
            }),
        ).toThrow();
    });
});

describe("createLightweightChartsAdapter — candle ingestion", () => {
    it("maps history → candlestick setData", async () => {
        const chart = new MockLwcApi();
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([{ kind: "history", bars: [bar(1), bar(2)] }]),
            host: stubHost(),
        });
        await runRendererLoop(handle);
        expect(chart.calls).toContainEqual({
            kind: "addSeries",
            seriesId: "s0",
            seriesType: "Candlestick",
            paneIndex: 0,
            options: {},
        });
        expect(chart.calls).toContainEqual({ kind: "setData", seriesId: "s0", points: 2 });
    });

    // Regression: candleData() must produce OHLC, not { time, value }.
    // lightweight-charts throws "Value is undefined" when open/high/low/close
    // are absent from a Candlestick series data point.
    it("candlestick update carries OHLC fields, not a scalar value", async () => {
        const chart = new MockLwcApi();
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([{ kind: "close", bar: bar(1, 10) }]),
            host: stubHost(),
        });
        await runRendererLoop(handle);
        const candleUpdate = chart.calls.find((c) => c.kind === "update" && c.seriesId === "s0");
        expect(candleUpdate).toBeDefined();
        expect(candleUpdate?.kind === "update" && candleUpdate.open).toBe(10);
        expect(candleUpdate?.kind === "update" && candleUpdate.high).toBe(11);
        expect(candleUpdate?.kind === "update" && candleUpdate.low).toBe(9);
        expect(candleUpdate?.kind === "update" && candleUpdate.close).toBe(10);
    });

    it("maps close → update and tick → first-then-update last bar", async () => {
        const chart = new MockLwcApi();
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([
                { kind: "close", bar: bar(1) },
                { kind: "tick", bar: bar(2, 11) },
                { kind: "tick", bar: bar(2, 12) },
            ]),
            host: stubHost(),
        });
        await runRendererLoop(handle);
        const updates = chart.calls.filter((c) => c.kind === "update");
        expect(updates).toHaveLength(3);
    });

    it("maps a leading tick (no prior bar) by appending it", async () => {
        const chart = new MockLwcApi();
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([
                { kind: "tick", bar: bar(1, 9) },
                { kind: "tick", bar: bar(1, 10) },
            ]),
            host: stubHost(),
        });
        await runRendererLoop(handle);
        // First tick appends, second replaces the in-progress bar → 2 updates.
        expect(chart.calls.filter((c) => c.kind === "update")).toHaveLength(2);
    });

    it("ignores secondary-stream candle events", async () => {
        const chart = new MockLwcApi();
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([{ kind: "close", bar: bar(1), streamKey: "1W" }]),
            host: stubHost(),
        });
        await runRendererLoop(handle);
        expect(chart.calls).toEqual([]);
    });
});

describe("createLightweightChartsAdapter — plot mapping", () => {
    it("line / step-line / area / histogram create native series and update", async () => {
        const chart = await runWithPlots([
            plot({ kind: "line", lineWidth: 1, lineStyle: "solid" }, { slotId: "a" }),
            plot({ kind: "step-line", lineWidth: 1, lineStyle: "solid" }, { slotId: "b" }),
            plot(
                { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.2 },
                { slotId: "c" },
            ),
            plot({ kind: "histogram", baseline: 0 }, { slotId: "d" }),
        ]);
        const types = chart.calls
            .filter((c) => c.kind === "addSeries")
            .map((c) => (c.kind === "addSeries" ? c.seriesType : ""));
        expect(types).toContain("Line");
        expect(types).toContain("Area");
        expect(types).toContain("Histogram");
        expect(chart.calls.some((c) => c.kind === "update" && c.seriesId !== "s0")).toBe(true);
    });

    it("reuses one series per slot across frames", async () => {
        const chart = new MockLwcApi();
        const host = stubHost();
        (host.drain as ReturnType<typeof vi.fn>).mockResolvedValue(
            emissions({ plots: [plot(LINE_STYLE, { slotId: "reuse" })] }),
        );
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([
                { kind: "close", bar: bar(1) },
                { kind: "close", bar: bar(2) },
            ]),
            host,
        });
        await runRendererLoop(handle);
        const lines = chart.calls.filter((c) => c.kind === "addSeries" && c.seriesType === "Line");
        expect(lines).toHaveLength(1);
    });

    it("visible:false hides the series instead of removing it", async () => {
        const chart = await runWithPlots([plot(LINE_STYLE, { slotId: "h", visible: false })]);
        expect(chart.calls).toContainEqual({
            kind: "applyOptions",
            seriesId: expect.any(String),
            options: { visible: false },
        });
    });

    it("null plot value becomes a whitespace update point", async () => {
        const chart = await runWithPlots([plot(LINE_STYLE, { slotId: "n", value: null })]);
        expect(chart.calls.some((c) => c.kind === "update" && c.value === null)).toBe(true);
    });

    it("null plot color still creates the line series", async () => {
        const chart = await runWithPlots([plot(LINE_STYLE, { slotId: "nc", color: null })]);
        expect(chart.calls.some((c) => c.kind === "addSeries" && c.seriesType === "Line")).toBe(
            true,
        );
    });

    // Regression: the plot's `color` MUST be forwarded as a series-creation
    // option, otherwise the native line falls back to lightweight-charts'
    // default series colour (every plotted line drew the same blue, ignoring
    // the script's `plot(..., { color })`). The colour lives ONLY at
    // `addSeries` (the factory never re-`applyOptions`es it), so assert it
    // there.
    it("forwards the plot color to the line series creation options", async () => {
        const chart = await runWithPlots([plot(LINE_STYLE, { slotId: "c", color: "#26a69a" })]);
        const line = chart.calls.find((c) => c.kind === "addSeries" && c.seriesType === "Line");
        // The emission's line width (compiler default 1) rides alongside the
        // colour so the native line is thin/consistent, not LC's default-3.
        // Plain `line` plots also carry `lineType: 2` (Curved) for smoothing.
        expect(line?.kind === "addSeries" && line.options).toEqual({
            color: "#26a69a",
            lineWidth: 1,
            lineType: 2,
        });
    });

    it("a null plot color carries only the line width in the series options", async () => {
        const chart = await runWithPlots([plot(LINE_STYLE, { slotId: "nco", color: null })]);
        const line = chart.calls.find((c) => c.kind === "addSeries" && c.seriesType === "Line");
        expect(line?.kind === "addSeries" && line.options).toEqual({ lineWidth: 1, lineType: 2 });
    });

    it("forwards the emission's line width to line / area / step-line series", async () => {
        const chart = await runWithPlots([
            plot({ kind: "line", lineWidth: 2, lineStyle: "solid" }, { slotId: "l", color: null }),
            plot(
                { kind: "step-line", lineWidth: 4, lineStyle: "solid" },
                { slotId: "s", color: null },
            ),
            plot(
                { kind: "area", lineWidth: 5, lineStyle: "solid", fillAlpha: 0.2 },
                { slotId: "a", color: null },
            ),
        ]);
        const widthFor = (seriesType: string): unknown => {
            const call = chart.calls.find(
                (c) => c.kind === "addSeries" && c.seriesType === seriesType,
            );
            return call?.kind === "addSeries" ? call.options.lineWidth : undefined;
        };
        expect(widthFor("Line")).toBe(2);
        expect(widthFor("Area")).toBe(5);
    });

    it("a histogram series carries no line width (LC histograms have none)", async () => {
        const chart = await runWithPlots([
            plot({ kind: "histogram", baseline: 0 }, { slotId: "h", color: null }),
        ]);
        const hist = chart.calls.find(
            (c) => c.kind === "addSeries" && c.seriesType === "Histogram",
        );
        expect(hist?.kind === "addSeries" && "lineWidth" in hist.options).toBe(false);
    });

    it("filled-band creates two line series and updates both edges", async () => {
        const chart = await runWithPlots([
            plot({ kind: "filled-band", upper: 5, lower: 1, alpha: 0.2 }, { slotId: "band" }),
        ]);
        const lines = chart.calls.filter((c) => c.kind === "addSeries" && c.seriesType === "Line");
        expect(lines).toHaveLength(2);
    });

    it("filled-band forwards plot.color to BOTH edge series", async () => {
        const chart = await runWithPlots([
            plot(
                { kind: "filled-band", upper: 5, lower: 1, alpha: 0.2 },
                { slotId: "band", color: "#26a69a" },
            ),
        ]);
        const lines = chart.calls.filter((c) => c.kind === "addSeries" && c.seriesType === "Line");
        expect(lines).toHaveLength(2);
        for (const line of lines) {
            expect(line.kind === "addSeries" && line.options).toEqual({ color: "#26a69a" });
        }
    });

    it("filled-band with a null color records no colour on its edges", async () => {
        const chart = await runWithPlots([
            plot(
                { kind: "filled-band", upper: 5, lower: 1, alpha: 0.2 },
                { slotId: "band", color: null },
            ),
        ]);
        const lines = chart.calls.filter((c) => c.kind === "addSeries" && c.seriesType === "Line");
        for (const line of lines) {
            expect(line.kind === "addSeries" && line.options).toEqual({});
        }
    });

    it("area folds fillAlpha into lineColor + top/bottom gradient", async () => {
        const chart = await runWithPlots([
            plot(
                { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.3 },
                { slotId: "ar", color: "#26a69a" },
            ),
        ]);
        const area = chart.calls.find((c) => c.kind === "addSeries" && c.seriesType === "Area");
        expect(area?.kind === "addSeries" && area.options).toMatchObject({
            lineColor: "#26a69a",
            topColor: "rgba(38, 166, 154, 0.3)",
            bottomColor: "rgba(38, 166, 154, 0)",
        });
    });

    it("area with a null color records no colour fields", async () => {
        const chart = await runWithPlots([
            plot(
                { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.3 },
                { slotId: "ar", color: null },
            ),
        ]);
        const area = chart.calls.find((c) => c.kind === "addSeries" && c.seriesType === "Area");
        expect(area?.kind === "addSeries" && Object.keys(area.options)).toEqual(["lineWidth"]);
    });

    it("area folds a 3-digit hex and passes a non-hex colour through verbatim", async () => {
        const chart = await runWithPlots([
            plot(
                { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.5 },
                { slotId: "ar1", color: "#0f0" },
            ),
            plot(
                { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.5 },
                { slotId: "ar2", color: "tomato" },
            ),
        ]);
        const areas = chart.calls.filter((c) => c.kind === "addSeries" && c.seriesType === "Area");
        expect(areas[0]?.kind === "addSeries" && areas[0].options.topColor).toBe(
            "rgba(0, 255, 0, 0.5)",
        );
        // A non-hex colour can't fold an alpha — `hexToRgba` returns it verbatim.
        expect(areas[1]?.kind === "addSeries" && areas[1].options.topColor).toBe("tomato");
    });

    it("filled-band visible:false hides both edges", async () => {
        const chart = await runWithPlots([
            plot(
                { kind: "filled-band", upper: 5, lower: 1, alpha: 0.2 },
                { slotId: "band", visible: false },
            ),
        ]);
        const hides = chart.calls.filter(
            (c) => c.kind === "applyOptions" && c.options.visible === false,
        );
        expect(hides).toHaveLength(2);
    });

    it("filled-band reuses its pair across frames", async () => {
        const chart = new MockLwcApi();
        const host = stubHost();
        (host.drain as ReturnType<typeof vi.fn>).mockResolvedValue(
            emissions({
                plots: [
                    plot({ kind: "filled-band", upper: 5, lower: 1, alpha: 0.2 }, { slotId: "bb" }),
                ],
            }),
        );
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([
                { kind: "close", bar: bar(1) },
                { kind: "close", bar: bar(2) },
            ]),
            host,
        });
        await runRendererLoop(handle);
        const lines = chart.calls.filter((c) => c.kind === "addSeries" && c.seriesType === "Line");
        expect(lines).toHaveLength(2);
    });

    it("horizontal-line attaches a price line on the overlay candle series", async () => {
        const chart = await runWithPlots([
            plot({ kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" }, { slotId: "hl" }),
        ]);
        expect(chart.calls.some((c) => c.kind === "createPriceLine")).toBe(true);
    });

    it("horizontal-line with null value defaults the price to 0", async () => {
        const chart = await runWithPlots([
            plot(
                { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                { slotId: "hl0", value: null },
            ),
        ]);
        expect(chart.calls).toContainEqual({
            kind: "createPriceLine",
            seriesId: "s0",
            priceLineId: "pl0",
            price: 0,
        });
    });

    it("horizontal-line in a subpane anchors on that pane's first series", async () => {
        const chart = await runWithPlots([
            plot(LINE_STYLE, { slotId: "sub-line", pane: "rsi" }),
            plot(
                { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                { slotId: "sub-hl", pane: "rsi" },
            ),
        ]);
        const priceLine = chart.calls.find((c) => c.kind === "createPriceLine");
        expect(priceLine).toBeDefined();
        expect(priceLine?.kind === "createPriceLine" && priceLine.seriesId).not.toBe("s0");
    });

    it("horizontal-line in an empty subpane is a no-op", async () => {
        const chart = await runWithPlots([
            plot(
                { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                { slotId: "lonely-hl", pane: "empty" },
            ),
        ]);
        expect(chart.calls.some((c) => c.kind === "createPriceLine")).toBe(false);
    });

    it("re-emitting one horizontal-line slot re-prices a single price line, not N", async () => {
        const chart = new MockLwcApi();
        const host = stubHost();
        // The slot re-emits each bar with a moving price — three bars total.
        let price = 10;
        (host.drain as ReturnType<typeof vi.fn>).mockImplementation(async () =>
            emissions({
                plots: [
                    plot(
                        { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                        { slotId: "hl", value: price++ },
                    ),
                ],
            }),
        );
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([
                { kind: "close", bar: bar(1) },
                { kind: "close", bar: bar(2) },
                { kind: "close", bar: bar(3) },
            ]),
            host,
        });
        await runRendererLoop(handle);
        // Exactly ONE native price line created — the re-sights re-price it.
        const created = chart.calls.filter((c) => c.kind === "createPriceLine");
        expect(created).toHaveLength(1);
        const repriced = chart.calls.filter((c) => c.kind === "applyPriceLineOptions");
        expect(repriced).toHaveLength(2);
        expect(repriced.map((c) => (c.kind === "applyPriceLineOptions" ? c.price : -1))).toEqual([
            11, 12,
        ]);
    });

    it("hiding a horizontal-line slot removes its native price line", async () => {
        const chart = new MockLwcApi();
        const host = stubHost();
        // First bar shows the line; second bar emits the slot visible:false.
        let frame = 0;
        (host.drain as ReturnType<typeof vi.fn>).mockImplementation(async () => {
            const visible = frame++ === 0;
            return emissions({
                plots: [
                    plot(
                        { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                        { slotId: "hl", ...(visible ? {} : { visible: false }) },
                    ),
                ],
            });
        });
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([
                { kind: "close", bar: bar(1) },
                { kind: "close", bar: bar(2) },
            ]),
            host,
        });
        await runRendererLoop(handle);
        expect(chart.calls.filter((c) => c.kind === "createPriceLine")).toHaveLength(1);
        const removed = chart.calls.filter((c) => c.kind === "removePriceLine");
        expect(removed).toHaveLength(1);
        expect(removed[0]?.kind === "removePriceLine" && removed[0].priceLineId).toBe("pl0");
    });

    it("hiding a horizontal-line slot that never had a price line is a no-op", () => {
        const { handle, chart } = build();
        handle.onEmissions(
            emissions({
                plots: [
                    plot(
                        { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                        { slotId: "never", visible: false },
                    ),
                ],
            }),
        );
        expect(chart.calls.some((c) => c.kind === "removePriceLine")).toBe(false);
    });

    it("native-expressible glyphs set distinct markers on the candle series", async () => {
        const chart = await runWithPlots([
            plot({ kind: "arrow", direction: "up", size: 1 }, { slotId: "au" }),
            plot({ kind: "arrow", direction: "down", size: 1 }, { slotId: "ad" }),
            plot({ kind: "character", char: "X", size: 2 }, { slotId: "ch" }),
            plot({ kind: "marker", shape: "circle", size: 3 }, { slotId: "mk" }),
            plot({ kind: "label", text: "hi", position: "above" }, { slotId: "lb" }),
        ]);
        const markers = chart.calls
            .filter((c) => c.kind === "setMarkers")
            .flatMap((c) => (c.kind === "setMarkers" ? c.markers : []));
        // Arrow up vs down differ in shape AND position.
        const up = markers.find((m) => m.shape === "arrowUp");
        const down = markers.find((m) => m.shape === "arrowDown");
        expect(up).toMatchObject({ shape: "arrowUp", position: "belowBar", color: "#3b82f6" });
        expect(down).toMatchObject({ shape: "arrowDown", position: "aboveBar" });
        // character carries its char as marker text; label carries its text.
        expect(markers.find((m) => m.text === "X")).toMatchObject({
            shape: "circle",
            position: "inBar",
            size: 2,
        });
        expect(markers.find((m) => m.text === "hi")).toMatchObject({ position: "aboveBar" });
        // The circle marker is native (no text), size forwarded.
        expect(markers.find((m) => m.shape === "circle" && m.text === undefined)).toMatchObject({
            size: 3,
            position: "inBar",
        });
    });

    it("a native glyph forwards plot.color and falls back to the default on null", async () => {
        const chart = await runWithPlots([
            plot({ kind: "marker", shape: "square", size: 1 }, { slotId: "m1", color: "#26a69a" }),
            plot({ kind: "marker", shape: "square", size: 1 }, { slotId: "m2", color: null }),
        ]);
        const markers = chart.calls
            .filter((c) => c.kind === "setMarkers")
            .flatMap((c) => (c.kind === "setMarkers" ? c.markers : []));
        expect(markers.map((m) => m.color)).toEqual(["#26a69a", "#3b82f6"]);
    });

    it("a shape glyph resolves location to a native marker position", async () => {
        const chart = await runWithPlots([
            plot({ kind: "shape", shape: "circle", size: 1, location: "below" }, { slotId: "s1" }),
            plot(
                { kind: "shape", shape: "square", size: 1, location: "absolute" },
                { slotId: "s2" },
            ),
            plot({ kind: "shape", shape: "circle", size: 1 }, { slotId: "s3" }),
        ]);
        const markers = chart.calls
            .filter((c) => c.kind === "setMarkers")
            .flatMap((c) => (c.kind === "setMarkers" ? c.markers : []));
        expect(markers.map((m) => m.position)).toEqual(["belowBar", "inBar", "inBar"]);
    });

    it("overlay-routed glyphs do NOT go native (no setMarkers)", async () => {
        const chart = await runWithPlots([
            plot({ kind: "shape", shape: "flag", size: 1 }, { slotId: "sh" }),
            plot({ kind: "shape", shape: "cross", size: 1 }, { slotId: "cr" }),
            plot({ kind: "marker", shape: "diamond", size: 1 }, { slotId: "di" }),
            plot({ kind: "marker", shape: "triangle-up", size: 1 }, { slotId: "tu" }),
        ]);
        expect(chart.calls.some((c) => c.kind === "setMarkers")).toBe(false);
    });

    it("a glyph with a null value is skipped (neither native nor buffered)", async () => {
        const chart = await runWithPlots([
            plot({ kind: "arrow", direction: "up", size: 1 }, { slotId: "ar", value: null }),
            plot({ kind: "shape", shape: "flag", size: 1 }, { slotId: "sh", value: null }),
        ]);
        expect(chart.calls.some((c) => c.kind === "setMarkers")).toBe(false);
    });

    it("candle-override recolours each bar's body+border+wick by direction", async () => {
        // Bull bar (close>open) → bull; bear bar (close<open) → bear; doji
        // (close===open) → doji. Each bar carries its own candle-override.
        const bull: Bar = { ...bar(1, 10), open: 9, close: 11 };
        const bear: Bar = { ...bar(2, 10), open: 11, close: 9 };
        const doji: Bar = { ...bar(3, 10), open: 10, close: 10 };
        const chart = new MockLwcApi();
        const host = stubHost();
        let frame = 0;
        (host.drain as ReturnType<typeof vi.fn>).mockImplementation(async () => {
            frame += 1;
            const t = frame;
            return emissions({
                plots: [
                    plot(
                        { kind: "candle-override", bull: "#0f0", bear: "#f00", doji: "#888" },
                        { slotId: "co", time: t },
                    ),
                ],
            });
        });
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([
                { kind: "close", bar: bull },
                { kind: "close", bar: bear },
                { kind: "close", bar: doji },
            ]),
            host,
        });
        await runRendererLoop(handle);
        // No whole-series tint — the colour rides per-bar data points.
        expect(chart.calls.some((c) => c.kind === "applyOptions" && "upColor" in c.options)).toBe(
            false,
        );
        const colorAt = (time: number): string | undefined => {
            const tinted = [...chart.calls]
                .reverse()
                .find((c) => c.kind === "update" && c.time === time && c.color !== undefined);
            return tinted?.kind === "update" ? tinted.color : undefined;
        };
        expect(colorAt(1)).toBe("#0f0");
        expect(colorAt(2)).toBe("#f00");
        expect(colorAt(3)).toBe("#888");
    });

    it("candle-override doji falls back to bull when no doji colour is given", async () => {
        const doji: Bar = { ...bar(1, 10), open: 10, close: 10 };
        const chart = await runWithPlots(
            [
                plot(
                    { kind: "candle-override", bull: "#0f0", bear: "#f00" },
                    { slotId: "co", time: 1 },
                ),
            ],
            [{ kind: "close", bar: doji }],
        );
        const tinted = chart.calls.find(
            (c) => c.kind === "update" && c.color !== undefined && c.open !== undefined,
        );
        expect(tinted?.kind === "update" && tinted.color).toBe("#0f0");
    });

    it("a candle-override whose time matches no known bar is a no-op for that frame", async () => {
        // The bar in state is time 1; the override targets time 99 → no candle
        // re-update, no per-point colour.
        const chart = await runWithPlots(
            [
                plot(
                    { kind: "candle-override", bull: "#0f0", bear: "#f00" },
                    { slotId: "co", time: 99 },
                ),
            ],
            [{ kind: "close", bar: bar(1) }],
        );
        expect(chart.calls.some((c) => c.kind === "update" && c.color !== undefined)).toBe(false);
    });

    it("bar-color wins over candle-override on the same bar", async () => {
        const bull: Bar = { ...bar(1, 10), open: 9, close: 11 };
        const chart = await runWithPlots(
            [
                plot(
                    { kind: "candle-override", bull: "#0f0", bear: "#f00" },
                    { slotId: "co", time: 1 },
                ),
                plot({ kind: "bar-color", color: "#2962ff" }, { slotId: "bc", time: 1 }),
            ],
            [{ kind: "close", bar: bull }],
        );
        const tinted = [...chart.calls]
            .reverse()
            .find((c) => c.kind === "update" && c.color !== undefined);
        expect(tinted?.kind === "update" && tinted.color).toBe("#2962ff");
    });

    it("bar-color recolours the candle DATA POINT body + border + wick for that bar", async () => {
        const chart = await runWithPlots([
            plot({ kind: "bar-color", color: "#2962ff" }, { slotId: "bc", time: 1 }),
        ]);
        // No whole-series tint — the colour rides the per-bar data point.
        expect(chart.calls.some((c) => c.kind === "applyOptions" && "upColor" in c.options)).toBe(
            false,
        );
        // The candle was re-`update`d with body + border + wick all set.
        const tinted = chart.calls.find(
            (c) => c.kind === "update" && c.color !== undefined && c.open !== undefined,
        );
        expect(tinted?.kind === "update" && tinted).toMatchObject({
            color: "#2962ff",
            borderColor: "#2962ff",
            wickColor: "#2962ff",
        });
    });

    it("bar-override recolours the candle DATA POINT body + border + wick for that bar", async () => {
        const chart = await runWithPlots([
            plot({ kind: "bar-override", color: "#ff6d00" }, { slotId: "bo", time: 1 }),
        ]);
        const tinted = chart.calls.find(
            (c) => c.kind === "update" && c.color !== undefined && c.open !== undefined,
        );
        expect(tinted?.kind === "update" && tinted).toMatchObject({
            color: "#ff6d00",
            borderColor: "#ff6d00",
            wickColor: "#ff6d00",
        });
    });

    it("bar-color colorValue overrides the static style.color", async () => {
        const chart = await runWithPlots([
            plot(
                { kind: "bar-color", color: "#2962ff" },
                { slotId: "bc", time: 1, colorValue: "#ff6d00" },
            ),
        ]);
        const tinted = chart.calls.find(
            (c) => c.kind === "update" && c.color !== undefined && c.open !== undefined,
        );
        expect(tinted?.kind === "update" && tinted.color).toBe("#ff6d00");
    });

    it("bar-color colorValue null clears the override (no colour this bar)", async () => {
        const chart = await runWithPlots([
            plot(
                { kind: "bar-color", color: "#2962ff" },
                { slotId: "bc", time: 1, colorValue: null },
            ),
        ]);
        // No candle update carries a colour — the override was cleared.
        expect(chart.calls.some((c) => c.kind === "update" && c.color !== undefined)).toBe(false);
    });

    it("per-bar bar-color colours differ across bars (genuinely per-bar)", async () => {
        // Two bars, each emitting its own bar-color: bar @1 blue, bar @2 orange.
        // A whole-series tint could only show ONE colour; per-bar data points
        // carry both, so the candle stays blue at @1 and orange at @2.
        const chart = new MockLwcApi();
        const host = stubHost();
        const drain = host.drain as ReturnType<typeof vi.fn>;
        drain
            .mockResolvedValueOnce(
                emissions({
                    plots: [
                        plot({ kind: "bar-color", color: "#2962ff" }, { slotId: "bc", time: 1 }),
                    ],
                }),
            )
            .mockResolvedValueOnce(
                emissions({
                    plots: [
                        plot({ kind: "bar-color", color: "#ff6d00" }, { slotId: "bc", time: 2 }),
                    ],
                }),
            );
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([
                { kind: "close", bar: bar(1) },
                { kind: "close", bar: bar(2) },
            ]),
            host,
        });
        await runRendererLoop(handle);
        const colours = chart.calls
            .filter((c) => c.kind === "update" && c.color !== undefined)
            .map((c) => (c.kind === "update" ? { time: c.time, color: c.color } : undefined));
        expect(colours).toEqual([
            { time: 1, color: "#2962ff" },
            { time: 2, color: "#ff6d00" },
        ]);
    });

    it("a bar-color whose time matches no known bar records nothing on the candle", async () => {
        // The candle series exists (a bar @1 was drawn) but the emission's time
        // (the builder default 1_000) matches no bar, so there is nothing to
        // re-stamp this frame.
        const chart = await runWithPlots([
            plot({ kind: "bar-color", color: "#2962ff" }, { slotId: "bc" }),
        ]);
        expect(chart.calls.some((c) => c.kind === "update" && c.color !== undefined)).toBe(false);
    });

    // Regression: a `bar-color` for a NON-last (historical) bar must NOT
    // `series.update()` it — LC's `update` only accepts the last point (or a
    // newer append) and throws "Cannot update oldest data" otherwise. The
    // demo delivers all history in ONE batch, so recolouring any but the final
    // bar hits this. The deferred batched `setData` rebuild applies the colour.
    it("a bar-color for a historical (non-last) bar rebuilds via setData, not update", async () => {
        const chart = await runWithPlots(
            [plot({ kind: "bar-color", color: "#2962ff" }, { slotId: "bc", time: 1 })],
            [{ kind: "history", bars: [bar(1), bar(2), bar(3)] }],
        );
        const setData = chart.calls.filter((c) => c.kind === "setData" && c.seriesId === "s0");
        // Two setData on the candle series: the initial history load, then the
        // batched rebuild that lands the historical bar's colour.
        expect(setData).toHaveLength(2);
        // No per-bar `update` carried a colour — the in-place update path is
        // skipped for the non-last bar (it would have thrown).
        expect(chart.calls.some((c) => c.kind === "update" && c.color !== undefined)).toBe(false);
    });

    it("a candle-override for a historical (non-last) bar rebuilds via setData, not update", async () => {
        const chart = await runWithPlots(
            [
                plot(
                    { kind: "candle-override", bull: "#0f0", bear: "#f00" },
                    { slotId: "co", time: 1 },
                ),
            ],
            [{ kind: "history", bars: [bar(1), bar(2), bar(3)] }],
        );
        const setData = chart.calls.filter((c) => c.kind === "setData" && c.seriesId === "s0");
        expect(setData).toHaveLength(2);
        expect(chart.calls.some((c) => c.kind === "update" && c.color !== undefined)).toBe(false);
    });

    it("bg-color buffers an overlay band (no native series) and horizontal-histogram stays a no-op", async () => {
        const chart = await runWithPlots([
            plot({ kind: "bg-color", color: "#222" }, { slotId: "bg" }),
            plot(
                { kind: "horizontal-histogram", buckets: [{ price: 1, volume: 2 }] },
                { slotId: "hh" },
            ),
        ]);
        // bg-color paints through the overlay, not a native series — only the
        // candle series is created. horizontal-histogram remains a no-op.
        expect(chart.calls.filter((c) => c.kind === "addSeries")).toHaveLength(1);
        expect(chart.calls.some((c) => c.kind === "setMarkers")).toBe(false);
    });

    it("a native glyph before any candle series is a no-op", () => {
        const { handle, chart } = build();
        handle.onEmissions(
            emissions({ plots: [plot({ kind: "marker", shape: "circle", size: 1 })] }),
        );
        expect(chart.calls.some((c) => c.kind === "setMarkers")).toBe(false);
    });

    it("an overlay-routed glyph before any candle series buffers, painting no native call", () => {
        const { handle, chart } = build();
        handle.onEmissions(emissions({ plots: [plot({ kind: "shape", shape: "flag", size: 1 })] }));
        // No native marker; the glyph is buffered for the overlay (painted once
        // the candle series + primitive exist).
        expect(chart.calls).toEqual([]);
    });

    it("a candle-override before any candle series is a no-op", () => {
        const { handle, chart } = build();
        handle.onEmissions(
            emissions({
                plots: [
                    plot({ kind: "candle-override", bull: "#0f0", bear: "#f00" }, { slotId: "t" }),
                ],
            }),
        );
        expect(chart.calls).toEqual([]);
    });

    it("a bar-color before any candle series is a no-op", () => {
        const { handle, chart } = build();
        handle.onEmissions(
            emissions({ plots: [plot({ kind: "bar-color", color: "#0ff" }, { slotId: "t" })] }),
        );
        expect(chart.calls).toEqual([]);
    });

    it("a horizontal-line before any candle series is a no-op", () => {
        const { handle, chart } = build();
        handle.onEmissions(
            emissions({
                plots: [
                    plot(
                        { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                        { slotId: "hl" },
                    ),
                ],
            }),
        );
        expect(chart.calls).toEqual([]);
    });
});

describe("createLightweightChartsAdapter — line-family colorValue (Task 13)", () => {
    const lineCv = (overrides: Partial<PlotEmission>): PlotEmission =>
        plot(LINE_STYLE, { slotId: "cv", ...overrides });

    // The native series the run path created, in creation order, with their
    // creation `options` (each run carries its run colour).
    const runSeries = (chart: MockLwcApi): ReadonlyArray<Record<string, unknown>> =>
        chart.calls
            .filter((c) => c.kind === "addSeries")
            .map((c) => (c.kind === "addSeries" ? c.options : {}));

    // Every `update` recorded against a given series id, in order.
    const updatesFor = (chart: MockLwcApi, seriesId: string): ReadonlyArray<number | null> =>
        chart.calls.flatMap((c) =>
            c.kind === "update" && c.seriesId === seriesId ? [c.value] : [],
        );

    it("omitted colorValue stays one native series (byte-identical path)", () => {
        const { handle, chart } = build();
        handle.onEmissions(emissions({ plots: [lineCv({ value: 1 })] }));
        handle.onEmissions(emissions({ plots: [lineCv({ value: 2 })] }));
        const series = chart.calls.filter((c) => c.kind === "addSeries");
        expect(series).toHaveLength(1);
        // No run colour folded in — the single-series path forwards the static
        // colour exactly as before.
        expect(series[0]?.kind === "addSeries" && series[0].options).toEqual({
            color: "#3b82f6",
            lineWidth: 1,
            lineType: 2,
        });
    });

    it("a mid-series color change opens a second run series with the boundary bar duplicated", () => {
        const { handle, chart } = build();
        // Two bars in the run colour #aaa, then a bar in #bbb → a second series.
        handle.onEmissions(
            emissions({ plots: [lineCv({ time: 1, value: 1, colorValue: "#aaa" })] }),
        );
        handle.onEmissions(
            emissions({ plots: [lineCv({ time: 2, value: 2, colorValue: "#aaa" })] }),
        );
        handle.onEmissions(
            emissions({ plots: [lineCv({ time: 3, value: 3, colorValue: "#bbb" })] }),
        );
        const series = runSeries(chart);
        expect(series).toHaveLength(2);
        expect(series[0]).toMatchObject({ color: "#aaa" });
        expect(series[1]).toMatchObject({ color: "#bbb" });
        // The first run holds bars 1 & 2; the second run duplicates bar 2's
        // value (the boundary) then draws bar 3 — so it joins visually.
        expect(updatesFor(chart, "s0")).toEqual([1, 2]);
        expect(updatesFor(chart, "s1")).toEqual([2, 3]);
    });

    it("a colorValue:null bar is a gap — the run ends and no series spans it", () => {
        const { handle, chart } = build();
        handle.onEmissions(
            emissions({ plots: [lineCv({ time: 1, value: 1, colorValue: "#aaa" })] }),
        );
        handle.onEmissions(emissions({ plots: [lineCv({ time: 2, value: 2, colorValue: null })] }));
        handle.onEmissions(
            emissions({ plots: [lineCv({ time: 3, value: 3, colorValue: "#aaa" })] }),
        );
        const series = runSeries(chart);
        // Two runs (#aaa before the gap, #aaa after) — but the post-gap run does
        // NOT duplicate a boundary across the gap.
        expect(series).toHaveLength(2);
        expect(updatesFor(chart, "s0")).toEqual([1]);
        expect(updatesFor(chart, "s1")).toEqual([3]);
    });

    it("a non-finite value mid-run is a gap that is not bridged into the next run", () => {
        const { handle, chart } = build();
        handle.onEmissions(
            emissions({ plots: [lineCv({ time: 1, value: 1, colorValue: "#aaa" })] }),
        );
        handle.onEmissions(
            emissions({ plots: [lineCv({ time: 2, value: null, colorValue: "#aaa" })] }),
        );
        handle.onEmissions(
            emissions({ plots: [lineCv({ time: 3, value: 3, colorValue: "#bbb" })] }),
        );
        // Same #aaa run absorbs the whitespace point (no colour change), then
        // #bbb opens a new run — but bar 2 was a gap so it is NOT duplicated.
        expect(updatesFor(chart, "s0")).toEqual([1, null]);
        expect(updatesFor(chart, "s1")).toEqual([3]);
    });

    it("the explicit colorValue is the run colour regardless of the static color", () => {
        // The run colour is the per-bar `colorValue`, NOT the static `plot.color`
        // — even a null static color yields a concrete run colour.
        const { handle, chart } = build();
        handle.onEmissions(
            emissions({ plots: [lineCv({ value: 1, color: null, colorValue: "#0f0" })] }),
        );
        expect(runSeries(chart)[0]).toMatchObject({ color: "#0f0" });
    });

    it("step-line run-split carries the native step lineType per run", () => {
        const { handle, chart } = build();
        const step = (o: Partial<PlotEmission>): PlotEmission =>
            plot({ kind: "step-line", lineWidth: 1, lineStyle: "solid" }, { slotId: "st", ...o });
        handle.onEmissions(emissions({ plots: [step({ time: 1, value: 1, colorValue: "#aaa" })] }));
        handle.onEmissions(emissions({ plots: [step({ time: 2, value: 2, colorValue: "#bbb" })] }));
        const series = runSeries(chart);
        expect(series).toHaveLength(2);
        for (const s of series) expect(s).toMatchObject({ lineType: 1, color: expect.any(String) });
    });

    it("area run-split folds the run colour into lineColor + gradient", () => {
        const { handle, chart } = build();
        const area = (o: Partial<PlotEmission>): PlotEmission =>
            plot(
                { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.4 },
                { slotId: "ar", ...o },
            );
        handle.onEmissions(
            emissions({ plots: [area({ time: 1, value: 1, colorValue: "#112233" })] }),
        );
        const series = chart.calls.filter((c) => c.kind === "addSeries" && c.seriesType === "Area");
        expect(series).toHaveLength(1);
        expect(series[0]?.kind === "addSeries" && series[0].options).toMatchObject({
            lineColor: "#112233",
            topColor: "rgba(17, 34, 51, 0.4)",
            bottomColor: "rgba(17, 34, 51, 0)",
        });
    });

    it("visible:false hides every run series of the slot", () => {
        const { handle, chart } = build();
        handle.onEmissions(
            emissions({ plots: [lineCv({ time: 1, value: 1, colorValue: "#aaa" })] }),
        );
        handle.onEmissions(
            emissions({ plots: [lineCv({ time: 2, value: 2, colorValue: "#bbb" })] }),
        );
        // Two runs exist; a visible:false re-emit hides both.
        handle.onEmissions(
            emissions({
                plots: [lineCv({ time: 3, value: 3, colorValue: "#bbb", visible: false })],
            }),
        );
        const hidden = chart.calls.filter(
            (c) => c.kind === "applyOptions" && c.options.visible === false,
        );
        expect(hidden).toHaveLength(2);
    });

    it("histogram with colorValue stays one series and stamps per-point colour", () => {
        const { handle, chart } = build();
        const hist = (o: Partial<PlotEmission>): PlotEmission =>
            plot({ kind: "histogram", baseline: 0 }, { slotId: "h", ...o });
        handle.onEmissions(emissions({ plots: [hist({ time: 1, value: 1, colorValue: "#aaa" })] }));
        handle.onEmissions(emissions({ plots: [hist({ time: 2, value: 2, colorValue: "#bbb" })] }));
        const series = chart.calls.filter((c) => c.kind === "addSeries");
        expect(series).toHaveLength(1);
        const colors = chart.calls.flatMap((c) => (c.kind === "update" ? [c.color] : []));
        expect(colors).toEqual(["#aaa", "#bbb"]);
    });

    it("histogram colorValue:null is a whitespace column (no colour)", () => {
        const { handle, chart } = build();
        handle.onEmissions(
            emissions({
                plots: [
                    plot(
                        { kind: "histogram", baseline: 0 },
                        { slotId: "h", time: 1, value: 5, colorValue: null },
                    ),
                ],
            }),
        );
        const update = chart.calls.find((c) => c.kind === "update");
        expect(update?.kind === "update" && update.value).toBeNull();
        expect(update?.kind === "update" && "color" in update).toBe(false);
    });

    it("histogram colorValue forwards the static colour at creation", () => {
        const { handle, chart } = build();
        handle.onEmissions(
            emissions({
                plots: [
                    plot(
                        { kind: "histogram", baseline: 0 },
                        { slotId: "h", value: 1, color: "#777", colorValue: "#aaa" },
                    ),
                ],
            }),
        );
        const series = chart.calls.find((c) => c.kind === "addSeries");
        expect(series?.kind === "addSeries" && series.options).toEqual({ color: "#777" });
    });

    it("histogram colorValue with a null static color creates the series cleanly", () => {
        const { handle, chart } = build();
        handle.onEmissions(
            emissions({
                plots: [
                    plot(
                        { kind: "histogram", baseline: 0 },
                        { slotId: "h", value: 1, color: null, colorValue: "#aaa" },
                    ),
                ],
            }),
        );
        const series = chart.calls.find((c) => c.kind === "addSeries");
        expect(series?.kind === "addSeries" && series.options).toEqual({});
    });

    it("histogram colorValue honours visible:false", () => {
        const { handle, chart } = build();
        handle.onEmissions(
            emissions({
                plots: [
                    plot(
                        { kind: "histogram", baseline: 0 },
                        { slotId: "h", value: 1, colorValue: "#aaa", visible: false },
                    ),
                ],
            }),
        );
        expect(
            chart.calls.some((c) => c.kind === "applyOptions" && c.options.visible === false),
        ).toBe(true);
    });

    it("run series are disposed so a re-driven slot starts fresh", () => {
        const { handle, chart } = build();
        handle.onEmissions(emissions({ plots: [lineCv({ value: 1, colorValue: "#aaa" })] }));
        handle.dispose();
        // After dispose the runSlots map is cleared; a fresh emission opens a new
        // run series rather than extending a stale (removed) one.
        handle.onEmissions(emissions({ plots: [lineCv({ value: 2, colorValue: "#aaa" })] }));
        // s0 (pre-dispose), remove, s1 (post-dispose) — two distinct series.
        const series = chart.calls.filter((c) => c.kind === "addSeries");
        expect(series).toHaveLength(2);
    });
});

describe("createLightweightChartsAdapter — plot x-shift (universal offset)", () => {
    const DAY = 86_400_000;
    // 10 history bars at one-day spacing so `medianBarSpacing` is a stable DAY.
    const HISTORY: ReadonlyArray<Bar> = Array.from({ length: 10 }, (_, i) => bar(i * DAY));

    // Drive the 10-bar history, then drain three line plots for the SAME bar
    // index (the last bar) — unshifted, +5, −5 — and read back the native
    // `update` time recorded for each slot's series.
    async function shiftedUpdateTimes(): Promise<{
        base: number;
        right: number;
        left: number;
    }> {
        const chart = new MockLwcApi();
        const host = stubHost();
        const lastBar = HISTORY.length - 1;
        (host.drain as ReturnType<typeof vi.fn>).mockResolvedValue(
            emissions({
                plots: [
                    plot(LINE_STYLE, { slotId: "base", bar: lastBar, time: HISTORY[lastBar].time }),
                    plot(LINE_STYLE, {
                        slotId: "right",
                        bar: lastBar,
                        time: HISTORY[lastBar].time,
                        xShift: 5,
                    }),
                    plot(LINE_STYLE, {
                        slotId: "left",
                        bar: lastBar,
                        time: HISTORY[lastBar].time,
                        xShift: -5,
                    }),
                ],
            }),
        );
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([{ kind: "history", bars: HISTORY }]),
            host,
        });
        await runRendererLoop(handle);
        const timeFor = (slotSeriesId: string): number => {
            const call = chart.calls.find(
                (c) => c.kind === "update" && c.seriesId === slotSeriesId,
            );
            if (call === undefined || call.kind !== "update") throw new Error("no update");
            return call.time;
        };
        // s0 is the candle series; the three line series are s1 (base), s2
        // (right), s3 (left) in declaration order.
        return { base: timeFor("s1"), right: timeFor("s2"), left: timeFor("s3") };
    }

    it("places a +5 copy ~5 spacings to the RIGHT of the unshifted point and −5 to the LEFT", async () => {
        const { base, right, left } = await shiftedUpdateTimes();
        // The unshifted point sits at the last bar's own time.
        expect(base).toBe(HISTORY[HISTORY.length - 1].time);
        // +5 is exactly five median spacings (one DAY each) into the future.
        expect(right).toBe(base + 5 * DAY);
        // −5 lands on a real prior bar (index last−5), strictly earlier.
        expect(left).toBe(HISTORY[HISTORY.length - 1 - 5].time);
        // Strictly monotonic across the three: left < base < right.
        expect(left).toBeLessThan(base);
        expect(base).toBeLessThan(right);
        expect(right - base).toBe(base - left);
    });

    it("shifts a filled-band's BOTH edges by the same xShift", async () => {
        const chart = new MockLwcApi();
        const host = stubHost();
        const lastBar = HISTORY.length - 1;
        (host.drain as ReturnType<typeof vi.fn>).mockResolvedValue(
            emissions({
                plots: [
                    plot(
                        { kind: "filled-band", upper: 5, lower: 1, alpha: 0.2 },
                        { slotId: "band", bar: lastBar, time: HISTORY[lastBar].time, xShift: 5 },
                    ),
                ],
            }),
        );
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([{ kind: "history", bars: HISTORY }]),
            host,
        });
        await runRendererLoop(handle);
        // The two band edges (s1 upper, s2 lower) both update at last + 5·DAY.
        const expected = HISTORY[lastBar].time + 5 * DAY;
        const edgeTimes = chart.calls
            .filter((c) => c.kind === "update" && (c.seriesId === "s1" || c.seriesId === "s2"))
            .map((c) => (c.kind === "update" ? c.time : -1));
        expect(edgeTimes).toEqual([expected, expected]);
    });

    it("shifts a native glyph marker by its xShift", async () => {
        const chart = new MockLwcApi();
        const host = stubHost();
        const lastBar = HISTORY.length - 1;
        (host.drain as ReturnType<typeof vi.fn>).mockResolvedValue(
            emissions({
                plots: [
                    plot(
                        { kind: "marker", shape: "circle", size: 1 },
                        { slotId: "g", bar: lastBar, time: HISTORY[lastBar].time, xShift: -5 },
                    ),
                ],
            }),
        );
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([{ kind: "history", bars: HISTORY }]),
            host,
        });
        await runRendererLoop(handle);
        // The glyph anchors at bar last−5's own time, not the unshifted time.
        const markerCall = chart.calls.find((c) => c.kind === "setMarkers");
        expect(markerCall?.kind === "setMarkers" && markerCall.markers[0]?.time).toBe(
            HISTORY[lastBar - 5].time,
        );
    });

    it("a no-offset plot updates at the bar's own time (byte-identical to pre-shift)", async () => {
        const chart = await runWithPlots([plot(LINE_STYLE, { slotId: "noshift", bar: 0 })]);
        // One bar in state at time 1; bar 0 + no shift → time 1.
        const lineUpdate = chart.calls.find((c) => c.kind === "update" && c.seriesId !== "s0");
        expect(lineUpdate?.kind === "update" && lineUpdate.time).toBe(1);
    });
});

describe("createLightweightChartsAdapter — initial visible window", () => {
    const rangeCalls = (chart: MockLwcApi): ReadonlyArray<{ from: number; to: number }> =>
        chart.calls
            .filter((c) => c.kind === "setVisibleLogicalRange")
            .map((c) => (c.kind === "setVisibleLogicalRange" ? { from: c.from, to: c.to } : null))
            .filter((r): r is { from: number; to: number } => r !== null);

    it("frames the most recent N bars once a history batch lands", async () => {
        const chart = new MockLwcApi();
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([
                { kind: "history", bars: Array.from({ length: 100 }, (_, i) => bar(i)) },
            ]),
            host: stubHost(),
            initialVisibleBars: 30,
        });
        await runRendererLoop(handle);
        // from = max(0, 100 - 30) = 70; to = 100 - 1 = 99.
        expect(rangeCalls(chart)).toEqual([{ from: 70, to: 99 }]);
    });

    it("clamps `from` to 0 when fewer bars than the window exist", async () => {
        const chart = new MockLwcApi();
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([{ kind: "close", bar: bar(1) }]),
            host: stubHost(),
            initialVisibleBars: 50,
        });
        await runRendererLoop(handle);
        // Only 1 bar: from = max(0, 1 - 50) = 0; to = 0.
        expect(rangeCalls(chart)).toEqual([{ from: 0, to: 0 }]);
    });

    it("frames on the first tick when the first event is a leading tick", async () => {
        const chart = new MockLwcApi();
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([
                { kind: "tick", bar: bar(1, 9) },
                { kind: "tick", bar: bar(1, 10) },
            ]),
            host: stubHost(),
            initialVisibleBars: 5,
        });
        await runRendererLoop(handle);
        // Framed exactly once on the first tick (1 bar): from 0, to 0.
        expect(rangeCalls(chart)).toEqual([{ from: 0, to: 0 }]);
    });

    it("frames exactly once — later live bars and ticks do not re-frame", async () => {
        const chart = new MockLwcApi();
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([
                { kind: "history", bars: Array.from({ length: 10 }, (_, i) => bar(i)) },
                { kind: "close", bar: bar(10) },
                { kind: "tick", bar: bar(11, 12) },
            ]),
            host: stubHost(),
            initialVisibleBars: 4,
        });
        await runRendererLoop(handle);
        // Only the first history frame fires (from = max(0, 10 - 4) = 6, to = 9).
        expect(rangeCalls(chart)).toEqual([{ from: 6, to: 9 }]);
    });

    it("never frames when initialVisibleBars is omitted (auto-fit unchanged)", async () => {
        const chart = new MockLwcApi();
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([
                { kind: "history", bars: Array.from({ length: 20 }, (_, i) => bar(i)) },
                { kind: "close", bar: bar(20) },
            ]),
            host: stubHost(),
        });
        await runRendererLoop(handle);
        expect(rangeCalls(chart)).toEqual([]);
    });

    it("does not frame on an empty (zero-bar) history batch", async () => {
        const chart = new MockLwcApi();
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([
                { kind: "history", bars: [] },
                { kind: "close", bar: bar(1) },
            ]),
            host: stubHost(),
            initialVisibleBars: 5,
        });
        await runRendererLoop(handle);
        // The empty batch has no bars, so framing defers to the first close.
        expect(rangeCalls(chart)).toEqual([{ from: 0, to: 0 }]);
    });
});

describe("createLightweightChartsAdapter — pane routing", () => {
    it("overlay plots stay on pane 0", async () => {
        const chart = await runWithPlots([plot(LINE_STYLE, { slotId: "o", pane: "overlay" })]);
        const added = chart.calls.find((c) => c.kind === "addSeries" && c.seriesType === "Line");
        expect(added?.kind === "addSeries" && added.paneIndex).toBe(0);
    });

    it("pane:'new' allocates a fresh pane each sight", async () => {
        const chart = await runWithPlots([
            plot(LINE_STYLE, { slotId: "n1", pane: "new" }),
            plot(LINE_STYLE, { slotId: "n2", pane: "new" }),
        ]);
        expect(chart.calls.filter((c) => c.kind === "addPane")).toHaveLength(2);
    });

    it("a named pane reuses one stable index across its slots", async () => {
        const chart = await runWithPlots([
            plot(LINE_STYLE, { slotId: "r1", pane: "rsi" }),
            plot(LINE_STYLE, { slotId: "r2", pane: "rsi" }),
        ]);
        expect(chart.calls.filter((c) => c.kind === "addPane")).toHaveLength(1);
        const indices = chart.calls
            .filter((c) => c.kind === "addSeries" && c.seriesType === "Line")
            .map((c) => (c.kind === "addSeries" ? c.paneIndex : -1));
        expect(new Set(indices)).toEqual(new Set([1]));
    });
});

describe("createLightweightChartsAdapter — drawings buffer (Task 6 seam)", () => {
    const drawing = (op: DrawingEmission["op"], handleId: string): DrawingEmission => ({
        kind: "drawing",
        op,
        handleId,
        drawingKind: "line",
        bar: 0,
        time: 1_000,
        state: {
            kind: "line",
            anchors: [
                { time: 1, price: 1 },
                { time: 2, price: 2 },
            ],
            style: {},
        },
    });

    it("buffers create then drops on remove without any native call", () => {
        const { handle, chart } = build();
        handle.onEmissions(emissions({ drawings: [drawing("create", "d1")] }));
        handle.onEmissions(emissions({ drawings: [drawing("remove", "d1")] }));
        expect(chart.calls).toEqual([]);
    });
});

describe("createLightweightChartsAdapter — bg-color overlay band (Task 12)", () => {
    // A bg-color emission rides `value: null` and its per-bar colour; it paints
    // through the overlay, never a native series — so no native call is made.
    const bgPlot = (overrides: Partial<PlotEmission> = {}): PlotEmission =>
        plot(
            { kind: "bg-color", color: "#222", transp: 50 },
            { slotId: "bg", value: null, ...overrides },
        );

    it("ingests a static bg-color band (no native series / marker)", () => {
        const { handle, chart } = build();
        handle.onEmissions(emissions({ plots: [bgPlot()] }));
        expect(chart.calls).toEqual([]);
    });

    it("ingests a per-bar colorValue override band", () => {
        const { handle, chart } = build();
        handle.onEmissions(emissions({ plots: [bgPlot({ colorValue: "#0f0" })] }));
        expect(chart.calls).toEqual([]);
    });

    it("a colorValue:null gap deletes any band for that bar", () => {
        const { handle, chart } = build();
        // Buffer a band, then clear it with an explicit null gap on the same bar.
        handle.onEmissions(emissions({ plots: [bgPlot({ colorValue: "#0f0" })] }));
        handle.onEmissions(emissions({ plots: [bgPlot({ colorValue: null })] }));
        expect(chart.calls).toEqual([]);
    });

    it("threads bg-color / glyph / drawing through the attached overlay primitive", async () => {
        // Drive a real candle so the primitive attaches, then a frame carrying a
        // bg-color band, an overlay glyph, and a drawing — exercising every
        // ingest branch (band key, glyph key, drawing key) end-to-end.
        const chart = await runWithPlots(
            [bgPlot(), plot({ kind: "shape", shape: "diamond", size: 8 }, { slotId: "g", z: -1 })],
            [{ kind: "close", bar: bar(1) }],
        );
        // Only the candle series is native; the overlay paints the rest.
        expect(chart.calls.filter((c) => c.kind === "addSeries")).toHaveLength(1);
        expect(chart.calls.some((c) => c.kind === "attachPrimitive")).toBe(true);
    });
});

describe("createLightweightChartsAdapter — alerts / conditions / logs / diagnostics", () => {
    it("accumulates alerts and forwards them to onAlert", () => {
        const onAlert = vi.fn();
        const { handle } = build({ onAlert });
        const alert = {
            kind: "alert" as const,
            slotId: "a",
            severity: "info" as const,
            message: "hi",
            bar: 0,
            time: 1,
            meta: {},
            channels: ["log" as const],
            dedupeKey: "k",
        };
        handle.onEmissions(emissions({ alerts: [alert] }));
        expect(onAlert).toHaveBeenCalledWith(alert);
    });

    it("trims the recent-alert ring buffer past its cap without throwing", () => {
        const { handle } = build();
        const many = Array.from({ length: 260 }, (_, i) => ({
            kind: "alert" as const,
            slotId: "a",
            severity: "info" as const,
            message: "hi",
            bar: 0,
            time: i,
            meta: {},
            channels: ["log" as const],
            dedupeKey: `k${i}`,
        }));
        expect(() => handle.onEmissions(emissions({ alerts: many }))).not.toThrow();
    });

    it("replaces alert conditions and trims the log buffer", () => {
        const { handle } = build();
        const condition = {
            kind: "alert-condition" as const,
            conditionId: "c",
            title: "T",
            description: "D",
            defaultMessage: "M",
            fired: false,
            bar: 0,
            time: 1,
        };
        const log = {
            kind: "log" as const,
            level: "info" as const,
            message: "m",
            bar: 0,
            time: 1,
        };
        expect(() =>
            handle.onEmissions(
                emissions({
                    alertConditions: [condition],
                    logs: Array.from({ length: 7 }, () => log),
                }),
            ),
        ).not.toThrow();
    });

    it("warns on warning/error diagnostics but not info", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { handle } = build();
        handle.onEmissions(
            emissions({
                diagnostics: [
                    { kind: "diagnostic", code: "dep-error", severity: "warning", message: "w" },
                    { kind: "diagnostic", code: "dep-error", severity: "error", message: "e" },
                    { kind: "diagnostic", code: "dep-error", severity: "info", message: "i" },
                ],
            }),
        );
        expect(warn).toHaveBeenCalledTimes(2);
        warn.mockRestore();
    });

    it("drops emissions that fail validation", () => {
        const { handle, chart } = build();
        const badPlot = { ...plot(LINE_STYLE), slotId: "" } as PlotEmission;
        handle.onEmissions(emissions({ plots: [badPlot] }));
        expect(chart.calls).toEqual([]);
    });
});

describe("createLightweightChartsAdapter — dispose", () => {
    it("clears state, removes the chart, and disposes the host", () => {
        const host = stubHost();
        const chart = new MockLwcApi();
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: mockCandleSource([]),
            host,
        });
        handle.dispose?.();
        expect(chart.calls).toContainEqual({ kind: "remove" });
        expect(host.dispose).toHaveBeenCalled();
    });
});

describe("runRendererLoop", () => {
    it("throws on a foreign handle", async () => {
        const foreign = {
            id: "x",
            candles: () => mockCandleSource([]),
        } as unknown as LwcAdapterHandle;
        await expect(runRendererLoop(foreign)).rejects.toThrow(/was not produced by/);
    });

    it("returns immediately when already aborted", async () => {
        const { handle, chart } = build({
            candleSource: eventSource([{ kind: "close", bar: bar(1) }]),
        });
        const controller = new AbortController();
        controller.abort();
        await runRendererLoop(handle, { signal: controller.signal });
        expect(chart.calls).toEqual([]);
    });

    it("aborts right after the first push (before the yield)", async () => {
        const controller = new AbortController();
        const host = stubHost();
        (host.push as ReturnType<typeof vi.fn>).mockImplementation(async () => {
            controller.abort();
        });
        const handle = createLightweightChartsAdapter({
            chartApi: new MockLwcApi(),
            candleSource: eventSource([
                { kind: "close", bar: bar(1) },
                { kind: "close", bar: bar(2) },
            ]),
            host,
        });
        await runRendererLoop(handle, { signal: controller.signal });
        expect(host.drain).not.toHaveBeenCalled();
    });

    it("aborts after the yield, before drain", async () => {
        const controller = new AbortController();
        const host = stubHost();
        // The yield is a setTimeout(0); abort on the next macrotask so the
        // post-yield check (`if (aborted()) return`) fires before drain.
        (host.push as ReturnType<typeof vi.fn>).mockImplementation(async () => {
            setTimeout(() => controller.abort(), 0);
        });
        const handle = createLightweightChartsAdapter({
            chartApi: new MockLwcApi(),
            candleSource: eventSource([{ kind: "close", bar: bar(1) }]),
            host,
        });
        await runRendererLoop(handle, { signal: controller.signal });
        expect(host.drain).not.toHaveBeenCalled();
    });

    it("aborts during drain, before feeding emissions back", async () => {
        const controller = new AbortController();
        const chart = new MockLwcApi();
        const host = stubHost();
        (host.drain as ReturnType<typeof vi.fn>).mockImplementation(async () => {
            controller.abort();
            return emissions({ plots: [plot(LINE_STYLE, { slotId: "late" })] });
        });
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([{ kind: "close", bar: bar(1) }]),
            host,
        });
        await runRendererLoop(handle, { signal: controller.signal });
        // Drain ran, but the post-drain abort check returned before onEmissions
        // applied the plot → no Line series was added.
        expect(host.drain).toHaveBeenCalled();
        expect(chart.calls.some((c) => c.kind === "addSeries" && c.seriesType === "Line")).toBe(
            false,
        );
    });

    it("aborts at the loop top before the next iteration's body", async () => {
        const controller = new AbortController();
        const host = stubHost();
        // A source that aborts when its SECOND value is pulled — i.e. after the
        // first iteration fully completed (push + drain + onEmissions) but
        // before the second iteration's top-of-body check, which then returns.
        let pulls = 0;
        const source: AsyncIterable<CandleEvent> = {
            async *[Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
                pulls++;
                yield { kind: "close", bar: bar(1) };
                pulls++;
                controller.abort();
                yield { kind: "close", bar: bar(2) };
            },
        };
        const handle = createLightweightChartsAdapter({
            chartApi: new MockLwcApi(),
            candleSource: source,
            host,
        });
        await runRendererLoop(handle, { signal: controller.signal });
        // First iteration completed; the loop returned at the top of the
        // second before pushing it.
        expect(pulls).toBe(2);
        expect(host.push).toHaveBeenCalledTimes(1);
    });

    it("runs to completion and feeds emissions back", async () => {
        const chart = new MockLwcApi();
        const host = stubHost();
        (host.drain as ReturnType<typeof vi.fn>).mockResolvedValue(
            emissions({ plots: [plot(LINE_STYLE, { slotId: "loop" })] }),
        );
        const handle = createLightweightChartsAdapter({
            chartApi: chart,
            candleSource: eventSource([{ kind: "close", bar: bar(1) }]),
            host,
        });
        await runRendererLoop(handle);
        expect(host.push).toHaveBeenCalled();
        expect(host.drain).toHaveBeenCalled();
        expect(chart.calls.some((c) => c.kind === "addSeries" && c.seriesType === "Line")).toBe(
            true,
        );
    });
});

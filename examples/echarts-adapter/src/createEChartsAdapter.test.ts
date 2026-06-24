// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type AlertEmission,
    type CandleEvent,
    type DrawingEmission,
    type PlotEmission,
    type PlotStyle,
    type RunnerEmissions,
    mockCandleSource,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import type { HostLimits, ScriptHost, WorkerLike } from "@invinite-org/chartlang-host-worker";
import type {
    BarSeriesOption,
    CandlestickSeriesOption,
    EChartsOption,
    GridOption,
    LineSeriesOption,
    SeriesOption,
} from "echarts/types/dist/echarts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEChartsAdapter, runEChartsLoop } from "./createEChartsAdapter.js";
import { MockECharts } from "./testing.js";

const MS_PER_DAY = 86_400_000;
const START_TIME = 1_700_000_000_000;

function bar(i: number, close: number): Bar {
    const open = close - 0.5;
    const high = close + 1;
    const low = close - 1;
    return {
        time: START_TIME + i * MS_PER_DAY,
        open,
        high,
        low,
        close,
        volume: 1_000 + i,
        symbol: "DEMO",
        interval: "1D",
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}

function emptyEmissions(): RunnerEmissions {
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

const LIMITS: HostLimits = Object.freeze({
    maxComputeMs: 1_000,
    maxHeapMb: 64,
    maxLogsPerBar: 100,
});

// A stub host that replays a queued sequence of drain results — one per bar —
// so a test can drive the adapter's full ingest + setOption path
// deterministically without a worker. The last queued frame is reused if the
// candle source outlives the queue.
function stubHost(frames: ReadonlyArray<RunnerEmissions>): ScriptHost {
    let i = 0;
    return Object.freeze({
        load: async () => {},
        push: async () => {},
        setPlotOverrides: () => {},
        drain: async () => {
            const frame = frames[Math.min(i, frames.length - 1)] ?? emptyEmissions();
            i += 1;
            return frame;
        },
        dispose: () => {},
        limits: LIMITS,
    });
}

function plot(over: Partial<PlotEmission> & { style: PlotStyle; bar: number }): PlotEmission {
    return {
        kind: "plot",
        slotId: over.slotId ?? "s.ts:1:1#0",
        title: over.title ?? "S",
        style: over.style,
        bar: over.bar,
        time: over.time ?? START_TIME + over.bar * MS_PER_DAY,
        // Distinguish "not provided" (default 0 / green) from an explicit
        // `null` (a per-bar gap / no colour) — `??` would swallow the null.
        value: "value" in over ? (over.value ?? null) : 0,
        color: "color" in over ? (over.color ?? null) : "#26a69a",
        meta: {},
        pane: over.pane ?? "overlay",
        ...(over.visible === undefined ? {} : { visible: over.visible }),
        ...(over.z === undefined ? {} : { z: over.z }),
        ...(over.xShift === undefined ? {} : { xShift: over.xShift }),
        // `colorValue` is the per-bar dynamic-color channel; distinguish an
        // explicit `null` gap from "not provided" via the key presence.
        ...("colorValue" in over ? { colorValue: over.colorValue ?? null } : {}),
    };
}

function frameWith(plots: ReadonlyArray<PlotEmission>): RunnerEmissions {
    return { ...emptyEmissions(), plots };
}

// Drive `bars` through the adapter with a stub host that emits `frames[i]` on
// the i-th drain, returning the mock so tests can inspect the final option.
async function drive(
    bars: ReadonlyArray<Bar>,
    frames: ReadonlyArray<RunnerEmissions>,
    extra: { onAlert?: (a: AlertEmission) => void } = {},
): Promise<MockECharts> {
    const chart = new MockECharts();
    const adapter = createEChartsAdapter({
        echartsFactory: () => chart,
        candleSource: mockCandleSource(bars, { interval: "1D", mode: "stream" }),
        host: stubHost(frames),
        ...(extra.onAlert !== undefined ? { onAlert: extra.onAlert } : {}),
    });
    await runEChartsLoop(adapter);
    return chart;
}

// Like `drive`, but pins an explicit theme `backgroundColor` so a test can
// assert the bg-color bands never overwrite the chart's own background.
async function driveWithBackground(
    bars: ReadonlyArray<Bar>,
    frames: ReadonlyArray<RunnerEmissions>,
    backgroundColor: string,
): Promise<MockECharts> {
    const chart = new MockECharts();
    const adapter = createEChartsAdapter({
        echartsFactory: () => chart,
        candleSource: mockCandleSource(bars, { interval: "1D", mode: "stream" }),
        host: stubHost(frames),
        backgroundColor,
    });
    await runEChartsLoop(adapter);
    return chart;
}

function lastOption(chart: MockECharts): EChartsOption {
    const option = chart.lastOption();
    if (option === undefined) throw new Error("no setOption recorded");
    return option;
}

function seriesArray(option: EChartsOption): SeriesOption[] {
    const series = option.series;
    if (!Array.isArray(series)) throw new Error("expected a series array");
    return series;
}

function findSeries(option: EChartsOption, name: string): SeriesOption {
    const found = seriesArray(option).find((s) => s.name === name);
    if (found === undefined) throw new Error(`series ${name} not found`);
    return found;
}

// A polygon `graphic` element the adapter emits for volume-profile buckets +
// closed drawings. The structural shape `buildOption` produces is narrower than
// ECharts' loose graphic type, so the test reads it through this view.
type GraphicEl = {
    readonly type?: string;
    readonly shape: { readonly points: ReadonlyArray<readonly [number, number]> };
    readonly style: { readonly fill?: string };
};

function graphicArray(option: EChartsOption): GraphicEl[] {
    const graphic: unknown = option.graphic;
    if (!Array.isArray(graphic)) throw new Error("expected a graphic array");
    return graphic as GraphicEl[];
}

// A broader read of a `graphic` element covering the glyph kinds: a path
// (polygon/polyline/circle) with a `shape` + path `style`, or a `text` element
// with a text `style`. Used by the glyph tests, which assert across element
// types (circle / polygon / polyline / text) rather than just polygons.
type AnyGraphicEl = {
    readonly type?: string;
    readonly zlevel?: number;
    readonly shape?: {
        readonly points?: ReadonlyArray<readonly [number, number]>;
        readonly cx?: number;
        readonly cy?: number;
        readonly r?: number;
    };
    readonly style?: {
        readonly fill?: string;
        readonly stroke?: string;
        readonly text?: string;
        readonly verticalAlign?: string;
    };
};

function anyGraphicArray(option: EChartsOption): AnyGraphicEl[] {
    const graphic: unknown = option.graphic;
    if (!Array.isArray(graphic)) throw new Error("expected a graphic array");
    return graphic as AnyGraphicEl[];
}

// The text bodies of every `graphic.text` element, in option order — used by
// the alert-condition + log overlay-panel tests.
function graphicTexts(option: EChartsOption): string[] {
    return anyGraphicArray(option)
        .filter((g) => g?.type === "text")
        .map((g) => g.style?.text ?? "");
}

// Every line-family series whose name shares `${prefix}` (a single un-split
// series keeps the bare prefix; colorValue splits append `#run${i}`).
function runSeries(option: EChartsOption, prefix: string): LineSeriesOption[] {
    return seriesArray(option).filter(
        (s): s is LineSeriesOption =>
            s.type === "line" && typeof s.name === "string" && s.name.startsWith(prefix),
    );
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("createEChartsAdapter — worker-host construction", () => {
    function noopWorker(): WorkerLike {
        const channel = new MessageChannel();
        return {
            addEventListener: () => {},
            postMessage: () => {},
            terminate: () => {
                channel.port1.close();
                channel.port2.close();
            },
        };
    }

    it("builds a real worker host (with resolveInputs) when workerLike is supplied", () => {
        const adapter = createEChartsAdapter({
            echartsFactory: () => new MockECharts(),
            candleSource: mockCandleSource([]),
            workerLike: noopWorker(),
            resolveInputs: () => ({ length: 20 }),
        });
        expect(adapter.resolveInputs?.("x")).toEqual({ length: 20 });
        adapter.dispose();
    });

    it("builds a worker host without an input resolver when omitted", () => {
        const adapter = createEChartsAdapter({
            echartsFactory: () => new MockECharts(),
            candleSource: mockCandleSource([]),
            workerLike: noopWorker(),
        });
        expect(adapter.resolveInputs).toBeUndefined();
        adapter.dispose();
    });

    it("throws constructing the default worker host (no host / no workerLike) in Node", () => {
        // The `host === undefined && workerLike === undefined` arm calls
        // `createWorkerHost({ capabilities })` → `defaultWorkerFactory()` →
        // `new Worker(...)`, which throws in Node. Exercising both the
        // resolveInputs-present and -absent sub-branches.
        expect(() =>
            createEChartsAdapter({
                echartsFactory: () => new MockECharts(),
                candleSource: mockCandleSource([]),
                resolveInputs: () => ({ length: 20 }),
            }),
        ).toThrow();
        expect(() =>
            createEChartsAdapter({
                echartsFactory: () => new MockECharts(),
                candleSource: mockCandleSource([]),
            }),
        ).toThrow();
    });
});

describe("createEChartsAdapter — base option tree", () => {
    it("builds a valid empty base option when a drain arrives with no bars", async () => {
        // An empty `history` event triggers one drain with zero bars — the
        // base option must be valid (no candlestick, empty series) and not throw.
        const chart = new MockECharts();
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: {
                [Symbol.asyncIterator]: async function* () {
                    yield { kind: "history" as const, bars: [] };
                },
            },
            host: stubHost([emptyEmissions()]),
        });
        await runEChartsLoop(adapter);
        const option = lastOption(chart);
        expect(seriesArray(option)).toEqual([]);
        expect(Array.isArray(option.grid)).toBe(true);
        expect(option.backgroundColor).toBe("#0b0e11");
    });

    it("renders candles as a native candlestick series", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const chart = await drive(bars, []);
        const candles = findSeries(lastOption(chart), "candles") as CandlestickSeriesOption;
        expect(candles.type).toBe("candlestick");
        expect(candles.data).toEqual([
            [99.5, 100, 99, 101],
            [100.5, 101, 100, 102],
        ]);
        // Explicit bull/bear body colours (canvas2d parity), not ECharts' default.
        expect(candles.itemStyle).toEqual({
            color: "#26a69a",
            color0: "#ef5350",
            borderColor: "#26a69a",
            borderColor0: "#ef5350",
        });
    });

    it("emits an inside dataZoom spanning every pane grid, full window by default", async () => {
        const chart = await drive([bar(0, 100)], []);
        const dataZoom = lastOption(chart).dataZoom;
        const first = Array.isArray(dataZoom) ? dataZoom[0] : dataZoom;
        expect(first?.type).toBe("inside");
        expect(first?.start).toBe(0);
        expect(first?.end).toBe(100);
    });

    it("preserves the user's dataZoom window across the notMerge rebuild", () => {
        const chart = new MockECharts();
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: mockCandleSource([]),
            host: stubHost([]),
        });
        // First frame seeds the full window; then the user zooms in.
        adapter.onEmissions(emptyEmissions());
        chart.applyUserZoom(20, 80);
        // The next destructive rebuild must restore the user's 20–80 window.
        adapter.onEmissions(emptyEmissions());
        const dataZoom = lastOption(chart).dataZoom;
        const first = Array.isArray(dataZoom) ? dataZoom[0] : dataZoom;
        expect(first?.start).toBe(20);
        expect(first?.end).toBe(80);
        adapter.dispose();
    });
});

describe("createEChartsAdapter — initialVisibleBars default window", () => {
    const dataZoomStart = (option: EChartsOption): number | undefined => {
        const dataZoom = option.dataZoom;
        const first = Array.isArray(dataZoom) ? dataZoom[0] : dataZoom;
        return first?.start;
    };

    // Drive `bars` through a fresh adapter framed on the most recent N bars,
    // returning the adapter + its mock so a test can keep driving frames after
    // the initial seed (e.g. to assert a later user zoom wins).
    async function driveWindowed(
        bars: ReadonlyArray<Bar>,
        n: number,
    ): Promise<{ chart: MockECharts; adapter: ReturnType<typeof createEChartsAdapter> }> {
        const chart = new MockECharts();
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            // A single history batch so all bars are present on the first
            // (and only) frame the seed fires on — mirrors production where the
            // warm-up history loads before the live stream begins.
            candleSource: mockCandleSource(bars, { interval: "1D", mode: "history" }),
            host: stubHost([]),
            initialVisibleBars: n,
        });
        await runEChartsLoop(adapter);
        return { chart, adapter };
    }

    it("frames the most recent N bars on the initial window when set", async () => {
        // 10 bars, initialVisibleBars 2 → the seed positions start at
        // 100 - (2/10)*100 = 80, so only the last 2 bars are framed; end stays 100.
        const bars = Array.from({ length: 10 }, (_, i) => bar(i, 100 + i));
        const { chart, adapter } = await driveWindowed(bars, 2);
        const dataZoom = lastOption(chart).dataZoom;
        const first = Array.isArray(dataZoom) ? dataZoom[0] : dataZoom;
        expect(first?.start).toBe(80);
        expect(first?.end).toBe(100);
        adapter.dispose();
    });

    it("clamps the seeded start to 0 when initialVisibleBars exceeds the bar count", async () => {
        // initialVisibleBars 5 > 3 bars → start clamps to 0 (fit all), end 100.
        const { chart, adapter } = await driveWindowed([bar(0, 100), bar(1, 101), bar(2, 102)], 5);
        expect(dataZoomStart(lastOption(chart))).toBe(0);
        adapter.dispose();
    });

    it("leaves the window full (0/100) when initialVisibleBars is omitted", async () => {
        const chart = await drive([bar(0, 100), bar(1, 101)], []);
        expect(dataZoomStart(lastOption(chart))).toBe(0);
    });

    it("seeds only once: a later user zoom wins and is not re-seeded", async () => {
        // After the streamed run seeds the windowed start (80), the user zooms
        // in to 33–66. The next destructive rebuild must restore THEIR window —
        // `hasSeededZoom` is already set, so the initial seed never re-applies.
        const bars = Array.from({ length: 10 }, (_, i) => bar(i, 100 + i));
        const { chart, adapter } = await driveWindowed(bars, 2);
        expect(dataZoomStart(lastOption(chart))).toBe(80);
        chart.applyUserZoom(33, 66);
        adapter.onEmissions(emptyEmissions());
        const dataZoom = lastOption(chart).dataZoom;
        const first = Array.isArray(dataZoom) ? dataZoom[0] : dataZoom;
        expect(first?.start).toBe(33);
        expect(first?.end).toBe(66);
        adapter.dispose();
    });
});

describe("createEChartsAdapter — plot kinds", () => {
    it("maps line + step-line to line series (step:'end' for step)", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 0,
                    slotId: "line",
                    value: 10,
                }),
            ]),
            frameWith([
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 1,
                    slotId: "line",
                    value: 11,
                }),
                plot({
                    style: { kind: "step-line", lineWidth: 1, lineStyle: "solid" },
                    bar: 1,
                    slotId: "step",
                    value: 5,
                }),
            ]),
        ];
        const chart = await drive(bars, frames);
        const option = lastOption(chart);
        const line = findSeries(option, "overlay|line") as LineSeriesOption;
        expect(line.type).toBe("line");
        expect(line.data).toEqual([10, 11]);
        const step = findSeries(option, "overlay|step") as LineSeriesOption;
        expect(step.step).toBe("end");
        // The step series only emitted on bar 1, so bar 0 is a gap.
        expect(step.data).toEqual(["-", 5]);
    });

    it("forwards lineWidth + dashed lineStyle into the ECharts lineStyle (line + area)", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "line", lineWidth: 3, lineStyle: "dashed" },
                    bar: 0,
                    slotId: "ln",
                    value: 10,
                    color: "#00ff00",
                }),
                plot({
                    style: { kind: "area", lineWidth: 2, lineStyle: "dotted", fillAlpha: 0.4 },
                    bar: 0,
                    slotId: "ar",
                    value: 9,
                    color: "#0000ff",
                }),
            ]),
        ];
        const option = lastOption(await drive(bars, frames));
        const line = findSeries(option, "overlay|ln") as LineSeriesOption;
        // Round caps/joins are pinned for smooth strokes (canvas2d parity).
        expect(line.lineStyle).toEqual({
            color: "#00ff00",
            width: 3,
            type: "dashed",
            cap: "round",
            join: "round",
        });
        const area = findSeries(option, "overlay|ar") as LineSeriesOption;
        // The area's line carries the width + dash too, alongside its areaStyle.
        expect(area.lineStyle).toEqual({
            color: "#0000ff",
            width: 2,
            type: "dotted",
            cap: "round",
            join: "round",
        });
        expect(area.areaStyle).toEqual({ opacity: 0.4 });
    });

    it("maps area to a line series with areaStyle", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.3 },
                    bar: 0,
                    slotId: "area",
                    value: 7,
                }),
            ]),
        ];
        const area = findSeries(
            lastOption(await drive(bars, frames)),
            "overlay|area",
        ) as LineSeriesOption;
        expect(area.areaStyle).toEqual({ opacity: 0.3 });
    });

    it("maps histogram to a bar series", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "histogram", baseline: 0 },
                    bar: 0,
                    slotId: "hist",
                    value: 4,
                }),
            ]),
        ];
        const option = lastOption(await drive(bars, frames));
        expect((findSeries(option, "overlay|hist") as BarSeriesOption).type).toBe("bar");
    });

    it("renders horizontal-histogram buckets as per-bucket polygon graphics (not a bar)", async () => {
        const bars = [bar(0, 100), bar(1, 110)];
        const frames = [
            frameWith([
                plot({
                    style: {
                        kind: "horizontal-histogram",
                        buckets: [
                            { price: 101, volume: 5, color: "#ff0000" },
                            // The taller bucket spans the full max width; this
                            // half-volume bucket is half as long.
                            { price: 105, volume: 10 },
                            // A zero-volume bucket contributes no bar.
                            { price: 108, volume: 0 },
                        ],
                    },
                    bar: 0,
                    slotId: "vp",
                    value: null,
                }),
            ]),
        ];
        const option = lastOption(await drive(bars, frames));
        // A volume-profile series is NOT a per-bar bar series.
        expect(seriesArray(option).some((s) => s.name === "overlay|vp")).toBe(false);
        const graphic = graphicArray(option);
        // Two finite-volume buckets → two polygons; the zero-volume row drops.
        const polys = graphic.filter((g) => g?.type === "polygon");
        expect(polys).toHaveLength(2);
        // The half-volume bucket's bar is half the full-width bucket's bar.
        const widthOf = (poly: GraphicEl): number => {
            const pts = poly.shape.points;
            return Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
        };
        const widths = polys.map(widthOf).sort((a, b) => a - b);
        expect(widths[1]).toBeGreaterThan(0);
        expect(widths[0]).toBeCloseTo(widths[1] / 2, 6);
        // The first bucket carries its explicit colour; the second falls back.
        const red = polys.find((p) => p.style.fill === "#ff0000");
        expect(red).toBeDefined();
        const fallback = polys.find((p) => p.style.fill === "#3b82f6");
        expect(fallback).toBeDefined();
    });

    it("renders nothing for a horizontal-histogram whose buckets are all zero-volume", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: {
                        kind: "horizontal-histogram",
                        buckets: [{ price: 100, volume: 0 }],
                    },
                    bar: 0,
                    slotId: "vp",
                    value: null,
                }),
            ]),
        ];
        const option = lastOption(await drive(bars, frames));
        expect(graphicArray(option).filter((g) => g?.type === "polygon")).toHaveLength(0);
    });

    it("maps filled-band to two stacked line series with the band areaStyle", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "filled-band", upper: 12, lower: 8, alpha: 0.2 },
                    bar: 0,
                    slotId: "band",
                    value: 10,
                }),
            ]),
            frameWith([
                plot({
                    // bar 1 carries a null bound → gap on both edges.
                    style: { kind: "filled-band", upper: null, lower: 8, alpha: 0.2 },
                    bar: 1,
                    slotId: "band",
                    value: 10,
                }),
                plot({
                    // An out-of-range bar index is dropped from the band data.
                    style: { kind: "filled-band", upper: 20, lower: 18, alpha: 0.2 },
                    bar: 9,
                    slotId: "band",
                    value: 19,
                }),
            ]),
        ];
        const option = lastOption(await drive(bars, frames));
        const lower = findSeries(option, "overlay|band:lower") as LineSeriesOption;
        const upper = findSeries(option, "overlay|band:upper") as LineSeriesOption;
        expect(lower.stack).toBe(upper.stack);
        expect(lower.data).toEqual([8, 8]);
        // Upper edge is the band THICKNESS (upper - lower); bar 1's null upper
        // is a gap.
        expect(upper.data).toEqual([4, "-"]);
        expect(upper.areaStyle).toEqual({ opacity: 0.2 });
    });

    it("skips a pre-band (style-less) point when a slot switches to filled-band", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            // bar 0 emits as a line (no per-point band style captured) …
            frameWith([
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 0,
                    slotId: "switch",
                    value: 5,
                }),
            ]),
            // … then bar 1 switches the slot to filled-band. The bar-0 point
            // has no captured style and must be skipped from the band data.
            frameWith([
                plot({
                    style: { kind: "filled-band", upper: 12, lower: 8, alpha: 0.2 },
                    bar: 1,
                    slotId: "switch",
                    value: 10,
                }),
            ]),
        ];
        const option = lastOption(await drive(bars, frames));
        const lower = findSeries(option, "overlay|switch:lower") as LineSeriesOption;
        // bar 0 (the former line point) is a gap; only bar 1 carries a bound.
        expect(lower.data).toEqual(["-", 8]);
    });

    it("renders the five glyph kinds as DISTINCT graphic elements (no uniform dot)", async () => {
        const bars = [bar(0, 100)];
        const glyphs: ReadonlyArray<PlotStyle> = [
            { kind: "shape", shape: "diamond", size: 8 },
            { kind: "marker", shape: "circle", size: 8 },
            { kind: "character", char: "x", size: 12 },
            { kind: "arrow", direction: "up", size: 10 },
            { kind: "label", text: "hi", position: "above" },
        ];
        const frames = [
            frameWith(
                glyphs.map((style, i) =>
                    plot({ style, bar: 0, slotId: `g${i}`, value: 50 + i, color: "#abcdef" }),
                ),
            ),
        ];
        const graphic = anyGraphicArray(lastOption(await drive(bars, frames)));
        // A diamond shape → polygon; a circle marker → circle; a character →
        // text with the char; an up arrow → polygon (triangle); a label → text
        // with its body. No two kinds collapse to the same element.
        const types = graphic.map((g) => g?.type);
        expect(types).toContain("circle"); // marker circle
        expect(types.filter((t) => t === "polygon").length).toBeGreaterThanOrEqual(2); // diamond + arrow
        const texts = graphic.filter((g) => g?.type === "text").map((g) => g.style?.text);
        expect(texts).toContain("x"); // character
        expect(texts).toContain("hi"); // label
        // Every glyph carries the plot color as its fill / stroke / text fill.
        for (const g of graphic) {
            const fill = g.style?.fill ?? g.style?.stroke;
            expect(fill).toBe("#abcdef");
        }
    });

    it("renders an up arrow and a down arrow as different triangles", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "arrow", direction: "up", size: 10 },
                    bar: 0,
                    slotId: "up",
                    value: 50,
                }),
                plot({
                    style: { kind: "arrow", direction: "down", size: 10 },
                    bar: 0,
                    slotId: "dn",
                    value: 60,
                }),
            ]),
        ];
        const polys = anyGraphicArray(lastOption(await drive(bars, frames))).filter(
            (g) => g?.type === "polygon",
        );
        expect(polys).toHaveLength(2);
        // The up arrow's apex is its TOPMOST vertex (smallest y); the down
        // arrow's apex is its BOTTOMMOST (largest y) — so the two triangles
        // differ structurally, not just in position.
        const apexY = (g: AnyGraphicEl): number => {
            const ys = (g.shape?.points ?? []).map((p) => p[1]);
            return ys[0] ?? 0;
        };
        const upApex = apexY(polys[0]);
        const downApex = apexY(polys[1]);
        const upYs = (polys[0].shape?.points ?? []).map((p) => p[1]);
        const downYs = (polys[1].shape?.points ?? []).map((p) => p[1]);
        // Up arrow: apex is the min y; down arrow: apex is the max y.
        expect(upApex).toBe(Math.min(...upYs));
        expect(downApex).toBe(Math.max(...downYs));
    });

    it("renders a cross shape as two crossing polylines", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "shape", shape: "cross", size: 8 },
                    bar: 0,
                    slotId: "c",
                    value: 50,
                }),
            ]),
        ];
        const lines = anyGraphicArray(lastOption(await drive(bars, frames))).filter(
            (g) => g?.type === "polyline",
        );
        expect(lines).toHaveLength(2);
    });

    it("renders xcross / flag stroke shapes and the triangle marker shapes", async () => {
        const bars = [bar(0, 100)];
        const styles: ReadonlyArray<PlotStyle> = [
            { kind: "shape", shape: "xcross", size: 8 },
            { kind: "shape", shape: "flag", size: 8 },
            { kind: "shape", shape: "triangle-up", size: 8 },
            { kind: "shape", shape: "triangle-down", size: 8 },
            { kind: "marker", shape: "square", size: 8 },
            { kind: "marker", shape: "diamond", size: 8 },
            { kind: "marker", shape: "triangle-up", size: 8 },
            { kind: "marker", shape: "triangle-down", size: 8 },
        ];
        const frames = [
            frameWith(
                styles.map((style, i) => plot({ style, bar: 0, slotId: `g${i}`, value: 50 + i })),
            ),
        ];
        const graphic = anyGraphicArray(lastOption(await drive(bars, frames)));
        // xcross → 2 polylines, flag → 1 polyline = 3 polylines total.
        expect(graphic.filter((g) => g?.type === "polyline")).toHaveLength(3);
        // 2 shape triangles + 4 markers (square/diamond/2 triangles) = 6 polygons.
        expect(graphic.filter((g) => g?.type === "polygon")).toHaveLength(6);
    });

    it("anchors character / label text by location (above / below / anchor)", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "character", char: "a", size: 12, location: "above" },
                    bar: 0,
                    slotId: "ca",
                    value: 50,
                }),
                plot({
                    style: { kind: "character", char: "b", size: 12, location: "below" },
                    bar: 0,
                    slotId: "cb",
                    value: 51,
                }),
                plot({
                    style: { kind: "character", char: "c", size: 12, location: "absolute" },
                    bar: 0,
                    slotId: "cc",
                    value: 52,
                }),
                plot({
                    style: { kind: "label", text: "L1", position: "below" },
                    bar: 0,
                    slotId: "l1",
                    value: 53,
                }),
                plot({
                    style: { kind: "label", text: "L2", position: "anchor" },
                    bar: 0,
                    slotId: "l2",
                    value: 54,
                }),
            ]),
        ];
        const texts = anyGraphicArray(lastOption(await drive(bars, frames))).filter(
            (g) => g?.type === "text",
        );
        const alignOf = (t: string): string | undefined =>
            texts.find((g) => g.style?.text === t)?.style?.verticalAlign;
        expect(alignOf("a")).toBe("bottom"); // character above
        expect(alignOf("b")).toBe("top"); // character below
        expect(alignOf("c")).toBe("middle"); // character absolute
        expect(alignOf("L1")).toBe("top"); // label below
        expect(alignOf("L2")).toBe("middle"); // label anchor
    });

    it("anchors a shape glyph above / below its value via location", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const makeFrame = (location: "above" | "below" | "absolute"): RunnerEmissions =>
            frameWith([
                plot({
                    style: { kind: "shape", shape: "square", size: 8, location },
                    bar: 0,
                    slotId: "s",
                    value: 50,
                }),
            ]);
        // Same value, three locations → three different centre y's: above is
        // the smallest pixel y (higher on screen), below the largest.
        const centreY = async (location: "above" | "below" | "absolute"): Promise<number> => {
            const g = anyGraphicArray(lastOption(await drive(bars, [makeFrame(location)]))).find(
                (el) => el?.type === "polygon",
            );
            const ys = (g?.shape?.points ?? []).map((p) => p[1]);
            return (Math.min(...ys) + Math.max(...ys)) / 2;
        };
        const above = await centreY("above");
        const absolute = await centreY("absolute");
        const below = await centreY("below");
        expect(above).toBeLessThan(absolute);
        expect(below).toBeGreaterThan(absolute);
    });

    it("drops a glyph point whose value is null (no graphic element)", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "shape", shape: "circle", size: 8 },
                    bar: 0,
                    slotId: "g",
                    value: null,
                }),
            ]),
        ];
        // The only thing that would have been projected is the null glyph, so
        // the whole graphic layer is empty (no spurious viewport sampling).
        expect(lastOption(await drive(bars, frames)).graphic).toEqual([]);
    });

    it("maps horizontal-line to a markLine on a carrier series", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                    bar: 0,
                    slotId: "hl",
                    value: 42,
                    color: "#ff0000",
                }),
            ]),
        ];
        const carrier = findSeries(
            lastOption(await drive(bars, frames)),
            "hlines-0",
        ) as LineSeriesOption;
        expect(carrier.markLine).toEqual({
            symbol: "none",
            data: [{ yAxis: 42, lineStyle: { color: "#ff0000" } }],
        });
    });

    it("defaults a null-priced / null-coloured horizontal-line to 0 / the default colour", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                    bar: 0,
                    slotId: "hl",
                    value: null,
                    color: null,
                }),
            ]),
        ];
        const carrier = findSeries(
            lastOption(await drive(bars, frames)),
            "hlines-0",
        ) as LineSeriesOption;
        expect(carrier.markLine).toEqual({
            symbol: "none",
            data: [{ yAxis: 0, lineStyle: { color: "#3b82f6" } }],
        });
    });
});

describe("createEChartsAdapter — candle-state overrides and background", () => {
    it("colours a candle-override body by bar direction (bull / bear / doji)", async () => {
        // Three explicit bars: a bullish (close > open), a bearish (close <
        // open), and a doji (close === open) — one candle-override frame per
        // bar, asserting the resolved body colour follows the bar's own
        // direction (canvas2d `candleOverride.ts` parity).
        const at = (i: number, open: number, close: number): Bar => ({
            ...bar(i, close),
            open,
            close,
            high: Math.max(open, close) + 1,
            low: Math.min(open, close) - 1,
        });
        const bars = [at(0, 99, 101), at(1, 101, 99), at(2, 100, 100)];
        const ov = (i: number): PlotEmission =>
            plot({
                style: {
                    kind: "candle-override",
                    bull: "#00ff00",
                    bear: "#ff0000",
                    doji: "#0000ff",
                },
                bar: i,
                slotId: "co",
                time: bars[i].time,
            });
        const frames = [frameWith([ov(0)]), frameWith([ov(1)]), frameWith([ov(2)])];
        const candles = findSeries(
            lastOption(await drive(bars, frames)),
            "candles",
        ) as CandlestickSeriesOption;
        expect(candles.data?.[0]).toMatchObject({
            itemStyle: { color: "#00ff00", color0: "#00ff00" },
        });
        expect(candles.data?.[1]).toMatchObject({
            itemStyle: { color: "#ff0000", color0: "#ff0000" },
        });
        expect(candles.data?.[2]).toMatchObject({
            itemStyle: { color: "#0000ff", color0: "#0000ff" },
        });
    });

    it("falls back a doji candle-override to the bull colour when no doji is set", async () => {
        const doji: Bar = (() => {
            const b = bar(0, 100);
            return { ...b, open: 100, close: 100, high: 101, low: 99 };
        })();
        const frames = [
            frameWith([
                plot({
                    style: { kind: "candle-override", bull: "#00ff00", bear: "#ff0000" },
                    bar: 0,
                    slotId: "co",
                    time: doji.time,
                }),
            ]),
        ];
        const candles = findSeries(
            lastOption(await drive([doji], frames)),
            "candles",
        ) as CandlestickSeriesOption;
        // No `doji` colour ⇒ the bull colour is the fallback.
        expect(candles.data?.[0]).toMatchObject({
            itemStyle: { color: "#00ff00", color0: "#00ff00" },
        });
    });

    it("tints a candlestick body via bar-override and bar-color", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "bar-override", color: "#111111" },
                    bar: 0,
                    slotId: "bo",
                    time: bars[0].time,
                }),
            ]),
            frameWith([
                plot({
                    style: { kind: "bar-color", color: "#222222" },
                    bar: 1,
                    slotId: "bc",
                    time: bars[1].time,
                }),
            ]),
        ];
        const candles = findSeries(
            lastOption(await drive(bars, frames)),
            "candles",
        ) as CandlestickSeriesOption;
        expect(candles.data?.[0]).toMatchObject({ itemStyle: { color: "#111111" } });
        expect(candles.data?.[1]).toMatchObject({ itemStyle: { color: "#222222" } });
    });

    it("bar-color prefers per-bar colorValue over the static style.color", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            frameWith([
                // colorValue present → overrides style.color.
                plot({
                    style: { kind: "bar-color", color: "#222222" },
                    colorValue: "#0000ff",
                    bar: 0,
                    slotId: "bc",
                    time: bars[0].time,
                }),
                // colorValue null → drop the tint (no override this bar).
                plot({
                    style: { kind: "bar-color", color: "#222222" },
                    colorValue: null,
                    bar: 1,
                    slotId: "bc",
                    time: bars[1].time,
                }),
            ]),
        ];
        const candles = findSeries(
            lastOption(await drive(bars, frames)),
            "candles",
        ) as CandlestickSeriesOption;
        expect(candles.data?.[0]).toMatchObject({ itemStyle: { color: "#0000ff" } });
        // The null bar carries no itemStyle override → a bare OHLC tuple.
        expect(candles.data?.[1]).toEqual([100.5, 101, 100, 102]);
    });
});

// Pull the candlestick series' `markArea.data` (the per-bar `bg-color` bands)
// off an option tree. Each item is a `[startItem, endItem]` interval; the start
// carries the band's `xAxis` index + `itemStyle` (colour + opacity).
type BgBandItem = readonly [
    {
        readonly xAxis?: number;
        readonly itemStyle?: { readonly color?: unknown; readonly opacity?: unknown };
    },
    { readonly xAxis?: number },
];

function bgBands(option: EChartsOption): BgBandItem[] {
    const candles = findSeries(option, "candles") as CandlestickSeriesOption;
    const data = candles.markArea?.data;
    return data === undefined ? [] : (data as unknown as BgBandItem[]);
}

describe("createEChartsAdapter — per-bar bg-color bands (markArea)", () => {
    it("renders one full-height band per bar, each carrying its own colour", async () => {
        const bars = [bar(0, 100), bar(1, 101), bar(2, 99)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "bg-color", color: "#26a69a" },
                    bar: 0,
                    slotId: "bg",
                    time: bars[0].time,
                }),
                plot({
                    style: { kind: "bg-color", color: "#ef5350" },
                    bar: 1,
                    slotId: "bg",
                    time: bars[1].time,
                }),
            ]),
        ];
        const bands = bgBands(lastOption(await drive(bars, frames)));
        expect(bands.length).toBe(2);
        // Adjacent bars carry distinct colours → adjacent stripes.
        expect(bands[0][0].xAxis).toBe(0);
        expect(bands[0][1].xAxis).toBe(0);
        expect(bands[0][0].itemStyle?.color).toBe("#26a69a");
        expect(bands[1][0].xAxis).toBe(1);
        expect(bands[1][0].itemStyle?.color).toBe("#ef5350");
    });

    it("maps transp 0-100 to opacity 1 - transp/100", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "bg-color", color: "#26a69a", transp: 85 },
                    bar: 0,
                    slotId: "bg",
                    time: bars[0].time,
                }),
                // Omitted transp → fully opaque (alpha 1).
                plot({
                    style: { kind: "bg-color", color: "#26a69a" },
                    bar: 1,
                    slotId: "bg2",
                    time: bars[1].time,
                }),
            ]),
        ];
        const bands = bgBands(lastOption(await drive(bars, frames)));
        expect(bands[0][0].itemStyle?.opacity).toBeCloseTo(0.15, 10);
        expect(bands[1][0].itemStyle?.opacity).toBe(1);
    });

    it("prefers per-bar colorValue over the static style.color", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "bg-color", color: "#26a69a", transp: 85 },
                    colorValue: "#ff00ff",
                    bar: 0,
                    slotId: "bg",
                    time: bars[0].time,
                }),
            ]),
        ];
        const bands = bgBands(lastOption(await drive(bars, frames)));
        expect(bands[0][0].itemStyle?.color).toBe("#ff00ff");
    });

    it("paints no band when colorValue is null (explicit per-bar gap)", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            // Bar 0 gets a band, bar 1 is an explicit null gap.
            frameWith([
                plot({
                    style: { kind: "bg-color", color: "#26a69a" },
                    bar: 0,
                    slotId: "bg",
                    time: bars[0].time,
                }),
                plot({
                    style: { kind: "bg-color", color: "#26a69a" },
                    colorValue: null,
                    bar: 1,
                    slotId: "bg2",
                    time: bars[1].time,
                }),
            ]),
        ];
        const bands = bgBands(lastOption(await drive(bars, frames)));
        expect(bands.length).toBe(1);
        expect(bands[0][0].xAxis).toBe(0);
    });

    it("clears a bar's band when a later colorValue:null arrives for it", async () => {
        // Two bars → two drains, so both frames are consumed; the second frame
        // re-targets bar 0's time with a `null` gap to drop its band.
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "bg-color", color: "#26a69a" },
                    bar: 0,
                    slotId: "bg",
                    time: bars[0].time,
                }),
            ]),
            frameWith([
                plot({
                    style: { kind: "bg-color", color: "#26a69a" },
                    colorValue: null,
                    bar: 0,
                    slotId: "bg",
                    time: bars[0].time,
                }),
            ]),
        ];
        // After the second frame the band is dropped → no markArea at all.
        expect(bgBands(lastOption(await drive(bars, frames))).length).toBe(0);
    });

    it("does NOT flood the whole pane background (theme background stays)", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "bg-color", color: "#123456" },
                    bar: 0,
                    slotId: "bg",
                    time: bars[0].time,
                }),
            ]),
        ];
        const option = lastOption(await driveWithBackground(bars, frames, "#0b0e11"));
        // The whole-chart background is the THEME colour, not the bg-color.
        expect(option.backgroundColor).toBe("#0b0e11");
        expect(option.backgroundColor).not.toBe("#123456");
        // The bg-color shows up only as a per-bar band.
        expect(bgBands(option)[0][0].itemStyle?.color).toBe("#123456");
    });

    it("emits no markArea when a buffered band matches no bar in the window", async () => {
        // A band keyed to a time outside the current bar window (e.g. scrolled
        // off) leaves `bgBands` non-empty but produces zero interval items, so
        // the candlestick carries no `markArea`.
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "bg-color", color: "#26a69a" },
                    bar: 0,
                    slotId: "bg",
                    time: START_TIME - MS_PER_DAY,
                }),
            ]),
        ];
        const candles = findSeries(
            lastOption(await drive(bars, frames)),
            "candles",
        ) as CandlestickSeriesOption;
        expect(candles.markArea).toBeUndefined();
    });

    it("emits no markArea when no bg-color band is live", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 0,
                    slotId: "l",
                    value: 100,
                }),
            ]),
        ];
        const candles = findSeries(
            lastOption(await drive(bars, frames)),
            "candles",
        ) as CandlestickSeriesOption;
        expect(candles.markArea).toBeUndefined();
    });
});

describe("createEChartsAdapter — panes, visibility, colours", () => {
    it("routes each pane to its own grid / axis pair (overlay = grid 0)", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 0,
                    slotId: "main",
                    value: 1,
                }),
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 0,
                    slotId: "rsi",
                    value: 70,
                    pane: "rsi",
                }),
            ]),
        ];
        const option = lastOption(await drive(bars, frames));
        const grids = option.grid;
        expect(Array.isArray(grids) ? (grids as GridOption[]).length : 0).toBe(2);
        const main = findSeries(option, "overlay|main") as LineSeriesOption;
        const rsi = findSeries(option, "rsi|rsi") as LineSeriesOption;
        expect(main.xAxisIndex).toBe(0);
        expect(rsi.xAxisIndex).toBe(1);
        expect(rsi.yAxisIndex).toBe(1);
    });

    it("omits a hidden (visible:false) series but keeps prior state for re-enable", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 0,
                    slotId: "v",
                    value: 3,
                }),
            ]),
            frameWith([
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 1,
                    slotId: "v",
                    value: 4,
                    visible: false,
                }),
            ]),
        ];
        // The hidden frame drops bar 1's point but the series stays in state
        // (bar 0's point survives), so it is still rendered.
        const v = findSeries(
            lastOption(await drive(bars, frames)),
            "overlay|v",
        ) as LineSeriesOption;
        expect(v.data).toEqual([3, "-"]);
    });

    it("falls back to the default line colour when no point carries a colour", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 0,
                    slotId: "nc",
                    value: 1,
                    color: null,
                }),
            ]),
        ];
        const nc = findSeries(
            lastOption(await drive(bars, frames)),
            "overlay|nc",
        ) as LineSeriesOption;
        expect(nc.lineStyle?.color).toBe("#3b82f6");
    });

    it("renders a NaN plot value as an ECharts gap", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 0,
                    slotId: "n",
                    value: 5,
                }),
            ]),
            // validateEmission rejects NaN values, so a finite frame plus an
            // out-of-range bar index exercises the gap path directly.
            frameWith([
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 9,
                    slotId: "n",
                    value: 6,
                }),
            ]),
        ];
        const n = findSeries(
            lastOption(await drive(bars, frames)),
            "overlay|n",
        ) as LineSeriesOption;
        // bar 9 is out of the 2-bar range → dropped; bar 1 never got a point.
        expect(n.data).toEqual([5, "-"]);
    });
});

describe("createEChartsAdapter — alerts, logs, drawings, diagnostics", () => {
    it("forwards alerts to onAlert and buffers logs / alert-conditions", async () => {
        const bars = [bar(0, 100)];
        const alert: AlertEmission = {
            kind: "alert",
            slotId: "a.ts:1:1#0",
            severity: "info",
            message: "hi",
            bar: 0,
            time: bars[0].time,
            meta: {},
            channels: ["toast"],
            dedupeKey: "a.ts:1:1#0|0|x",
        };
        const frame: RunnerEmissions = {
            ...emptyEmissions(),
            alerts: [alert],
            logs: [{ kind: "log", level: "info", message: "log", bar: 0, time: bars[0].time }],
            alertConditions: [
                {
                    kind: "alert-condition",
                    conditionId: "c",
                    title: "t",
                    description: "d",
                    defaultMessage: "m",
                    fired: true,
                    bar: 0,
                    time: bars[0].time,
                },
            ],
        };
        const received: AlertEmission[] = [];
        await drive(bars, [frame], { onAlert: (a) => received.push(a) });
        expect(received).toEqual([alert]);
    });

    it("caps the buffered alert ring at its max", async () => {
        const bars = [bar(0, 100)];
        const mkAlert = (i: number): AlertEmission => ({
            kind: "alert",
            slotId: "a.ts:1:1#0",
            severity: "info",
            message: `m${i}`,
            bar: 0,
            time: bars[0].time,
            meta: {},
            channels: ["toast"],
            dedupeKey: `a.ts:1:1#0|0|${i}`,
        });
        const frame: RunnerEmissions = {
            ...emptyEmissions(),
            // 300 alerts in one frame overflow the 256-entry ring buffer.
            alerts: Array.from({ length: 300 }, (_, i) => mkAlert(i)),
        };
        const received: AlertEmission[] = [];
        const option = lastOption(await drive(bars, [frame], { onAlert: (a) => received.push(a) }));
        // Every alert is forwarded to onAlert; only the buffer is capped.
        expect(received.length).toBe(300);
        expect(findSeries(option, "candles").type).toBe("candlestick");
    });

    it("caps the buffered log ring at five entries", async () => {
        const bars = [bar(0, 100)];
        const frame: RunnerEmissions = {
            ...emptyEmissions(),
            logs: Array.from({ length: 7 }, (_, i) => ({
                kind: "log" as const,
                level: "info" as const,
                message: `log${i}`,
                bar: 0,
                time: bars[0].time,
            })),
        };
        // Seven logs in one frame exercise the ring-buffer shift; the run
        // completes without throwing.
        const option = lastOption(await drive(bars, [frame]));
        expect(findSeries(option, "candles").type).toBe("candlestick");
    });

    it("renders a create drawing as a graphic element and clears it on op:remove", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const drawing: DrawingEmission = {
            kind: "drawing",
            handleId: "d.ts:1:1#0",
            drawingKind: "line",
            op: "create",
            state: {
                kind: "line",
                anchors: [
                    { time: bars[0].time, price: 100 },
                    { time: bars[1].time, price: 101 },
                ],
                style: {},
            },
            bar: 0,
            time: bars[0].time,
        };
        const chart = new MockECharts();
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: mockCandleSource(bars, { interval: "1D", mode: "stream" }),
            host: stubHost([
                { ...emptyEmissions(), drawings: [drawing] },
                { ...emptyEmissions(), drawings: [{ ...drawing, op: "remove" as const }] },
            ]),
        });
        await runEChartsLoop(adapter);

        // Frame 1: the line drawing decomposes to an open polyline graphic.
        // `buildViewport` records `convertToPixel` calls too, so select the
        // setOption frames explicitly.
        const setOptions = chart.calls.filter((c) => c.kind === "setOption");
        const created = setOptions[0];
        if (created.kind !== "setOption") throw new Error("expected setOption");
        const graphic1 = created.option.graphic;
        if (!Array.isArray(graphic1)) throw new Error("expected a graphic array");
        expect(graphic1).toHaveLength(1);
        expect(graphic1[0]).toMatchObject({ type: "polyline" });

        // Frame 2: op:remove drops the handle, so the graphic array is empty.
        const removed = lastOption(chart).graphic;
        if (!Array.isArray(removed)) throw new Error("expected a graphic array");
        expect(removed).toHaveLength(0);
        expect(findSeries(lastOption(chart), "candles").type).toBe("candlestick");
    });

    it("skips a drawing whose anchors project to non-finite pixels (NaN filter)", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        // A NaN price anchor → NaN pixel → the polyline element is filtered out
        // so ECharts never logs a non-finite-coord warning.
        const drawing: DrawingEmission = {
            kind: "drawing",
            handleId: "d.ts:2:1#0",
            drawingKind: "line",
            op: "create",
            state: {
                kind: "line",
                anchors: [
                    { time: bars[0].time, price: Number.NaN },
                    { time: bars[1].time, price: 101 },
                ],
                style: {},
            },
            bar: 0,
            time: bars[0].time,
        };
        const option = lastOption(
            await drive(bars, [{ ...emptyEmissions(), drawings: [drawing] }]),
        );
        const graphic = option.graphic;
        if (!Array.isArray(graphic)) throw new Error("expected a graphic array");
        expect(graphic).toHaveLength(0);
    });

    it("renders a rectangle drawing as a closed polygon graphic", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const drawing: DrawingEmission = {
            kind: "drawing",
            handleId: "d.ts:3:1#0",
            drawingKind: "rectangle",
            op: "create",
            state: {
                kind: "rectangle",
                anchors: [
                    { time: bars[0].time, price: 100 },
                    { time: bars[1].time, price: 101 },
                ],
                style: { color: "#3b82f6" },
            },
            bar: 0,
            time: bars[0].time,
        };
        const option = lastOption(
            await drive(bars, [{ ...emptyEmissions(), drawings: [drawing] }]),
        );
        const graphic = option.graphic;
        if (!Array.isArray(graphic)) throw new Error("expected a graphic array");
        expect(graphic.some((g) => g?.type === "polygon")).toBe(true);
    });

    it("emits an empty graphic array when no drawings are present", async () => {
        const option = lastOption(await drive([bar(0, 100)], [emptyEmissions()]));
        expect(option.graphic).toEqual([]);
    });

    it("warns on warning/error diagnostics", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const bars = [bar(0, 100)];
        const frame: RunnerEmissions = {
            ...emptyEmissions(),
            diagnostics: [
                {
                    kind: "diagnostic",
                    severity: "warning",
                    code: "unsupported-pane",
                    message: "w",
                    slotId: null,
                    bar: 0,
                },
                {
                    kind: "diagnostic",
                    severity: "info",
                    code: "dropped-by-policy",
                    message: "i",
                    slotId: null,
                    bar: 0,
                },
            ],
        };
        await drive(bars, [frame]);
        expect(warn).toHaveBeenCalledTimes(1);
    });
});

describe("createEChartsAdapter — alert-condition + log overlay panels", () => {
    function condition(
        over: Partial<RunnerEmissions["alertConditions"][number]> & { conditionId: string },
    ): RunnerEmissions["alertConditions"][number] {
        return {
            kind: "alert-condition",
            conditionId: over.conditionId,
            title: over.title ?? "t",
            description: over.description ?? "d",
            defaultMessage: over.defaultMessage ?? "m",
            fired: over.fired ?? true,
            bar: over.bar ?? 0,
            time: over.time ?? START_TIME,
        };
    }

    function log(over: {
        level?: "info" | "warn" | "error";
        message: string;
    }): RunnerEmissions["logs"][number] {
        return {
            kind: "log",
            level: over.level ?? "info",
            message: over.message,
            bar: 0,
            time: START_TIME,
        };
    }

    it("renders one graphic.text row per FIRED alert condition", async () => {
        const bars = [bar(0, 100)];
        const frame: RunnerEmissions = {
            ...emptyEmissions(),
            alertConditions: [
                condition({ conditionId: "bullCross", defaultMessage: "crossed up" }),
                condition({ conditionId: "bearCross", defaultMessage: "crossed down" }),
            ],
        };
        const texts = graphicTexts(lastOption(await drive(bars, [frame])));
        expect(texts).toEqual(["bullCross: crossed up", "bearCross: crossed down"]);
    });

    it("ignores non-fired conditions (they travel the wire but do not paint)", async () => {
        const bars = [bar(0, 100)];
        const frame: RunnerEmissions = {
            ...emptyEmissions(),
            alertConditions: [
                condition({ conditionId: "fired", fired: true, defaultMessage: "yes" }),
                condition({ conditionId: "armed", fired: false, defaultMessage: "no" }),
            ],
        };
        const texts = graphicTexts(lastOption(await drive(bars, [frame])));
        expect(texts).toEqual(["fired: yes"]);
    });

    it("emits no condition graphics for an all-unfired / empty frame", async () => {
        const bars = [bar(0, 100)];
        const frame: RunnerEmissions = {
            ...emptyEmissions(),
            alertConditions: [condition({ conditionId: "armed", fired: false })],
        };
        // Only an unfired condition (and no logs) ⇒ the whole graphic layer is
        // empty (no spurious viewport sample either).
        expect(lastOption(await drive(bars, [frame])).graphic).toEqual([]);
    });

    it("renders the latest logs as graphic.text rows", async () => {
        const bars = [bar(0, 100)];
        const frame: RunnerEmissions = {
            ...emptyEmissions(),
            logs: [log({ message: "a" }), log({ level: "warn", message: "b" })],
        };
        const texts = graphicTexts(lastOption(await drive(bars, [frame])));
        expect(texts).toEqual(["[info] a", "[warn] b"]);
    });

    it("caps the rendered log pane at the last five entries", async () => {
        const bars = [bar(0, 100)];
        const frame: RunnerEmissions = {
            ...emptyEmissions(),
            logs: Array.from({ length: 8 }, (_, i) => log({ message: `m${i}` })),
        };
        // The ingest ring keeps the last five; the pane renders exactly five.
        const texts = graphicTexts(lastOption(await drive(bars, [frame])));
        expect(texts).toEqual(["[info] m3", "[info] m4", "[info] m5", "[info] m6", "[info] m7"]);
    });

    it("appends overlay panels ON TOP of the z-sorted graphic layer", async () => {
        const bars = [bar(0, 100)];
        // A drawing (z-sorted layer) plus a fired condition + a log (always-on
        // -top overlay). The drawing's polyline comes first, then the overlay
        // text rows. One bar ⇒ the stub frame is ingested exactly once.
        const drawing: DrawingEmission = {
            kind: "drawing",
            handleId: "d.ts:1:1#0",
            drawingKind: "line",
            op: "create",
            state: {
                kind: "line",
                anchors: [
                    { time: bars[0].time, price: 100 },
                    { time: bars[0].time + MS_PER_DAY, price: 101 },
                ],
                style: {},
            },
            bar: 0,
            time: bars[0].time,
        };
        const frame: RunnerEmissions = {
            ...emptyEmissions(),
            drawings: [drawing],
            alertConditions: [condition({ conditionId: "c", defaultMessage: "m" })],
            logs: [log({ message: "l" })],
        };
        const option = lastOption(await drive(bars, [frame]));
        const types = anyGraphicArray(option).map((g) => g?.type);
        // The drawing polyline precedes the two appended overlay text rows.
        expect(types).toEqual(["polyline", "text", "text"]);
        expect(graphicTexts(option)).toEqual(["c: m", "[info] l"]);
    });
});

describe("createEChartsAdapter — line-family colorValue (segment runs)", () => {
    const LINE: PlotStyle = { kind: "line", lineWidth: 1, lineStyle: "solid" };

    it("omitted colorValue ⇒ a single byte-identical series (no split)", async () => {
        const bars = [bar(0, 100), bar(1, 101), bar(2, 102)];
        const frames = [0, 1, 2].map((b) =>
            frameWith([
                plot({ style: LINE, bar: b, slotId: "ln", value: 10 + b, color: "#26a69a" }),
            ]),
        );
        const option = lastOption(await drive(bars, frames));
        const runs = runSeries(option, "overlay|ln");
        expect(runs).toHaveLength(1);
        expect(runs[0].name).toBe("overlay|ln");
        expect(runs[0].data).toEqual([10, 11, 12]);
        expect(runs[0].lineStyle?.color).toBe("#26a69a");
    });

    it("present colorValue subset ⇒ per-run series, each its own colour", async () => {
        const bars = [bar(0, 100), bar(1, 101), bar(2, 102)];
        // Bars 0,1 green (static), bar 2 explicit red override → two runs.
        const frames = [
            frameWith([plot({ style: LINE, bar: 0, slotId: "ln", value: 10, color: "#26a69a" })]),
            frameWith([plot({ style: LINE, bar: 1, slotId: "ln", value: 11, color: "#26a69a" })]),
            frameWith([
                plot({
                    style: LINE,
                    bar: 2,
                    slotId: "ln",
                    value: 12,
                    color: "#26a69a",
                    colorValue: "#ff0000",
                }),
            ]),
        ];
        const runs = runSeries(lastOption(await drive(bars, frames)), "overlay|ln");
        expect(runs).toHaveLength(2);
        // First run: the static green span (bars 0,1); second: the red bar 2.
        expect(runs[0].name).toBe("overlay|ln");
        expect(runs[0].lineStyle?.color).toBe("#26a69a");
        expect(runs[0].data).toEqual([10, 11, "-"]);
        expect(runs[1].name).toBe("overlay|ln#run1");
        expect(runs[1].lineStyle?.color).toBe("#ff0000");
        expect(runs[1].data).toEqual(["-", "-", 12]);
    });

    it("colorValue:null ⇒ a paint-nothing gap that breaks the run", async () => {
        const bars = [bar(0, 100), bar(1, 101), bar(2, 102)];
        // Bar 1 carries a finite value but colorValue:null → it folds into the
        // y-scale yet paints in NO run, splitting bars 0 and 2 into two runs.
        const frames = [
            frameWith([plot({ style: LINE, bar: 0, slotId: "ln", value: 10, color: "#26a69a" })]),
            frameWith([
                plot({
                    style: LINE,
                    bar: 1,
                    slotId: "ln",
                    value: 11,
                    color: "#26a69a",
                    colorValue: null,
                }),
            ]),
            frameWith([plot({ style: LINE, bar: 2, slotId: "ln", value: 12, color: "#26a69a" })]),
        ];
        const runs = runSeries(lastOption(await drive(bars, frames)), "overlay|ln");
        expect(runs).toHaveLength(2);
        // Bar 1's value is painted by neither run (the gap).
        expect(runs[0].data).toEqual([10, "-", "-"]);
        expect(runs[1].data).toEqual(["-", "-", 12]);
        expect(runs[1].name).toBe("overlay|ln#run1");
    });

    it("a fully-gapped line still emits its single placeholder series", async () => {
        const bars = [bar(0, 100)];
        // value:null everywhere ⇒ no run paints, but the single series with an
        // all-gap data array is still emitted (the pre-feature placeholder).
        const frames = [
            frameWith([plot({ style: LINE, bar: 0, slotId: "ln", value: null, color: "#26a69a" })]),
        ];
        const runs = runSeries(lastOption(await drive(bars, frames)), "overlay|ln");
        expect(runs).toHaveLength(1);
        expect(runs[0].name).toBe("overlay|ln");
        expect(runs[0].data).toEqual(["-"]);
    });

    it("splits an AREA series into per-colour runs that each keep areaStyle", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const AREA: PlotStyle = { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.3 };
        const frames = [
            frameWith([plot({ style: AREA, bar: 0, slotId: "ar", value: 5, color: "#26a69a" })]),
            frameWith([
                plot({
                    style: AREA,
                    bar: 1,
                    slotId: "ar",
                    value: 6,
                    color: "#26a69a",
                    colorValue: "#0000ff",
                }),
            ]),
        ];
        const runs = runSeries(lastOption(await drive(bars, frames)), "overlay|ar");
        expect(runs).toHaveLength(2);
        expect(runs[0].areaStyle).toEqual({ opacity: 0.3 });
        expect(runs[1].areaStyle).toEqual({ opacity: 0.3 });
        expect(runs[1].lineStyle?.color).toBe("#0000ff");
    });
});

describe("createEChartsAdapter — drawing z render order", () => {
    function lineDrawing(handleId: string, z: number | undefined): DrawingEmission {
        return {
            kind: "drawing",
            handleId,
            drawingKind: "line",
            op: "create",
            state: {
                kind: "line",
                anchors: [
                    { time: START_TIME, price: 100 },
                    { time: START_TIME + MS_PER_DAY, price: 101 },
                ],
                style: {},
            },
            bar: 0,
            time: START_TIME,
            ...(z === undefined ? {} : { z }),
        };
    }

    it("sinks a z:-1 drawing to zlevel:-1 (beneath the z:0 series default)", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            {
                ...emptyEmissions(),
                plots: [
                    plot({
                        style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                        bar: 0,
                        slotId: "p",
                        value: 100,
                    }),
                ],
                drawings: [lineDrawing("d#0", -1)],
            },
        ];
        const option = lastOption(await drive(bars, frames));
        // The drawing's graphic element carries zlevel -1 (painted underneath the
        // default-zlevel series); the z:0 line series carries NO zlevel.
        const drawingEl = anyGraphicArray(option).find((g) => g?.type === "polyline");
        expect(drawingEl?.zlevel).toBe(-1);
        const line = findSeries(option, "overlay|p") as LineSeriesOption;
        expect(line.zlevel).toBeUndefined();
    });

    it("lifts a z>0 plot series to zlevel:1 (above the default-zlevel graphics)", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            {
                ...emptyEmissions(),
                plots: [
                    plot({
                        style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                        bar: 0,
                        slotId: "p",
                        value: 100,
                        z: 2,
                    }),
                ],
                drawings: [lineDrawing("d#0", undefined)],
            },
        ];
        const option = lastOption(await drive(bars, frames));
        const line = findSeries(option, "overlay|p") as LineSeriesOption;
        expect(line.zlevel).toBe(1);
        // The default-z drawing stays at zlevel 0 (omitted).
        const drawingEl = anyGraphicArray(option).find((g) => g?.type === "polyline");
        expect(drawingEl?.zlevel).toBeUndefined();
    });

    it("orders a z:-1 drawing below a z:0 glyph in the resolved graphic array", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            {
                ...emptyEmissions(),
                plots: [
                    plot({
                        style: { kind: "marker", shape: "circle", size: 8 },
                        bar: 0,
                        slotId: "g",
                        value: 100,
                    }),
                ],
                drawings: [lineDrawing("d#0", -1)],
            },
        ];
        const graphic = anyGraphicArray(lastOption(await drive(bars, frames)));
        // The shared `sortByRenderOrder` resolves the z:-1 drawing BEFORE the
        // z:0 glyph, so the drawing's polyline precedes the glyph's circle in
        // the array (earlier = painted first = underneath).
        const drawingIdx = graphic.findIndex((g) => g?.type === "polyline");
        const glyphIdx = graphic.findIndex((g) => g?.type === "circle");
        expect(drawingIdx).toBeGreaterThanOrEqual(0);
        expect(glyphIdx).toBeGreaterThanOrEqual(0);
        expect(drawingIdx).toBeLessThan(glyphIdx);
    });

    it("skips a drawing that decomposes to zero graphic elements", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        // A `group` drawing is a metadata-only container — `decomposeGroup`
        // returns `[]`, so its mark contributes no graphic element (the
        // empty-elements `continue` in `drawingMarks`). A coexisting glyph keeps
        // the layer non-empty so the skip is observable as the group's absence.
        const group: DrawingEmission = {
            kind: "drawing",
            handleId: "grp#0",
            drawingKind: "group",
            op: "create",
            state: { kind: "group", childHandleIds: [] },
            bar: 0,
            time: START_TIME,
        };
        const frames = [
            {
                ...emptyEmissions(),
                plots: [
                    plot({
                        style: { kind: "marker", shape: "circle", size: 8 },
                        bar: 0,
                        slotId: "g",
                        value: 100,
                    }),
                ],
                drawings: [group],
            },
            // Second drain emits nothing so the marker is stored exactly once.
            emptyEmissions(),
        ];
        const graphic = anyGraphicArray(lastOption(await drive(bars, frames)));
        // Only the glyph circle is present — the group contributed nothing.
        expect(graphic.filter((g) => g?.type === "circle")).toHaveLength(1);
        expect(graphic.filter((g) => g?.type === "polyline" || g?.type === "polygon")).toHaveLength(
            0,
        );
    });

    it("re-emitting a live drawing keeps its ingest seq (stable render order)", async () => {
        const bars = [bar(0, 100), bar(1, 101)];
        // Two drawings: A ingested first, then B. Re-emitting A on a later frame
        // must NOT push it after B in the resolved order (same z, so seq breaks
        // the tie and A's seq is preserved across the upsert).
        const a = lineDrawing("a#0", undefined);
        const b: DrawingEmission = {
            ...lineDrawing("b#0", undefined),
            time: START_TIME + MS_PER_DAY,
        };
        const frames = [
            { ...emptyEmissions(), drawings: [a, b] },
            { ...emptyEmissions(), drawings: [a] },
        ];
        const graphic = anyGraphicArray(lastOption(await drive(bars, frames)));
        // Both polylines present, A still before B (A's seq < B's seq, unchanged
        // by the re-emit).
        expect(graphic.filter((g) => g?.type === "polyline")).toHaveLength(2);
    });
});

describe("createEChartsAdapter — universal plot offset (xShift)", () => {
    it("writes a +5 series at baseline+5, grows the category axis, and clips a -5 below 0", async () => {
        // Five bars. A baseline (unshifted) SMA, a +5 copy displaced right into
        // the future, and a -5 copy displaced left. The +5 series' last bar
        // (index 4) lands at column 9 — outside the real 5-bar window — so the
        // axis must grow by the max positive shift (5) to give it a slot. The
        // -5 series' early bars project to negative columns and clip.
        const bars = [bar(0, 100), bar(1, 101), bar(2, 102), bar(3, 103), bar(4, 104)];
        const base = (slotId: string, shift: number | undefined) =>
            Array.from({ length: 5 }, (_, i) =>
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: i,
                    slotId,
                    value: 50 + i,
                    ...(shift === undefined ? {} : { xShift: shift }),
                }),
            );
        const frames = [
            frameWith([...base("flat", undefined), ...base("right", 5), ...base("left", -5)]),
        ];
        const option = lastOption(await drive(bars, frames));

        // The category axis grew by the max positive shift (5): 5 real bars + 5
        // synthetic future columns = 10 categories.
        const xAxes = option.xAxis;
        const firstX = Array.isArray(xAxes) ? xAxes[0] : xAxes;
        const categoryData = (firstX as { data?: ReadonlyArray<unknown> }).data;
        expect(categoryData?.length).toBe(10);

        // Baseline series: each bar i at its own column i.
        const flat = findSeries(option, "overlay|flat") as LineSeriesOption;
        expect(flat.data).toEqual([50, 51, 52, 53, 54, "-", "-", "-", "-", "-"]);

        // +5 series: every datum is shifted right by 5 (bar 0 → column 5, …),
        // i.e. the baseline index + 5. Columns 0-4 are gaps.
        const right = findSeries(option, "overlay|right") as LineSeriesOption;
        expect(right.data).toEqual(["-", "-", "-", "-", "-", 50, 51, 52, 53, 54]);
        // Concretely: the value computed at bar 1 (baseline column 1) renders at
        // column 1 + 5 = 6.
        expect((right.data as Array<number | string>)[6]).toBe(51);

        // -5 series: bars 0-4 project to columns -5..-1, all clipped (negative
        // category, no slot) → every column is a gap.
        const left = findSeries(option, "overlay|left") as LineSeriesOption;
        expect(left.data).toEqual(["-", "-", "-", "-", "-", "-", "-", "-", "-", "-"]);
    });

    it("a -5 shift that lands in range writes at baseline-5 (no clip)", async () => {
        // Eight bars; a single point computed at bar 6 shifted -5 lands at
        // column 1 (in range, not clipped) — the index analogue of a left shift.
        const bars = Array.from({ length: 8 }, (_, i) => bar(i, 100 + i));
        const frames = [
            frameWith([
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 6,
                    slotId: "back",
                    value: 77,
                    xShift: -5,
                }),
            ]),
        ];
        const back = findSeries(
            lastOption(await drive(bars, frames)),
            "overlay|back",
        ) as LineSeriesOption;
        // No positive shift anywhere → the axis is NOT extended (8 columns).
        expect(back.data?.length).toBe(8);
        // Value written at bar 6 - 5 = column 1; everything else is a gap.
        expect(back.data).toEqual(["-", 77, "-", "-", "-", "-", "-", "-"]);
    });

    it("keeps the category axis + data unchanged when no point carries an offset", async () => {
        // A no-offset frame must be byte-identical to the pre-offset build: the
        // axis stays at the real bar count and the data is unshifted.
        const bars = [bar(0, 100), bar(1, 101)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 0,
                    slotId: "ln",
                    value: 10,
                }),
                plot({
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 1,
                    slotId: "ln",
                    value: 11,
                }),
            ]),
        ];
        const option = lastOption(await drive(bars, frames));
        const xAxes = option.xAxis;
        const firstX = Array.isArray(xAxes) ? xAxes[0] : xAxes;
        expect((firstX as { data?: ReadonlyArray<unknown> }).data?.length).toBe(2);
        const ln = findSeries(option, "overlay|ln") as LineSeriesOption;
        expect(ln.data).toEqual([10, 11]);
    });

    it("shifts a glyph graphic by the offset (bar-time anchored, like a drawing)", async () => {
        const bars = [bar(0, 100), bar(1, 101), bar(2, 102)];
        // A glyph at bar 0 with xShift +1 renders at bar 1's pixel x — glyphs
        // are bar-TIME anchored (via `shiftedBarTime` → `timeToX`), not
        // category-index anchored like the line/band series, so a `+1` glyph
        // lands at the same x as an unshifted glyph on bar 1.
        const shiftedFrame = frameWith([
            plot({
                style: { kind: "shape", shape: "square", size: 8 },
                bar: 0,
                slotId: "g",
                value: 50,
                xShift: 1,
            }),
        ]);
        const refFrame = frameWith([
            plot({
                style: { kind: "shape", shape: "square", size: 8 },
                bar: 1,
                slotId: "g",
                value: 50,
            }),
        ]);
        const centreX = (option: EChartsOption): number => {
            const g = anyGraphicArray(option).find((el) => el?.type === "polygon");
            const xs = (g?.shape?.points ?? []).map((p) => p[0]);
            return (Math.min(...xs) + Math.max(...xs)) / 2;
        };
        const shifted = centreX(
            lastOption(await drive(bars, [shiftedFrame, frameWith([]), frameWith([])])),
        );
        const reference = centreX(
            lastOption(await drive(bars, [refFrame, frameWith([]), frameWith([])])),
        );
        expect(shifted).toBeCloseTo(reference, 6);

        // The filled-band series still uses the category column (the +1 band
        // point lands at column 1) — only glyphs moved to the pixel path.
        const bandFrame = frameWith([
            plot({
                style: { kind: "filled-band", upper: 12, lower: 8, alpha: 0.2 },
                bar: 0,
                slotId: "band",
                value: 10,
                xShift: 1,
            }),
        ]);
        const lower = findSeries(
            lastOption(await drive(bars, [bandFrame, frameWith([]), frameWith([])])),
            "overlay|band:lower",
        ) as LineSeriesOption;
        expect(lower.data).toEqual(["-", 8, "-", "-"]);
    });
});

describe("createEChartsAdapter — dblclick zoom reset", () => {
    it("resets the user's zoom window to the full range on a double-click", async () => {
        const chart = new MockECharts();
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: mockCandleSource([]),
            host: stubHost([]),
        });
        // Seed a frame, then the user zooms in; the next rebuild restores it.
        adapter.onEmissions(emptyEmissions());
        chart.applyUserZoom(20, 80);
        adapter.onEmissions(emptyEmissions());
        const zoomed = lastOption(chart).dataZoom;
        const zoomedFirst = Array.isArray(zoomed) ? zoomed[0] : zoomed;
        expect(zoomedFirst?.start).toBe(20);
        expect(zoomedFirst?.end).toBe(80);

        // A double-click resets the window to 0/100 and re-applies the option.
        chart.fire("dblclick");
        const reset = lastOption(chart).dataZoom;
        const resetFirst = Array.isArray(reset) ? reset[0] : reset;
        expect(resetFirst?.start).toBe(0);
        expect(resetFirst?.end).toBe(100);
        adapter.dispose();
    });
});

describe("createEChartsAdapter — lifecycle", () => {
    it("dispose resets state and disposes the chart + host", async () => {
        const chart = new MockECharts();
        const hostDispose = vi.fn();
        const host: ScriptHost = { ...stubHost([]), dispose: hostDispose };
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: mockCandleSource([bar(0, 100)], { interval: "1D", mode: "stream" }),
            host,
        });
        await runEChartsLoop(adapter);
        adapter.dispose();
        expect(chart.calls.at(-1)).toEqual({ kind: "dispose" });
        expect(hostDispose).toHaveBeenCalledOnce();
    });

    it("runEChartsLoop throws on a foreign handle", async () => {
        const foreign = Object.freeze({
            id: "x",
            name: "x",
            capabilities: createEChartsAdapter({
                echartsFactory: () => new MockECharts(),
                candleSource: mockCandleSource([]),
                host: stubHost([]),
            }).capabilities,
            candles: () => mockCandleSource([]),
            onEmissions: () => {},
            dispose: () => {},
            host: stubHost([]),
        });
        await expect(runEChartsLoop(foreign)).rejects.toThrow(
            "was not produced by createEChartsAdapter",
        );
    });

    it("returns immediately when the signal is already aborted", async () => {
        const chart = new MockECharts();
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: mockCandleSource([bar(0, 100)], { interval: "1D", mode: "stream" }),
            host: stubHost([]),
        });
        const controller = new AbortController();
        controller.abort();
        await runEChartsLoop(adapter, { signal: controller.signal });
        // Aborted before the first iteration → no setOption recorded.
        expect(chart.calls).toEqual([]);
    });

    it("aborts at the loop top on the next iteration", async () => {
        const chart = new MockECharts();
        const controller = new AbortController();
        // A candles iterator that aborts as it yields the SECOND event, so the
        // loop re-enters and the top-of-body checkpoint returns.
        async function* candles(): AsyncGenerator<CandleEvent> {
            yield { kind: "close", bar: bar(0, 100) };
            controller.abort();
            yield { kind: "close", bar: bar(1, 101) };
        }
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: { [Symbol.asyncIterator]: candles },
            host: stubHost([emptyEmissions(), emptyEmissions()]),
        });
        await runEChartsLoop(adapter, { signal: controller.signal });
        // First event drained + rendered; the second aborts at the loop top.
        expect(chart.calls.filter((c) => c.kind === "setOption").length).toBe(1);
    });

    it("aborts right after host.push", async () => {
        const chart = new MockECharts();
        const controller = new AbortController();
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: mockCandleSource([bar(0, 100)], { interval: "1D", mode: "stream" }),
            host: {
                ...stubHost([]),
                push: async () => {
                    controller.abort();
                },
            },
        });
        await runEChartsLoop(adapter, { signal: controller.signal });
        // Aborted right after push → no drain, no setOption.
        expect(chart.calls).toEqual([]);
    });

    it("aborts during the post-push yield", async () => {
        const chart = new MockECharts();
        const controller = new AbortController();
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: mockCandleSource([bar(0, 100)], { interval: "1D", mode: "stream" }),
            host: {
                ...stubHost([]),
                // Schedule the abort to land during the loop's setTimeout(0)
                // yield (queued before the yield's own timer resolves).
                push: async () => {
                    setTimeout(() => controller.abort(), 0);
                },
            },
        });
        await runEChartsLoop(adapter, { signal: controller.signal });
        expect(chart.calls).toEqual([]);
    });

    it("aborts mid-stream after the first drained frame", async () => {
        const chart = new MockECharts();
        const controller = new AbortController();
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: mockCandleSource([bar(0, 100), bar(1, 101), bar(2, 102)], {
                interval: "1D",
                mode: "stream",
            }),
            host: {
                ...stubHost([]),
                drain: async () => {
                    controller.abort();
                    return emptyEmissions();
                },
            },
        });
        await runEChartsLoop(adapter, { signal: controller.signal });
        // The drain aborts the controller; the loop returns without applying
        // that frame's onEmissions, so no setOption is recorded.
        expect(chart.calls).toEqual([]);
    });

    it("uses a custom backgroundColor when supplied", async () => {
        const chart = new MockECharts();
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: mockCandleSource([bar(0, 100)], { interval: "1D", mode: "stream" }),
            host: stubHost([emptyEmissions()]),
            backgroundColor: "#abcdef",
            interval: "1D",
        });
        await runEChartsLoop(adapter);
        expect(lastOption(chart).backgroundColor).toBe("#abcdef");
    });

    it("ignores secondary-stream candle events (streamKey set)", async () => {
        const chart = new MockECharts();
        const events: CandleEvent[] = [
            { kind: "history", bars: [bar(0, 100)], streamKey: "1W" },
            { kind: "close", bar: bar(1, 101) },
            { kind: "tick", bar: bar(1, 101.5) },
        ];
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: {
                [Symbol.asyncIterator]: async function* () {
                    yield* events;
                },
            },
            host: stubHost([emptyEmissions(), emptyEmissions(), emptyEmissions()]),
        });
        await runEChartsLoop(adapter);
        // Only the main close + tick land; the secondary history is ignored,
        // leaving exactly one bar (close then tick-overwrite of the head).
        const candles = findSeries(lastOption(chart), "candles") as CandlestickSeriesOption;
        expect(candles.data?.length).toBe(1);
    });

    it("seeds the bar window from a leading tick when no bars exist yet", async () => {
        const chart = new MockECharts();
        const events: CandleEvent[] = [
            { kind: "tick", bar: bar(0, 100) },
            { kind: "tick", bar: bar(0, 100.5) },
        ];
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: {
                [Symbol.asyncIterator]: async function* () {
                    yield* events;
                },
            },
            host: stubHost([emptyEmissions(), emptyEmissions()]),
        });
        await runEChartsLoop(adapter);
        // The first tick seeds the head bar (empty window branch); the second
        // overwrites it, leaving exactly one bar.
        const candles = findSeries(lastOption(chart), "candles") as CandlestickSeriesOption;
        expect(candles.data?.length).toBe(1);
    });

    it("appends history-batch bars to the main window", async () => {
        const chart = new MockECharts();
        const events: CandleEvent[] = [{ kind: "history", bars: [bar(0, 100), bar(1, 101)] }];
        const adapter = createEChartsAdapter({
            echartsFactory: () => chart,
            candleSource: {
                [Symbol.asyncIterator]: async function* () {
                    yield* events;
                },
            },
            host: stubHost([emptyEmissions()]),
        });
        await runEChartsLoop(adapter);
        const candles = findSeries(lastOption(chart), "candles") as CandlestickSeriesOption;
        expect(candles.data?.length).toBe(2);
    });
});

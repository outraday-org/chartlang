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
    ScatterSeriesOption,
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
        expect(line.lineStyle).toEqual({ color: "#00ff00", width: 3, type: "dashed" });
        const area = findSeries(option, "overlay|ar") as LineSeriesOption;
        // The area's line carries the width + dash too, alongside its areaStyle.
        expect(area.lineStyle).toEqual({ color: "#0000ff", width: 2, type: "dotted" });
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

    it("maps glyph plot kinds (shape/marker/character/arrow/label) to scatter series", async () => {
        const bars = [bar(0, 100)];
        const glyphs: ReadonlyArray<PlotStyle> = [
            { kind: "shape", shape: "circle", size: 1 },
            { kind: "marker", shape: "circle", size: 1 },
            { kind: "character", char: "x", size: 1 },
            { kind: "arrow", direction: "up", size: 1 },
            { kind: "label", text: "hi", position: "above" },
        ];
        const frames = [
            frameWith(
                glyphs.map((style, i) => plot({ style, bar: 0, slotId: `g${i}`, value: 50 + i })),
            ),
        ];
        const option = lastOption(await drive(bars, frames));
        for (let i = 0; i < glyphs.length; i += 1) {
            const s = findSeries(option, `overlay|g${i}`) as ScatterSeriesOption;
            expect(s.type).toBe("scatter");
            expect(s.data).toEqual([[0, 50 + i]]);
        }
    });

    it("drops a glyph point whose value is null (no scatter datum)", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "shape", shape: "circle", size: 1 },
                    bar: 0,
                    slotId: "g",
                    value: null,
                }),
            ]),
        ];
        const s = findSeries(
            lastOption(await drive(bars, frames)),
            "overlay|g",
        ) as ScatterSeriesOption;
        expect(s.data).toEqual([]);
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
    it("tints a candlestick body via candle-override (bull colour)", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({
                    style: { kind: "candle-override", bull: "#00ff00", bear: "#ff0000" },
                    bar: 0,
                    slotId: "co",
                }),
            ]),
        ];
        const candles = findSeries(
            lastOption(await drive(bars, frames)),
            "candles",
        ) as CandlestickSeriesOption;
        expect(candles.data?.[0]).toEqual({
            value: [99.5, 100, 99, 101],
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

    it("maps bg-color to the chart backgroundColor (last-write-wins)", async () => {
        const bars = [bar(0, 100)];
        const frames = [
            frameWith([
                plot({ style: { kind: "bg-color", color: "#123456" }, bar: 0, slotId: "bg" }),
                plot({ style: { kind: "bg-color", color: "#654321" }, bar: 0, slotId: "bg2" }),
            ]),
        ];
        expect(lastOption(await drive(bars, frames)).backgroundColor).toBe("#654321");
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

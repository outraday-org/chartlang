// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Cross-adapter guardrail: ONE multi-plot + universal-`offset` (xShift)
// scenario driven through ALL FIVE example adapters' headless mocks. Each
// adapter must render three DISTINCTLY-positioned, DISTINCTLY-coloured line
// series. This catches the offset-collapse + colour-collapse class of bug:
// before the fix the universal `offset` was dropped for echarts / konva /
// uplot / lightweight-charts (the +5 / −5 copies collapsed onto the
// unshifted x), and uplot additionally hardcoded a single blue stroke for
// every series (all three series read `#3b82f6`). Both regressions would
// turn the assertions below RED.

import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import {
    type WorkerBootScope,
    type WorkerLike,
    createWorkerBoot,
    createWorkerHost,
} from "@invinite-org/chartlang-host-worker";
import {
    CANVAS2D_CAPABILITIES,
    createCanvas2dAdapter,
    runRendererLoop as runCanvas2dLoop,
} from "chartlang-example-canvas2d-adapter";
import { MockCanvas2DContext } from "chartlang-example-canvas2d-adapter/testing";
import { createEChartsAdapter, runEChartsLoop } from "chartlang-example-echarts-adapter";
import { MockECharts } from "chartlang-example-echarts-adapter/testing";
import { createKonvaAdapter, feedCandleEvent } from "chartlang-example-konva-adapter";
import { MockKonva } from "chartlang-example-konva-adapter/testing";
import type { RecordedNode } from "chartlang-example-konva-adapter/testing";
import {
    LWC_CAPABILITIES,
    LWC_SYM_INFO,
    createLightweightChartsAdapter,
    runRendererLoop as runLwcLoop,
} from "chartlang-example-lightweight-charts-adapter";
import { MockLwcApi } from "chartlang-example-lightweight-charts-adapter/testing";
import {
    UPLOT_CAPABILITIES,
    UPLOT_SYM_INFO,
    createUplotAdapter,
    runUplotLoop,
} from "chartlang-example-uplot-adapter";
import { makeMockUplotFactory } from "chartlang-example-uplot-adapter/testing";
import { describe, expect, it } from "vitest";

import {
    COLORS_IN_ORDER,
    OFFSET_BARS,
    OFFSET_MANIFEST,
    OFFSET_MODULE_SOURCE,
    SHIFT_LEFT_COLOR,
    SHIFT_RIGHT_COLOR,
    UNSHIFTED_COLOR,
} from "./cross-adapter-offset.fixture";

// `Map<color, positioned-x[]>` — the finite-point positions of each coloured
// series along its adapter-native x axis (pixel x / data index / aligned
// column / native time). Ordered by source bar so element `k` of each colour's
// array describes the SAME source bar.
type SeriesXByColor = Map<string, ReadonlyArray<number>>;

// Pair a `MessageChannel`-backed `WorkerLike` (host side) with a
// `WorkerBootScope` (boot side). Identical to every adapter's integration
// test — the bundle runs through the real worker shim, not a stub host.
function pair(): { worker: WorkerLike; scope: WorkerBootScope } {
    const ch = new MessageChannel();
    ch.port1.start();
    ch.port2.start();
    const worker: WorkerLike = {
        addEventListener(type, listener) {
            if (type !== "message") return;
            ch.port1.addEventListener("message", (ev) => {
                listener(ev as MessageEvent<unknown>);
            });
        },
        postMessage(msg) {
            ch.port1.postMessage(msg);
        },
        terminate() {
            ch.port1.close();
            ch.port2.close();
        },
    };
    const scope: WorkerBootScope = {
        addEventListener(_type, listener) {
            ch.port2.addEventListener("message", (ev) => {
                void listener(ev as MessageEvent<never>);
            });
        },
        postMessage(msg) {
            ch.port2.postMessage(msg);
        },
    };
    return { worker, scope };
}

const STREAM = { interval: "1D", mode: "stream" } as const;

// ---------------------------------------------------------------------------
// canvas2d — reads the canvas call log: each plot strokes a polyline whose
// strokeStyle is the series colour; the `moveTo` / `lineTo` x's are the
// positioned pixel x.
// ---------------------------------------------------------------------------
async function runCanvas2d(): Promise<SeriesXByColor> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    const ctx = new MockCanvas2DContext();
    const adapter = createCanvas2dAdapter({
        canvas: { width: 960, height: 480 },
        ctx,
        candleSource: mockCandleSource(OFFSET_BARS, STREAM),
        capabilities: CANVAS2D_CAPABILITIES,
        host: createWorkerHost({ capabilities: CANVAS2D_CAPABILITIES, workerLike: worker }),
    });
    await adapter.host.load({ moduleSource: OFFSET_MODULE_SOURCE, manifest: OFFSET_MANIFEST });
    await runCanvas2dLoop(adapter);
    adapter.dispose();
    return polylineXByColor(ctx.calls);
}

// Walk a canvas call log, grouping each polyline's `moveTo`/`lineTo` x's by
// the strokeStyle in force when the polyline was drawn. Used by canvas2d AND
// uplot (both paint to a `MockCanvasContext`). The final frame's polylines
// win — a `Map` keyed by colour keeps only the last (fully-warmed) series.
function polylineXByColor(
    calls: ReadonlyArray<MockCanvas2DContext["calls"][number]>,
): SeriesXByColor {
    const wanted = new Set<string>(COLORS_IN_ORDER);
    const out = new Map<string, number[]>();
    let stroke: string | undefined;
    let current: number[] | undefined;
    for (const call of calls) {
        if (call.kind === "set" && call.prop === "strokeStyle") {
            stroke = typeof call.value === "string" ? call.value : undefined;
            current = undefined;
            continue;
        }
        if (!stroke || !wanted.has(stroke)) continue;
        if (call.kind === "moveTo") {
            current = [call.x];
            out.set(stroke, current);
            continue;
        }
        if (call.kind === "lineTo" && current) current.push(call.x);
    }
    return out;
}

// ---------------------------------------------------------------------------
// konva — reads the series-layer Line nodes: each plot is one `Line` whose
// `config.stroke` is the colour and `config.points` is a flat
// `[x0,y0,x1,y1,…]` array (even entries are the positioned x).
// ---------------------------------------------------------------------------
async function runKonva(): Promise<SeriesXByColor> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    const konva = new MockKonva();
    const adapter = createKonvaAdapter({
        konva,
        stage: { width: 960, height: 480 },
        candleSource: mockCandleSource(OFFSET_BARS, STREAM),
        workerLike: worker,
        resolveInputs: () => ({}),
    });
    await adapter.host.load({ moduleSource: OFFSET_MODULE_SOURCE, manifest: OFFSET_MANIFEST });
    for await (const event of adapter.candles({ interval: "1D" })) {
        feedCandleEvent(adapter, event);
        await adapter.host.push(event);
        adapter.onEmissions(await adapter.host.drain());
    }
    // roots: [Stage, seriesLayer, drawingsLayer, axisLayer, …].
    const seriesLayer = konva.roots[1];
    adapter.dispose();

    const wanted = new Set<string>(COLORS_IN_ORDER);
    const out = new Map<string, number[]>();
    const walk = (node: RecordedNode): void => {
        if (node.type === "Line") {
            const stroke = node.config.stroke;
            const points = node.config.points;
            if (typeof stroke === "string" && wanted.has(stroke) && Array.isArray(points)) {
                const xs: number[] = [];
                for (let i = 0; i < points.length; i += 2) {
                    const x = points[i];
                    if (typeof x === "number") xs.push(x);
                }
                out.set(stroke, xs);
            }
        }
        for (const child of node.children) walk(child);
    };
    walk(seriesLayer);
    return out;
}

// ---------------------------------------------------------------------------
// echarts — reads the built `EChartsOption`: each plot is a `line` series whose
// `lineStyle.color` is the colour and whose `data` array carries the value at
// the SHIFTED category column (`bar + xShift`); non-occupied columns hold `"-"`.
// The positioned x is the data-array INDEX of each finite value.
// ---------------------------------------------------------------------------
async function runECharts(): Promise<SeriesXByColor> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    const chart = new MockECharts();
    const adapter = createEChartsAdapter({
        echartsFactory: () => chart,
        candleSource: mockCandleSource(OFFSET_BARS, STREAM),
        workerLike: worker,
        resolveInputs: () => ({}),
    });
    await adapter.host.load({ moduleSource: OFFSET_MODULE_SOURCE, manifest: OFFSET_MANIFEST });
    await runEChartsLoop(adapter);
    const option = chart.lastOption();
    adapter.dispose();
    if (option === undefined) throw new Error("echarts: no setOption recorded");

    const series: unknown = option.series;
    if (!Array.isArray(series)) throw new Error("echarts: expected a series array");
    const wanted = new Set<string>(COLORS_IN_ORDER);
    const out = new Map<string, number[]>();
    for (const candidate of series) {
        const line = asLineSeries(candidate);
        if (line === undefined || !wanted.has(line.color)) continue;
        const xs: number[] = [];
        line.data.forEach((datum, index) => {
            if (typeof datum === "number" && Number.isFinite(datum)) xs.push(index);
        });
        out.set(line.color, xs);
    }
    return out;
}

// Structurally narrow an ECharts series object (the option tree is loosely
// typed) into the `line` shape this guardrail reads: its `lineStyle.color`
// and its `data` array (value-or-`"-"` per category column). Echarts types are
// not resolvable from the repo root (only inside the echarts-adapter package),
// so narrow from `unknown` rather than importing them.
function asLineSeries(
    candidate: unknown,
): { readonly color: string; readonly data: ReadonlyArray<unknown> } | undefined {
    if (typeof candidate !== "object" || candidate === null) return undefined;
    const record = candidate as Record<string, unknown>;
    if (record.type !== "line") return undefined;
    const data = record.data;
    if (!Array.isArray(data)) return undefined;
    const lineStyle = record.lineStyle;
    if (typeof lineStyle !== "object" || lineStyle === null) return undefined;
    const color = (lineStyle as Record<string, unknown>).color;
    if (typeof color !== "string") return undefined;
    return { color, data };
}

// ---------------------------------------------------------------------------
// uplot — reads the latest aligned data + the per-series strokes: `opts.series`
// (recorded at construction) carries one `{ stroke }` per plot slot; the last
// `setData` record carries `AlignedData = [xs, ...valueRows]`. Value row `i`
// belongs to series spec `i`; the positioned x is the COLUMN index of each
// finite value.
// ---------------------------------------------------------------------------
async function runUplot(): Promise<SeriesXByColor> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    const { factory, instances } = makeMockUplotFactory();
    const adapter = createUplotAdapter({
        target: {} as HTMLElement,
        width: 960,
        height: 480,
        uplotFactory: factory,
        candleSource: mockCandleSource(OFFSET_BARS, STREAM),
        capabilities: UPLOT_CAPABILITIES,
        host: createWorkerHost({
            capabilities: UPLOT_CAPABILITIES,
            symInfo: UPLOT_SYM_INFO,
            workerLike: worker,
        }),
    });
    await adapter.host.load({ moduleSource: OFFSET_MODULE_SOURCE, manifest: OFFSET_MANIFEST });
    await runUplotLoop(adapter);
    const overlay = instances[0];
    adapter.dispose();

    const created = overlay.records.find((r) => r.kind === "new");
    if (created?.kind !== "new") throw new Error("uplot: no construction record");
    const strokes = created.opts.series.map((spec) => spec.stroke);

    let data: ReadonlyArray<ReadonlyArray<number | null>> | undefined;
    for (let i = overlay.records.length - 1; i >= 0; i -= 1) {
        const rec = overlay.records[i];
        if (rec.kind === "setData") {
            data = rec.data;
            break;
        }
    }
    if (data === undefined) throw new Error("uplot: no setData record");

    const wanted = new Set<string>(COLORS_IN_ORDER);
    const out = new Map<string, number[]>();
    strokes.forEach((stroke, seriesIndex) => {
        if (!wanted.has(stroke)) return;
        const row = data?.[seriesIndex + 1]; // row 0 is the xs (time) row.
        if (row === undefined) return;
        const xs: number[] = [];
        row.forEach((value, column) => {
            if (typeof value === "number" && Number.isFinite(value)) xs.push(column);
        });
        out.set(stroke, xs);
    });
    return out;
}

// ---------------------------------------------------------------------------
// lightweight-charts — each plot slot is its OWN native `Line` series; the
// recorded `update` calls carry the SHIFTED native `time`. The mock does not
// record the series colour, so the three line series are keyed by declaration
// order (= the three script colours). The positioned x is the native time.
// ---------------------------------------------------------------------------
async function runLwc(): Promise<SeriesXByColor> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    const chart = new MockLwcApi();
    const adapter = createLightweightChartsAdapter({
        chartApi: chart,
        candleSource: mockCandleSource(OFFSET_BARS, STREAM),
        capabilities: LWC_CAPABILITIES,
        host: createWorkerHost({
            capabilities: LWC_CAPABILITIES,
            symInfo: LWC_SYM_INFO,
            workerLike: worker,
        }),
    });
    await adapter.host.load({ moduleSource: OFFSET_MODULE_SOURCE, manifest: OFFSET_MANIFEST });
    await runLwcLoop(adapter);
    const calls = chart.calls;
    adapter.dispose();

    // The candlestick is the first `addSeries` (`s0`); the three plot slots are
    // the next three `Line` series in declaration order. Map each line series'
    // ordinal to its declared colour, then collect its `update` times.
    const lineSeriesIds: string[] = [];
    for (const call of calls) {
        if (call.kind === "addSeries" && call.seriesType === "Line") {
            lineSeriesIds.push(call.seriesId);
        }
    }
    const timesBySeries = new Map<string, number[]>();
    for (const call of calls) {
        if (call.kind === "update" && lineSeriesIds.includes(call.seriesId)) {
            const list = timesBySeries.get(call.seriesId) ?? [];
            list.push(call.time);
            timesBySeries.set(call.seriesId, list);
        }
    }
    const out = new Map<string, number[]>();
    lineSeriesIds.forEach((seriesId, ordinal) => {
        const color = COLORS_IN_ORDER[ordinal];
        if (color === undefined) return;
        out.set(color, timesBySeries.get(seriesId) ?? []);
    });
    return out;
}

// ---------------------------------------------------------------------------
// The uniform assertion. Every adapter must render exactly three distinctly
// coloured line series whose interior positions strictly order +5 > unshifted
// > −5 along the adapter's native x axis.
// ---------------------------------------------------------------------------
function assertDistinctlyPositioned(label: string, byColor: SeriesXByColor): void {
    // Exactly three line series, one per script colour. (Catches uplot's former
    // all-blue collapse: a single stroke would leave only one keyed colour.)
    expect(byColor.size, `${label}: expected 3 line series`).toBe(3);

    const unshifted = byColor.get(UNSHIFTED_COLOR);
    const right = byColor.get(SHIFT_RIGHT_COLOR);
    const left = byColor.get(SHIFT_LEFT_COLOR);
    expect(unshifted, `${label}: missing unshifted (${UNSHIFTED_COLOR})`).toBeDefined();
    expect(right, `${label}: missing +5 (${SHIFT_RIGHT_COLOR})`).toBeDefined();
    expect(left, `${label}: missing −5 (${SHIFT_LEFT_COLOR})`).toBeDefined();
    if (unshifted === undefined || right === undefined || left === undefined) return;

    // All three carry finite, plotted points (the SMA warmed up).
    expect(unshifted.length, `${label}: unshifted has no points`).toBeGreaterThan(0);
    expect(right.length, `${label}: +5 has no points`).toBeGreaterThan(0);
    expect(left.length, `${label}: −5 has no points`).toBeGreaterThan(0);

    // The three colours are DISTINCT (three keys ⇒ already distinct, asserted
    // explicitly for the colour-collapse class of bug).
    expect(new Set([UNSHIFTED_COLOR, SHIFT_RIGHT_COLOR, SHIFT_LEFT_COLOR]).size).toBe(3);

    // Compare a REPRESENTATIVE INTERIOR point shared by all three series, well
    // away from the warmup head and the data edge so neither a ±5 shift nor an
    // extrapolated/clipped column distorts it. All three series have the same
    // count of finite points (same SMA over the same bars), so element `k`
    // describes the same source bar across colours.
    const n = Math.min(unshifted.length, right.length, left.length);
    expect(n, `${label}: too few shared points`).toBeGreaterThan(4);
    const k = Math.floor(n / 2);

    // The +5 copy draws strictly to the RIGHT (greater x) of the unshifted, and
    // the −5 copy strictly to the LEFT (smaller x) — the offset-collapse catch.
    expect(right[k], `${label}: +5 not right of unshifted at k=${k}`).toBeGreaterThan(unshifted[k]);
    expect(left[k], `${label}: −5 not left of unshifted at k=${k}`).toBeLessThan(unshifted[k]);
}

describe("cross-adapter offset + colour guardrail", () => {
    it("canvas2d renders three distinctly-positioned, distinctly-coloured SMA series", async () => {
        assertDistinctlyPositioned("canvas2d", await runCanvas2d());
    });

    it("konva renders three distinctly-positioned, distinctly-coloured SMA series", async () => {
        assertDistinctlyPositioned("konva", await runKonva());
    });

    it("echarts renders three distinctly-positioned, distinctly-coloured SMA series", async () => {
        assertDistinctlyPositioned("echarts", await runECharts());
    });

    it("uplot renders three distinctly-positioned, distinctly-coloured SMA series", async () => {
        assertDistinctlyPositioned("uplot", await runUplot());
    });

    it("lightweight-charts renders three distinctly-positioned, distinctly-coloured SMA series", async () => {
        assertDistinctlyPositioned("lightweight-charts", await runLwc());
    });
});

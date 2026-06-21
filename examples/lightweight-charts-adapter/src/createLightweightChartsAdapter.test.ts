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

    it("filled-band creates two line series and updates both edges", async () => {
        const chart = await runWithPlots([
            plot({ kind: "filled-band", upper: 5, lower: 1, alpha: 0.2 }, { slotId: "band" }),
        ]);
        const lines = chart.calls.filter((c) => c.kind === "addSeries" && c.seriesType === "Line");
        expect(lines).toHaveLength(2);
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

    it("shape / character / arrow / marker / label set markers on the candle series", async () => {
        const chart = await runWithPlots([
            plot({ kind: "shape", shape: "flag", size: 1 }, { slotId: "sh" }),
            plot({ kind: "character", char: "X", size: 1 }, { slotId: "ch" }),
            plot({ kind: "arrow", direction: "up", size: 1 }, { slotId: "ar" }),
            plot({ kind: "marker", shape: "circle", size: 1 }, { slotId: "mk" }),
            plot({ kind: "label", text: "hi", position: "above" }, { slotId: "lb" }),
        ]);
        expect(chart.calls.filter((c) => c.kind === "setMarkers")).toHaveLength(5);
    });

    it("a marker with a null value is skipped", async () => {
        const chart = await runWithPlots([
            plot({ kind: "shape", shape: "flag", size: 1 }, { slotId: "sh", value: null }),
        ]);
        expect(chart.calls.some((c) => c.kind === "setMarkers")).toBe(false);
    });

    it("candle-override / bar-override / bar-color tint the candle series", async () => {
        const chart = await runWithPlots([
            plot({ kind: "candle-override", bull: "#0f0", bear: "#f00" }, { slotId: "co" }),
            plot({ kind: "bar-override", color: "#00f" }, { slotId: "bo" }),
            plot({ kind: "bar-color", color: "#0ff" }, { slotId: "bc" }),
        ]);
        const tints = chart.calls.filter(
            (c) => c.kind === "applyOptions" && "upColor" in c.options,
        );
        expect(tints).toHaveLength(3);
    });

    it("bg-color and horizontal-histogram are documented no-ops", async () => {
        const chart = await runWithPlots([
            plot({ kind: "bg-color", color: "#222" }, { slotId: "bg" }),
            plot(
                { kind: "horizontal-histogram", buckets: [{ price: 1, volume: 2 }] },
                { slotId: "hh" },
            ),
        ]);
        expect(chart.calls.filter((c) => c.kind === "addSeries")).toHaveLength(1);
        expect(chart.calls.some((c) => c.kind === "setMarkers")).toBe(false);
    });

    it("a marker before any candle series is a no-op", () => {
        const { handle, chart } = build();
        handle.onEmissions(emissions({ plots: [plot({ kind: "shape", shape: "flag", size: 1 })] }));
        expect(chart.calls.some((c) => c.kind === "setMarkers")).toBe(false);
    });

    it("a candle tint before any candle series is a no-op", () => {
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

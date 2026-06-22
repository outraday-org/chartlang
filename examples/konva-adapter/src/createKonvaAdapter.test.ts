// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CandleEvent,
    PlotEmission,
    PlotStyle,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import type { HostCompiledScript, ScriptHost } from "@invinite-org/chartlang-host-worker";
import { describe, expect, it } from "vitest";

import { KONVA_CAPABILITIES } from "./capabilities.js";
import {
    type KonvaAdapterHandle,
    createKonvaAdapter,
    feedCandleEvent,
    handleInterval,
    redraw,
    runKonvaLoop,
} from "./createKonvaAdapter.js";
import type { RecordedNode, RecordedNodeType } from "./testing.js";
import { MockKonva, hashKonvaScene } from "./testing.js";

// ---- fixtures ----

function bar(time: number, open: number, high: number, low: number, close: number): Bar {
    return {
        time,
        open,
        high,
        low,
        close,
        volume: 100,
        symbol: "DEMO",
        interval: "1D",
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}

function emissions(plots: ReadonlyArray<PlotEmission>): RunnerEmissions {
    return {
        plots,
        drawings: [],
        alerts: [],
        alertConditions: [],
        logs: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
}

function plot(slotId: string, style: PlotStyle, over: Partial<PlotEmission> = {}): PlotEmission {
    return {
        kind: "plot",
        slotId,
        title: slotId,
        style,
        bar: 0,
        time: 0,
        value: 1,
        color: null,
        meta: {},
        pane: "overlay",
        ...over,
    };
}

function stubHost(): ScriptHost & { disposed: boolean } {
    const out = {
        disposed: false,
        limits: { maxHeapBytes: 0, maxCpuMsPerStep: 0, maxRingBufferBars: 0 },
        load: async (_c: HostCompiledScript): Promise<void> => undefined,
        push: async (_e: CandleEvent): Promise<void> => undefined,
        setPlotOverrides: (): void => undefined,
        drain: async (): Promise<RunnerEmissions> => emissions([]),
        dispose: (): void => {
            out.disposed = true;
        },
    };
    return out;
}

async function* emptyCandles(): AsyncIterable<CandleEvent> {
    /* no candles */
}

function build(over: Partial<Parameters<typeof createKonvaAdapter>[0]> = {}): {
    adapter: KonvaAdapterHandle;
    konva: MockKonva;
    host: ScriptHost & { disposed: boolean };
} {
    const konva = new MockKonva();
    const host = stubHost();
    const adapter = createKonvaAdapter({
        konva,
        stage: { width: 800, height: 400 },
        candleSource: emptyCandles(),
        host,
        ...over,
    });
    return { adapter, konva, host };
}

// Flatten the recorded scene to the leaf-node types under every Group, in
// order, so tests can assert which visuals were built.
function leafTypes(konva: MockKonva): RecordedNodeType[] {
    const out: RecordedNodeType[] = [];
    const walk = (node: RecordedNode): void => {
        if (node.type !== "Stage" && node.type !== "Layer" && node.type !== "Group") {
            out.push(node.type);
        }
        for (const child of node.children) walk(child);
    };
    // The series layer is roots[1] (Stage, seriesLayer, drawingsLayer, …).
    for (const child of konva.roots[1].children) walk(child);
    return out;
}

// Flatten the leaf-node types under the DRAWINGS layer (roots[2]) — the
// dedicated layer `rebuildDrawingsLayer` populates from `decomposeDrawing`.
function drawingLeafTypes(konva: MockKonva): RecordedNodeType[] {
    const out: RecordedNodeType[] = [];
    const walk = (node: RecordedNode): void => {
        if (node.type !== "Stage" && node.type !== "Layer" && node.type !== "Group") {
            out.push(node.type);
        }
        for (const child of node.children) walk(child);
    };
    for (const child of konva.roots[2].children) walk(child);
    return out;
}

function groupChildren(konva: MockKonva): RecordedNode[][] {
    return konva.roots[1].children.map((g) => [...g.children]);
}

// ---- tests ----

describe("createKonvaAdapter — construction", () => {
    it("builds a stage with a series layer, a drawings layer, and an axis layer", () => {
        const { konva } = build();
        expect(konva.roots[0].type).toBe("Stage");
        expect(konva.roots[1].type).toBe("Layer");
        expect(konva.roots[2].type).toBe("Layer");
        expect(konva.roots[3].type).toBe("Layer");
        expect(konva.ops.filter((o) => o.op === "add" && o.on === "Stage")).toHaveLength(3);
    });

    it("constructs the stage WITHOUT a container by default", () => {
        const { konva } = build();
        expect(konva.roots[0].type).toBe("Stage");
        expect("container" in konva.roots[0].config).toBe(false);
    });

    it("passes a supplied container into the stage config", () => {
        // A minimal structural HTMLElement stand-in — the headless MockKonva
        // records the config bag without touching the DOM, so any object
        // satisfying the type is enough to assert the seam carries it.
        const container = {} as HTMLElement;
        const { konva } = build({ container });
        expect(konva.roots[0].type).toBe("Stage");
        expect(konva.roots[0].config.container).toBe(container);
    });

    it("defaults capabilities and exposes the host on the handle", () => {
        const { adapter } = build();
        expect(adapter.capabilities).toBe(KONVA_CAPABILITIES);
        expect(adapter.host).toBeDefined();
    });

    it("accepts a capabilities / interval / palette override", () => {
        const { adapter } = build({
            capabilities: KONVA_CAPABILITIES,
            interval: "1h",
            palette: undefined,
        });
        expect(handleInterval(adapter)).toBe("1h");
    });

    it("defaults the interval to 1D", () => {
        const { adapter } = build();
        expect(handleInterval(adapter)).toBe("1D");
    });

    it("exposes the candle source through adapter.candles()", async () => {
        const source = (async function* (): AsyncIterable<CandleEvent> {
            yield { kind: "history", bars: [] };
        })();
        const { adapter } = build({ candleSource: source });
        const received: CandleEvent[] = [];
        for await (const e of adapter.candles({ interval: "chart" })) received.push(e);
        expect(received).toEqual([{ kind: "history", bars: [] }]);
    });

    it("builds a real worker host via createWorkerHost when workerLike is supplied", () => {
        const channel = new MessageChannel();
        const worker = {
            addEventListener: (): void => undefined,
            postMessage: (): void => undefined,
            terminate: (): void => {
                channel.port1.close();
                channel.port2.close();
            },
        };
        const adapter = createKonvaAdapter({
            konva: new MockKonva(),
            stage: { width: 1, height: 1 },
            candleSource: emptyCandles(),
            resolveInputs: () => ({ length: 20 }),
            workerLike: worker,
        });
        expect(adapter.host.limits.maxCpuMsPerStep).toBeGreaterThan(0);
        adapter.dispose();
    });

    it("builds a worker host without an input resolver when omitted", () => {
        const channel = new MessageChannel();
        const worker = {
            addEventListener: (): void => undefined,
            postMessage: (): void => undefined,
            terminate: (): void => {
                channel.port1.close();
                channel.port2.close();
            },
        };
        const adapter = createKonvaAdapter({
            konva: new MockKonva(),
            stage: { width: 1, height: 1 },
            candleSource: emptyCandles(),
            workerLike: worker,
        });
        expect(adapter.resolveInputs).toBeUndefined();
        adapter.dispose();
    });

    it("calls createWorkerHost without workerLike when neither host nor workerLike are supplied", () => {
        // The default `createWorkerHost({...})` path spins up a real Worker,
        // which throws in Node — asserting the throw lights up both the
        // resolveInputs-present and resolveInputs-absent default branches
        // (the production-only default factory is v8-ignored at the
        // host-worker level, mirroring the canvas2d adapter test).
        expect(() =>
            createKonvaAdapter({
                konva: new MockKonva(),
                stage: { width: 1, height: 1 },
                candleSource: emptyCandles(),
                resolveInputs: () => ({ length: 20 }),
            }),
        ).toThrow();
        expect(() =>
            createKonvaAdapter({
                konva: new MockKonva(),
                stage: { width: 1, height: 1 },
                candleSource: emptyCandles(),
            }),
        ).toThrow();
    });
});

describe("createKonvaAdapter — candles", () => {
    it("renders a wick Line + body Rect per bar from history", () => {
        const { adapter, konva } = build();
        feedCandleEvent(adapter, {
            kind: "history",
            bars: [bar(0, 10, 12, 8, 11), bar(10, 11, 13, 10, 10)],
        });
        // overlay group → 2 bars × (Line wick + Rect body)
        expect(leafTypes(konva)).toEqual(["Line", "Rect", "Line", "Rect"]);
    });

    it("ignores secondary-stream candle events", () => {
        const { adapter, konva } = build();
        feedCandleEvent(adapter, { kind: "close", bar: bar(0, 1, 2, 0, 1), streamKey: "1W" });
        expect(leafTypes(konva)).toEqual([]);
    });

    it("appends a close bar and replaces the head on tick", () => {
        const { adapter, konva } = build();
        feedCandleEvent(adapter, { kind: "close", bar: bar(0, 1, 2, 0, 1) });
        feedCandleEvent(adapter, { kind: "tick", bar: bar(0, 1, 5, 0, 4) });
        // one bar still → wick + body
        expect(leafTypes(konva)).toEqual(["Line", "Rect"]);
    });

    it("seeds the first bar from a tick when empty", () => {
        const { adapter, konva } = build();
        feedCandleEvent(adapter, { kind: "tick", bar: bar(0, 1, 2, 0, 1) });
        expect(leafTypes(konva)).toEqual(["Line", "Rect"]);
    });

    it("renders nothing for empty bars but keeps the layers", () => {
        const { konva } = build();
        expect(leafTypes(konva)).toEqual([]);
        expect(konva.roots[1].type).toBe("Layer");
    });
});

describe("createKonvaAdapter — plots", () => {
    function withBars(over: Partial<Parameters<typeof createKonvaAdapter>[0]> = {}) {
        const ctx = build(over);
        feedCandleEvent(ctx.adapter, {
            kind: "history",
            bars: [bar(0, 10, 12, 8, 11), bar(10, 11, 13, 10, 12)],
        });
        return ctx;
    }

    function emit(adapter: KonvaAdapterHandle, plots: ReadonlyArray<PlotEmission>): void {
        adapter.onEmissions(emissions(plots));
    }

    it("renders a line series as a single Line", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "solid" },
                { bar: 0, time: 0, value: 11 },
            ),
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "solid" },
                { bar: 1, time: 10, value: 12 },
            ),
        ]);
        const lineSeries = groupChildren(konva)[0].filter((n) => n.type === "Line");
        // 2 candle wicks + 1 series line = 3 lines
        expect(lineSeries).toHaveLength(3);
    });

    it("applies a dashed line's dash array", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "dashed" },
                { bar: 0, time: 0, value: 11 },
            ),
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "dashed" },
                { bar: 1, time: 10, value: 12 },
            ),
        ]);
        const dashed = groupChildren(konva)[0].find(
            (n) => n.type === "Line" && Array.isArray(n.config.dash),
        );
        expect(dashed?.config.dash).toEqual([6, 4]);
    });

    it("applies a dotted line's dash array", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "dotted" },
                { bar: 0, time: 0, value: 11 },
            ),
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "dotted" },
                { bar: 1, time: 10, value: 12 },
            ),
        ]);
        const dotted = groupChildren(konva)[0].find(
            (n) => n.type === "Line" && Array.isArray(n.config.dash),
        );
        expect(dotted?.config.dash).toEqual([2, 3]);
    });

    it("carries a series point's color, falling back to the palette default", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "solid" },
                { bar: 0, time: 0, value: 11, color: null },
            ),
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "solid" },
                { bar: 1, time: 10, value: 12, color: null },
            ),
        ]);
        // both points null-colored → palette plotDefault stroke.
        const series = groupChildren(konva)[0].find(
            (n) => n.type === "Line" && n.config.stroke === "#90caf9",
        );
        expect(series).toBeDefined();
    });

    it("uses the latest non-null series color for the line stroke", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "solid" },
                { bar: 0, time: 0, value: 11, color: "#abc" },
            ),
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "solid" },
                { bar: 1, time: 10, value: 12, color: "#abc" },
            ),
        ]);
        const series = groupChildren(konva)[0].find(
            (n) => n.type === "Line" && n.config.stroke === "#abc",
        );
        expect(series).toBeDefined();
    });

    it("breaks a line series into segments at a null gap", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "dashed" },
                { bar: 0, time: 0, value: 11 },
            ),
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "dashed" },
                { bar: 1, time: 5, value: null },
            ),
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "dashed" },
                { bar: 1, time: 10, value: 12 },
            ),
        ]);
        // gap collapses the run to two single-point runs (each < 2 points →
        // no polyline emitted), so only the candle wicks remain as Lines.
        const lines = groupChildren(konva)[0].filter((n) => n.type === "Line");
        expect(lines).toHaveLength(2);
    });

    it("renders a step-line series with knee points", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "s",
                { kind: "step-line", lineWidth: 1, lineStyle: "solid" },
                { bar: 0, time: 0, value: 11 },
            ),
            plot(
                "s",
                { kind: "step-line", lineWidth: 1, lineStyle: "solid" },
                { bar: 1, time: 10, value: 12 },
            ),
        ]);
        const series = groupChildren(konva)[0].find(
            (n) =>
                n.type === "Line" && Array.isArray(n.config.points) && n.config.points.length === 6,
        );
        expect(series).toBeDefined();
    });

    it("renders an area series as a closed filled Line", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "a",
                { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.3 },
                { bar: 0, time: 0, value: 11 },
            ),
            plot(
                "a",
                { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.3 },
                { bar: 1, time: 10, value: 12 },
            ),
        ]);
        const closed = groupChildren(konva)[0].find(
            (n) => n.type === "Line" && n.config.closed === true,
        );
        expect(closed).toBeDefined();
        // The area fill carries the requested `fillAlpha` baked into the
        // colour (0.3 → `4d`); the stroke stays fully opaque.
        expect(closed?.config.fill).toBe("#90caf94d");
        expect(closed?.config.stroke).toBe("#90caf9");
    });

    it("skips an area series with fewer than two finite points", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "a",
                { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.3 },
                { bar: 0, time: 0, value: 11 },
            ),
        ]);
        const closed = groupChildren(konva)[0].filter(
            (n) => n.type === "Line" && n.config.closed === true,
        );
        expect(closed).toHaveLength(0);
    });

    it("applies a dashed area's dash array", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "a",
                { kind: "area", lineWidth: 1, lineStyle: "dashed", fillAlpha: 0.3 },
                { bar: 0, time: 0, value: 11 },
            ),
            plot(
                "a",
                { kind: "area", lineWidth: 1, lineStyle: "dashed", fillAlpha: 0.3 },
                { bar: 1, time: 10, value: 12 },
            ),
        ]);
        const closed = groupChildren(konva)[0].find(
            (n) => n.type === "Line" && n.config.closed === true,
        );
        expect(closed?.config.dash).toEqual([6, 4]);
    });

    it("renders a histogram series as per-bar Rects, skipping null and NaN, color-defaulting", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "h",
                { kind: "histogram", baseline: 0 },
                { bar: 0, time: 0, value: 5, color: "#0f0" },
            ),
            plot(
                "h",
                { kind: "histogram", baseline: 0 },
                { bar: 1, time: 10, value: 6, color: null },
            ),
            plot("h", { kind: "histogram", baseline: 0 }, { bar: 1, time: 12, value: null }),
            plot("h", { kind: "histogram", baseline: 0 }, { bar: 1, time: 14, value: Number.NaN }),
        ]);
        const histRects = groupChildren(konva)[0].filter(
            (n) => n.type === "Rect" && n.config.width === 4,
        );
        // two finite bars (colored + null-color→palette default), null + NaN skipped.
        expect(histRects).toHaveLength(2);
        expect(histRects.map((r) => r.config.fill)).toEqual(["#0f0", "#90caf9"]);
    });

    it("renders a filled-band as a closed Line, breaking on a null bound", () => {
        const { adapter, konva } = withBars();
        const bandStyle = (upper: number | null, lower: number | null): PlotStyle => ({
            kind: "filled-band",
            upper,
            lower,
            alpha: 0.4,
        });
        emit(adapter, [
            plot("b", bandStyle(13, 9), { bar: 0, time: 0, value: 11 }),
            plot("b", bandStyle(14, 10), { bar: 1, time: 10, value: 12 }),
            plot("b", bandStyle(null, 10), { bar: 1, time: 20, value: 12 }),
        ]);
        const closed = groupChildren(konva)[0].filter(
            (n) => n.type === "Line" && n.config.closed === true,
        );
        expect(closed.length).toBeGreaterThanOrEqual(1);
    });

    it("bakes the band alpha into a 6-hex fill but passes a non-6-hex fill through unchanged", () => {
        const { adapter, konva } = withBars();
        const bandStyle = (): PlotStyle => ({
            kind: "filled-band",
            upper: 13,
            lower: 9,
            alpha: 0.5,
        });
        // A plain `#rrggbb` colour gets the alpha baked into `#rrggbbaa`
        // (0.5 → `80`); a named / `rgba()` colour the guard does not match
        // is returned UNCHANGED — appending two hex digits would corrupt it.
        emit(adapter, [
            plot("hex", bandStyle(), { bar: 0, time: 0, value: 11, color: "#112233" }),
            plot("hex", bandStyle(), { bar: 1, time: 10, value: 12, color: "#112233" }),
        ]);
        const hexBand = groupChildren(konva)[0].find(
            (n) => n.type === "Line" && n.config.closed === true && n.config.fill === "#11223380",
        );
        expect(hexBand).toBeDefined();

        const named = build();
        feedCandleEvent(named.adapter, {
            kind: "history",
            bars: [bar(0, 10, 12, 8, 11), bar(10, 11, 13, 10, 12)],
        });
        named.adapter.onEmissions(
            emissions([
                plot("named", bandStyle(), { bar: 0, time: 0, value: 11, color: "rgb(1,2,3)" }),
                plot("named", bandStyle(), { bar: 1, time: 10, value: 12, color: "rgb(1,2,3)" }),
            ]),
        );
        const namedBand = groupChildren(named.konva)[0].find(
            (n) => n.type === "Line" && n.config.closed === true,
        );
        expect(namedBand?.config.fill).toBe("rgb(1,2,3)");
    });

    it("renders a horizontal line across the pane", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "hl",
                { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                { value: 70, color: "#f00" },
            ),
        ]);
        const hlines = groupChildren(konva)[0].filter(
            (n) => n.type === "Line" && n.config.stroke === "#f00",
        );
        expect(hlines).toHaveLength(1);
    });

    it("defaults a null hline color and null hline value", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "hl",
                { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                { value: null, color: null },
            ),
        ]);
        const hline = groupChildren(konva)[0].find(
            (n) => n.type === "Line" && n.config.stroke === "#ef4444",
        );
        // null value → price 0 → still drawn at the palette default colour.
        expect(hline).toBeDefined();
    });

    it("skips a plot marked not visible", () => {
        const { adapter, konva } = withBars();
        emit(adapter, [
            plot(
                "l",
                { kind: "line", lineWidth: 1, lineStyle: "solid" },
                { bar: 0, time: 0, value: 11, visible: false },
            ),
        ]);
        const lines = groupChildren(konva)[0].filter((n) => n.type === "Line");
        expect(lines).toHaveLength(2); // only candle wicks
    });
});

describe("createKonvaAdapter — glyph / override / style kinds", () => {
    function emit(style: PlotStyle, over: Partial<PlotEmission> = {}): RecordedNode[] {
        const ctx = build();
        feedCandleEvent(ctx.adapter, { kind: "history", bars: [bar(0, 10, 12, 8, 11)] });
        ctx.adapter.onEmissions(emissions([plot("g", style, { value: 11, ...over })]));
        return groupChildren(ctx.konva)[0];
    }

    it("renders shape and marker as a Rect glyph, honouring an explicit color", () => {
        // null color → palette glyphText default.
        expect(
            emit({ kind: "shape", shape: "circle", size: 6 }).some(
                (n) => n.type === "Rect" && n.config.fill === "#e2e8f0",
            ),
        ).toBe(true);
        // explicit color → that color.
        expect(
            emit({ kind: "marker", shape: "square", size: 6 }, { color: "#123" }).some(
                (n) => n.type === "Rect" && n.config.fill === "#123",
            ),
        ).toBe(true);
    });

    it("skips a shape/marker with a non-finite or null value", () => {
        const nan = emit({ kind: "shape", shape: "circle", size: 6 }, { value: Number.NaN });
        // only candle wick (Line) + candle body (Rect) — no glyph Rect added.
        expect(nan.filter((n) => n.type === "Rect")).toHaveLength(1);
        const nul = emit({ kind: "marker", shape: "square", size: 6 }, { value: null });
        expect(nul.filter((n) => n.type === "Rect")).toHaveLength(1);
    });

    it("renders character and arrow as a Text glyph", () => {
        expect(emit({ kind: "character", char: "A", size: 8 }).some((n) => n.type === "Text")).toBe(
            true,
        );
        expect(
            emit({ kind: "arrow", direction: "up", size: 8 }).some((n) => n.type === "Text"),
        ).toBe(true);
        expect(
            emit({ kind: "arrow", direction: "down", size: 8 }).some((n) => n.type === "Text"),
        ).toBe(true);
    });

    it("skips a character/arrow with a non-finite value", () => {
        expect(
            emit({ kind: "character", char: "A", size: 8 }, { value: null }).some(
                (n) => n.type === "Text",
            ),
        ).toBe(false);
        expect(
            emit({ kind: "arrow", direction: "up", size: 8 }, { value: null }).some(
                (n) => n.type === "Text",
            ),
        ).toBe(false);
    });

    it("renders a label as a Text glyph", () => {
        expect(
            emit({ kind: "label", text: "hi", position: "above" }).some((n) => n.type === "Text"),
        ).toBe(true);
    });

    it("skips a label with a non-finite value", () => {
        expect(
            emit({ kind: "label", text: "hi", position: "above" }, { value: null }).some(
                (n) => n.type === "Text",
            ),
        ).toBe(false);
    });

    it("re-tints the bar for candle-override / bar-override / bar-color", () => {
        const co = emit({ kind: "candle-override", bull: "#0f0", bear: "#f00" }, { time: 0 });
        expect(co.some((n) => n.type === "Rect" && n.config.fill === "#0f0")).toBe(true);
        const bo = emit({ kind: "bar-override", color: "#abc" }, { time: 0 });
        expect(bo.some((n) => n.type === "Rect" && n.config.fill === "#abc")).toBe(true);
        const bc = emit({ kind: "bar-color", color: "#def" }, { time: 0 });
        expect(bc.some((n) => n.type === "Rect" && n.config.fill === "#def")).toBe(true);
    });

    it("skips an override when no bar matches its time", () => {
        const co = emit({ kind: "candle-override", bull: "#0f0", bear: "#f00" }, { time: 9999 });
        expect(co.some((n) => n.config.fill === "#0f0")).toBe(false);
    });

    it("renders a bg-color background Rect", () => {
        expect(
            emit({ kind: "bg-color", color: "#222" }, { time: 0 }).some(
                (n) => n.config.fill === "#222",
            ),
        ).toBe(true);
    });

    it("renders a bg-color spanning the full plot width when there are no bars", () => {
        // bg-color emitted before any candles → colWidth falls back to the
        // full plot width (the `bars.length > 0` else branch). The plot width
        // is the stage width minus the 52px price-axis gutter (canvas2d parity).
        const { adapter, konva } = build();
        adapter.onEmissions(
            emissions([plot("g", { kind: "bg-color", color: "#333" }, { time: 0 })]),
        );
        const bg = groupChildren(konva)[0].find((n) => n.config.fill === "#333");
        expect(bg?.config.width).toBe(748);
    });

    it("renders a horizontal-histogram as per-bucket Rects", () => {
        const children = emit({
            kind: "horizontal-histogram",
            buckets: [
                { price: 11, volume: 10 },
                { price: 12, volume: 5, color: "#777" },
            ],
        });
        const rects = children.filter((n) => n.type === "Rect" && n.config.height === 6);
        expect(rects).toHaveLength(2);
    });

    it("renders no horizontal-histogram bars when all volumes are zero", () => {
        const children = emit({
            kind: "horizontal-histogram",
            buckets: [{ price: 11, volume: 0 }],
        });
        expect(children.filter((n) => n.config.height === 6)).toHaveLength(0);
    });
});

describe("createKonvaAdapter — panes", () => {
    it("appends a new pane group for a subpane plot", () => {
        const { adapter, konva } = build();
        feedCandleEvent(adapter, {
            kind: "history",
            bars: [bar(0, 10, 12, 8, 11), bar(10, 11, 13, 10, 12)],
        });
        adapter.onEmissions(
            emissions([
                plot(
                    "rsi",
                    { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    { bar: 0, time: 0, value: 30, pane: "rsi" },
                ),
                plot(
                    "rsi",
                    { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    { bar: 1, time: 10, value: 70, pane: "rsi" },
                ),
            ]),
        );
        // overlay group + rsi subpane group
        expect(konva.roots[1].children).toHaveLength(2);
    });

    it("routes overlays and hlines only into their own pane", () => {
        const { adapter, konva } = build();
        feedCandleEvent(adapter, {
            kind: "history",
            bars: [bar(0, 10, 12, 8, 11), bar(10, 11, 13, 10, 12)],
        });
        adapter.onEmissions(
            emissions([
                // overlay-pane glyph + overlay-pane hline
                plot(
                    "g",
                    { kind: "shape", shape: "circle", size: 6 },
                    { bar: 0, time: 0, value: 11 },
                ),
                plot(
                    "hl",
                    { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                    { value: 11, color: "#f00" },
                ),
                // a subpane series so the per-pane filters must skip the
                // overlay-only glyph + hline on the subpane iteration.
                plot(
                    "rsi",
                    { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    { bar: 0, time: 0, value: 30, pane: "rsi" },
                ),
                plot(
                    "rsi",
                    { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    { bar: 1, time: 10, value: 70, pane: "rsi" },
                ),
            ]),
        );
        const [overlay, sub] = konva.roots[1].children;
        expect(overlay.children.some((n) => n.config.stroke === "#f00")).toBe(true);
        // the subpane carries neither the overlay glyph nor the overlay hline.
        expect(sub.children.some((n) => n.config.stroke === "#f00")).toBe(false);
    });

    it("falls back to a (0, 1) y-range for a pane with no finite candidate", () => {
        const { adapter, konva } = build();
        feedCandleEvent(adapter, { kind: "history", bars: [bar(0, 10, 12, 8, 11)] });
        // A subpane whose only series point is null → computeYRange finds
        // nothing finite, exercising the (0, 1) fallback without a NaN
        // viewport. The pane group is still created.
        adapter.onEmissions(
            emissions([
                plot(
                    "empty",
                    { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    { bar: 0, time: 0, value: null, pane: "sub" },
                ),
            ]),
        );
        expect(konva.roots[1].children).toHaveLength(2);
    });

    it("pads a degenerate pane whose only candidate makes yMin === yMax", () => {
        const { adapter, konva } = build();
        feedCandleEvent(adapter, { kind: "history", bars: [bar(0, 10, 12, 8, 11)] });
        // A subpane with a single finite series point → computeYRange yields
        // yMin === yMax === 50, exercising the ±1 padding branch without
        // throwing or producing a NaN viewport.
        adapter.onEmissions(
            emissions([
                plot(
                    "flat",
                    { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    { bar: 0, time: 0, value: 50, pane: "sub" },
                ),
            ]),
        );
        expect(konva.roots[1].children).toHaveLength(2);
    });
});

describe("createKonvaAdapter — drawings + non-rendered emissions", () => {
    it("drops a create+remove of the same handle, leaving the drawings layer empty, and ingests alerts/logs/conditions/diagnostics without throwing", () => {
        const { adapter, konva } = build();
        feedCandleEvent(adapter, { kind: "history", bars: [bar(0, 10, 12, 8, 11)] });
        expect(() =>
            adapter.onEmissions({
                plots: [],
                drawings: [
                    {
                        kind: "drawing",
                        handleId: "d1",
                        drawingKind: "line",
                        op: "create",
                        state: {
                            kind: "line",
                            anchors: [
                                { time: 0, price: 10 },
                                { time: 10, price: 12 },
                            ],
                            style: {},
                        },
                        bar: 0,
                        time: 0,
                    },
                    {
                        kind: "drawing",
                        handleId: "d1",
                        drawingKind: "line",
                        op: "remove",
                        state: {
                            kind: "line",
                            anchors: [
                                { time: 0, price: 10 },
                                { time: 10, price: 12 },
                            ],
                            style: {},
                        },
                        bar: 0,
                        time: 0,
                    },
                ],
                alerts: [
                    {
                        kind: "alert",
                        slotId: "a",
                        severity: "info",
                        message: "hi",
                        bar: 0,
                        time: 0,
                        meta: {},
                        channels: ["log"],
                        dedupeKey: "a@0",
                    },
                ],
                alertConditions: [
                    {
                        kind: "alert-condition",
                        conditionId: "c",
                        title: "t",
                        description: "d",
                        defaultMessage: "m",
                        fired: true,
                        bar: 0,
                        time: 0,
                    },
                ],
                logs: [{ kind: "log", level: "info", message: "L", bar: 0, time: 0, meta: {} }],
                diagnostics: [
                    {
                        kind: "diagnostic",
                        severity: "warning",
                        code: "unsupported-plot-kind",
                        message: "x",
                        slotId: null,
                        bar: null,
                    },
                ],
                fromBar: 0,
                toBar: 0,
            }),
        ).not.toThrow();
        // The series layer holds only candles (drawings live on their own
        // layer); the create+remove of `d1` nets to an empty drawings layer.
        expect(leafTypes(konva)).toEqual(["Line", "Rect"]);
        expect(drawingLeafTypes(konva)).toEqual([]);
    });

    it("renders a live line drawing as a Konva Line on the drawings layer", () => {
        const { adapter, konva } = build();
        feedCandleEvent(adapter, {
            kind: "history",
            bars: [bar(0, 10, 12, 8, 11), bar(10, 11, 13, 10, 12)],
        });
        adapter.onEmissions({
            ...emissions([]),
            drawings: [
                {
                    kind: "drawing",
                    handleId: "line1",
                    drawingKind: "line",
                    op: "create",
                    state: {
                        kind: "line",
                        anchors: [
                            { time: 0, price: 10 },
                            { time: 10, price: 12 },
                        ],
                        style: {},
                    },
                    bar: 0,
                    time: 0,
                },
            ],
        });
        expect(drawingLeafTypes(konva)).toEqual(["Line"]);
        // The drawings layer is rebuilt + batchDraw'd like the series layer.
        expect(konva.ops).toContainEqual({ op: "destroyChildren", on: "Layer" });
    });

    it("renders multiple drawing kinds (rectangle, circle, text, marker) to the right node types", () => {
        const { adapter, konva } = build();
        feedCandleEvent(adapter, {
            kind: "history",
            bars: [bar(0, 10, 12, 8, 11), bar(10, 11, 13, 10, 12)],
        });
        adapter.onEmissions({
            ...emissions([]),
            drawings: [
                {
                    kind: "drawing",
                    handleId: "rect1",
                    drawingKind: "rectangle",
                    op: "create",
                    state: {
                        kind: "rectangle",
                        anchors: [
                            { time: 0, price: 10 },
                            { time: 10, price: 12 },
                        ],
                        style: {},
                    },
                    bar: 0,
                    time: 0,
                },
                {
                    kind: "drawing",
                    handleId: "circ1",
                    drawingKind: "circle",
                    op: "create",
                    state: {
                        kind: "circle",
                        anchors: [
                            { time: 0, price: 10 },
                            { time: 5, price: 10 },
                        ],
                        style: {},
                    },
                    bar: 0,
                    time: 0,
                },
                {
                    kind: "drawing",
                    handleId: "txt1",
                    drawingKind: "text",
                    op: "create",
                    state: {
                        kind: "text",
                        anchor: { time: 5, price: 11 },
                        body: "hi",
                        style: { bgColor: "#fde047" },
                    },
                    bar: 0,
                    time: 0,
                },
            ],
        });
        const leaves = drawingLeafTypes(konva);
        // rectangle → closed Line; circle → full-circle Arc; text+bgColor →
        // backing Rect + Text.
        expect(leaves).toContain("Line");
        expect(leaves).toContain("Arc");
        expect(leaves).toContain("Rect");
        expect(leaves).toContain("Text");
    });
});

describe("createKonvaAdapter — dispose + handle guards", () => {
    it("destroys the stage, disposes the host, and clears state", () => {
        const { adapter, konva, host } = build();
        feedCandleEvent(adapter, { kind: "history", bars: [bar(0, 10, 12, 8, 11)] });
        adapter.dispose();
        expect(host.disposed).toBe(true);
        expect(konva.ops).toContainEqual({ op: "destroy", on: "Stage" });
    });

    it("throws on feedCandleEvent for a foreign handle", () => {
        const foreign = Object.freeze({}) as unknown as KonvaAdapterHandle;
        expect(() => feedCandleEvent(foreign, { kind: "history", bars: [] })).toThrow(
            /not produced by createKonvaAdapter/,
        );
    });

    it("throws on handleInterval for a foreign handle", () => {
        const foreign = Object.freeze({}) as unknown as KonvaAdapterHandle;
        expect(() => handleInterval(foreign)).toThrow(/not produced by createKonvaAdapter/);
    });
});

describe("createKonvaAdapter — hash stability", () => {
    it("hashes the rendered candle scene deterministically", () => {
        const make = (): MockKonva => {
            const { adapter, konva } = build();
            feedCandleEvent(adapter, {
                kind: "history",
                bars: [bar(0, 10, 12, 8, 11), bar(10, 11, 13, 10, 12)],
            });
            return konva;
        };
        expect(hashKonvaScene(make())).toBe(hashKonvaScene(make()));
    });
});

// A host that records every push + drain so the loop's per-event drive can
// be asserted. Each drain returns the next queued emission set (or empty).
function recordingHost(drainResults: RunnerEmissions[] = []): ScriptHost & {
    pushed: CandleEvent[];
    drains: number;
} {
    const out = {
        pushed: [] as CandleEvent[],
        drains: 0,
        limits: { maxHeapBytes: 0, maxCpuMsPerStep: 0, maxRingBufferBars: 0 },
        load: async (_c: HostCompiledScript): Promise<void> => undefined,
        push: async (e: CandleEvent): Promise<void> => {
            out.pushed.push(e);
        },
        setPlotOverrides: (): void => undefined,
        drain: async (): Promise<RunnerEmissions> => {
            const result = drainResults[out.drains] ?? emissions([]);
            out.drains += 1;
            return result;
        },
        dispose: (): void => undefined,
    };
    return out;
}

async function* candleStream(events: ReadonlyArray<CandleEvent>): AsyncIterable<CandleEvent> {
    for (const event of events) yield event;
}

describe("redraw", () => {
    it("rebuilds the series + drawings layers on demand", () => {
        const { adapter, konva } = build();
        feedCandleEvent(adapter, { kind: "history", bars: [bar(0, 10, 12, 8, 11)] });
        redraw(adapter);
        // A repaint rebuilt the series layer with the candle wick + body.
        expect(leafTypes(konva)).toContain("Rect");
    });

    it("throws when handed a handle not produced by createKonvaAdapter", () => {
        const foreign = Object.freeze({}) as unknown as KonvaAdapterHandle;
        expect(() => redraw(foreign)).toThrow(/not produced by createKonvaAdapter/);
    });
});

describe("computePaneViewport gutter", () => {
    it("reserves the 52px price-axis gutter so the plot width matches canvas2d", () => {
        // With one bar, the candle body width is pxWidth / bars * BODY_WIDTH_RATIO.
        // pxWidth = stageWidth(800) - gutter(52) = 748, body = 748 * 0.6 = 448.8.
        const { adapter, konva } = build();
        feedCandleEvent(adapter, { kind: "history", bars: [bar(0, 10, 12, 8, 11)] });
        redraw(adapter);
        const rects: RecordedNode[] = [];
        const walk = (n: RecordedNode): void => {
            if (n.type === "Rect") rects.push(n);
            for (const c of n.children) walk(c);
        };
        for (const c of konva.roots[1].children) walk(c);
        expect(rects[0]?.config.width).toBeCloseTo(748 * 0.6, 5);
    });
});

describe("runKonvaLoop", () => {
    it("iterates the candle source, repaints, pushes every event, drains, and re-renders", async () => {
        const events: CandleEvent[] = [
            { kind: "history", bars: [bar(0, 10, 12, 8, 11)] },
            { kind: "close", bar: bar(10, 11, 13, 10, 12) },
            { kind: "tick", bar: bar(10, 11, 14, 10, 13) },
        ];
        const host = recordingHost([
            emissions([]),
            emissions([plot("a", { kind: "line", lineStyle: "solid", lineWidth: 1 })]),
            emissions([]),
        ]);
        const { adapter, konva } = build({ candleSource: candleStream(events), host });
        await runKonvaLoop(adapter);
        expect(host.pushed).toEqual(events);
        expect(host.drains).toBe(3);
        // feedCandleEvent repainted per event, so the series layer carries
        // the candle wick + body built from the fed bars.
        expect(leafTypes(konva)).toContain("Rect");
    });

    it("throws when handed a handle not produced by createKonvaAdapter", async () => {
        const foreign = Object.freeze({}) as unknown as KonvaAdapterHandle;
        await expect(runKonvaLoop(foreign)).rejects.toThrow(/not produced by createKonvaAdapter/);
    });

    it("returns immediately when the signal is already aborted", async () => {
        const host = recordingHost([emissions([])]);
        const { adapter } = build({
            candleSource: candleStream([{ kind: "close", bar: bar(0, 1, 2, 0, 1) }]),
            host,
        });
        const controller = new AbortController();
        controller.abort();
        await runKonvaLoop(adapter, { signal: controller.signal });
        expect(host.pushed).toEqual([]);
        expect(host.drains).toBe(0);
    });

    it("breaks out of the loop on the next iteration after an abort", async () => {
        const host = recordingHost([emissions([]), emissions([]), emissions([])]);
        const controller = new AbortController();
        const events: CandleEvent[] = [
            { kind: "close", bar: bar(0, 1, 2, 0, 1) },
            { kind: "close", bar: bar(10, 1, 2, 0, 1) },
        ];
        // Abort at the END of each yield so the body's top-of-iteration
        // abort check is what short-circuits the second event.
        async function* yieldAll(): AsyncIterable<CandleEvent> {
            for (const event of events) {
                yield event;
                controller.abort();
            }
        }
        const { adapter } = build({ candleSource: yieldAll(), host });
        await expect(runKonvaLoop(adapter, { signal: controller.signal })).resolves.toBeUndefined();
        expect(host.pushed.length).toBe(1);
        expect(host.drains).toBe(1);
    });

    it("ignores abort when the signal is never triggered", async () => {
        const host = recordingHost([emissions([]), emissions([])]);
        const controller = new AbortController();
        const { adapter } = build({
            candleSource: candleStream([
                { kind: "close", bar: bar(0, 1, 2, 0, 1) },
                { kind: "close", bar: bar(10, 1, 2, 0, 1) },
            ]),
            host,
        });
        await runKonvaLoop(adapter, { signal: controller.signal });
        expect(host.pushed.length).toBe(2);
        expect(host.drains).toBe(2);
    });

    it("aborts mid-push so the post-push branch returns before draining", async () => {
        const controller = new AbortController();
        const event: CandleEvent = { kind: "close", bar: bar(0, 1, 2, 0, 1) };
        const base = recordingHost([emissions([])]);
        const host: ScriptHost = {
            ...base,
            push: async (e: CandleEvent): Promise<void> => {
                base.pushed.push(e);
                controller.abort();
            },
        };
        const { adapter } = build({ candleSource: candleStream([event]), host });
        await runKonvaLoop(adapter, { signal: controller.signal });
        expect(base.pushed).toEqual([event]);
        expect(base.drains).toBe(0);
    });

    it("aborts during the post-yield microtask so the pre-drain branch returns", async () => {
        const controller = new AbortController();
        const event: CandleEvent = { kind: "close", bar: bar(0, 1, 2, 0, 1) };
        const base = recordingHost([emissions([])]);
        const host: ScriptHost = {
            ...base,
            push: async (e: CandleEvent): Promise<void> => {
                base.pushed.push(e);
                // Fire the abort on the next macrotask — after push resolves
                // but during the loop's `setTimeout(0)` yield, so the
                // pre-drain abort check short-circuits before draining.
                setTimeout(() => controller.abort(), 0);
            },
        };
        const { adapter } = build({ candleSource: candleStream([event]), host });
        await runKonvaLoop(adapter, { signal: controller.signal });
        expect(base.pushed).toEqual([event]);
        expect(base.drains).toBe(0);
    });

    it("aborts during drain so the post-drain branch returns before onEmissions", async () => {
        const controller = new AbortController();
        const event: CandleEvent = { kind: "close", bar: bar(0, 1, 2, 0, 1) };
        const base = recordingHost();
        const host: ScriptHost = {
            ...base,
            drain: async (): Promise<RunnerEmissions> => {
                base.drains += 1;
                // Abort while the drain is in flight: the post-drain guard
                // must short-circuit before onEmissions paints the disposing
                // stage.
                controller.abort();
                return emissions([plot("a", { kind: "line", lineStyle: "solid", lineWidth: 1 })]);
            },
        };
        const { adapter, konva } = build({ candleSource: candleStream([event]), host });
        await runKonvaLoop(adapter, { signal: controller.signal });
        expect(base.drains).toBe(1);
        // feedCandleEvent rebuilt all three layers (3 `destroyChildren` —
        // series, drawings, axis); the skipped onEmissions added no further
        // rebuild, so the count stays 3.
        expect(konva.ops.filter((o) => o.op === "destroyChildren")).toHaveLength(3);
    });
});

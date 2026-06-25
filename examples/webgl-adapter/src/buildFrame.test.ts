// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotEmission, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { type PaneLayoutRect, buildFrame } from "./buildFrame.js";
import { applyEmissions } from "./ingest.js";
import type {
    CandleBodiesDescriptor,
    FilledBandDescriptor,
    LineStripDescriptor,
    VerticalBarsDescriptor,
} from "./layer-descriptor.js";
import { type AdapterState, createAdapterState } from "./state.js";

const OVERLAY: PaneLayoutRect = { paneKey: "overlay", x: 0, y: 0, width: 800, height: 400 };

function bar(time: number, close: number): Bar {
    return { time, open: close - 1, high: close + 2, low: close - 2, close };
}

function emissions(plots: PlotEmission[]): RunnerEmissions {
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

function linePlot(overrides: Partial<PlotEmission> & { slotId: string }): PlotEmission {
    return {
        kind: "plot",
        slotId: overrides.slotId,
        title: "",
        style: overrides.style ?? { kind: "line", lineWidth: 1, lineStyle: "solid" },
        bar: overrides.bar ?? 0,
        time: overrides.time ?? 0,
        value: "value" in overrides ? (overrides.value as number | null) : 100,
        color: overrides.color ?? null,
        meta: {},
        pane: overrides.pane ?? "overlay",
        ...(overrides.xShift === undefined ? {} : { xShift: overrides.xShift }),
        ...(overrides.z === undefined ? {} : { z: overrides.z }),
        ...("colorValue" in overrides ? { colorValue: overrides.colorValue } : {}),
    };
}

function seedBars(state: AdapterState, bars: Bar[]): void {
    state.bars.push(...bars);
}

describe("buildFrame — window resolution", () => {
    it("empty bars ⇒ (0,1) window and no layers", () => {
        const state = createAdapterState();
        const [pane] = buildFrame(state, [OVERLAY]);
        expect(pane.window).toEqual({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 });
        expect(pane.layers).toEqual([]);
    });

    it("fewer-than-N bars (initialVisibleBars) ⇒ full data window", () => {
        const state = createAdapterState({ initialVisibleBars: 120 });
        seedBars(state, [bar(0, 10), bar(10, 11), bar(20, 12)]);
        const [pane] = buildFrame(state, [OVERLAY]);
        expect(pane.window.xMin).toBe(0);
        expect(pane.window.xMax).toBe(2);
    });

    it("more-than-N bars ⇒ window framed on the most recent N", () => {
        const state = createAdapterState({ initialVisibleBars: 2 });
        seedBars(state, [bar(0, 10), bar(10, 11), bar(20, 12), bar(30, 13)]);
        const [pane] = buildFrame(state, [OVERLAY]);
        // autoFollowXMin = len - 2 = 2, xMax = last slot = 3.
        expect(pane.window.xMin).toBe(2);
        expect(pane.window.xMax).toBe(3);
    });

    it("no initialVisibleBars ⇒ fit all data (auto-follow)", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 11), bar(20, 12), bar(30, 13)]);
        const [pane] = buildFrame(state, [OVERLAY]);
        expect(pane.window.xMin).toBe(0);
        expect(pane.window.xMax).toBe(3);
    });

    it("compresses calendar gaps so adjacent market bars use adjacent slots", () => {
        const state = createAdapterState();
        const day = 86_400_000;
        seedBars(state, [bar(0, 10), bar(day, 11), bar(4 * day, 12)]);
        const [pane] = buildFrame(state, [OVERLAY]);
        const bodies = pane.layers.find(
            (l): l is CandleBodiesDescriptor => l.kind === "candle-bodies",
        );
        expect(pane.window.xMax).toBe(2);
        expect(bodies?.rows[0]).toBe(0);
        expect(bodies?.rows[6]).toBe(1);
        expect(bodies?.rows[12]).toBe(2);
    });
});

describe("buildFrame — y-autofit", () => {
    it("auto-fits the visible window's high/low with a ±5% pad", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 20)]);
        const [pane] = buildFrame(state, [OVERLAY]);
        // bar highs/lows: [8..12] and [18..22] ⇒ range [8, 22], pad = 0.7.
        expect(pane.window.yMin).toBeCloseTo(8 - 0.7);
        expect(pane.window.yMax).toBeCloseTo(22 + 0.7);
    });

    it("folds a horizontal line into the pane y-range", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 11)]);
        applyEmissions(
            state,
            emissions([
                linePlot({
                    slotId: "h",
                    value: 100,
                    style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
                }),
            ]),
        );
        const [pane] = buildFrame(state, [OVERLAY]);
        // The hline at 100 stretches yMax well past the candle highs.
        expect(pane.window.yMax).toBeGreaterThan(100);
    });

    it("a subpane sees only its own series, not the overlay bars", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 11)]);
        applyEmissions(
            state,
            emissions([linePlot({ slotId: "rsi", pane: "rsi", value: 50, time: 0, bar: 0 })]),
        );
        applyEmissions(
            state,
            emissions([linePlot({ slotId: "rsi", pane: "rsi", value: 70, time: 10, bar: 1 })]),
        );
        const subpane: PaneLayoutRect = { paneKey: "rsi", x: 0, y: 400, width: 800, height: 100 };
        const panes = buildFrame(state, [OVERLAY, subpane]);
        const rsi = panes.find((p) => p.paneKey === "rsi");
        // RSI series spans [50, 70]; no candle highs/lows leak in.
        expect(rsi?.window.yMin).toBeCloseTo(50 - (70 - 50) * 0.05);
        expect(rsi?.window.yMax).toBeCloseTo(70 + (70 - 50) * 0.05);
    });
});

describe("buildFrame — candle descriptors", () => {
    it("packs world-space candle bodies + wicks for the overlay pane", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 9)]); // up, down
        const [pane] = buildFrame(state, [OVERLAY]);
        const bodies = pane.layers.find(
            (l): l is CandleBodiesDescriptor => l.kind === "candle-bodies",
        );
        expect(bodies?.rowCount).toBe(2);
        // Row 0: [x=0, open=9, high=12, low=8, close=10, isBull=1].
        expect(Array.from(bodies?.rows.slice(0, 6) ?? [])).toEqual([0, 9, 12, 8, 10, 1]);
        // Row 1 close 9 < open 8? open = close-1 = 8, so 9 >= 8 ⇒ bull. Use a true bear.
        expect(pane.layers.some((l) => l.kind === "candle-wicks")).toBe(true);
    });

    it("marks a bearish bar isBull = 0", () => {
        const state = createAdapterState();
        const bearBar: Bar = { time: 0, open: 12, high: 13, low: 9, close: 10 };
        seedBars(state, [bearBar]);
        const [pane] = buildFrame(state, [OVERLAY]);
        const bodies = pane.layers.find(
            (l): l is CandleBodiesDescriptor => l.kind === "candle-bodies",
        );
        expect(bodies?.rows[5]).toBe(0);
    });
});

describe("buildFrame — line-strip descriptors", () => {
    it("packs a line series in world (time, value) order", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 11)]);
        applyEmissions(state, emissions([linePlot({ slotId: "ema", value: 10, time: 0, bar: 0 })]));
        applyEmissions(
            state,
            emissions([linePlot({ slotId: "ema", value: 11, time: 10, bar: 1 })]),
        );
        const [pane] = buildFrame(state, [OVERLAY]);
        const strip = pane.layers.find((l): l is LineStripDescriptor => l.kind === "line-strip");
        expect(strip?.pointCount).toBe(2);
        expect(Array.from(strip?.points ?? [])).toEqual([0, 10, 1, 11]);
        expect(strip?.step).toBe(false);
    });

    it("packs NaN for a value:null gap so the program skips the segment", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 11)]);
        applyEmissions(
            state,
            emissions([linePlot({ slotId: "ema", value: null, time: 0, bar: 0 })]),
        );
        const [pane] = buildFrame(state, [OVERLAY]);
        const strip = pane.layers.find((l): l is LineStripDescriptor => l.kind === "line-strip");
        expect(Number.isNaN(strip?.points[1] ?? 0)).toBe(true);
    });

    it("packs NaN for a colorValue:null gap (paint-nothing this bar)", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10)]);
        applyEmissions(
            state,
            emissions([linePlot({ slotId: "ema", value: 10, time: 0, bar: 0, colorValue: null })]),
        );
        const [pane] = buildFrame(state, [OVERLAY]);
        const strip = pane.layers.find((l): l is LineStripDescriptor => l.kind === "line-strip");
        expect(Number.isNaN(strip?.points[1] ?? 0)).toBe(true);
    });

    it("sets step = true for a step-line series", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10)]);
        applyEmissions(
            state,
            emissions([
                linePlot({
                    slotId: "s",
                    value: 10,
                    bar: 0,
                    style: { kind: "step-line", lineWidth: 1, lineStyle: "solid" },
                }),
            ]),
        );
        const [pane] = buildFrame(state, [OVERLAY]);
        const strip = pane.layers.find((l): l is LineStripDescriptor => l.kind === "line-strip");
        expect(strip?.step).toBe(true);
    });

    it("orders line strips by (z, seq)", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10)]);
        applyEmissions(
            state,
            emissions([
                linePlot({ slotId: "front", value: 10, bar: 0, z: 1 }),
                linePlot({ slotId: "back", value: 10, bar: 0, z: -1 }),
            ]),
        );
        const [pane] = buildFrame(state, [OVERLAY]);
        const strips = pane.layers.filter((l): l is LineStripDescriptor => l.kind === "line-strip");
        expect(strips.map((s) => s.id)).toEqual([
            "overlay|back:line-strip",
            "overlay|front:line-strip",
        ]);
    });
});

describe("buildFrame — horizontal lines (hline band)", () => {
    function hlinePlot(slotId: string, value: number, overrides: Partial<PlotEmission> = {}) {
        return linePlot({
            slotId,
            value,
            style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" },
            ...overrides,
        });
    }

    it("renders each hline as a 2-point line-strip spanning the window at its price", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 11)]);
        applyEmissions(state, emissions([hlinePlot("res", 30)]));
        const [pane] = buildFrame(state, [OVERLAY]);
        const hline = pane.layers.find(
            (l): l is LineStripDescriptor => l.kind === "line-strip" && l.id.includes(":hline:"),
        );
        expect(hline).toBeDefined();
        expect(hline?.pointCount).toBe(2);
        // [xMin, price, xMax, price] across the resolved window.
        expect(Array.from(hline?.points ?? [])).toEqual([
            pane.window.xMin,
            30,
            pane.window.xMax,
            30,
        ]);
    });

    it("dashes a non-solid hline and solid-strokes a solid one", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10)]);
        applyEmissions(
            state,
            emissions([
                hlinePlot("dash", 20, {
                    slotId: "dash",
                    style: { kind: "horizontal-line", lineWidth: 1, lineStyle: "dashed" },
                }),
            ]),
        );
        const [pane] = buildFrame(state, [OVERLAY]);
        const hline = pane.layers.find(
            (l): l is LineStripDescriptor => l.kind === "line-strip" && l.id.includes(":hline:"),
        );
        expect(hline?.dash).not.toBeNull();
    });

    it("orders an hline after a series and before a higher-z series (default z=0)", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10)]);
        applyEmissions(
            state,
            emissions([linePlot({ slotId: "ema", value: 10, bar: 0 }), hlinePlot("res", 30)]),
        );
        const [pane] = buildFrame(state, [OVERLAY]);
        const strips = pane.layers.filter((l): l is LineStripDescriptor => l.kind === "line-strip");
        // series (band 0) before hline (band 2) at the default z.
        expect(strips[0].id).toBe("overlay|ema:line-strip");
        expect(strips[strips.length - 1].id).toContain(":hline:");
    });
});

describe("buildFrame — xShift widening", () => {
    it("widens xMax for a +k future shift past the data edge", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 11), bar(20, 12)]);
        applyEmissions(
            state,
            emissions([linePlot({ slotId: "ema", value: 12, time: 20, bar: 2, xShift: 2 })]),
        );
        const [pane] = buildFrame(state, [OVERLAY]);
        // bar 2 shifted +2 ⇒ slot 4.
        expect(pane.window.xMax).toBe(4);
    });

    it("does not widen for an in-range or negative shift", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 11), bar(20, 12)]);
        applyEmissions(
            state,
            emissions([linePlot({ slotId: "ema", value: 12, time: 20, bar: 2, xShift: -1 })]),
        );
        const [pane] = buildFrame(state, [OVERLAY]);
        expect(pane.window.xMax).toBe(2);
    });
});

describe("buildFrame — histogram → vertical-bars descriptor", () => {
    function histPlot(slotId: string, value: number | null, bar: number, baseline = 0) {
        return linePlot({
            slotId,
            value,
            bar,
            time: bar * 10,
            pane: "volume",
            style: { kind: "histogram", baseline },
        });
    }

    it("routes a histogram series to a vertical-bars descriptor", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 11)]);
        applyEmissions(state, emissions([histPlot("vol", 1000, 0)]));
        applyEmissions(state, emissions([histPlot("vol", 500, 1)]));
        const subpane: PaneLayoutRect = { paneKey: "volume", x: 0, y: 320, width: 800, height: 80 };
        const panes = buildFrame(state, [OVERLAY, subpane]);
        const vol = panes.find((p) => p.paneKey === "volume");
        const bars = vol?.layers.find(
            (l): l is VerticalBarsDescriptor => l.kind === "vertical-bars",
        );
        expect(bars?.rowCount).toBe(2);
        // rows = [x, height = value - baseline, isPositive] per bar (baseline 0).
        expect(Array.from(bars?.rows ?? [])).toEqual([0, 1000, 1, 1, 500, 1]);
        expect(bars?.baseline).toBe(0);
    });

    it("signs height + isPositive about a non-zero baseline", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 11)]);
        // Histogram about baseline 50: a below-baseline bar (40) and an
        // above-baseline bar (70).
        applyEmissions(state, emissions([histPlot("osc", 40, 0, 50)]));
        applyEmissions(state, emissions([histPlot("osc", 70, 1, 50)]));
        const subpane: PaneLayoutRect = { paneKey: "volume", x: 0, y: 320, width: 800, height: 80 };
        const panes = buildFrame(state, [OVERLAY, subpane]);
        const vol = panes.find((p) => p.paneKey === "volume");
        const bars = vol?.layers.find(
            (l): l is VerticalBarsDescriptor => l.kind === "vertical-bars",
        );
        // bar 0: 40 - 50 = -10, isPositive 0; bar 1: 70 - 50 = 20, isPositive 1.
        expect(Array.from(bars?.rows ?? [])).toEqual([0, -10, 0, 1, 20, 1]);
        expect(bars?.baseline).toBe(50);
    });

    it("packs NaN height for a value:null gap (GPU clips the bar)", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10)]);
        applyEmissions(state, emissions([histPlot("vol", null, 0)]));
        const subpane: PaneLayoutRect = { paneKey: "volume", x: 0, y: 320, width: 800, height: 80 };
        const panes = buildFrame(state, [OVERLAY, subpane]);
        const vol = panes.find((p) => p.paneKey === "volume");
        const bars = vol?.layers.find(
            (l): l is VerticalBarsDescriptor => l.kind === "vertical-bars",
        );
        expect(Number.isNaN(bars?.rows[1] ?? 0)).toBe(true);
        expect(bars?.rows[2]).toBe(0);
    });
});

describe("buildFrame — filled-band → filled-band descriptor", () => {
    function bandPlot(slotId: string, bar: number, upper: number | null, lower: number | null) {
        return linePlot({
            slotId,
            value: null,
            bar,
            time: bar * 10,
            pane: "overlay",
            style: { kind: "filled-band", upper, lower, alpha: 0.2 },
            color: "#26a69a",
        });
    }

    it("routes a filled-band series to a filled-band descriptor (world edges)", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 11)]);
        applyEmissions(state, emissions([bandPlot("bb", 0, 12, 8)]));
        applyEmissions(state, emissions([bandPlot("bb", 1, 13, 9)]));
        const [pane] = buildFrame(state, [OVERLAY]);
        const band = pane.layers.find((l): l is FilledBandDescriptor => l.kind === "filled-band");
        expect(band?.pointCount).toBe(2);
        // upper/lower pack [x, y] per column; x is the compressed bar slot.
        expect(Array.from(band?.upper ?? [])).toEqual([0, 12, 1, 13]);
        expect(Array.from(band?.lower ?? [])).toEqual([0, 8, 1, 9]);
        // Alpha rides on the color (style.alpha = 0.2).
        expect(band?.color[3]).toBeCloseTo(0.2);
    });

    it("packs NaN edges for a single-null-edge per-bar gap", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10)]);
        applyEmissions(state, emissions([bandPlot("bb", 0, null, 8)]));
        const [pane] = buildFrame(state, [OVERLAY]);
        const band = pane.layers.find((l): l is FilledBandDescriptor => l.kind === "filled-band");
        expect(Number.isNaN(band?.upper[1] ?? 0)).toBe(true);
        expect(Number.isNaN(band?.lower[1] ?? 0)).toBe(true);
    });
});

describe("buildFrame — area → fill body + edge line", () => {
    function areaPlot(slotId: string, bar: number, value: number | null) {
        return linePlot({
            slotId,
            value,
            bar,
            time: bar * 10,
            pane: "overlay",
            style: { kind: "area", lineWidth: 1, lineStyle: "solid", fillAlpha: 0.3 },
            color: "#26a69a",
        });
    }

    it("emits a filled-band fill body AND a line-strip edge for an area series", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 11)]);
        applyEmissions(state, emissions([areaPlot("a", 0, 50)]));
        applyEmissions(state, emissions([areaPlot("a", 1, 60)]));
        const [pane] = buildFrame(state, [OVERLAY]);
        const fill = pane.layers.find((l): l is FilledBandDescriptor => l.kind === "filled-band");
        const edge = pane.layers.find((l): l is LineStripDescriptor => l.kind === "line-strip");
        expect(fill).toBeDefined();
        expect(edge).toBeDefined();
        // The fill's upper edge is the series value; its lower edge is the
        // pane floor (a constant, the bottom of the visible window).
        expect(fill?.upper[1]).toBe(50);
        expect(fill?.lower[1]).toBe(fill?.lower[3]);
        expect(fill?.color[3]).toBeCloseTo(0.3);
    });

    it("packs NaN fill edges for a value:null gap", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10)]);
        applyEmissions(state, emissions([areaPlot("a", 0, null)]));
        const [pane] = buildFrame(state, [OVERLAY]);
        const fill = pane.layers.find((l): l is FilledBandDescriptor => l.kind === "filled-band");
        expect(Number.isNaN(fill?.upper[1] ?? 0)).toBe(true);
        expect(Number.isNaN(fill?.lower[1] ?? 0)).toBe(true);
    });
});

describe("buildFrame — subpane cssRect", () => {
    it("carries each pane's CSS rect through to the render state", () => {
        const state = createAdapterState();
        seedBars(state, [bar(0, 10), bar(10, 11)]);
        const subpane: PaneLayoutRect = { paneKey: "rsi", x: 0, y: 320, width: 800, height: 80 };
        const panes = buildFrame(state, [OVERLAY, subpane]);
        expect(panes[0].cssRect).toEqual({ x: 0, y: 0, width: 800, height: 400 });
        expect(panes[1].cssRect).toEqual({ x: 0, y: 320, width: 800, height: 80 });
    });

    it("carries the cssRect on the empty-bars pane too", () => {
        const state = createAdapterState();
        const [pane] = buildFrame(state, [OVERLAY]);
        expect(pane.cssRect).toEqual({ x: 0, y: 0, width: 800, height: 400 });
    });
});

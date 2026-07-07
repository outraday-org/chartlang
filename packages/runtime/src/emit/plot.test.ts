// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Series } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import { Float64RingBuffer } from "../ringBuffer.js";
import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { inMemoryStateStore } from "../stateStore.js";
import { createStreamState } from "../streamState.js";
import { plot } from "./plot.js";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
        ...overrides,
    };
}

function makeCtx(
    opts: {
        caps?: Capabilities;
        barIndex?: number;
        barTime?: number;
        plotOverrides?: RuntimeContext["plotOverrides"];
        defaultPane?: string;
        scriptPane?: string;
    } = {},
): {
    ctx: RuntimeContext;
    emissions: MutableRunnerEmissions;
} {
    const emissions: MutableRunnerEmissions = {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
    const stream = createStreamState({ interval: "", capacity: 4, symbol: "" });
    stream.bar.time = opts.barTime ?? 1_700_000_000_000;
    const ctx: RuntimeContext = {
        stream,
        stateStore: inMemoryStateStore(),
        capabilities: opts.caps ?? makeCaps(),
        emissions,
        barIndex: () => opts.barIndex ?? 5,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
        defaultPane: opts.defaultPane ?? "overlay",
        scriptPane: opts.scriptPane ?? "script:test",
        plotOverrides: opts.plotOverrides ?? {},
    };
    return { ctx, emissions };
}

function fakeSeries(value: number): Series<number> {
    const stub = {
        get current() {
            return value;
        },
        get length() {
            return 1;
        },
    };
    return stub as Series<number>;
}

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("plot — happy path", () => {
    it("pushes one PlotEmission with the expected fields (numeric value)", () => {
        const { ctx, emissions } = makeCtx({ barIndex: 3, barTime: 1_700_000_060_000 });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42);
        expect(emissions.plots).toHaveLength(1);
        const e = emissions.plots[0];
        expect(e.kind).toBe("plot");
        expect(e.slotId).toBe("a:1:1#0");
        expect(e.value).toBe(42);
        expect(e.bar).toBe(3);
        expect(e.time).toBe(1_700_000_060_000);
        expect(e.style.kind).toBe("line");
        expect(e.pane).toBe("overlay");
        expect(e.color).toBeNull();
        expect(e.meta).toEqual({});
        expect(e.title).toBe("");
        expect(emissions.diagnostics).toEqual([]);
    });

    it("emits the script pane when the mount default is a subpane (overlay:false, subPanes >= 1)", () => {
        const caps = makeCaps({ subPanes: 1 });
        const { ctx, emissions } = makeCtx({ caps, defaultPane: "script:rsi-cross" });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42);
        expect(emissions.plots[0].pane).toBe("script:rsi-cross");
        expect(emissions.diagnostics).toEqual([]);
    });

    it("reads .current when passed a Series<number>", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", fakeSeries(7.5));
        expect(emissions.plots[0].value).toBe(7.5);
    });

    it("applies opts (color, title, lineWidth, lineStyle)", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1, {
            color: "#3b82f6",
            title: "EMA",
            lineWidth: 2,
            lineStyle: "dashed",
        });
        const e = emissions.plots[0];
        expect(e.color).toBe("#3b82f6");
        expect(e.title).toBe("EMA");
        expect(e.style.lineWidth).toBe(2);
        expect(e.style.lineStyle).toBe("dashed");
    });
});

describe("plot — xShift (presentation offset, Option A)", () => {
    function tagged(offset: number): Series<number> {
        const buf = new Float64RingBuffer(8);
        buf.append(11);
        buf.append(22);
        return makeShiftedSeriesView<number>(buf, offset);
    }

    it("carries a positive recorded offset onto xShift, value unshifted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", tagged(5));
        const e = emissions.plots[0];
        expect(e.xShift).toBe(5);
        expect(e.value).toBe(22);
    });

    it("carries a negative recorded offset onto xShift", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", tagged(-3));
        expect(emissions.plots[0].xShift).toBe(-3);
    });

    it("omits xShift for a plain numeric value", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42);
        expect(emissions.plots[0].xShift).toBeUndefined();
    });

    it("omits xShift for an untagged series view", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const buf = new Float64RingBuffer(4);
        buf.append(9);
        plot("a:1:1#0", makeSeriesView<number>(buf));
        expect(emissions.plots[0].xShift).toBeUndefined();
    });

    it("omits xShift for an offset === 0 view (byte-identical to no-offset)", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", tagged(0));
        expect(emissions.plots[0].xShift).toBeUndefined();
    });
});

describe("plot — z (render-order, omit-when-0)", () => {
    function tagged(offset: number): Series<number> {
        const buf = new Float64RingBuffer(8);
        buf.append(11);
        buf.append(22);
        return makeShiftedSeriesView<number>(buf, offset);
    }

    it("carries a non-zero z onto the emission", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42, { z: 2 });
        expect(emissions.plots[0].z).toBe(2);
    });

    it("carries a fractional / negative z", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42, { z: -1.5 });
        expect(emissions.plots[0].z).toBe(-1.5);
    });

    it("omits the z key entirely when z is not provided (byte-identical baseline)", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42);
        const e = emissions.plots[0];
        expect("z" in e).toBe(false);
        expect(e.z).toBeUndefined();
    });

    it("omits the z key when z === 0 (byte-identical to no-z)", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42, { z: 0 });
        expect("z" in emissions.plots[0]).toBe(false);
    });

    it("is independent of xShift — a plot can carry both", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", tagged(3), { z: 2 });
        const e = emissions.plots[0];
        expect(e.xShift).toBe(3);
        expect(e.z).toBe(2);
    });

    it("preserves z through a matching plot override (regression guard)", () => {
        const { ctx, emissions } = makeCtx({
            plotOverrides: { "a:1:1#0": { visible: false, color: "#f00" } },
        });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1, { z: 4 });
        const e = emissions.plots[0];
        expect(e.z).toBe(4);
        expect(e.visible).toBe(false);
        expect(e.color).toBe("#f00");
    });
});

describe("plot — visible (authoring, omit-when-visible)", () => {
    it("carries visible: false onto the emission", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42, { visible: false });
        expect(emissions.plots[0].visible).toBe(false);
    });

    it("omits the visible key when visible: true (byte-identical baseline)", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42, { visible: true });
        const e = emissions.plots[0];
        expect("visible" in e).toBe(false);
        expect(e.visible).toBeUndefined();
    });

    it("omits the visible key entirely when not provided (byte-identical baseline)", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42);
        expect("visible" in emissions.plots[0]).toBe(false);
    });

    it("resolves a per-bar boolean — set when false", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const close = -1;
        plot("a:1:1#0", 42, { visible: close > 0 });
        expect(emissions.plots[0].visible).toBe(false);
    });

    it("resolves a per-bar boolean — omitted when true", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const close = 5;
        plot("a:1:1#0", 42, { visible: close > 0 });
        expect("visible" in emissions.plots[0]).toBe(false);
    });

    it("is orthogonal to a value: null skip-bar (both co-occur)", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", Number.NaN, { visible: false });
        const e = emissions.plots[0];
        expect(e.value).toBeNull();
        expect(e.visible).toBe(false);
    });

    it("dedup: second same-bar write with visible: false wins", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1);
        plot("a:1:1#0", 2, { visible: false });
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0].value).toBe(2);
        expect(emissions.plots[0].visible).toBe(false);
    });

    it("composes with a host override — authored false AND override both leave visible: false", () => {
        const { ctx, emissions } = makeCtx({
            plotOverrides: { "a:1:1#0": { visible: false } },
        });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1, { visible: false });
        expect(emissions.plots[0].visible).toBe(false);
    });
});

describe("plot — plot overrides", () => {
    it("applies a matching slot override from the context (visible/color/line)", () => {
        const { ctx, emissions } = makeCtx({
            plotOverrides: {
                "a:1:1#0": { visible: false, color: "#f00", lineWidth: 4, lineStyle: "dashed" },
            },
        });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1, { color: "#000", lineWidth: 1, lineStyle: "solid" });
        const e = emissions.plots[0];
        expect(e.visible).toBe(false);
        expect(e.color).toBe("#f00");
        expect(e.style.lineWidth).toBe(4);
        expect(e.style.lineStyle).toBe("dashed");
    });

    it("leaves the emission untouched when no override matches the slot", () => {
        const { ctx, emissions } = makeCtx({
            plotOverrides: { "other:1:1#0": { visible: false } },
        });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1);
        expect(emissions.plots[0].visible).toBeUndefined();
        expect(emissions.plots[0].color).toBeNull();
    });
});

describe("plot — style selection (opts.style)", () => {
    it("emits a histogram style when opts.style.kind === 'histogram' (default baseline 0)", () => {
        const caps = makeCaps({ plots: new Set(["line", "histogram"]) });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42, { style: { kind: "histogram" } });
        expect(emissions.plots).toHaveLength(1);
        const style = emissions.plots[0].style;
        expect(style.kind).toBe("histogram");
        if (style.kind === "histogram") {
            expect(style.baseline).toBe(0);
        }
    });

    it("respects an explicit histogram baseline", () => {
        const caps = makeCaps({ plots: new Set(["line", "histogram"]) });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 10, { style: { kind: "histogram", baseline: 50 } });
        const style = emissions.plots[0].style;
        if (style.kind !== "histogram") throw new Error("expected histogram");
        expect(style.baseline).toBe(50);
    });

    it("emits a step-line style when opts.style.kind === 'step-line'", () => {
        const caps = makeCaps({ plots: new Set(["line", "step-line"]) });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1, {
            style: { kind: "step-line" },
            lineWidth: 3,
            lineStyle: "dashed",
        });
        const style = emissions.plots[0].style;
        expect(style.kind).toBe("step-line");
        if (style.kind === "step-line") {
            expect(style.lineWidth).toBe(3);
            expect(style.lineStyle).toBe("dashed");
        }
    });

    it("emits an area style when opts.style.kind === 'area' (default fillAlpha 0.2)", () => {
        const caps = makeCaps({ plots: new Set(["line", "area"]) });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42, {
            style: { kind: "area" },
            lineWidth: 2,
            lineStyle: "dotted",
        });
        expect(emissions.plots).toHaveLength(1);
        const style = emissions.plots[0].style;
        expect(style.kind).toBe("area");
        if (style.kind === "area") {
            expect(style.lineWidth).toBe(2);
            expect(style.lineStyle).toBe("dotted");
            expect(style.fillAlpha).toBe(0.2);
        }
    });

    it("respects an explicit area fillAlpha", () => {
        const caps = makeCaps({ plots: new Set(["line", "area"]) });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 10, { style: { kind: "area", fillAlpha: 0.5 } });
        const style = emissions.plots[0].style;
        if (style.kind !== "area") throw new Error("expected area");
        expect(style.fillAlpha).toBe(0.5);
        expect(style.lineWidth).toBe(1);
        expect(style.lineStyle).toBe("solid");
    });

    it("falls back to line when opts.style is omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1, { style: { kind: "line" } });
        expect(emissions.plots[0].style.kind).toBe("line");
    });

    it("drops + diagnoses unsupported-plot-kind when the chosen style is not in capabilities.plots", () => {
        const caps = makeCaps({ plots: capabilities.allLines() });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1, { style: { kind: "histogram" } });
        expect(emissions.plots).toEqual([]);
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-plot-kind");
    });

    it("emits a marker style when opts.style.kind === 'marker'", () => {
        const caps = makeCaps({ plots: new Set(["line", "marker"]) });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42, {
            style: { kind: "marker", shape: "triangle-up", size: 6 },
        });
        expect(emissions.plots).toHaveLength(1);
        const style = emissions.plots[0].style;
        expect(style.kind).toBe("marker");
        if (style.kind === "marker") {
            expect(style.shape).toBe("triangle-up");
            expect(style.size).toBe(6);
        }
    });

    it("emits Phase-5 styles unchanged", () => {
        const caps = makeCaps({
            plots: new Set([
                "line",
                "step-line",
                "horizontal-line",
                "histogram",
                "area",
                "filled-band",
                "label",
                "marker",
                "shape",
                "character",
                "arrow",
                "candle-override",
                "bar-override",
                "bg-color",
                "bar-color",
                "horizontal-histogram",
            ]),
        });
        const cases = [
            {
                slotId: "a:1:1#1",
                style: { kind: "shape", shape: "flag", size: 8, location: "below" },
            },
            {
                slotId: "a:1:1#2",
                style: { kind: "character", char: "A", size: 12, location: "above" },
            },
            { slotId: "a:1:1#3", style: { kind: "arrow", direction: "up", size: 10 } },
            {
                slotId: "a:1:1#4",
                style: { kind: "candle-override", bull: "#26a69a", bear: "#ef5350" },
            },
            { slotId: "a:1:1#5", style: { kind: "bar-override", color: "#f59e0b" } },
            { slotId: "a:1:1#6", style: { kind: "bg-color", color: "#1d4ed8", transp: 80 } },
            { slotId: "a:1:1#7", style: { kind: "bar-color", color: "#a855f7" } },
            {
                slotId: "a:1:1#8",
                style: {
                    kind: "horizontal-histogram",
                    buckets: [{ price: 100, volume: 20, color: "#90caf9" }],
                },
            },
        ] as const;
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        for (const item of cases) {
            plot(item.slotId, 42, { style: item.style });
        }
        expect(emissions.plots.map((emission) => emission.style)).toEqual(
            cases.map((item) => item.style),
        );
    });

    it("omits optional Phase-5 style fields when they are undefined", () => {
        const caps = makeCaps({
            plots: new Set(["line", "shape", "character", "candle-override", "bg-color"]),
        });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        plot("a:1:1#1", 1, { style: { kind: "shape", shape: "flag", size: 8 } });
        plot("a:1:1#2", 2, { style: { kind: "character", char: "A", size: 12 } });
        plot("a:1:1#3", 3, { style: { kind: "candle-override", bull: "#0f0", bear: "#f00" } });
        plot("a:1:1#4", 4, { style: { kind: "bg-color", color: "#111" } });
        plot("a:1:1#5", 5, {
            style: { kind: "candle-override", bull: "#0f0", bear: "#f00", doji: "#999" },
        });

        expect(emissions.plots.map((emission) => emission.style)).toEqual([
            { kind: "shape", shape: "flag", size: 8 },
            { kind: "character", char: "A", size: 12 },
            { kind: "candle-override", bull: "#0f0", bear: "#f00" },
            { kind: "bg-color", color: "#111" },
            { kind: "candle-override", bull: "#0f0", bear: "#f00", doji: "#999" },
        ]);
    });

    it("omits colorValue on the static plot path (no dynamic-color channel)", () => {
        // `plot` never passes a dynamic color, so the per-bar `colorValue` own
        // key is absent — the wire stays byte-identical to the pre-Deliverable-2
        // baseline (every pinned plot golden / conformance hash holds).
        const caps = makeCaps({ plots: new Set(["line", "bg-color"]) });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 42, { color: "#3b82f6" });
        plot("a:1:1#1", Number.NaN, { style: { kind: "bg-color", color: "#111" } });
        expect(emissions.plots).toHaveLength(2);
        expect("colorValue" in emissions.plots[0]).toBe(false);
        expect("colorValue" in emissions.plots[1]).toBe(false);
    });
});

describe("plot — NaN handling", () => {
    it("emits value: null for non-finite numeric value", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", Number.NaN);
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0].value).toBeNull();
    });

    it("emits value: null when Series.current is NaN", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", fakeSeries(Number.NaN));
        expect(emissions.plots[0].value).toBeNull();
    });

    it("emits value: null for Infinity", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", Number.POSITIVE_INFINITY);
        expect(emissions.plots[0].value).toBeNull();
    });
});

describe("plot — capability gating", () => {
    it("drops + diagnoses unsupported-plot-kind when capabilities.plots lacks 'line'", () => {
        const caps = makeCaps({ plots: capabilities.horizontalLine() });
        const { ctx, emissions } = makeCtx({ caps });
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1);
        expect(emissions.plots).toEqual([]);
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-plot-kind");
        expect(emissions.diagnostics[0].slotId).toBe("a:1:1#0");
    });

    it("emits an unsupported-pane diagnostic when opts.pane is non-overlay", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1, { pane: "new" });
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0].pane).toBe("overlay");
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-pane");
    });
});

describe("plot — dedup", () => {
    it("two plots on the same (slotId, bar) — second wins", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        plot("a:1:1#0", 1);
        plot("a:1:1#0", 2);
        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0].value).toBe(2);
    });
});

describe("plot — outside context", () => {
    it("throws sentinel when ACTIVE_RUNTIME_CONTEXT.current is null", () => {
        expect(() => plot("a:1:1#0", 1)).toThrow("plot called outside an active script step");
    });

    it("throws sentinel when called without a slot id (direct script-author invocation)", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => plot(1)).toThrow("plot called outside an active script step");
    });

    it("throws sentinel when slotId is provided but value is not number|Series", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        // Three-arg shape with non-numeric value — the compiler would
        // never emit this, but the guard must throw.
        expect(() => plot("a:1:1#0", { color: "#fff" } as never)).toThrow(
            "plot called outside an active script step",
        );
    });
});

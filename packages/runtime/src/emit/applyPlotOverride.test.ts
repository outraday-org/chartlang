// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotEmission, PlotStyle } from "@invinite-org/chartlang-adapter-kit";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { applyPlotOverride } from "./applyPlotOverride.js";

function lineEmission(overrides: Partial<PlotEmission> = {}): PlotEmission {
    return {
        kind: "plot",
        slotId: "s:1:1#0",
        title: "",
        style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
        bar: 0,
        time: 0,
        value: 1,
        color: null,
        meta: {},
        pane: "overlay",
        ...overrides,
    };
}

function histogramEmission(): PlotEmission {
    return {
        kind: "plot",
        slotId: "s:1:1#0",
        title: "",
        style: { kind: "histogram", baseline: 0 },
        bar: 0,
        time: 0,
        value: 1,
        color: null,
        meta: {},
        pane: "overlay",
    };
}

describe("applyPlotOverride", () => {
    it("returns the input unchanged (same reference) when override is undefined", () => {
        const e = lineEmission();
        expect(applyPlotOverride(e, undefined)).toBe(e);
    });

    it("returns deep-equal emission for an empty override", () => {
        const e = lineEmission();
        const next = applyPlotOverride(e, {});
        expect(next).toEqual(e);
        expect(next.visible).toBeUndefined();
    });

    it("sets visible:false when override.visible === false", () => {
        const next = applyPlotOverride(lineEmission(), { visible: false });
        expect(next.visible).toBe(false);
    });

    it("does not write visible when override.visible === true (omits the field)", () => {
        const next = applyPlotOverride(lineEmission(), { visible: true });
        expect("visible" in next).toBe(false);
    });

    it("overwrites color", () => {
        const next = applyPlotOverride(lineEmission({ color: "#000" }), { color: "#f00" });
        expect(next.color).toBe("#f00");
    });

    it("merges lineWidth + lineStyle on a line-family kind", () => {
        const next = applyPlotOverride(lineEmission(), { lineWidth: 3, lineStyle: "dashed" });
        const style = next.style as Extract<PlotStyle, { kind: "line" }>;
        expect(style.lineWidth).toBe(3);
        expect(style.lineStyle).toBe("dashed");
    });

    it("merges lineWidth only on a line-family kind", () => {
        const next = applyPlotOverride(lineEmission(), { lineWidth: 5 });
        const style = next.style as Extract<PlotStyle, { kind: "line" }>;
        expect(style.lineWidth).toBe(5);
        expect(style.lineStyle).toBe("solid");
    });

    it("merges lineStyle only on a line-family kind", () => {
        const next = applyPlotOverride(lineEmission(), { lineStyle: "dotted" });
        const style = next.style as Extract<PlotStyle, { kind: "line" }>;
        expect(style.lineStyle).toBe("dotted");
        expect(style.lineWidth).toBe(1);
    });

    it("ignores lineWidth/lineStyle on a non-line kind (no-op)", () => {
        const e = histogramEmission();
        const next = applyPlotOverride(e, { lineWidth: 9, lineStyle: "dashed" });
        expect(next.style).toEqual(e.style);
    });

    it("applies all fields combined", () => {
        const next = applyPlotOverride(lineEmission(), {
            visible: false,
            color: "#0f0",
            lineWidth: 4,
            lineStyle: "dashed",
        });
        const style = next.style as Extract<PlotStyle, { kind: "line" }>;
        expect(next.visible).toBe(false);
        expect(next.color).toBe("#0f0");
        expect(style.lineWidth).toBe(4);
        expect(style.lineStyle).toBe("dashed");
    });

    it("property: an empty override returns a deep-equal emission for random valid emissions", () => {
        const lineStyleArb = fc.constantFrom("solid", "dashed", "dotted" as const);
        const styleArb: fc.Arbitrary<PlotStyle> = fc.oneof(
            fc.record({
                kind: fc.constantFrom("line", "step-line", "horizontal-line" as const),
                lineWidth: fc.integer({ min: 1, max: 5 }),
                lineStyle: lineStyleArb,
            }) as fc.Arbitrary<PlotStyle>,
            fc.record({
                kind: fc.constant("histogram" as const),
                baseline: fc.double({ min: -10, max: 10, noNaN: true }),
            }) as fc.Arbitrary<PlotStyle>,
        );
        const emissionArb: fc.Arbitrary<PlotEmission> = fc.record({
            kind: fc.constant("plot" as const),
            slotId: fc.string(),
            title: fc.string(),
            style: styleArb,
            bar: fc.nat(),
            time: fc.nat(),
            value: fc.oneof(fc.double({ noNaN: true }), fc.constant(null)),
            color: fc.oneof(fc.string(), fc.constant(null)),
            meta: fc.constant({}),
            pane: fc.constantFrom("overlay", "new" as const),
        });
        fc.assert(
            fc.property(emissionArb, (emission) => {
                expect(applyPlotOverride(emission, {})).toEqual(emission);
            }),
        );
    });
});

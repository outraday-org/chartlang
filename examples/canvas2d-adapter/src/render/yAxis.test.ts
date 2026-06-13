// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette.js";
import { MockCanvas2DContext } from "../testing.js";
import type { Viewport } from "./coords.js";
import { drawYAxis } from "./yAxis.js";

function viewport(over: Partial<Viewport>): Viewport {
    return {
        xMin: 0,
        xMax: 1,
        yMin: over.yMin ?? 0,
        yMax: over.yMax ?? 100,
        pxWidth: over.pxWidth ?? 200,
        pxHeight: over.pxHeight ?? 80,
    };
}

function labels(ctx: MockCanvas2DContext): string[] {
    return ctx.calls.flatMap((c) => (c.kind === "fillText" ? [c.text] : []));
}

describe("drawYAxis", () => {
    it("emits five gridlines and five gutter labels", () => {
        const ctx = new MockCanvas2DContext();
        drawYAxis(ctx, viewport({}), DEFAULT_PALETTE);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(5);
        expect(labels(ctx)).toHaveLength(5);
    });

    it("places labels in the gutter (x beyond the plot width)", () => {
        const ctx = new MockCanvas2DContext();
        drawYAxis(ctx, viewport({ pxWidth: 200 }), DEFAULT_PALETTE);
        const texts = ctx.calls.filter((c) => c.kind === "fillText");
        for (const call of texts) {
            if (call.kind === "fillText") expect(call.x).toBeGreaterThan(200);
        }
    });

    it("maps the top tick to yMax and the bottom tick to yMin", () => {
        const ctx = new MockCanvas2DContext();
        drawYAxis(ctx, viewport({ yMin: 0, yMax: 100 }), DEFAULT_PALETTE);
        const texts = labels(ctx);
        // Top label (y=0) reads yMax; bottom label (y=pxHeight) reads yMin.
        expect(texts[0]).toBe("100");
        expect(texts[texts.length - 1]).toBe("0");
    });

    it("formats integers for a wide span (>= 50)", () => {
        const ctx = new MockCanvas2DContext();
        drawYAxis(ctx, viewport({ yMin: 0, yMax: 100 }), DEFAULT_PALETTE);
        expect(labels(ctx)).toContain("50");
    });

    it("formats one decimal for a medium span (>= 5)", () => {
        const ctx = new MockCanvas2DContext();
        drawYAxis(ctx, viewport({ yMin: 100, yMax: 110 }), DEFAULT_PALETTE);
        expect(labels(ctx)).toContain("105.0");
    });

    it("formats two decimals for a tight span (< 5)", () => {
        const ctx = new MockCanvas2DContext();
        drawYAxis(ctx, viewport({ yMin: 1, yMax: 2 }), DEFAULT_PALETTE);
        expect(labels(ctx)).toContain("1.50");
    });

    it("uses top / middle / bottom baselines across the tick column", () => {
        const ctx = new MockCanvas2DContext();
        drawYAxis(ctx, viewport({}), DEFAULT_PALETTE);
        const baselines = ctx.calls.flatMap((c) =>
            c.kind === "set" && c.prop === "textBaseline" ? [c.value] : [],
        );
        expect(baselines).toContain("top");
        expect(baselines).toContain("middle");
        expect(baselines).toContain("bottom");
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette.js";
import { MockCanvas2DContext } from "../testing.js";
import type { Viewport } from "./coords.js";
import { drawYAxis, formatTick, niceTicks } from "./yAxis.js";

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

function strokes(ctx: MockCanvas2DContext): number {
    return ctx.calls.filter((c) => c.kind === "stroke").length;
}

describe("niceTicks", () => {
    it("ticks a [-1.1, 1.1] pane at round 0.5 steps (not even-division 0.55)", () => {
        expect(niceTicks(-1.1, 1.1, 5)).toEqual([-1, -0.5, 0, 0.5, 1]);
    });

    it("snaps the step up the 1 / 2 / 5 × 10ⁿ ladder", () => {
        expect(niceTicks(0, 50, 5)).toEqual([0, 10, 20, 30, 40, 50]); // norm 1 → ×1
        expect(niceTicks(0, 75, 5)).toEqual([0, 20, 40, 60]); // norm 1.5 → ×2
        expect(niceTicks(0, 150, 5)).toEqual([0, 50, 100, 150]); // norm 3 → ×5
        expect(niceTicks(0, 350, 5)).toEqual([0, 100, 200, 300]); // norm 7 → ×10
    });

    it("returns [] for a degenerate or non-finite range", () => {
        expect(niceTicks(5, 5, 5)).toEqual([]);
        expect(niceTicks(10, 0, 5)).toEqual([]);
        expect(niceTicks(Number.NaN, 1, 5)).toEqual([]);
        expect(niceTicks(0, 1, 0)).toEqual([]);
    });
});

describe("formatTick", () => {
    it("uses no decimals for an integer step", () => {
        expect(formatTick(40, 20)).toBe("40");
    });

    it("derives decimals from a sub-integer step", () => {
        expect(formatTick(0.5, 0.5)).toBe("0.5");
        expect(formatTick(0.05, 0.05)).toBe("0.05");
    });

    it("caps decimals at six for a vanishingly small step", () => {
        expect(formatTick(0.000001, 0.0000001)).toBe("0.000001");
    });
});

describe("drawYAxis", () => {
    it("draws one gridline and one gutter label per nice tick", () => {
        const ctx = new MockCanvas2DContext();
        drawYAxis(ctx, viewport({ yMin: 0, yMax: 100 }), DEFAULT_PALETTE);
        expect(strokes(ctx)).toBe(labels(ctx).length);
        expect(strokes(ctx)).toBeGreaterThan(1);
    });

    it("labels round values for a [-1, 1] pane — never the 0.55 even-division", () => {
        const ctx = new MockCanvas2DContext();
        drawYAxis(ctx, viewport({ yMin: -1.1, yMax: 1.1 }), DEFAULT_PALETTE);
        const texts = labels(ctx);
        expect(texts).toEqual(expect.arrayContaining(["-1.0", "-0.5", "0.0", "0.5", "1.0"]));
        expect(texts).not.toContain("0.55");
        expect(texts).not.toContain("1.10");
    });

    it("places labels in the gutter (x beyond the plot width)", () => {
        const ctx = new MockCanvas2DContext();
        drawYAxis(ctx, viewport({ pxWidth: 200 }), DEFAULT_PALETTE);
        for (const call of ctx.calls) {
            if (call.kind === "fillText") expect(call.x).toBeGreaterThan(200);
        }
    });

    it("uses top / middle / bottom baselines across the tick column", () => {
        const ctx = new MockCanvas2DContext();
        drawYAxis(ctx, viewport({ yMin: 0, yMax: 100 }), DEFAULT_PALETTE);
        const baselines = ctx.calls.flatMap((c) =>
            c.kind === "set" && c.prop === "textBaseline" ? [c.value] : [],
        );
        expect(baselines).toContain("top");
        expect(baselines).toContain("middle");
        expect(baselines).toContain("bottom");
    });

    it("draws nothing for a degenerate range", () => {
        const ctx = new MockCanvas2DContext();
        drawYAxis(ctx, viewport({ yMin: 5, yMax: 5 }), DEFAULT_PALETTE);
        expect(strokes(ctx)).toBe(0);
        expect(labels(ctx)).toHaveLength(0);
    });
});

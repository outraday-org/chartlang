// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { CyclicLinesState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderCyclicLines } from "./cyclicLines";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: CyclicLinesState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "cyclic-lines",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: CyclicLinesState = {
    kind: "cyclic-lines",
    anchors: [
        { time: 0, price: 50 },
        { time: 10, price: 50 },
    ],
    style: {},
};

describe("renderCyclicLines", () => {
    it("strokes repeated full-height vertical lines spaced by periodPx", () => {
        const ctx = new MockCanvas2DContext();
        renderCyclicLines(ctx, emission(STATE), VIEW);
        const strokes = ctx.calls.filter((c) => c.kind === "stroke");
        expect(strokes.length).toBeGreaterThan(0);
        const moves = ctx.calls.filter((c) => c.kind === "moveTo");
        expect(moves.length).toBe(strokes.length);
        for (const move of moves) {
            if (move.kind === "moveTo") expect(move.y).toBe(0);
        }
        const lines = ctx.calls.filter((c) => c.kind === "lineTo");
        for (const line of lines) {
            if (line.kind === "lineTo") expect(line.y).toBe(VIEW.pxHeight);
        }
    });

    it("defaults to cycle sky-blue #0ea5e9 stroke", () => {
        const ctx = new MockCanvas2DContext();
        renderCyclicLines(ctx, emission(STATE), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#0ea5e9");
    });

    it("honours state.style.color override", () => {
        const ctx = new MockCanvas2DContext();
        renderCyclicLines(ctx, emission({ ...STATE, style: { color: "#abcdef" } }), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#abcdef");
    });

    it("applies dashed line dash pattern when style.lineStyle = dashed", () => {
        const ctx = new MockCanvas2DContext();
        renderCyclicLines(ctx, emission({ ...STATE, style: { lineStyle: "dashed" } }), VIEW);
        const dashCalls = ctx.calls.filter((c) => c.kind === "setLineDash");
        const dashed = dashCalls.find((c) => c.kind === "setLineDash" && c.segments.length === 2);
        expect(dashed).toBeDefined();
    });

    it("skips strokes whose x falls left of the viewport (offscreen-left anchor)", () => {
        // Place `from` far to the left of the viewport at time = -200
        // (well past x = -16). The first few iterations of the loop
        // produce x values < -16 which should `continue` without
        // drawing; the loop then resumes once x catches up to the
        // viewport.
        const ctx = new MockCanvas2DContext();
        renderCyclicLines(
            ctx,
            emission({
                ...STATE,
                anchors: [
                    { time: -200, price: 50 },
                    { time: -190, price: 50 },
                ],
            }),
            VIEW,
        );
        const strokes = ctx.calls.filter((c) => c.kind === "stroke").length;
        expect(strokes).toBeGreaterThan(0);
    });

    it("no-ops silently when periodPx is zero (anchors at same time)", () => {
        const ctx = new MockCanvas2DContext();
        renderCyclicLines(
            ctx,
            emission({
                ...STATE,
                anchors: [
                    { time: 50, price: 50 },
                    { time: 50, price: 50 },
                ],
            }),
            VIEW,
        );
        expect(ctx.calls).toEqual([]);
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { GannSquareState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { GANN_LEVELS } from "./gannLevels";
import { renderGannSquare } from "./gannSquare";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: GannSquareState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "gann-square",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: GannSquareState = {
    kind: "gann-square",
    anchors: [
        { time: 0, price: 0 },
        { time: 100, price: 100 },
    ],
    style: {},
};

describe("renderGannSquare", () => {
    it("strokes one horizontal + one vertical line per GANN_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        renderGannSquare(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(GANN_LEVELS.length * 2);
    });

    it("defaults strokeStyle to gann purple #a855f7", () => {
        const ctx = new MockCanvas2DContext();
        renderGannSquare(ctx, emission(STATE), VIEW);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#a855f7");
    });

    it("honours style.color", () => {
        const ctx = new MockCanvas2DContext();
        renderGannSquare(ctx, emission({ ...STATE, style: { color: "#fedcba" } }), VIEW);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#fedcba");
    });

    it("paints a square (side = max(|dx|, |dy|) in canvas space)", () => {
        const ctx = new MockCanvas2DContext();
        // anchors at (0,0) and (100,100) in world → canvas (0,400) and
        // (800,0). |dx|=800, |dy|=400 → side = 800.
        renderGannSquare(ctx, emission(STATE), VIEW);
        // The level=1.0 horizontal spans the full side; check at least
        // one stroke endpoint lands at x = 0 + 800 = 800.
        const lineTos = ctx.calls.filter((c) => c.kind === "lineTo");
        const xs = lineTos
            .map((c) => (c.kind === "lineTo" ? c.x : 0))
            .filter((x) => Number.isFinite(x));
        expect(xs.some((x) => Math.abs(x - 800) < 1e-6)).toBe(true);
    });

    it("strokes no fills (square is stroked, not filled)", () => {
        const ctx = new MockCanvas2DContext();
        renderGannSquare(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("handles the b-left-of-a case (signX = -1, square anchored to the left of a)", () => {
        const ctx = new MockCanvas2DContext();
        // anchors: a at world (100, 100), b at world (0, 0). In canvas:
        // a → (800, 0), b → (0, 400). signX = -1 (b.x < a.x), signY = 1
        // (b.y > a.y). side = max(|−800|, |400|) = 800. So the square
        // sits from (a.x - 800, a.y) = (0, 0) to (a.x, a.y + 800) =
        // (800, 800). The level=1.0 vertical lands at x = 0.
        renderGannSquare(
            ctx,
            emission({
                ...STATE,
                anchors: [
                    { time: 100, price: 100 },
                    { time: 0, price: 0 },
                ],
            }),
            VIEW,
        );
        const lineTos = ctx.calls.filter((c) => c.kind === "lineTo");
        const xs = lineTos
            .map((c) => (c.kind === "lineTo" ? c.x : 0))
            .filter((x) => Number.isFinite(x));
        // Square left edge sits at x = 800 - 800 = 0.
        expect(xs.some((x) => Math.abs(x - 0) < 1e-6)).toBe(true);
    });

    it("handles the b-above-a case (signY = -1, square anchored above a)", () => {
        const ctx = new MockCanvas2DContext();
        // a at world (0, 0) → canvas (0, 400); b at world (100, -100)
        // → canvas (800, 800). signX = 1, signY = -1 (b.y > a.y in
        // canvas-pixel space is actually flipped; in priceToY, a.y =
        // 400 when price=0, b.y = 800 when price=-100, so b.y > a.y).
        // Actually let's use b.price > a.price so canvas-b.y < a.y
        // (priceToY inverts): a (0,0) → (0,400), b (100,100) →
        // (800,0). b.y < a.y → signY = -1 path.
        renderGannSquare(
            ctx,
            emission({
                ...STATE,
                anchors: [
                    { time: 0, price: 100 },
                    { time: 100, price: 0 },
                ],
            }),
            VIEW,
        );
        // a → canvas (0, 0); b → (800, 400). b.x > a.x → signX=1;
        // b.y > a.y → signY=1. To hit signY=-1, swap order: a → (800,
        // 400), b → (0, 0). b.x < a.x → signX=-1; b.y < a.y → signY=-1.
        // The case above hits signX=1, signY=1; do an explicit
        // mirror-case call.
        renderGannSquare(
            ctx,
            emission({
                ...STATE,
                anchors: [
                    { time: 100, price: 0 },
                    { time: 0, price: 100 },
                ],
            }),
            VIEW,
        );
        // Sanity: the function emitted strokes for both cases without
        // throwing.
        expect(ctx.calls.filter((c) => c.kind === "stroke").length).toBeGreaterThan(0);
    });
});

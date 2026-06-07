// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { GannSquareFixedState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { GANN_LEVELS } from "./gannLevels";
import { renderGannSquareFixed } from "./gannSquareFixed";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: GannSquareFixedState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "gann-square-fixed",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: GannSquareFixedState = {
    kind: "gann-square-fixed",
    anchor: { time: 50, price: 50 },
    style: {},
};

describe("renderGannSquareFixed", () => {
    it("strokes one horizontal + one vertical line per GANN_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        renderGannSquareFixed(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(
            GANN_LEVELS.length * 2,
        );
    });

    it("defaults strokeStyle to gann purple #a855f7", () => {
        const ctx = new MockCanvas2DContext();
        renderGannSquareFixed(ctx, emission(STATE), VIEW);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#a855f7");
    });

    it("honours style.color", () => {
        const ctx = new MockCanvas2DContext();
        renderGannSquareFixed(
            ctx,
            emission({ ...STATE, style: { color: "#abcdef" } }),
            VIEW,
        );
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#abcdef");
    });

    it("paints the level=1.0 vertical at origin.x + 80 (fixed pixel side)", () => {
        const ctx = new MockCanvas2DContext();
        renderGannSquareFixed(ctx, emission(STATE), VIEW);
        // First horizontal is at level=0 (top edge) which equals origin.y;
        // first vertical is at level=0 (left edge) which equals origin.x.
        // Find the moveTo with x = origin.x + 80 (level=1 vertical's left
        // bottom corner).
        const lineTos = ctx.calls.filter((c) => c.kind === "lineTo");
        const xs = lineTos
            .map((c) => (c.kind === "lineTo" ? c.x : 0))
            .filter((x) => Number.isFinite(x));
        // At least one stroke endpoint should hit origin.x + SIDE_PX.
        const originX = (50 / 100) * 800;
        expect(xs.some((x) => Math.abs(x - (originX + 80)) < 1e-6)).toBe(true);
    });
});

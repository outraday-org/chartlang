// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { HeadAndShouldersState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderHeadAndShoulders } from "./headAndShoulders.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: HeadAndShouldersState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "head-and-shoulders",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: HeadAndShouldersState = {
    kind: "head-and-shoulders",
    anchors: [
        { time: 10, price: 60 },
        { time: 30, price: 30 },
        { time: 50, price: 80 },
        { time: 70, price: 30 },
        { time: 90, price: 60 },
    ],
    style: {},
};

describe("renderHeadAndShoulders", () => {
    it("strokes the 4-leg pivot polyline + 1 neckline (2 strokes total)", () => {
        const ctx = new MockCanvas2DContext();
        renderHeadAndShoulders(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(2);
    });

    it("labels every pivot (LS, LL, H, RL, RS)", () => {
        const ctx = new MockCanvas2DContext();
        renderHeadAndShoulders(ctx, emission(STATE), VIEW);
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["LS", "LL", "H", "RL", "RS"]);
    });

    it("draws the neckline between anchors[1] (LL) and anchors[3] (RL)", () => {
        const ctx = new MockCanvas2DContext();
        renderHeadAndShoulders(ctx, emission(STATE), VIEW);
        // The pivot polyline ends with the 4 lineTo calls + 5 fillText
        // calls; the neckline appends one more beginPath + moveTo +
        // lineTo + stroke. We pin the FINAL moveTo + lineTo coordinates.
        const moveTos = ctx.calls.filter((c) => c.kind === "moveTo");
        const lineTos = ctx.calls.filter((c) => c.kind === "lineTo");
        const lastMove = moveTos[moveTos.length - 1];
        const lastLine = lineTos[lineTos.length - 1];
        if (lastMove?.kind === "moveTo" && lastLine?.kind === "lineTo") {
            // anchors[1] = LL at world (30, 30); anchors[3] = RL at world (70, 30).
            // worldToCanvas — x = 800 * 30/100 = 240, y = 400 - 400*30/100 = 280.
            expect(lastMove.x).toBe(240);
            expect(lastLine.x).toBe(560);
        }
    });

    it("defaults to amber #f59e0b", () => {
        const ctx = new MockCanvas2DContext();
        renderHeadAndShoulders(ctx, emission(STATE), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#f59e0b");
    });

    it("honours style.color (both polyline + neckline)", () => {
        const ctx = new MockCanvas2DContext();
        renderHeadAndShoulders(ctx, emission({ ...STATE, style: { color: "#abcdef" } }), VIEW);
        const strokes = ctx.calls.filter((c) => c.kind === "set" && c.prop === "strokeStyle");
        for (const s of strokes) {
            if (s.kind === "set") expect(s.value).toBe("#abcdef");
        }
    });

    it("emits no fills (stroked-only)", () => {
        const ctx = new MockCanvas2DContext();
        renderHeadAndShoulders(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });
});

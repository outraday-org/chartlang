// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibRetracementState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { FIB_LEVELS } from "./fibLevels";
import { renderFibRetracement } from "./fibRetracement";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: FibRetracementState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "fib-retracement",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderFibRetracement", () => {
    it("strokes one horizontal rail per default FIB_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        renderFibRetracement(
            ctx,
            emission({
                kind: "fib-retracement",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(FIB_LEVELS.length);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(FIB_LEVELS.length);
    });

    it("honours an explicit style.levels override (3 levels = 3 strokes)", () => {
        const ctx = new MockCanvas2DContext();
        renderFibRetracement(
            ctx,
            emission({
                kind: "fib-retracement",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                ],
                style: { levels: [0.382, 0.5, 0.618] },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(3);
    });

    it("defaults strokeStyle to invinite fib yellow (#facc15) when color is omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderFibRetracement(
            ctx,
            emission({
                kind: "fib-retracement",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                ],
                style: {},
            }),
            VIEW,
        );
        const strokeSet = ctx.calls.find(
            (c) => c.kind === "set" && c.prop === "strokeStyle",
        );
        if (strokeSet?.kind === "set") expect(strokeSet.value).toBe("#facc15");
    });

    it("paints one fillText label per level when showLabels is true", () => {
        const ctx = new MockCanvas2DContext();
        renderFibRetracement(
            ctx,
            emission({
                kind: "fib-retracement",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                ],
                style: { levels: [0.382, 0.5, 0.618], showLabels: true },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(3);
    });

    it("does not paint labels when showLabels is omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderFibRetracement(
            ctx,
            emission({
                kind: "fib-retracement",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(0);
    });

    it("extends each rail to the viewport edges when extendLeft/extendRight are set", () => {
        const ctx = new MockCanvas2DContext();
        renderFibRetracement(
            ctx,
            emission({
                kind: "fib-retracement",
                anchors: [
                    { time: 25, price: 0 },
                    { time: 75, price: 100 },
                ],
                style: { levels: [0.5], extendLeft: true, extendRight: true },
            }),
            VIEW,
        );
        const moves = ctx.calls.filter((c) => c.kind === "moveTo" || c.kind === "lineTo");
        if (moves[0].kind === "moveTo") expect(moves[0].x).toBe(0);
        if (moves[1].kind === "lineTo") expect(moves[1].x).toBe(VIEW.pxWidth);
    });
});

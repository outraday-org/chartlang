// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibTrendTimeState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { FIB_LEVELS } from "./fibLevels";
import { renderFibTrendTime } from "./fibTrendTime";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: FibTrendTimeState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "fib-trend-time",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderFibTrendTime", () => {
    it("strokes one vertical line per default FIB_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        renderFibTrendTime(
            ctx,
            emission({
                kind: "fib-trend-time",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 30, price: 50 },
                    { time: 50, price: 25 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(FIB_LEVELS.length);
    });

    it("every vertical line lands at y=pxHeight on the lineTo (full height)", () => {
        const ctx = new MockCanvas2DContext();
        renderFibTrendTime(
            ctx,
            emission({
                kind: "fib-trend-time",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 30, price: 50 },
                    { time: 50, price: 25 },
                ],
                style: { levels: [0.5] },
            }),
            VIEW,
        );
        const lineTos = ctx.calls.filter((c) => c.kind === "lineTo");
        for (const c of lineTos) {
            if (c.kind === "lineTo") expect(c.y).toBe(VIEW.pxHeight);
        }
    });

    it("paints labels at the top when showLabels is true", () => {
        const ctx = new MockCanvas2DContext();
        renderFibTrendTime(
            ctx,
            emission({
                kind: "fib-trend-time",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 30, price: 50 },
                    { time: 50, price: 25 },
                ],
                style: { levels: [0.5, 1], showLabels: true },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(2);
    });

    it("defaults strokeStyle to fib yellow #facc15", () => {
        const ctx = new MockCanvas2DContext();
        renderFibTrendTime(
            ctx,
            emission({
                kind: "fib-trend-time",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 30, price: 50 },
                    { time: 50, price: 25 },
                ],
                style: { levels: [0.5] },
            }),
            VIEW,
        );
        const strokeSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (strokeSet?.kind === "set") expect(strokeSet.value).toBe("#facc15");
    });
});

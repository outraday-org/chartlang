// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibTimeZoneState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { FIB_LEVELS } from "./fibLevels.js";
import { renderFibTimeZone } from "./fibTimeZone.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: FibTimeZoneState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "fib-time-zone",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderFibTimeZone", () => {
    it("strokes one vertical zone per default FIB_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        renderFibTimeZone(
            ctx,
            emission({
                kind: "fib-time-zone",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 0 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(FIB_LEVELS.length);
    });

    it("strokes each vertical from y=0 to y=pxHeight", () => {
        const ctx = new MockCanvas2DContext();
        renderFibTimeZone(
            ctx,
            emission({
                kind: "fib-time-zone",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 0 },
                ],
                style: { levels: [0.5] },
            }),
            VIEW,
        );
        const moves = ctx.calls.filter((c) => c.kind === "moveTo" || c.kind === "lineTo");
        if (moves[0].kind === "moveTo") expect(moves[0].y).toBe(0);
        if (moves[1].kind === "lineTo") expect(moves[1].y).toBe(VIEW.pxHeight);
    });

    it("paints one fillText label per level when showLabels is true", () => {
        const ctx = new MockCanvas2DContext();
        renderFibTimeZone(
            ctx,
            emission({
                kind: "fib-time-zone",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 0 },
                ],
                style: { levels: [0.382, 0.618], showLabels: true },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(2);
    });

    it("does not paint labels when showLabels is omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderFibTimeZone(
            ctx,
            emission({
                kind: "fib-time-zone",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 0 },
                ],
                style: { levels: [0.5] },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(0);
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibChannelState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { FIB_LEVELS } from "./fibLevels";
import { renderFibChannel } from "./fibChannel";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: FibChannelState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "fib-channel",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderFibChannel", () => {
    it("strokes one parallel rail per default FIB_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        renderFibChannel(
            ctx,
            emission({
                kind: "fib-channel",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                    { time: 0, price: 50 },
                ],
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(FIB_LEVELS.length);
    });

    it("strokes a 3-level set with 3 strokes", () => {
        const ctx = new MockCanvas2DContext();
        renderFibChannel(
            ctx,
            emission({
                kind: "fib-channel",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                    { time: 0, price: 50 },
                ],
                style: { levels: [0.382, 0.5, 0.618] },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(3);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("paints labels at the second anchor when showLabels is true", () => {
        const ctx = new MockCanvas2DContext();
        renderFibChannel(
            ctx,
            emission({
                kind: "fib-channel",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                    { time: 0, price: 50 },
                ],
                style: { levels: [0.5], showLabels: true },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(1);
    });

    it("defaults strokeStyle to fib yellow #facc15", () => {
        const ctx = new MockCanvas2DContext();
        renderFibChannel(
            ctx,
            emission({
                kind: "fib-channel",
                anchors: [
                    { time: 0, price: 0 },
                    { time: 100, price: 100 },
                    { time: 0, price: 50 },
                ],
                style: { levels: [0.5] },
            }),
            VIEW,
        );
        const strokeSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (strokeSet?.kind === "set") expect(strokeSet.value).toBe("#facc15");
    });
});

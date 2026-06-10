// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { GannFanState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { GANN_FAN_RATIOS } from "./gannLevels.js";
import { renderGannFan } from "./gannFan.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: GannFanState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "gann-fan",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: GannFanState = {
    kind: "gann-fan",
    anchors: [
        { time: 0, price: 0 },
        { time: 50, price: 50 },
    ],
    style: {},
};

describe("renderGannFan", () => {
    it("strokes one ray per GANN_FAN_RATIOS entry (9 strokes)", () => {
        const ctx = new MockCanvas2DContext();
        renderGannFan(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(GANN_FAN_RATIOS.length);
    });

    it("defaults strokeStyle to gann purple #a855f7", () => {
        const ctx = new MockCanvas2DContext();
        renderGannFan(ctx, emission(STATE), VIEW);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#a855f7");
    });

    it("honours style.color", () => {
        const ctx = new MockCanvas2DContext();
        renderGannFan(ctx, emission({ ...STATE, style: { color: "#0f1e2d" } }), VIEW);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#0f1e2d");
    });

    it("skips degenerate rays when the direction vector collapses to zero", () => {
        const ctx = new MockCanvas2DContext();
        // anchors[0] === anchors[1] → dx = dy = 0 → no rays painted.
        renderGannFan(
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
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(0);
    });

    it("strokes no fills (rays are stroked, not filled)", () => {
        const ctx = new MockCanvas2DContext();
        renderGannFan(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });
});

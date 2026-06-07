// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { GannBoxState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { GANN_LEVELS } from "./gannLevels";
import { renderGannBox } from "./gannBox";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: GannBoxState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "gann-box",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: GannBoxState = {
    kind: "gann-box",
    anchors: [
        { time: 0, price: 0 },
        { time: 100, price: 100 },
    ],
    style: {},
};

describe("renderGannBox", () => {
    it("strokes one horizontal + one vertical line per GANN_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        renderGannBox(ctx, emission(STATE), VIEW);
        // 5 horizontal + 5 vertical = 10 strokes.
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(
            GANN_LEVELS.length * 2,
        );
    });

    it("defaults strokeStyle to gann purple #a855f7", () => {
        const ctx = new MockCanvas2DContext();
        renderGannBox(ctx, emission(STATE), VIEW);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#a855f7");
    });

    it("honours style.color", () => {
        const ctx = new MockCanvas2DContext();
        renderGannBox(
            ctx,
            emission({ ...STATE, style: { color: "#123456" } }),
            VIEW,
        );
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#123456");
    });

    it("strokes no fills (box is stroked, not filled)", () => {
        const ctx = new MockCanvas2DContext();
        renderGannBox(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });
});

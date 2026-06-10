// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { PitchforkState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderPitchfork } from "./pitchfork.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: PitchforkState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "pitchfork",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: PitchforkState = {
    kind: "pitchfork",
    anchors: [
        { time: 0, price: 0 },
        { time: 30, price: 50 },
        { time: 50, price: 25 },
    ],
    variant: "standard",
    style: {},
};

describe("renderPitchfork", () => {
    it("strokes 3 lines (median + 2 parallel handles)", () => {
        const ctx = new MockCanvas2DContext();
        renderPitchfork(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(3);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(3);
    });

    it("defaults strokeStyle to pitchfork pink #ec4899", () => {
        const ctx = new MockCanvas2DContext();
        renderPitchfork(ctx, emission(STATE), VIEW);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#ec4899");
    });

    it("honours style.color", () => {
        const ctx = new MockCanvas2DContext();
        renderPitchfork(ctx, emission({ ...STATE, style: { color: "#123456" } }), VIEW);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#123456");
    });

    it("renders 3 strokes for each of the 4 variants", () => {
        for (const variant of ["standard", "schiff", "modifiedSchiff", "inside"] as const) {
            const ctx = new MockCanvas2DContext();
            renderPitchfork(ctx, emission({ ...STATE, variant }), VIEW);
            expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(3);
        }
    });

    it("emits no fills (pitchfork is stroked-only)", () => {
        const ctx = new MockCanvas2DContext();
        renderPitchfork(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });
});

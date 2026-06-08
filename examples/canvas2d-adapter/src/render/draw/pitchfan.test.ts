// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { PitchfanState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderPitchfan } from "./pitchfan";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: PitchfanState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "pitchfan",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: PitchfanState = {
    kind: "pitchfan",
    anchors: [
        { time: 0, price: 0 },
        { time: 30, price: 50 },
        { time: 50, price: 25 },
    ],
    style: {},
};

describe("renderPitchfan", () => {
    it("strokes 3 rays (one per (b, mid(b,c), c) direction)", () => {
        const ctx = new MockCanvas2DContext();
        renderPitchfan(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(3);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(3);
    });

    it("defaults strokeStyle to pitchfork pink #ec4899", () => {
        const ctx = new MockCanvas2DContext();
        renderPitchfan(ctx, emission(STATE), VIEW);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#ec4899");
    });

    it("honours style.color", () => {
        const ctx = new MockCanvas2DContext();
        renderPitchfan(ctx, emission({ ...STATE, style: { color: "#123456" } }), VIEW);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#123456");
    });

    it("emits no fills (pitchfan is stroked-only)", () => {
        const ctx = new MockCanvas2DContext();
        renderPitchfan(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("skips rays where the (a → target) vector is zero-length", () => {
        // Degenerate triple — all three anchors collapse to the same
        // world point so every projected `target` equals `a`. The
        // renderer must skip each ray cleanly (no NaN strokes).
        const ctx = new MockCanvas2DContext();
        const degenerate: PitchfanState = {
            kind: "pitchfan",
            anchors: [
                { time: 50, price: 50 },
                { time: 50, price: 50 },
                { time: 50, price: 50 },
            ],
            style: {},
        };
        renderPitchfan(ctx, emission(degenerate), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(0);
    });
});

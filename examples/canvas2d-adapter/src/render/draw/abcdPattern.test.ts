// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { AbcdPatternState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderAbcdPattern } from "./abcdPattern.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: AbcdPatternState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "abcd-pattern",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: AbcdPatternState = {
    kind: "abcd-pattern",
    anchors: [
        { time: 0, price: 0 },
        { time: 30, price: 50 },
        { time: 60, price: 25 },
        { time: 90, price: 70 },
    ],
    style: {},
};

describe("renderAbcdPattern", () => {
    it("strokes a 3-leg open polyline + labels every pivot", () => {
        const ctx = new MockCanvas2DContext();
        renderAbcdPattern(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(3);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["A", "B", "C", "D"]);
    });

    it("defaults to amber #f59e0b", () => {
        const ctx = new MockCanvas2DContext();
        renderAbcdPattern(ctx, emission(STATE), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#f59e0b");
    });

    it("honours style.color", () => {
        const ctx = new MockCanvas2DContext();
        renderAbcdPattern(ctx, emission({ ...STATE, style: { color: "#123456" } }), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#123456");
    });

    it("emits no fills (stroked-only)", () => {
        const ctx = new MockCanvas2DContext();
        renderAbcdPattern(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });
});

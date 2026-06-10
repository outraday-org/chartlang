// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { XabcdPatternState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderXabcdPattern } from "./xabcdPattern.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: XabcdPatternState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "xabcd-pattern",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: XabcdPatternState = {
    kind: "xabcd-pattern",
    anchors: [
        { time: 0, price: 0 },
        { time: 20, price: 40 },
        { time: 40, price: 20 },
        { time: 60, price: 60 },
        { time: 80, price: 30 },
    ],
    style: {},
};

describe("renderXabcdPattern", () => {
    it("strokes one open polyline (1 beginPath / 1 moveTo / 4 lineTo / 1 stroke)", () => {
        const ctx = new MockCanvas2DContext();
        renderXabcdPattern(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(4);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });

    it("labels every pivot (X, A, B, C, D)", () => {
        const ctx = new MockCanvas2DContext();
        renderXabcdPattern(ctx, emission(STATE), VIEW);
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["X", "A", "B", "C", "D"]);
    });

    it("honours style.color", () => {
        const ctx = new MockCanvas2DContext();
        renderXabcdPattern(ctx, emission({ ...STATE, style: { color: "#abcdef" } }), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#abcdef");
    });

    it("defaults to amber #f59e0b", () => {
        const ctx = new MockCanvas2DContext();
        renderXabcdPattern(ctx, emission(STATE), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#f59e0b");
    });

    it("emits no fills (stroked-only)", () => {
        const ctx = new MockCanvas2DContext();
        renderXabcdPattern(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });
});

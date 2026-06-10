// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { CypherPatternState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderCypherPattern } from "./cypherPattern.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: CypherPatternState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "cypher-pattern",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: CypherPatternState = {
    kind: "cypher-pattern",
    anchors: [
        { time: 0, price: 0 },
        { time: 20, price: 50 },
        { time: 40, price: 20 },
        { time: 60, price: 65 },
        { time: 80, price: 30 },
    ],
    style: {},
};

describe("renderCypherPattern", () => {
    it("strokes a 4-leg open polyline + labels every pivot", () => {
        const ctx = new MockCanvas2DContext();
        renderCypherPattern(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(4);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["X", "A", "B", "C", "D"]);
    });

    it("defaults to amber #f59e0b", () => {
        const ctx = new MockCanvas2DContext();
        renderCypherPattern(ctx, emission(STATE), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#f59e0b");
    });

    it("honours style.color + style.lineWidth", () => {
        const ctx = new MockCanvas2DContext();
        renderCypherPattern(
            ctx,
            emission({ ...STATE, style: { color: "#abcdef", lineWidth: 4 } }),
            VIEW,
        );
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        const width = ctx.calls.find((c) => c.kind === "set" && c.prop === "lineWidth");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#abcdef");
        if (width?.kind === "set") expect(width.value).toBe(4);
    });

    it("emits no fills (stroked-only)", () => {
        const ctx = new MockCanvas2DContext();
        renderCypherPattern(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });
});

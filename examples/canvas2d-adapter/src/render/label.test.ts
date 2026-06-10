// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette.js";
import { MockCanvas2DContext } from "../testing.js";
import { drawLabel } from "./label.js";

describe("drawLabel", () => {
    it("emits the canonical fillStyle / font / textAlign / textBaseline / fillText sequence", () => {
        const ctx = new MockCanvas2DContext();
        drawLabel(
            ctx,
            { x: 100, y: 50, text: "PEAK", position: "above", color: "#26a69a" },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "fillStyle", value: "#26a69a" },
            { kind: "set", prop: "font", value: "10px sans-serif" },
            { kind: "set", prop: "textAlign", value: "center" },
            { kind: "set", prop: "textBaseline", value: "bottom" },
            { kind: "fillText", text: "PEAK", x: 100, y: 50 },
        ]);
    });

    it("maps 'above' to textBaseline 'bottom', 'below' to 'top', 'anchor' to 'middle'", () => {
        for (const [position, baseline] of [
            ["above", "bottom"],
            ["below", "top"],
            ["anchor", "middle"],
        ] as const) {
            const ctx = new MockCanvas2DContext();
            drawLabel(ctx, { x: 0, y: 0, text: "X", position, color: "#000" }, DEFAULT_PALETTE);
            const setBaseline = ctx.calls.find(
                (c) => c.kind === "set" && c.prop === "textBaseline",
            );
            expect(setBaseline).toEqual({ kind: "set", prop: "textBaseline", value: baseline });
        }
    });

    it("falls back to palette.plotDefault when color is null", () => {
        const ctx = new MockCanvas2DContext();
        drawLabel(ctx, { x: 0, y: 0, text: "X", position: "anchor", color: null }, DEFAULT_PALETTE);
        const setFill = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(setFill).toEqual({
            kind: "set",
            prop: "fillStyle",
            value: DEFAULT_PALETTE.plotDefault,
        });
    });

    it("uses the supplied font when provided, otherwise the Canvas-2D-default '10px sans-serif'", () => {
        const ctx = new MockCanvas2DContext();
        drawLabel(
            ctx,
            { x: 0, y: 0, text: "X", position: "above", color: "#000", font: "12px monospace" },
            DEFAULT_PALETTE,
        );
        const setFont = ctx.calls.find((c) => c.kind === "set" && c.prop === "font");
        expect(setFont).toEqual({ kind: "set", prop: "font", value: "12px monospace" });
    });

    it("forwards text + coordinates to fillText verbatim", () => {
        const ctx = new MockCanvas2DContext();
        drawLabel(
            ctx,
            { x: 12.5, y: 34.5, text: "PEAK", position: "above", color: "#000" },
            DEFAULT_PALETTE,
        );
        const ft = ctx.calls.find((c) => c.kind === "fillText");
        expect(ft).toEqual({ kind: "fillText", text: "PEAK", x: 12.5, y: 34.5 });
    });
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TextState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderText } from "./text.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: TextState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "text",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderText", () => {
    it("paints the body at the projected anchor with the resolved font + alignment + color", () => {
        const ctx = new MockCanvas2DContext();
        renderText(
            ctx,
            emission({
                kind: "text",
                anchor: { time: 50, price: 50 },
                body: "Note",
                style: { color: "#10b981", size: "large", halign: "center", valign: "middle" },
            }),
            VIEW,
        );
        const sequence = ctx.calls.map((c) => c.kind);
        expect(sequence).toEqual(["set", "set", "set", "set", "fillText"]);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "font", value: "16px sans-serif" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "textAlign", value: "center" });
        expect(ctx.calls[2]).toEqual({ kind: "set", prop: "textBaseline", value: "middle" });
        expect(ctx.calls[3]).toEqual({ kind: "set", prop: "fillStyle", value: "#10b981" });
        const textCall = ctx.calls[4];
        if (textCall.kind === "fillText") {
            expect(textCall.text).toBe("Note");
            expect(textCall.x).toBe(400);
            expect(textCall.y).toBe(200);
        }
    });

    it("defaults size to normal (12px), align to center/middle, color to #000000", () => {
        const ctx = new MockCanvas2DContext();
        renderText(
            ctx,
            emission({
                kind: "text",
                anchor: { time: 0, price: 0 },
                body: "x",
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "font", value: "12px sans-serif" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "textAlign", value: "center" });
        expect(ctx.calls[2]).toEqual({ kind: "set", prop: "textBaseline", value: "middle" });
        expect(ctx.calls[3]).toEqual({ kind: "set", prop: "fillStyle", value: "#000000" });
    });

    it("paints a body longer than the marker glyph cap (uses the 256-char text body cap)", () => {
        const ctx = new MockCanvas2DContext();
        const body = "Inverse Head and Shoulders Confirmed";
        renderText(
            ctx,
            emission({
                kind: "text",
                anchor: { time: 0, price: 0 },
                body,
                style: {},
            }),
            VIEW,
        );
        const textCall = ctx.calls[4];
        if (textCall.kind === "fillText") {
            expect(textCall.text).toBe(body);
        }
    });

    it("does NOT paint any background rectangle even when style.bgColor is set", () => {
        const ctx = new MockCanvas2DContext();
        renderText(
            ctx,
            emission({
                kind: "text",
                anchor: { time: 0, price: 0 },
                body: "x",
                style: { bgColor: "#fef3c7" },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "fillRect")).toHaveLength(0);
    });
});

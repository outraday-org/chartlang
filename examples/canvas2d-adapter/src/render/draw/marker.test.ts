// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { MarkerState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderMarker } from "./marker.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: MarkerState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "marker",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderMarker", () => {
    it("paints text at the projected anchor with the resolved font + alignment", () => {
        const ctx = new MockCanvas2DContext();
        renderMarker(
            ctx,
            emission({
                kind: "marker",
                anchor: { time: 50, price: 50 },
                text: "B",
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
            expect(textCall.text).toBe("B");
            expect(textCall.x).toBe(400);
            expect(textCall.y).toBe(200);
        }
    });

    it("emits no calls when text is undefined", () => {
        const ctx = new MockCanvas2DContext();
        renderMarker(
            ctx,
            emission({
                kind: "marker",
                anchor: { time: 50, price: 50 },
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls).toEqual([]);
    });

    it("emits no calls when text is an empty string", () => {
        const ctx = new MockCanvas2DContext();
        renderMarker(
            ctx,
            emission({
                kind: "marker",
                anchor: { time: 50, price: 50 },
                text: "",
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls).toEqual([]);
    });

    it("defaults size to normal (12px), align to center/middle, color to #000000", () => {
        const ctx = new MockCanvas2DContext();
        renderMarker(
            ctx,
            emission({
                kind: "marker",
                anchor: { time: 0, price: 0 },
                text: "x",
                style: {},
            }),
            VIEW,
        );
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "font", value: "12px sans-serif" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "textAlign", value: "center" });
        expect(ctx.calls[2]).toEqual({ kind: "set", prop: "textBaseline", value: "middle" });
        expect(ctx.calls[3]).toEqual({ kind: "set", prop: "fillStyle", value: "#000000" });
    });

    it.each(["tiny", "small", "normal", "large", "huge"] as const)(
        "maps style.size = '%s' to its pixel font size",
        (size) => {
            const ctx = new MockCanvas2DContext();
            renderMarker(
                ctx,
                emission({
                    kind: "marker",
                    anchor: { time: 0, price: 0 },
                    text: "x",
                    style: { size },
                }),
                VIEW,
            );
            const fontCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "font");
            const expected = { tiny: 8, small: 10, normal: 12, large: 16, huge: 20 }[size];
            if (fontCall?.kind === "set") {
                expect(fontCall.value).toBe(`${expected}px sans-serif`);
            }
        },
    );

    it.each(["left", "right"] as const)(
        "maps style.halign = '%s' through HALIGN_TO_TEXTALIGN",
        (halign) => {
            const ctx = new MockCanvas2DContext();
            renderMarker(
                ctx,
                emission({
                    kind: "marker",
                    anchor: { time: 0, price: 0 },
                    text: "x",
                    style: { halign },
                }),
                VIEW,
            );
            const alignCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "textAlign");
            if (alignCall?.kind === "set") {
                expect(alignCall.value).toBe(halign);
            }
        },
    );

    it.each(["top", "bottom"] as const)(
        "maps style.valign = '%s' through VALIGN_TO_TEXTBASELINE",
        (valign) => {
            const ctx = new MockCanvas2DContext();
            renderMarker(
                ctx,
                emission({
                    kind: "marker",
                    anchor: { time: 0, price: 0 },
                    text: "x",
                    style: { valign },
                }),
                VIEW,
            );
            const baseCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "textBaseline");
            if (baseCall?.kind === "set") {
                expect(baseCall.value).toBe(valign);
            }
        },
    );
});

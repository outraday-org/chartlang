// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { DrawPrimitive } from "../geometry/types.js";
import { MockCanvasContext } from "./mockContext.js";
import { paintPrimitive } from "./paintPrimitive.js";

describe("paintPrimitive — polyline", () => {
    it("strokes an open polyline and resets the dash", () => {
        const ctx = new MockCanvasContext();
        paintPrimitive(ctx, {
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            closed: false,
            stroke: { color: "#000", width: 1, dash: [6, 4] },
        });
        expect(ctx.calls.map((c) => c.kind)).toEqual([
            "set",
            "set",
            "setLineDash",
            "beginPath",
            "moveTo",
            "lineTo",
            "stroke",
            "setLineDash",
        ]);
    });

    it("fills before stroking for a closed filled polyline", () => {
        const ctx = new MockCanvasContext();
        paintPrimitive(ctx, {
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
            ],
            closed: true,
            stroke: { color: "#000", width: 1, dash: [] },
            fill: { color: "#eee", alpha: 0.5 },
        });
        const kinds = ctx.calls.map((c) => c.kind);
        expect(kinds).toEqual([
            "set",
            "set",
            "setLineDash",
            "beginPath",
            "moveTo",
            "lineTo",
            "lineTo",
            "closePath",
            "set",
            "set",
            "fill",
            "set",
            "stroke",
            "setLineDash",
        ]);
    });

    it("fills a polyline with no stroke (arrowhead case)", () => {
        const ctx = new MockCanvasContext();
        paintPrimitive(ctx, {
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
                { x: 5, y: -5 },
            ],
            closed: true,
            fill: { color: "#000", alpha: 1 },
        });
        expect(ctx.calls.map((c) => c.kind)).toEqual([
            "beginPath",
            "moveTo",
            "lineTo",
            "lineTo",
            "closePath",
            "set",
            "set",
            "fill",
            "set",
        ]);
    });

    it("is a no-op for an empty polyline", () => {
        const ctx = new MockCanvasContext();
        paintPrimitive(ctx, { kind: "polyline", points: [], closed: false });
        expect(ctx.calls).toEqual([]);
    });

    it("brackets the stroke in globalAlpha when stroke.alpha is set (highlighter)", () => {
        const ctx = new MockCanvasContext();
        paintPrimitive(ctx, {
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            closed: false,
            stroke: { color: "#facc15", width: 6, dash: [], alpha: 0.3 },
        });
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "strokeStyle", value: "#facc15" },
            { kind: "set", prop: "lineWidth", value: 6 },
            { kind: "setLineDash", segments: [] },
            { kind: "beginPath" },
            { kind: "moveTo", x: 0, y: 0 },
            { kind: "lineTo", x: 10, y: 10 },
            { kind: "set", prop: "globalAlpha", value: 0.3 },
            { kind: "stroke" },
            { kind: "set", prop: "globalAlpha", value: 1 },
            { kind: "setLineDash", segments: [] },
        ]);
    });

    it("emits no globalAlpha mutation when stroke.alpha is omitted (byte-identical)", () => {
        const ctx = new MockCanvasContext();
        paintPrimitive(ctx, {
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            closed: false,
            stroke: { color: "#000", width: 1, dash: [] },
        });
        expect(ctx.calls.some((c) => c.kind === "set" && c.prop === "globalAlpha")).toBe(false);
    });
});

describe("paintPrimitive — arc", () => {
    it("strokes and fills an arc", () => {
        const ctx = new MockCanvasContext();
        paintPrimitive(ctx, {
            kind: "arc",
            cx: 50,
            cy: 50,
            r: 10,
            start: 0,
            end: Math.PI * 2,
            stroke: { color: "#000", width: 1, dash: [] },
            fill: { color: "#eee", alpha: 1 },
        });
        expect(ctx.calls.map((c) => c.kind)).toEqual([
            "set",
            "set",
            "setLineDash",
            "beginPath",
            "arc",
            "closePath",
            "set",
            "set",
            "fill",
            "set",
            "stroke",
            "setLineDash",
        ]);
    });

    it("fills an arc with no stroke (dot case)", () => {
        const ctx = new MockCanvasContext();
        paintPrimitive(ctx, {
            kind: "arc",
            cx: 1,
            cy: 1,
            r: 3,
            start: 0,
            end: Math.PI * 2,
            fill: { color: "#3b82f6", alpha: 1 },
        });
        expect(ctx.calls.map((c) => c.kind)).toEqual([
            "beginPath",
            "arc",
            "closePath",
            "set",
            "set",
            "fill",
            "set",
        ]);
    });
});

describe("paintPrimitive — text", () => {
    it("applies font/align/baseline/color then fills the text", () => {
        const ctx = new MockCanvasContext();
        paintPrimitive(ctx, {
            kind: "text",
            x: 10,
            y: 20,
            text: "Hi",
            color: "#222",
            font: "12px sans-serif",
            align: "center",
            baseline: "middle",
        });
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "font", value: "12px sans-serif" },
            { kind: "set", prop: "textAlign", value: "center" },
            { kind: "set", prop: "textBaseline", value: "middle" },
            { kind: "set", prop: "fillStyle", value: "#222" },
            { kind: "fillText", text: "Hi", x: 10, y: 20 },
        ]);
    });
});

describe("paintPrimitive — marker", () => {
    const shapes = ["circle", "square", "diamond", "triangle-up", "triangle-down"] as const;

    for (const shape of shapes) {
        it(`paints a closed ${shape} glyph`, () => {
            const ctx = new MockCanvasContext();
            const prim: DrawPrimitive = {
                kind: "marker",
                shape,
                x: 50,
                y: 50,
                size: 10,
                fill: { color: "#000", alpha: 1 },
                stroke: { color: "#000", width: 1, dash: [] },
            };
            paintPrimitive(ctx, prim);
            const kinds = ctx.calls.map((c) => c.kind);
            expect(kinds[0]).toBe("set");
            expect(kinds).toContain("closePath");
            expect(kinds).toContain("fill");
            expect(kinds).toContain("stroke");
        });
    }
});

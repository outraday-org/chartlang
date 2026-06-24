// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    type ShapeGlyph,
    drawArrow,
    drawCharacter,
    drawLabel,
    drawMarker,
    drawShape,
} from "./glyphs.js";
import { MockCanvasContext } from "./mockContext.js";

const FALLBACK = "#90caf9";

describe("drawShape", () => {
    // The five filled-marker shapes delegate to drawMarker (covered there);
    // here we assert the delegation fires by checking each produces a fill.
    const markerShapes: ReadonlyArray<ShapeGlyph> = [
        "circle",
        "triangle-up",
        "triangle-down",
        "square",
        "diamond",
    ];
    for (const shape of markerShapes) {
        it(`delegates ${shape} to the filled marker geometry`, () => {
            const ctx = new MockCanvasContext();
            drawShape(ctx, { x: 10, y: 20, shape, size: 8, color: null }, FALLBACK);
            // A marker shape fills (square via fillRect, the rest via fill()).
            const fills = ctx.calls.filter((c) => c.kind === "fill" || c.kind === "fillRect");
            expect(fills.length).toBeGreaterThan(0);
        });
    }

    it("strokes a cross with a horizontal + vertical segment", () => {
        const ctx = new MockCanvasContext();
        drawShape(ctx, { x: 0, y: 0, shape: "cross", size: 8, color: "#abcdef" }, FALLBACK);
        expect(ctx.calls.some((c) => c.kind === "set" && c.prop === "strokeStyle")).toBe(true);
        // cross = two moveTos + two lineTos (no closePath / fill).
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(2);
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(true);
        expect(ctx.calls.some((c) => c.kind === "fill")).toBe(false);
    });

    it("strokes an xcross as two diagonals", () => {
        const ctx = new MockCanvasContext();
        drawShape(ctx, { x: 0, y: 0, shape: "xcross", size: 8, color: null }, FALLBACK);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(2);
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(true);
    });

    it("strokes a flag as a connected polyline", () => {
        const ctx = new MockCanvasContext();
        drawShape(ctx, { x: 0, y: 0, shape: "flag", size: 8, color: null }, FALLBACK);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(3);
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(true);
    });

    it("uses the fallback color when color is null", () => {
        const ctx = new MockCanvasContext();
        drawShape(ctx, { x: 0, y: 0, shape: "cross", size: 8, color: null }, FALLBACK);
        const strokeSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        expect(strokeSet).toEqual({ kind: "set", prop: "strokeStyle", value: FALLBACK });
    });

    it.each(["above", "below", "absolute", undefined] as const)(
        "anchors at location %s",
        (location) => {
            const ctx = new MockCanvasContext();
            drawShape(
                ctx,
                {
                    x: 0,
                    y: 100,
                    shape: "cross",
                    size: 8,
                    color: null,
                    ...(location === undefined ? {} : { location }),
                },
                FALLBACK,
            );
            const move = ctx.calls.find((c) => c.kind === "moveTo");
            // above shifts the anchor up, below shifts it down, absolute keeps it.
            const expectedY =
                location === "above" ? 100 - 8 * 1.25 : location === "below" ? 100 + 8 * 1.25 : 100;
            expect(move).toEqual({ kind: "moveTo", x: -4, y: expectedY });
        },
    );
});

describe("drawMarker", () => {
    it("draws a circle via arc + fill", () => {
        const ctx = new MockCanvasContext();
        drawMarker(ctx, { x: 5, y: 5, shape: "circle", size: 6, color: "#26a69a" }, FALLBACK);
        expect(ctx.calls.some((c) => c.kind === "arc")).toBe(true);
        expect(ctx.calls.some((c) => c.kind === "fill")).toBe(true);
    });

    it("draws a square via a single fillRect", () => {
        const ctx = new MockCanvasContext();
        drawMarker(ctx, { x: 5, y: 5, shape: "square", size: 6, color: null }, FALLBACK);
        expect(ctx.calls.filter((c) => c.kind === "fillRect")).toHaveLength(1);
        expect(ctx.calls.some((c) => c.kind === "arc")).toBe(false);
    });

    it.each(["triangle-up", "triangle-down", "diamond"] as const)(
        "draws %s as a closed filled polygon",
        (shape) => {
            const ctx = new MockCanvasContext();
            drawMarker(ctx, { x: 5, y: 5, shape, size: 6, color: null }, FALLBACK);
            expect(ctx.calls.some((c) => c.kind === "closePath")).toBe(true);
            expect(ctx.calls.some((c) => c.kind === "fill")).toBe(true);
        },
    );

    it("falls back to the fallback color for a null color", () => {
        const ctx = new MockCanvasContext();
        drawMarker(ctx, { x: 5, y: 5, shape: "circle", size: 6, color: null }, FALLBACK);
        const fillSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(fillSet).toEqual({ kind: "set", prop: "fillStyle", value: FALLBACK });
    });
});

describe("drawCharacter", () => {
    it.each([
        ["above", "bottom", -12],
        ["below", "top", 12],
        ["absolute", "middle", 0],
        [undefined, "middle", 0],
    ] as const)("renders text at location %s", (location, baseline, dy) => {
        const ctx = new MockCanvasContext();
        drawCharacter(
            ctx,
            {
                x: 3,
                y: 0,
                char: "A",
                size: 12,
                color: "#fff",
                ...(location === undefined ? {} : { location }),
            },
            FALLBACK,
        );
        expect(
            ctx.calls.some(
                (c) => c.kind === "set" && c.prop === "textBaseline" && c.value === baseline,
            ),
        ).toBe(true);
        expect(ctx.calls.find((c) => c.kind === "fillText")).toEqual({
            kind: "fillText",
            text: "A",
            x: 3,
            y: dy,
        });
    });

    it("falls back to the fallback color for a null color", () => {
        const ctx = new MockCanvasContext();
        drawCharacter(ctx, { x: 0, y: 0, char: "X", size: 10, color: null }, FALLBACK);
        const fillSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(fillSet).toEqual({ kind: "set", prop: "fillStyle", value: FALLBACK });
    });
});

describe("drawArrow", () => {
    it("draws an up arrow apex above the anchor", () => {
        const ctx = new MockCanvasContext();
        drawArrow(ctx, { x: 0, y: 0, direction: "up", size: 10, color: "#0f0" }, FALLBACK);
        const move = ctx.calls.find((c) => c.kind === "moveTo");
        expect(move).toEqual({ kind: "moveTo", x: 0, y: -5 });
        expect(ctx.calls.some((c) => c.kind === "fill")).toBe(true);
    });

    it("draws a down arrow apex below the anchor", () => {
        const ctx = new MockCanvasContext();
        drawArrow(ctx, { x: 0, y: 0, direction: "down", size: 10, color: null }, FALLBACK);
        const move = ctx.calls.find((c) => c.kind === "moveTo");
        expect(move).toEqual({ kind: "moveTo", x: 0, y: 5 });
    });

    it("falls back to the fallback color for a null color", () => {
        const ctx = new MockCanvasContext();
        drawArrow(ctx, { x: 0, y: 0, direction: "up", size: 10, color: null }, FALLBACK);
        const fillSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(fillSet).toEqual({ kind: "set", prop: "fillStyle", value: FALLBACK });
    });
});

describe("drawLabel", () => {
    it.each([
        ["above", "bottom"],
        ["below", "top"],
        ["anchor", "middle"],
    ] as const)("renders text with the %s baseline", (position, baseline) => {
        const ctx = new MockCanvasContext();
        drawLabel(ctx, { x: 2, y: 4, text: "PEAK", position, color: "#fff" }, FALLBACK);
        expect(
            ctx.calls.some(
                (c) => c.kind === "set" && c.prop === "textBaseline" && c.value === baseline,
            ),
        ).toBe(true);
        expect(ctx.calls.find((c) => c.kind === "fillText")).toEqual({
            kind: "fillText",
            text: "PEAK",
            x: 2,
            y: 4,
        });
    });

    it("uses the default font when none is given", () => {
        const ctx = new MockCanvasContext();
        drawLabel(ctx, { x: 0, y: 0, text: "T", position: "anchor", color: null }, FALLBACK);
        expect(
            ctx.calls.some(
                (c) => c.kind === "set" && c.prop === "font" && c.value === "10px sans-serif",
            ),
        ).toBe(true);
    });

    it("uses an explicit font when given", () => {
        const ctx = new MockCanvasContext();
        drawLabel(
            ctx,
            { x: 0, y: 0, text: "T", position: "anchor", color: "#fff", font: "16px serif" },
            FALLBACK,
        );
        expect(
            ctx.calls.some(
                (c) => c.kind === "set" && c.prop === "font" && c.value === "16px serif",
            ),
        ).toBe(true);
    });

    it("falls back to the fallback color for a null color", () => {
        const ctx = new MockCanvasContext();
        drawLabel(ctx, { x: 0, y: 0, text: "T", position: "anchor", color: null }, FALLBACK);
        const fillSet = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(fillSet).toEqual({ kind: "set", prop: "fillStyle", value: FALLBACK });
    });
});

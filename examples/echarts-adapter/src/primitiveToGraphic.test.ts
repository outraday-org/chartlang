// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawPrimitive } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { primitiveIsFinite, primitiveToGraphic } from "./primitiveToGraphic.js";

describe("primitiveToGraphic", () => {
    it("maps an open polyline to a `polyline` graphic with stroke style", () => {
        const el = primitiveToGraphic({
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 20 },
            ],
            closed: false,
            stroke: { color: "#abc123", width: 2, dash: [] },
        });
        expect(el).toEqual({
            type: "polyline",
            shape: {
                points: [
                    [0, 0],
                    [10, 20],
                ],
            },
            style: { stroke: "#abc123", lineWidth: 2 },
        });
    });

    it("maps a closed polyline to a `polygon` and carries the fill", () => {
        const el = primitiveToGraphic({
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
            ],
            closed: true,
            stroke: { color: "#000000", width: 1, dash: [4, 2] },
            fill: { color: "#dbeafe", alpha: 0.4 },
        });
        expect(el.type).toBe("polygon");
        if (el.type !== "polygon") throw new Error("unreachable");
        expect(el.style).toEqual({
            stroke: "#000000",
            lineWidth: 1,
            lineDash: [4, 2],
            fill: "#dbeafe",
            fillOpacity: 0.4,
        });
    });

    it("carries `strokeOpacity` when the IR stroke sets alpha", () => {
        const el = primitiveToGraphic({
            kind: "polyline",
            points: [{ x: 1, y: 2 }],
            closed: false,
            stroke: { color: "#facc15", width: 6, dash: [], alpha: 0.3 },
        });
        if (el.type !== "polyline") throw new Error("unreachable");
        expect(el.style).toEqual({ stroke: "#facc15", lineWidth: 6, strokeOpacity: 0.3 });
    });

    it("emits an empty path style when a polyline has neither stroke nor fill", () => {
        const el = primitiveToGraphic({
            kind: "polyline",
            points: [{ x: 1, y: 1 }],
            closed: false,
        });
        if (el.type !== "polyline") throw new Error("unreachable");
        expect(el.style).toEqual({});
    });

    it("maps an arc to an `arc` graphic", () => {
        const el = primitiveToGraphic({
            kind: "arc",
            cx: 50,
            cy: 60,
            r: 12,
            start: 0,
            end: Math.PI,
            stroke: { color: "#10b981", width: 1, dash: [] },
        });
        expect(el).toEqual({
            type: "arc",
            shape: { cx: 50, cy: 60, r: 12, startAngle: 0, endAngle: Math.PI },
            style: { stroke: "#10b981", lineWidth: 1 },
        });
    });

    it("maps a text primitive, including the optional background colour", () => {
        const el = primitiveToGraphic({
            kind: "text",
            x: 5,
            y: 7,
            text: "hi",
            color: "#111111",
            font: "12px sans-serif",
            align: "center",
            baseline: "middle",
            bgColor: "#ffffff",
        });
        expect(el).toEqual({
            type: "text",
            x: 5,
            y: 7,
            style: {
                text: "hi",
                fill: "#111111",
                font: "12px sans-serif",
                align: "center",
                verticalAlign: "middle",
                backgroundColor: "#ffffff",
            },
        });
    });

    it("omits the text background when none is set", () => {
        const el = primitiveToGraphic({
            kind: "text",
            x: 0,
            y: 0,
            text: "x",
            color: "#000000",
            font: "10px sans-serif",
            align: "left",
            baseline: "top",
        });
        if (el.type !== "text") throw new Error("unreachable");
        expect("backgroundColor" in el.style).toBe(false);
    });

    it("maps a circle marker to a `circle` graphic", () => {
        const el = primitiveToGraphic({
            kind: "marker",
            shape: "circle",
            x: 100,
            y: 200,
            size: 8,
            fill: { color: "#ef4444", alpha: 1 },
        });
        expect(el).toEqual({
            type: "circle",
            shape: { cx: 100, cy: 200, r: 4 },
            style: { fill: "#ef4444", fillOpacity: 1 },
        });
    });

    it("maps a square marker to a 4-point polygon", () => {
        const el = primitiveToGraphic({
            kind: "marker",
            shape: "square",
            x: 0,
            y: 0,
            size: 4,
        });
        if (el.type !== "polygon") throw new Error("unreachable");
        expect(el.shape.points).toEqual([
            [-2, -2],
            [2, -2],
            [2, 2],
            [-2, 2],
        ]);
    });

    it("maps a diamond marker to a 4-point polygon", () => {
        const el = primitiveToGraphic({
            kind: "marker",
            shape: "diamond",
            x: 0,
            y: 0,
            size: 4,
        });
        if (el.type !== "polygon") throw new Error("unreachable");
        expect(el.shape.points).toEqual([
            [0, -2],
            [2, 0],
            [0, 2],
            [-2, 0],
        ]);
    });

    it("maps a triangle-up marker to a 3-point polygon", () => {
        const el = primitiveToGraphic({
            kind: "marker",
            shape: "triangle-up",
            x: 0,
            y: 0,
            size: 4,
        });
        if (el.type !== "polygon") throw new Error("unreachable");
        expect(el.shape.points).toEqual([
            [0, -2],
            [2, 2],
            [-2, 2],
        ]);
    });

    it("maps a triangle-down marker to a 3-point polygon", () => {
        const el = primitiveToGraphic({
            kind: "marker",
            shape: "triangle-down",
            x: 0,
            y: 0,
            size: 4,
        });
        if (el.type !== "polygon") throw new Error("unreachable");
        expect(el.shape.points).toEqual([
            [0, 2],
            [2, -2],
            [-2, -2],
        ]);
    });

    it("falls back defensively for an unknown IR kind (exhaustiveness guard)", () => {
        // The `never` default arm is unreachable through the type system; an
        // unknown-kind cast exercises the defensive `return`.
        const rogue = { kind: "octagon" } as unknown as DrawPrimitive;
        const el = primitiveToGraphic(rogue);
        expect(el).toEqual({ type: "polyline", shape: { points: [] }, style: {} });
    });
});

describe("primitiveIsFinite", () => {
    it("accepts a polyline with all-finite points and rejects an empty one", () => {
        expect(
            primitiveIsFinite({
                kind: "polyline",
                points: [{ x: 0, y: 0 }],
                closed: false,
            }),
        ).toBe(true);
        expect(primitiveIsFinite({ kind: "polyline", points: [], closed: false })).toBe(false);
    });

    it("rejects a polyline with a non-finite point", () => {
        expect(
            primitiveIsFinite({
                kind: "polyline",
                points: [
                    { x: 0, y: 0 },
                    { x: Number.NaN, y: 1 },
                ],
                closed: false,
            }),
        ).toBe(false);
    });

    it("validates an arc's centre / radius / angles", () => {
        expect(primitiveIsFinite({ kind: "arc", cx: 1, cy: 2, r: 3, start: 0, end: 1 })).toBe(true);
        expect(
            primitiveIsFinite({
                kind: "arc",
                cx: 1,
                cy: 2,
                r: Number.NaN,
                start: 0,
                end: 1,
            }),
        ).toBe(false);
    });

    it("validates a text anchor", () => {
        const base = {
            kind: "text" as const,
            text: "a",
            color: "#000",
            font: "10px sans-serif",
            align: "left" as const,
            baseline: "top" as const,
        };
        expect(primitiveIsFinite({ ...base, x: 1, y: 2 })).toBe(true);
        expect(primitiveIsFinite({ ...base, x: Number.NaN, y: 2 })).toBe(false);
    });

    it("validates a marker anchor and size", () => {
        expect(primitiveIsFinite({ kind: "marker", shape: "circle", x: 1, y: 2, size: 4 })).toBe(
            true,
        );
        expect(
            primitiveIsFinite({
                kind: "marker",
                shape: "circle",
                x: 1,
                y: 2,
                size: Number.NaN,
            }),
        ).toBe(false);
    });
});

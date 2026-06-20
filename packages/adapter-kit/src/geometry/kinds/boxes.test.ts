// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CircleState,
    EllipseState,
    FillBetweenState,
    PathState,
    PolylineState,
    RectangleState,
    RotatedRectangleState,
    TriangleState,
} from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../types.js";
import {
    decomposeCircle,
    decomposeEllipse,
    decomposeFillBetween,
    decomposePath,
    decomposePolyline,
    decomposeRectangle,
    decomposeRotatedRectangle,
    decomposeTriangle,
} from "./boxes.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

describe("decomposeRectangle", () => {
    it("emits a closed bbox polygon with no fill by default", () => {
        const state: RectangleState = {
            kind: "rectangle",
            anchors: [
                { time: 2, price: 8 },
                { time: 6, price: 4 },
            ],
            style: {},
        };
        const poly = decomposeRectangle(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.closed).toBe(true);
            expect(poly.fill).toBeUndefined();
            expect(poly.points).toEqual([
                { x: 20, y: 20 },
                { x: 60, y: 20 },
                { x: 60, y: 60 },
                { x: 20, y: 60 },
            ]);
        }
    });

    it("includes a fill when style.fill is set", () => {
        const state: RectangleState = {
            kind: "rectangle",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: { fill: "#dbeafe", fillAlpha: 0.4 },
        };
        const poly = decomposeRectangle(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.fill).toEqual({ color: "#dbeafe", alpha: 0.4 });
        }
    });
});

describe("decomposeRotatedRectangle", () => {
    it("walks the four anchors as a closed polygon", () => {
        const state: RotatedRectangleState = {
            kind: "rotated-rectangle",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 2, price: 0 },
                { time: 1, price: -1 },
            ],
            style: { fill: "#fff" },
        };
        const poly = decomposeRotatedRectangle(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.points).toHaveLength(4);
            expect(poly.closed).toBe(true);
            expect(poly.fill).toEqual({ color: "#fff", alpha: 1 });
        }
    });

    it("omits fill when style.fill is unset", () => {
        const state: RotatedRectangleState = {
            kind: "rotated-rectangle",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 2, price: 0 },
                { time: 1, price: -1 },
            ],
            style: {},
        };
        const poly = decomposeRotatedRectangle(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.fill).toBeUndefined();
        }
    });
});

describe("decomposeTriangle", () => {
    it("emits a closed 3-vertex polygon", () => {
        const state: TriangleState = {
            kind: "triangle",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 2, price: 0 },
            ],
            style: {},
        };
        const poly = decomposeTriangle(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.points).toHaveLength(3);
            expect(poly.closed).toBe(true);
            expect(poly.fill).toBeUndefined();
        }
    });

    it("includes a fill when set", () => {
        const state: TriangleState = {
            kind: "triangle",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 2, price: 0 },
            ],
            style: { fill: "#abc" },
        };
        const poly = decomposeTriangle(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.fill).toEqual({ color: "#abc", alpha: 1 });
        }
    });
});

describe("decomposePolyline", () => {
    it("emits a closed N-vertex polyline (no fill)", () => {
        const state: PolylineState = {
            kind: "polyline",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 2, price: 2 },
            ],
            style: { color: "#abcdef", lineWidth: 2, lineStyle: "dotted" },
        };
        const poly = decomposePolyline(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.closed).toBe(true);
            expect(poly.fill).toBeUndefined();
            expect(poly.stroke).toEqual({ color: "#abcdef", width: 2, dash: [2, 4] });
        }
    });

    it("defaults stroke colour to black", () => {
        const state: PolylineState = {
            kind: "polyline",
            anchors: [{ time: 0, price: 0 }],
            style: {},
        };
        const poly = decomposePolyline(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.stroke).toEqual({ color: "#000000", width: 1, dash: [] });
        }
    });
});

describe("decomposeCircle", () => {
    it("emits an arc whose radius is the projected pixel distance", () => {
        const state: CircleState = {
            kind: "circle",
            anchors: [
                { time: 5, price: 5 },
                { time: 8, price: 5 },
            ],
            style: {},
        };
        const arc = decomposeCircle(state, view)[0];
        if (arc.kind === "arc") {
            expect({ cx: arc.cx, cy: arc.cy }).toEqual({ cx: 50, cy: 50 });
            expect(arc.r).toBe(30);
            expect(arc.start).toBe(0);
            expect(arc.end).toBeCloseTo(Math.PI * 2);
        }
    });

    it("includes a fill when set", () => {
        const state: CircleState = {
            kind: "circle",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 0 },
            ],
            style: { fill: "#eee" },
        };
        const arc = decomposeCircle(state, view)[0];
        if (arc.kind === "arc") {
            expect(arc.fill).toEqual({ color: "#eee", alpha: 1 });
        }
    });
});

describe("decomposeEllipse", () => {
    it("emits a closed 64-segment polyline inscribed in the bbox", () => {
        const state: EllipseState = {
            kind: "ellipse",
            anchors: [
                { time: 0, price: 0 },
                { time: 4, price: 2 },
            ],
            style: {},
        };
        const poly = decomposeEllipse(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.points).toHaveLength(64);
            expect(poly.closed).toBe(true);
            // First sample is the right-most extent (centre + rx, centre y).
            expect(poly.points[0]).toEqual({ x: 40, y: 90 });
            expect(poly.fill).toBeUndefined();
        }
    });

    it("includes a fill when set", () => {
        const state: EllipseState = {
            kind: "ellipse",
            anchors: [
                { time: 0, price: 0 },
                { time: 2, price: 1 },
            ],
            style: { fill: "#abc", fillAlpha: 0.3 },
        };
        const poly = decomposeEllipse(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.fill).toEqual({ color: "#abc", alpha: 0.3 });
        }
    });
});

describe("decomposePath", () => {
    it("emits an open polyline by default", () => {
        const state: PathState = {
            kind: "path",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        };
        const poly = decomposePath(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.closed).toBe(false);
            expect(poly.stroke).toEqual({ color: "#000000", width: 1, dash: [] });
        }
    });

    it("closes the polyline when style.closed is true", () => {
        const state: PathState = {
            kind: "path",
            anchors: [{ time: 0, price: 0 }],
            style: { closed: true, color: "#111", lineWidth: 2, lineStyle: "dashed" },
        };
        const poly = decomposePath(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.closed).toBe(true);
            expect(poly.stroke).toEqual({ color: "#111", width: 2, dash: [6, 4] });
        }
    });
});

describe("decomposeFillBetween", () => {
    const baseStyle = { fill: "#3b82f6", fillAlpha: 0.2 };

    it("walks edgeA forward then edgeB reversed into one closed fill", () => {
        const state: FillBetweenState = {
            kind: "fill-between",
            edgeA: [
                { time: 0, price: 2 },
                { time: 1, price: 2 },
            ],
            edgeB: [
                { time: 0, price: 0 },
                { time: 1, price: 0 },
            ],
            style: baseStyle,
        };
        const poly = decomposeFillBetween(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.closed).toBe(true);
            expect(poly.points).toHaveLength(4);
            expect(poly.fill).toEqual({ color: "#3b82f6", alpha: 0.2 });
            expect(poly.stroke).toBeUndefined();
        }
    });

    it("includes a stroke only when style.color is set", () => {
        const state: FillBetweenState = {
            kind: "fill-between",
            edgeA: [{ time: 0, price: 2 }],
            edgeB: [{ time: 0, price: 0 }],
            style: { color: "#000", lineWidth: 2 },
        };
        const poly = decomposeFillBetween(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.stroke).toEqual({ color: "#000", width: 2, dash: [] });
            expect(poly.fill).toBeUndefined();
        }
    });

    it("defaults the outline width and dash when only color is set", () => {
        const state: FillBetweenState = {
            kind: "fill-between",
            edgeA: [{ time: 0, price: 2 }],
            edgeB: [{ time: 0, price: 0 }],
            style: { color: "#000" },
        };
        const poly = decomposeFillBetween(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.stroke).toEqual({ color: "#000", width: 1, dash: [] });
        }
    });

    it("is a no-op for a degenerate edge", () => {
        const state: FillBetweenState = {
            kind: "fill-between",
            edgeA: [],
            edgeB: [{ time: 0, price: 0 }],
            style: baseStyle,
        };
        expect(decomposeFillBetween(state, view)).toEqual([]);
    });

    it("is a no-op when a mapped anchor is non-finite", () => {
        const nanView: Viewport = { ...view, xMin: 0, xMax: 0 };
        const stateA: FillBetweenState = {
            kind: "fill-between",
            edgeA: [{ time: Number.NaN, price: 1 }],
            edgeB: [{ time: 0, price: 0 }],
            style: baseStyle,
        };
        expect(decomposeFillBetween(stateA, view)).toEqual([]);
        const stateB: FillBetweenState = {
            kind: "fill-between",
            edgeA: [{ time: 0, price: 1 }],
            edgeB: [{ time: Number.NaN, price: 0 }],
            style: baseStyle,
        };
        expect(decomposeFillBetween(stateB, view)).toEqual([]);
        void nanView;
    });
});

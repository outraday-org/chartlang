// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CrossLineState,
    HorizontalLineState,
    HorizontalRayState,
    LineState,
    TrendAngleState,
    VerticalLineState,
} from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../types.js";
import {
    decomposeCrossLine,
    decomposeHorizontalLine,
    decomposeHorizontalRay,
    decomposeLine,
    decomposeTrendAngle,
    decomposeVerticalLine,
} from "./lines.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

describe("decomposeLine", () => {
    it("emits a single open polyline at default stroke", () => {
        const state: LineState = {
            kind: "line",
            anchors: [
                { time: 1, price: 9 },
                { time: 2, price: 8 },
            ],
            style: {},
        };
        const prims = decomposeLine(state, view);
        expect(prims).toHaveLength(1);
        const poly = prims[0];
        expect(poly.kind).toBe("polyline");
        if (poly.kind === "polyline") {
            expect(poly.closed).toBe(false);
            expect(poly.points).toEqual([
                { x: 10, y: 10 },
                { x: 20, y: 20 },
            ]);
            expect(poly.stroke).toEqual({ color: "#000000", width: 1, dash: [] });
        }
    });

    it("extends right to the viewport edge when flagged", () => {
        const state: LineState = {
            kind: "line",
            anchors: [
                { time: 1, price: 9 },
                { time: 2, price: 8 },
            ],
            style: { extendRight: true, color: "#ff0000", lineWidth: 2, lineStyle: "dashed" },
        };
        const poly = decomposeLine(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.points[0]).toEqual({ x: 10, y: 10 });
            expect(poly.points[1].x).toBe(100);
            expect(poly.stroke).toEqual({ color: "#ff0000", width: 2, dash: [6, 4] });
        }
    });
});

describe("decomposeHorizontalLine", () => {
    it("spans the full width at the price's y", () => {
        const state: HorizontalLineState = {
            kind: "horizontal-line",
            price: 5,
            style: {},
        };
        const poly = decomposeHorizontalLine(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.points).toEqual([
                { x: 0, y: 50 },
                { x: 100, y: 50 },
            ]);
        }
    });
});

describe("decomposeHorizontalRay", () => {
    it("runs from the anchor to the right edge at constant y", () => {
        const state: HorizontalRayState = {
            kind: "horizontal-ray",
            anchor: { time: 2, price: 8 },
            style: {},
        };
        const poly = decomposeHorizontalRay(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.points).toEqual([
                { x: 20, y: 20 },
                { x: 100, y: 20 },
            ]);
        }
    });
});

describe("decomposeVerticalLine", () => {
    it("spans the full height at the time's x", () => {
        const state: VerticalLineState = {
            kind: "vertical-line",
            time: 5,
            style: {},
        };
        const poly = decomposeVerticalLine(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.points).toEqual([
                { x: 50, y: 0 },
                { x: 50, y: 100 },
            ]);
        }
    });
});

describe("decomposeCrossLine", () => {
    it("emits a horizontal and a vertical polyline sharing one stroke", () => {
        const state: CrossLineState = {
            kind: "cross-line",
            anchor: { time: 5, price: 5 },
            style: { color: "#00ff00" },
        };
        const prims = decomposeCrossLine(state, view);
        expect(prims).toHaveLength(2);
        const [h, v] = prims;
        if (h.kind === "polyline" && v.kind === "polyline") {
            expect(h.points).toEqual([
                { x: 0, y: 50 },
                { x: 100, y: 50 },
            ]);
            expect(v.points).toEqual([
                { x: 50, y: 0 },
                { x: 50, y: 100 },
            ]);
            expect(h.stroke?.color).toBe("#00ff00");
            expect(v.stroke).toBe(h.stroke);
        }
    });
});

describe("decomposeTrendAngle", () => {
    it("emits the segment, an arc, and the degree label", () => {
        const state: TrendAngleState = {
            kind: "trend-angle",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        };
        const prims = decomposeTrendAngle(state, view);
        expect(prims.map((p) => p.kind)).toEqual(["polyline", "arc", "text"]);
        const arc = prims[1];
        if (arc.kind === "arc") {
            // 1 time / 1 price up-right ⇒ +45° in screen space.
            expect(arc.r).toBe(24);
            expect(arc.end).toBe(0);
        }
        const label = prims[2];
        if (label.kind === "text") {
            expect(label.text).toBe("45.0°");
            expect(label.align).toBe("left");
            expect(label.baseline).toBe("middle");
        }
    });
});

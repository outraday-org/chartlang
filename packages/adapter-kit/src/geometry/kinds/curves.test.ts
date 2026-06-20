// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ArcState, CurveState, DoubleCurveState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { worldPointToPixel } from "../project.js";
import type { Viewport } from "../types.js";
import { decomposeArc, decomposeCurve, decomposeDoubleCurve } from "./curves.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

describe("decomposeArc", () => {
    it("emits one open polyline of 33 sampled points passing through endpoints", () => {
        const state: ArcState = {
            kind: "arc",
            anchors: [
                { time: 0, price: 0 },
                { time: 5, price: 10 },
                { time: 10, price: 0 },
            ],
            style: {},
        };
        const prims = decomposeArc(state, view);
        expect(prims).toHaveLength(1);
        const p = prims[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.closed).toBe(false);
        expect(p.points).toHaveLength(33);
        expect(p.points[0]).toEqual(worldPointToPixel(state.anchors[0], view));
        expect(p.points[32]).toEqual(worldPointToPixel(state.anchors[2], view));
        expect(p.stroke).toEqual({ color: "#000000", width: 1, dash: [] });
    });

    it("apex lies on the curve at the midpoint sample", () => {
        const state: ArcState = {
            kind: "arc",
            anchors: [
                { time: 0, price: 0 },
                { time: 5, price: 8 },
                { time: 10, price: 0 },
            ],
            style: { color: "#f00", lineWidth: 2, lineStyle: "dashed" },
        };
        const prims = decomposeArc(state, view);
        const p = prims[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        // CURVE_SAMPLES = 32 → midpoint sample index is 16 (t = 0.5).
        expect(p.points[16]).toEqual(worldPointToPixel(state.anchors[1], view));
        expect(p.stroke?.color).toBe("#f00");
        expect(p.stroke?.width).toBe(2);
    });
});

describe("decomposeCurve", () => {
    it("samples a quadratic with the middle anchor as the control point", () => {
        const state: CurveState = {
            kind: "curve",
            anchors: [
                { time: 0, price: 0 },
                { time: 5, price: 10 },
                { time: 10, price: 0 },
            ],
            style: {},
        };
        const prims = decomposeCurve(state, view);
        const p = prims[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.points).toHaveLength(33);
        expect(p.points[0]).toEqual(worldPointToPixel(state.anchors[0], view));
        expect(p.points[32]).toEqual(worldPointToPixel(state.anchors[2], view));
    });
});

describe("decomposeDoubleCurve", () => {
    it("samples a single cubic from anchors[0] to anchors[4], skipping the mid anchor", () => {
        const state: DoubleCurveState = {
            kind: "double-curve",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 4 },
                { time: 2, price: 0 },
                { time: 3, price: -4 },
                { time: 4, price: 0 },
            ],
            style: {},
        };
        const prims = decomposeDoubleCurve(state, view);
        const p = prims[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.closed).toBe(false);
        expect(p.points).toHaveLength(33);
        expect(p.points[0]).toEqual(worldPointToPixel(state.anchors[0], view));
        expect(p.points[32]).toEqual(worldPointToPixel(state.anchors[4], view));
    });
});

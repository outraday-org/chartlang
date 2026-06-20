// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { BrushState, HighlighterState, PenState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { worldPointToPixel } from "../project.js";
import type { Viewport } from "../types.js";
import { decomposeBrush, decomposeHighlighter, decomposePen } from "./freehand.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

const anchors = [
    { time: 0, price: 0 },
    { time: 1, price: 1 },
    { time: 2, price: 0 },
] as const;

describe("decomposePen", () => {
    it("emits one open polyline with default stroke", () => {
        const state: PenState = { kind: "pen", anchors: [...anchors], style: {} };
        const prims = decomposePen(state, view);
        expect(prims).toHaveLength(1);
        const p = prims[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.closed).toBe(false);
        expect(p.points).toEqual(anchors.map((a) => worldPointToPixel(a, view)));
        expect(p.stroke).toEqual({ color: "#000000", width: 1, dash: [] });
    });

    it("honours an explicit style", () => {
        const state: PenState = {
            kind: "pen",
            anchors: [...anchors],
            style: { color: "#abc", lineWidth: 3, lineStyle: "dotted" },
        };
        const p = decomposePen(state, view)[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.stroke?.color).toBe("#abc");
        expect(p.stroke?.width).toBe(3);
        expect(p.stroke?.dash.length).toBeGreaterThan(0);
    });
});

describe("decomposeHighlighter", () => {
    it("emits a thick translucent open polyline carrying stroke.alpha", () => {
        const state: HighlighterState = {
            kind: "highlighter",
            anchors: [...anchors],
            style: { color: "#facc15", alpha: 0.3 },
        };
        const p = decomposeHighlighter(state, view)[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.closed).toBe(false);
        expect(p.fill).toBeUndefined();
        expect(p.stroke).toEqual({ color: "#facc15", width: 6, dash: [], alpha: 0.3 });
    });
});

describe("decomposeBrush", () => {
    it("emits a closed polyline with both fill and stroke", () => {
        const state: BrushState = {
            kind: "brush",
            anchors: [...anchors],
            style: { stroke: "#000000", fill: "#ffffff" },
        };
        const p = decomposeBrush(state, view)[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.closed).toBe(true);
        expect(p.stroke).toEqual({ color: "#000000", width: 1, dash: [] });
        expect(p.fill).toEqual({ color: "#ffffff", alpha: 1 });
    });
});

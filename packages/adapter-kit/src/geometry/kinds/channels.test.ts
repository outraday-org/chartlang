// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    DisjointChannelState,
    FlatTopBottomState,
    RegressionTrendState,
    TrendChannelState,
} from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { worldPointToPixel } from "../project.js";
import type { Viewport } from "../types.js";
import {
    decomposeDisjointChannel,
    decomposeFlatTopBottom,
    decomposeRegressionTrend,
    decomposeTrendChannel,
} from "./channels.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

describe("decomposeTrendChannel", () => {
    it("emits the primary rail and a parallel translate by hook − a", () => {
        const state: TrendChannelState = {
            kind: "trend-channel",
            anchors: [
                { time: 0, price: 0 },
                { time: 4, price: 4 },
                { time: 0, price: 2 },
            ],
            style: {},
        };
        const prims = decomposeTrendChannel(state, view);
        expect(prims).toHaveLength(2);
        const a = worldPointToPixel(state.anchors[0], view);
        const b = worldPointToPixel(state.anchors[1], view);
        const hook = worldPointToPixel(state.anchors[2], view);
        const dx = hook.x - a.x;
        const dy = hook.y - a.y;
        const primary = prims[0];
        const parallel = prims[1];
        if (primary.kind !== "polyline" || parallel.kind !== "polyline") {
            throw new Error("expected polylines");
        }
        expect(primary.points).toEqual([a, b]);
        expect(parallel.points).toEqual([
            { x: a.x + dx, y: a.y + dy },
            { x: b.x + dx, y: b.y + dy },
        ]);
        expect(primary.stroke).toBe(parallel.stroke);
    });
});

describe("decomposeFlatTopBottom", () => {
    it("places the top rail at the max price and the bottom at the min", () => {
        const state: FlatTopBottomState = {
            kind: "flat-top-bottom",
            anchors: [
                { time: 0, price: 1 },
                { time: 5, price: 1 },
                { time: 0, price: 7 },
            ],
            style: {},
        };
        const prims = decomposeFlatTopBottom(state, view);
        expect(prims).toHaveLength(2);
        const top = prims[0];
        const bottom = prims[1];
        if (top.kind !== "polyline" || bottom.kind !== "polyline") {
            throw new Error("expected polylines");
        }
        const topLeft = worldPointToPixel({ time: 0, price: 7 }, view);
        const bottomLeft = worldPointToPixel({ time: 0, price: 1 }, view);
        expect(top.points[0]).toEqual(topLeft);
        expect(bottom.points[0]).toEqual(bottomLeft);
        // Top rail (higher price) is above the bottom rail in pixel space.
        expect(top.points[0].y).toBeLessThan(bottom.points[0].y);
    });
});

describe("decomposeDisjointChannel", () => {
    it("emits two independent segments", () => {
        const state: DisjointChannelState = {
            kind: "disjoint-channel",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 0, price: 2 },
                { time: 1, price: 3 },
            ],
            style: {},
        };
        const prims = decomposeDisjointChannel(state, view);
        expect(prims).toHaveLength(2);
        const seg1 = prims[0];
        const seg2 = prims[1];
        if (seg1.kind !== "polyline" || seg2.kind !== "polyline") {
            throw new Error("expected polylines");
        }
        expect(seg1.points).toEqual([
            worldPointToPixel(state.anchors[0], view),
            worldPointToPixel(state.anchors[1], view),
        ]);
        expect(seg2.points).toEqual([
            worldPointToPixel(state.anchors[2], view),
            worldPointToPixel(state.anchors[3], view),
        ]);
    });
});

describe("decomposeRegressionTrend", () => {
    it("emits a single placeholder line with the default colour", () => {
        const state: RegressionTrendState = {
            kind: "regression-trend",
            anchors: [
                { time: 0, price: 0 },
                { time: 5, price: 1 },
            ],
            style: {},
        };
        const prims = decomposeRegressionTrend(state, view);
        expect(prims).toHaveLength(1);
        const p = prims[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.points).toEqual([
            worldPointToPixel(state.anchors[0], view),
            worldPointToPixel(state.anchors[1], view),
        ]);
        expect(p.stroke).toEqual({ color: "#3b82f6", width: 1, dash: [] });
    });

    it("honours an explicit style.color and ignores the band flags", () => {
        const state: RegressionTrendState = {
            kind: "regression-trend",
            anchors: [
                { time: 0, price: 0 },
                { time: 5, price: 1 },
            ],
            style: {
                color: "#10b981",
                stdevMultiplier: 2,
                showUpperBand: true,
                showLowerBand: true,
                source: "close",
            },
        };
        const prims = decomposeRegressionTrend(state, view);
        expect(prims).toHaveLength(1);
        const p = prims[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.stroke?.color).toBe("#10b981");
    });
});

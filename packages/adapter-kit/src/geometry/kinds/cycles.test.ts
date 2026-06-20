// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CyclicLinesState,
    SineLineState,
    TimeCyclesState,
} from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../types.js";
import { decomposeCyclicLines, decomposeSineLine, decomposeTimeCycles } from "./cycles.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

describe("decomposeCyclicLines", () => {
    it("emits repeated vertical lines spaced by the period", () => {
        const state: CyclicLinesState = {
            kind: "cyclic-lines",
            anchors: [
                { time: 1, price: 0 },
                { time: 3, price: 0 },
            ],
            style: {},
        };
        const prims = decomposeCyclicLines(state, view);
        // period = 20px from x=10; lines at 10,30,...,90 then break.
        expect(prims.length).toBeGreaterThan(0);
        expect(prims.every((p) => p.kind === "polyline")).toBe(true);
    });

    it("returns [] for a non-positive period", () => {
        const state: CyclicLinesState = {
            kind: "cyclic-lines",
            anchors: [
                { time: 5, price: 0 },
                { time: 5, price: 0 },
            ],
            style: {},
        };
        expect(decomposeCyclicLines(state, view)).toEqual([]);
    });

    it("skips lines left of the viewport and breaks past the right edge", () => {
        const state: CyclicLinesState = {
            kind: "cyclic-lines",
            anchors: [
                { time: -5, price: 0 },
                { time: -3, price: 0 },
            ],
            style: { lineStyle: "dashed" },
        };
        // fromPx.x = -50, period = 20 → x = -50,-30,-10,10,30,... first two skipped (<-16).
        const prims = decomposeCyclicLines(state, view);
        const xs = prims.map((p) => (p.kind === "polyline" ? p.points[0].x : Number.NaN));
        expect(Math.min(...xs)).toBeGreaterThanOrEqual(-16);
        expect(prims[0].kind === "polyline" && prims[0].stroke?.dash).toEqual([6, 4]);
    });
});

describe("decomposeTimeCycles", () => {
    it("emits concentric upper-half arcs across the viewport", () => {
        const state: TimeCyclesState = {
            kind: "time-cycles",
            anchors: [
                { time: 4, price: 5 },
                { time: 6, price: 5 },
            ],
            style: {},
        };
        const prims = decomposeTimeCycles(state, view);
        expect(prims.length).toBeGreaterThan(1);
        expect(prims.every((p) => p.kind === "arc")).toBe(true);
        const first = prims[0];
        expect(first.kind === "arc" && first.start).toBe(Math.PI);
        expect(first.kind === "arc" && first.end).toBe(2 * Math.PI);
    });

    it("returns [] for a non-positive diameter", () => {
        const state: TimeCyclesState = {
            kind: "time-cycles",
            anchors: [
                { time: 5, price: 5 },
                { time: 5, price: 5 },
            ],
            style: {},
        };
        expect(decomposeTimeCycles(state, view)).toEqual([]);
    });
});

describe("decomposeSineLine", () => {
    it("emits one sampled polyline (from below to above)", () => {
        const state: SineLineState = {
            kind: "sine-line",
            anchors: [
                { time: 2, price: 2 },
                { time: 6, price: 8 },
            ],
            style: {},
        };
        const prims = decomposeSineLine(state, view);
        expect(prims).toHaveLength(1);
        expect(prims[0].kind === "polyline" && prims[0].points.length).toBeGreaterThan(2);
    });

    it("handles the from-above-to peak sign branch", () => {
        const state: SineLineState = {
            kind: "sine-line",
            anchors: [
                { time: 2, price: 8 },
                { time: 6, price: 2 },
            ],
            style: {},
        };
        expect(decomposeSineLine(state, view)).toHaveLength(1);
    });

    it("returns [] for a non-positive half-period", () => {
        const state: SineLineState = {
            kind: "sine-line",
            anchors: [
                { time: 5, price: 2 },
                { time: 5, price: 8 },
            ],
            style: {},
        };
        expect(decomposeSineLine(state, view)).toEqual([]);
    });
});

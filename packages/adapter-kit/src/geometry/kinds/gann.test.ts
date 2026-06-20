// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    GannBoxState,
    GannFanState,
    GannSquareFixedState,
    GannSquareState,
} from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../types.js";
import {
    decomposeGannBox,
    decomposeGannFan,
    decomposeGannSquare,
    decomposeGannSquareFixed,
} from "./gann.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

describe("decomposeGannBox", () => {
    it("emits 5 horizontal + 5 vertical grid polylines", () => {
        const state: GannBoxState = {
            kind: "gann-box",
            anchors: [
                { time: 0, price: 0 },
                { time: 8, price: 8 },
            ],
            style: {},
        };
        const prims = decomposeGannBox(state, view);
        expect(prims).toHaveLength(10);
        expect(prims.every((p) => p.kind === "polyline")).toBe(true);
    });

    it("honours custom colour + line width", () => {
        const state: GannBoxState = {
            kind: "gann-box",
            anchors: [
                { time: 0, price: 0 },
                { time: 8, price: 8 },
            ],
            style: { color: "#123456", lineWidth: 3 },
        };
        const first = decomposeGannBox(state, view)[0];
        expect(first.kind === "polyline" && first.stroke?.color).toBe("#123456");
        expect(first.kind === "polyline" && first.stroke?.width).toBe(3);
    });
});

describe("decomposeGannSquareFixed", () => {
    it("emits an 80px grid at the anchor", () => {
        const state: GannSquareFixedState = {
            kind: "gann-square-fixed",
            anchor: { time: 0, price: 10 },
            style: {},
        };
        const prims = decomposeGannSquareFixed(state, view);
        expect(prims).toHaveLength(10);
    });
});

describe("decomposeGannSquare", () => {
    it("emits a signed-positive square grid", () => {
        const state: GannSquareState = {
            kind: "gann-square",
            anchors: [
                { time: 0, price: 10 },
                { time: 5, price: 5 },
            ],
            style: {},
        };
        expect(decomposeGannSquare(state, view)).toHaveLength(10);
    });

    it("emits a signed-negative square grid (b before a)", () => {
        const state: GannSquareState = {
            kind: "gann-square",
            anchors: [
                { time: 8, price: 2 },
                { time: 2, price: 8 },
            ],
            style: {},
        };
        expect(decomposeGannSquare(state, view)).toHaveLength(10);
    });
});

describe("decomposeGannFan", () => {
    it("emits 9 rays for a non-degenerate direction", () => {
        const state: GannFanState = {
            kind: "gann-fan",
            anchors: [
                { time: 0, price: 0 },
                { time: 5, price: 5 },
            ],
            style: {},
        };
        const prims = decomposeGannFan(state, view);
        expect(prims).toHaveLength(9);
    });

    it("skips zero-magnitude rays (dx=0 and dy=0 → all ratios degenerate)", () => {
        const state: GannFanState = {
            kind: "gann-fan",
            anchors: [
                { time: 3, price: 3 },
                { time: 3, price: 3 },
            ],
            style: {},
        };
        expect(decomposeGannFan(state, view)).toHaveLength(0);
    });
});

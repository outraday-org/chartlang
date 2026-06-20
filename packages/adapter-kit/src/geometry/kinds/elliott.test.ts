// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    ElliottCorrectionWaveState,
    ElliottDoubleComboState,
    ElliottImpulseWaveState,
    ElliottTriangleWaveState,
    ElliottTripleComboState,
} from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { DrawPrimitive, Viewport } from "../types.js";
import {
    decomposeElliottCorrectionWave,
    decomposeElliottDoubleCombo,
    decomposeElliottImpulseWave,
    decomposeElliottTriangleWave,
    decomposeElliottTripleCombo,
} from "./elliott.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

function pts(n: number) {
    return Array.from({ length: n }, (_, i) => ({ time: i, price: i % 2 }));
}

function labels(prims: ReadonlyArray<DrawPrimitive>): string[] {
    return prims.filter((p) => p.kind === "text").map((p) => (p.kind === "text" ? p.text : ""));
}

describe("decomposeElliottImpulseWave", () => {
    it("uses default 1-5 labels and the teal default colour", () => {
        const state: ElliottImpulseWaveState = {
            kind: "elliott-impulse-wave",
            anchors: pts(5) as ElliottImpulseWaveState["anchors"],
            style: {},
        };
        const prims = decomposeElliottImpulseWave(state, view);
        expect(labels(prims)).toEqual(["1", "2", "3", "4", "5"]);
        const leg = prims[0];
        expect(leg.kind === "polyline" && leg.stroke?.color).toBe("#14b8a6");
    });

    it("honours matching state.labels override", () => {
        const state: ElliottImpulseWaveState = {
            kind: "elliott-impulse-wave",
            anchors: pts(5) as ElliottImpulseWaveState["anchors"],
            labels: ["i", "ii", "iii", "iv", "v"],
            style: {},
        };
        expect(labels(decomposeElliottImpulseWave(state, view))).toEqual([
            "i",
            "ii",
            "iii",
            "iv",
            "v",
        ]);
    });

    it("falls back to defaults when state.labels length mismatches", () => {
        const state: ElliottImpulseWaveState = {
            kind: "elliott-impulse-wave",
            anchors: pts(5) as ElliottImpulseWaveState["anchors"],
            labels: ["only", "two"],
            style: {},
        };
        expect(labels(decomposeElliottImpulseWave(state, view))).toEqual(["1", "2", "3", "4", "5"]);
    });

    it("lets style.color override the teal default", () => {
        const state: ElliottImpulseWaveState = {
            kind: "elliott-impulse-wave",
            anchors: pts(5) as ElliottImpulseWaveState["anchors"],
            style: { color: "#000000" },
        };
        const leg = decomposeElliottImpulseWave(state, view)[0];
        expect(leg.kind === "polyline" && leg.stroke?.color).toBe("#000000");
    });
});

describe("decomposeElliottCorrectionWave", () => {
    it("uses default A-B-C labels", () => {
        const state: ElliottCorrectionWaveState = {
            kind: "elliott-correction-wave",
            anchors: pts(3) as ElliottCorrectionWaveState["anchors"],
            style: {},
        };
        expect(labels(decomposeElliottCorrectionWave(state, view))).toEqual(["A", "B", "C"]);
    });
});

describe("decomposeElliottTriangleWave", () => {
    it("uses default a-e labels", () => {
        const state: ElliottTriangleWaveState = {
            kind: "elliott-triangle-wave",
            anchors: pts(5) as ElliottTriangleWaveState["anchors"],
            style: {},
        };
        expect(labels(decomposeElliottTriangleWave(state, view))).toEqual([
            "a",
            "b",
            "c",
            "d",
            "e",
        ]);
    });
});

describe("decomposeElliottDoubleCombo", () => {
    it("uses default double-combo labels", () => {
        const state: ElliottDoubleComboState = {
            kind: "elliott-double-combo",
            anchors: pts(7) as ElliottDoubleComboState["anchors"],
            style: {},
        };
        expect(labels(decomposeElliottDoubleCombo(state, view))).toEqual([
            "S",
            "W",
            "x1",
            "X",
            "x2",
            "Yi",
            "Y",
        ]);
    });
});

describe("decomposeElliottTripleCombo", () => {
    it("uses default triple-combo labels", () => {
        const state: ElliottTripleComboState = {
            kind: "elliott-triple-combo",
            anchors: pts(7) as ElliottTripleComboState["anchors"],
            style: {},
        };
        expect(labels(decomposeElliottTripleCombo(state, view))).toEqual([
            "S",
            "W",
            "X1",
            "Y",
            "X2",
            "Zi",
            "Z",
        ]);
    });
});

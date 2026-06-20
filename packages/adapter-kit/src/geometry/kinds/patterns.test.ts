// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AbcdPatternState,
    CypherPatternState,
    HeadAndShouldersState,
    ThreeDrivesPatternState,
    TrianglePatternState,
    XabcdPatternState,
} from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { DrawPrimitive, Viewport } from "../types.js";
import {
    decomposeAbcdPattern,
    decomposeCypherPattern,
    decomposeHeadAndShoulders,
    decomposeThreeDrivesPattern,
    decomposeTrianglePattern,
    decomposeXabcdPattern,
} from "./patterns.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

function pts(n: number) {
    return Array.from({ length: n }, (_, i) => ({ time: i, price: i % 2 }));
}

function textLabels(prims: ReadonlyArray<DrawPrimitive>): string[] {
    return prims.filter((p) => p.kind === "text").map((p) => (p.kind === "text" ? p.text : ""));
}

describe("decomposeXabcdPattern", () => {
    it("emits a 5-vertex labelled polyline", () => {
        const state: XabcdPatternState = {
            kind: "xabcd-pattern",
            anchors: pts(5) as XabcdPatternState["anchors"],
            style: {},
        };
        const prims = decomposeXabcdPattern(state, view);
        expect(prims).toHaveLength(6);
        expect(textLabels(prims)).toEqual(["X", "A", "B", "C", "D"]);
    });
});

describe("decomposeCypherPattern", () => {
    it("uses the same XABCD labels", () => {
        const state: CypherPatternState = {
            kind: "cypher-pattern",
            anchors: pts(5) as CypherPatternState["anchors"],
            style: {},
        };
        expect(textLabels(decomposeCypherPattern(state, view))).toEqual(["X", "A", "B", "C", "D"]);
    });
});

describe("decomposeHeadAndShoulders", () => {
    it("emits the labelled polyline plus a neckline polyline", () => {
        const state: HeadAndShouldersState = {
            kind: "head-and-shoulders",
            anchors: pts(5) as HeadAndShouldersState["anchors"],
            style: {},
        };
        const prims = decomposeHeadAndShoulders(state, view);
        // 1 leg polyline + 5 labels + 1 neckline polyline.
        expect(prims).toHaveLength(7);
        expect(prims.filter((p) => p.kind === "polyline")).toHaveLength(2);
        expect(textLabels(prims)).toEqual(["LS", "LL", "H", "RL", "RS"]);
    });

    it("honours a custom neckline colour", () => {
        const state: HeadAndShouldersState = {
            kind: "head-and-shoulders",
            anchors: pts(5) as HeadAndShouldersState["anchors"],
            style: { color: "#ff0000" },
        };
        const prims = decomposeHeadAndShoulders(state, view);
        const neckline = prims[prims.length - 1];
        expect(neckline.kind === "polyline" && neckline.stroke?.color).toBe("#ff0000");
    });
});

describe("decomposeAbcdPattern", () => {
    it("emits 4 labels", () => {
        const state: AbcdPatternState = {
            kind: "abcd-pattern",
            anchors: pts(4) as AbcdPatternState["anchors"],
            style: {},
        };
        expect(textLabels(decomposeAbcdPattern(state, view))).toEqual(["A", "B", "C", "D"]);
    });
});

describe("decomposeTrianglePattern", () => {
    it("emits 3 labels", () => {
        const state: TrianglePatternState = {
            kind: "triangle-pattern",
            anchors: pts(3) as TrianglePatternState["anchors"],
            style: {},
        };
        expect(textLabels(decomposeTrianglePattern(state, view))).toEqual(["A", "B", "C"]);
    });
});

describe("decomposeThreeDrivesPattern", () => {
    it("emits 7 labels", () => {
        const state: ThreeDrivesPatternState = {
            kind: "three-drives-pattern",
            anchors: pts(7) as ThreeDrivesPatternState["anchors"],
            style: {},
        };
        expect(textLabels(decomposeThreeDrivesPattern(state, view))).toEqual([
            "S",
            "D1",
            "R1",
            "D2",
            "R2",
            "D3",
            "E",
        ]);
    });
});

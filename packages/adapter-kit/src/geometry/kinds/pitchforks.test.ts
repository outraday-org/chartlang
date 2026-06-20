// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PitchfanState, PitchforkState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../types.js";
import { decomposePitchfan, decomposePitchfork } from "./pitchforks.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

const anchors = [
    { time: 0, price: 0 },
    { time: 2, price: 8 },
    { time: 6, price: 2 },
] as const;

describe("decomposePitchfork", () => {
    it.each(["standard", "schiff", "modifiedSchiff", "inside"] as const)(
        "emits 3 rails for variant %s",
        (variant) => {
            const state: PitchforkState = {
                kind: "pitchfork",
                variant,
                anchors: [...anchors],
                style: {},
            };
            const prims = decomposePitchfork(state, view);
            expect(prims).toHaveLength(3);
            expect(prims.every((p) => p.kind === "polyline")).toBe(true);
        },
    );

    it("honours custom colour + line width", () => {
        const state: PitchforkState = {
            kind: "pitchfork",
            variant: "standard",
            anchors: [...anchors],
            style: { color: "#abcdef", lineWidth: 2 },
        };
        const first = decomposePitchfork(state, view)[0];
        expect(first.kind === "polyline" && first.stroke?.color).toBe("#abcdef");
        expect(first.kind === "polyline" && first.stroke?.width).toBe(2);
    });
});

describe("decomposePitchfan", () => {
    it("emits 3 rays for non-degenerate targets", () => {
        const state: PitchfanState = { kind: "pitchfan", anchors: [...anchors], style: {} };
        expect(decomposePitchfan(state, view)).toHaveLength(3);
    });

    it("skips a ray when its target coincides with the pivot", () => {
        const state: PitchfanState = {
            kind: "pitchfan",
            anchors: [
                { time: 0, price: 0 },
                { time: 0, price: 0 },
                { time: 0, price: 0 },
            ],
            style: {},
        };
        // pivot == b == c == midBC → all three rays degenerate.
        expect(decomposePitchfan(state, view)).toHaveLength(0);
    });
});

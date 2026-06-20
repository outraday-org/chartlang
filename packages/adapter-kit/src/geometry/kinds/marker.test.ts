// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MarkerState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../types.js";
import { decomposeMarker } from "./marker.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

describe("decomposeMarker", () => {
    it("emits a single text primitive when text is set", () => {
        const state: MarkerState = {
            kind: "marker",
            anchor: { time: 5, price: 5 },
            text: "B",
            style: { color: "#444" },
        };
        const prims = decomposeMarker(state, view);
        expect(prims).toHaveLength(1);
        const t = prims[0];
        if (t.kind === "text") {
            expect(t).toMatchObject({ x: 50, y: 50, text: "B", color: "#444" });
        }
    });

    it("carries bgColor when set", () => {
        const state: MarkerState = {
            kind: "marker",
            anchor: { time: 0, price: 0 },
            text: "x",
            style: { bgColor: "#fef3c7" },
        };
        const t = decomposeMarker(state, view)[0];
        if (t.kind === "text") {
            expect(t.bgColor).toBe("#fef3c7");
        }
    });

    it("is a no-op when text is undefined", () => {
        const state: MarkerState = {
            kind: "marker",
            anchor: { time: 0, price: 0 },
            style: {},
        };
        expect(decomposeMarker(state, view)).toEqual([]);
    });

    it("is a no-op when text is empty", () => {
        const state: MarkerState = {
            kind: "marker",
            anchor: { time: 0, price: 0 },
            text: "",
            style: {},
        };
        expect(decomposeMarker(state, view)).toEqual([]);
    });
});

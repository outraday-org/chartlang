// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { FrameState, GroupState, TableState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { DrawPrimitive, Viewport } from "../types.js";
import { decomposeFrame, decomposeGroup, decomposeTable } from "./containers.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 200, pxHeight: 200 };

function texts(prims: ReadonlyArray<DrawPrimitive>): string[] {
    return prims.filter((p) => p.kind === "text").map((p) => (p.kind === "text" ? p.text : ""));
}

describe("decomposeGroup", () => {
    it("is a no-op returning []", () => {
        const state: GroupState = { kind: "group", childHandleIds: ["a", "b"] };
        expect(decomposeGroup(state, view)).toEqual([]);
    });
});

describe("decomposeFrame", () => {
    const anchors: FrameState["anchors"] = [
        { time: 1, price: 8 },
        { time: 6, price: 2 },
    ];

    it("emits a bordered rectangle with no fill / no label by default", () => {
        const state: FrameState = { kind: "frame", anchors, childHandleIds: [], style: {} };
        const prims = decomposeFrame(state, view);
        expect(prims).toHaveLength(1);
        const border = prims[0];
        expect(border.kind === "polyline" && border.closed).toBe(true);
        expect(border.kind === "polyline" && border.fill).toBeUndefined();
    });

    it("adds a background fill when bgColor is set", () => {
        const state: FrameState = {
            kind: "frame",
            anchors,
            childHandleIds: [],
            style: { bgColor: "#eeeeee" },
        };
        const border = decomposeFrame(state, view)[0];
        expect(border.kind === "polyline" && border.fill).toEqual({ color: "#eeeeee", alpha: 1 });
    });

    it("adds a label text when label is set", () => {
        const state: FrameState = {
            kind: "frame",
            anchors,
            childHandleIds: [],
            style: { label: "Idea" },
        };
        const prims = decomposeFrame(state, view);
        expect(texts(prims)).toEqual(["Idea"]);
    });

    it("returns [] for a degenerate (zero-width) frame", () => {
        const state: FrameState = {
            kind: "frame",
            anchors: [
                { time: 3, price: 8 },
                { time: 3, price: 2 },
            ],
            childHandleIds: [],
            style: {},
        };
        expect(decomposeFrame(state, view)).toEqual([]);
    });

    it("returns [] for a non-finite frame", () => {
        const state: FrameState = {
            kind: "frame",
            anchors: [
                { time: Number.POSITIVE_INFINITY, price: 8 },
                { time: 6, price: 2 },
            ],
            childHandleIds: [],
            style: {},
        };
        expect(decomposeFrame(state, view)).toEqual([]);
    });

    it("returns [] for a degenerate (zero-height) frame", () => {
        const state: FrameState = {
            kind: "frame",
            anchors: [
                { time: 1, price: 5 },
                { time: 6, price: 5 },
            ],
            childHandleIds: [],
            style: {},
        };
        expect(decomposeFrame(state, view)).toEqual([]);
    });
});

describe("decomposeTable", () => {
    it("emits a bg-fill + text per cell", () => {
        const state: TableState = {
            kind: "table",
            position: "top-left",
            cells: [
                [{ text: "P&L" }, { text: "+12%" }],
                [{ text: "Net" }, { text: "-3%" }],
            ],
        };
        const prims = decomposeTable(state, view);
        // 4 cells → 4 fill polylines + 4 texts.
        expect(prims.filter((p) => p.kind === "polyline")).toHaveLength(4);
        expect(prims.filter((p) => p.kind === "text")).toHaveLength(4);
    });

    it("adds per-cell borders when borderColor + borderWidth are set", () => {
        const state: TableState = {
            kind: "table",
            position: "middle-center",
            cells: [[{ text: "x" }]],
            borderColor: "#999999",
            borderWidth: 1,
        };
        const prims = decomposeTable(state, view);
        // 1 bg-fill + 1 text + 1 border.
        expect(prims.filter((p) => p.kind === "polyline")).toHaveLength(2);
    });

    it("adds an outer frame polyline when frame is set", () => {
        const state: TableState = {
            kind: "table",
            position: "bottom-right",
            cells: [[{ text: "x" }]],
            frame: { color: "#000000", width: 2 },
        };
        const prims = decomposeTable(state, view);
        const last = prims[prims.length - 1];
        expect(last.kind === "polyline" && last.stroke?.color).toBe("#000000");
        expect(last.kind === "polyline" && last.stroke?.width).toBe(2);
    });

    it("resolves every halign / valign + textSize cell variant without throwing", () => {
        const state: TableState = {
            kind: "table",
            position: "middle-right",
            cells: [
                [
                    { text: "a", textHalign: "left", textValign: "top", textSize: "tiny" },
                    { text: "b", textHalign: "center", textValign: "middle", textSize: "huge" },
                    { text: "c", textHalign: "right", textValign: "bottom", textSize: "large" },
                ],
            ],
        };
        const prims = decomposeTable(state, view);
        const aligns = prims
            .filter((p) => p.kind === "text")
            .map((p) => (p.kind === "text" ? p.align : ""));
        expect(aligns).toEqual(["left", "center", "right"]);
    });

    it("resolves bottom-* / *-center positioning", () => {
        const state: TableState = {
            kind: "table",
            position: "bottom-center",
            cells: [[{ text: "x" }]],
        };
        expect(decomposeTable(state, view).length).toBeGreaterThan(0);
    });

    it("handles a ragged row (missing cell → empty default)", () => {
        const state: TableState = {
            kind: "table",
            position: "top-left",
            cells: [[{ text: "a" }, { text: "b" }], [{ text: "c" }]],
        };
        const prims = decomposeTable(state, view);
        // 2 columns × 2 rows = 4 cells (the missing one is filled with "").
        expect(prims.filter((p) => p.kind === "text")).toHaveLength(4);
    });

    it("handles zero rows without throwing", () => {
        const state: TableState = { kind: "table", position: "top-left", cells: [] };
        expect(decomposeTable(state, view)).toEqual([]);
    });
});

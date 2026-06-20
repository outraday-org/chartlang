// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingKind, DrawingState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { DrawingEmission } from "../types.js";
import { decomposeDrawing } from "./decompose.js";
import type { Viewport } from "./types.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

function emission(drawingKind: DrawingKind, state: DrawingState): DrawingEmission {
    return { kind: "drawing", handleId: "h", drawingKind, op: "create", state, bar: 0, time: 0 };
}

const BASIC: ReadonlyArray<[DrawingKind, DrawingState]> = [
    [
        "line",
        {
            kind: "line",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        },
    ],
    ["horizontal-line", { kind: "horizontal-line", price: 1, style: {} }],
    ["horizontal-ray", { kind: "horizontal-ray", anchor: { time: 0, price: 1 }, style: {} }],
    ["vertical-line", { kind: "vertical-line", time: 1, style: {} }],
    ["cross-line", { kind: "cross-line", anchor: { time: 1, price: 1 }, style: {} }],
    [
        "trend-angle",
        {
            kind: "trend-angle",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        },
    ],
    [
        "rectangle",
        {
            kind: "rectangle",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        },
    ],
    [
        "rotated-rectangle",
        {
            kind: "rotated-rectangle",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 2, price: 0 },
                { time: 1, price: -1 },
            ],
            style: {},
        },
    ],
    [
        "triangle",
        {
            kind: "triangle",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 2, price: 0 },
            ],
            style: {},
        },
    ],
    [
        "polyline",
        {
            kind: "polyline",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        },
    ],
    [
        "circle",
        {
            kind: "circle",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 0 },
            ],
            style: {},
        },
    ],
    [
        "ellipse",
        {
            kind: "ellipse",
            anchors: [
                { time: 0, price: 0 },
                { time: 2, price: 1 },
            ],
            style: {},
        },
    ],
    [
        "path",
        {
            kind: "path",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        },
    ],
    [
        "fill-between",
        {
            kind: "fill-between",
            edgeA: [{ time: 0, price: 1 }],
            edgeB: [{ time: 0, price: 0 }],
            style: { fill: "#3b82f6" },
        },
    ],
    ["marker", { kind: "marker", anchor: { time: 1, price: 1 }, text: "B", style: {} }],
    ["text", { kind: "text", anchor: { time: 1, price: 1 }, body: "t", style: {} }],
    [
        "arrow",
        {
            kind: "arrow",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        },
    ],
    ["arrow-marker", { kind: "arrow-marker", anchor: { time: 1, price: 1 }, style: {} }],
    ["arrow-mark-up", { kind: "arrow-mark-up", anchor: { time: 1, price: 1 }, style: {} }],
    ["arrow-mark-down", { kind: "arrow-mark-down", anchor: { time: 1, price: 1 }, style: {} }],
];

const ANCHOR3 = [
    { time: 0, price: 0 },
    { time: 1, price: 1 },
    { time: 2, price: 0 },
] as const;

const TASK2: ReadonlyArray<[DrawingKind, DrawingState]> = [
    ["arc", { kind: "arc", anchors: [...ANCHOR3], style: {} }],
    ["curve", { kind: "curve", anchors: [...ANCHOR3], style: {} }],
    [
        "double-curve",
        {
            kind: "double-curve",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 2, price: 0 },
                { time: 3, price: -1 },
                { time: 4, price: 0 },
            ],
            style: {},
        },
    ],
    [
        "pen",
        {
            kind: "pen",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        },
    ],
    [
        "highlighter",
        {
            kind: "highlighter",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: { color: "#facc15", alpha: 0.3 },
        },
    ],
    [
        "brush",
        {
            kind: "brush",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: { stroke: "#000000", fill: "#ffffff" },
        },
    ],
    ["trend-channel", { kind: "trend-channel", anchors: [...ANCHOR3], style: {} }],
    ["flat-top-bottom", { kind: "flat-top-bottom", anchors: [...ANCHOR3], style: {} }],
    [
        "disjoint-channel",
        {
            kind: "disjoint-channel",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 0, price: 2 },
                { time: 1, price: 3 },
            ],
            style: {},
        },
    ],
    [
        "regression-trend",
        {
            kind: "regression-trend",
            anchors: [
                { time: 0, price: 0 },
                { time: 5, price: 1 },
            ],
            style: {},
        },
    ],
    [
        "fib-retracement",
        {
            kind: "fib-retracement",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        },
    ],
    ["fib-trend-extension", { kind: "fib-trend-extension", anchors: [...ANCHOR3], style: {} }],
    ["fib-channel", { kind: "fib-channel", anchors: [...ANCHOR3], style: {} }],
    [
        "fib-time-zone",
        {
            kind: "fib-time-zone",
            anchors: [
                { time: 0, price: 0 },
                { time: 4, price: 0 },
            ],
            style: {},
        },
    ],
    ["fib-wedge", { kind: "fib-wedge", anchors: [...ANCHOR3], style: {} }],
    [
        "fib-speed-fan",
        {
            kind: "fib-speed-fan",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        },
    ],
    [
        "fib-speed-arcs",
        {
            kind: "fib-speed-arcs",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 0 },
            ],
            style: {},
        },
    ],
    [
        "fib-spiral",
        {
            kind: "fib-spiral",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 0 },
            ],
            style: {},
        },
    ],
    [
        "fib-circles",
        {
            kind: "fib-circles",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 0 },
            ],
            style: {},
        },
    ],
    ["fib-trend-time", { kind: "fib-trend-time", anchors: [...ANCHOR3], style: {} }],
];

const ANCHOR5 = [
    { time: 0, price: 0 },
    { time: 1, price: 1 },
    { time: 2, price: 0 },
    { time: 3, price: 1 },
    { time: 4, price: 0 },
] as const;

const ANCHOR7 = [
    { time: 0, price: 0 },
    { time: 1, price: 1 },
    { time: 2, price: 0 },
    { time: 3, price: 1 },
    { time: 4, price: 0 },
    { time: 5, price: 1 },
    { time: 6, price: 0 },
] as const;

const TASK3: ReadonlyArray<[DrawingKind, DrawingState]> = [
    [
        "gann-box",
        {
            kind: "gann-box",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        },
    ],
    ["gann-square-fixed", { kind: "gann-square-fixed", anchor: { time: 0, price: 0 }, style: {} }],
    [
        "gann-square",
        {
            kind: "gann-square",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        },
    ],
    [
        "gann-fan",
        {
            kind: "gann-fan",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: {},
        },
    ],
    ["pitchfork", { kind: "pitchfork", variant: "standard", anchors: [...ANCHOR3], style: {} }],
    ["pitchfan", { kind: "pitchfan", anchors: [...ANCHOR3], style: {} }],
    ["xabcd-pattern", { kind: "xabcd-pattern", anchors: [...ANCHOR5], style: {} }],
    ["cypher-pattern", { kind: "cypher-pattern", anchors: [...ANCHOR5], style: {} }],
    ["head-and-shoulders", { kind: "head-and-shoulders", anchors: [...ANCHOR5], style: {} }],
    [
        "abcd-pattern",
        {
            kind: "abcd-pattern",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 2, price: 0 },
                { time: 3, price: 1 },
            ],
            style: {},
        },
    ],
    ["triangle-pattern", { kind: "triangle-pattern", anchors: [...ANCHOR3], style: {} }],
    ["three-drives-pattern", { kind: "three-drives-pattern", anchors: [...ANCHOR7], style: {} }],
    ["elliott-impulse-wave", { kind: "elliott-impulse-wave", anchors: [...ANCHOR5], style: {} }],
    [
        "elliott-correction-wave",
        { kind: "elliott-correction-wave", anchors: [...ANCHOR3], style: {} },
    ],
    ["elliott-triangle-wave", { kind: "elliott-triangle-wave", anchors: [...ANCHOR5], style: {} }],
    ["elliott-double-combo", { kind: "elliott-double-combo", anchors: [...ANCHOR7], style: {} }],
    ["elliott-triple-combo", { kind: "elliott-triple-combo", anchors: [...ANCHOR7], style: {} }],
    [
        "cyclic-lines",
        {
            kind: "cyclic-lines",
            anchors: [
                { time: 1, price: 0 },
                { time: 3, price: 0 },
            ],
            style: {},
        },
    ],
    [
        "time-cycles",
        {
            kind: "time-cycles",
            anchors: [
                { time: 4, price: 5 },
                { time: 6, price: 5 },
            ],
            style: {},
        },
    ],
    [
        "sine-line",
        {
            kind: "sine-line",
            anchors: [
                { time: 2, price: 2 },
                { time: 6, price: 8 },
            ],
            style: {},
        },
    ],
    [
        "frame",
        {
            kind: "frame",
            anchors: [
                { time: 1, price: 8 },
                { time: 6, price: 2 },
            ],
            childHandleIds: [],
            style: {},
        },
    ],
    ["table", { kind: "table", position: "top-left", cells: [[{ text: "x" }]] }],
];

describe("decomposeDrawing", () => {
    it("routes every basic kind to a non-empty primitive list", () => {
        for (const [kind, state] of BASIC) {
            const prims = decomposeDrawing(emission(kind, state), view);
            expect(prims.length, kind).toBeGreaterThan(0);
        }
    });

    it("covers exactly 20 basic kinds", () => {
        expect(BASIC).toHaveLength(20);
    });

    it("routes every curve / freehand / channel / fibonacci kind to primitives", () => {
        for (const [kind, state] of TASK2) {
            const prims = decomposeDrawing(emission(kind, state), view);
            expect(prims.length, kind).toBeGreaterThan(0);
        }
    });

    it("covers exactly 20 Task-2 kinds", () => {
        expect(TASK2).toHaveLength(20);
    });

    it("routes every gann / pitchfork / pattern / elliott / cycle / container / table kind to primitives", () => {
        for (const [kind, state] of TASK3) {
            const prims = decomposeDrawing(emission(kind, state), view);
            expect(prims.length, kind).toBeGreaterThan(0);
        }
    });

    it("covers exactly 22 non-group Task-3 kinds", () => {
        expect(TASK3).toHaveLength(22);
    });

    it("decomposes the group container to [] (no-op)", () => {
        const group = emission("group", { kind: "group", childHandleIds: ["a"] });
        expect(decomposeDrawing(group, view)).toEqual([]);
    });

    it("is exhaustive over all 63 drawing kinds", () => {
        // 20 basic + 20 Task-2 + 22 Task-3 + group = 63.
        expect(BASIC.length + TASK2.length + TASK3.length + 1).toBe(63);
    });

    it("falls into the exhaustive default arm for an unknown kind (defensive)", () => {
        const rogue: DrawingEmission = {
            kind: "drawing",
            handleId: "h",
            drawingKind: "not-a-real-kind" as unknown as DrawingKind,
            op: "create",
            state: { kind: "rogue" } as unknown as DrawingState,
            bar: 0,
            time: 0,
        };
        expect(decomposeDrawing(rogue, view)).toEqual([]);
    });
});

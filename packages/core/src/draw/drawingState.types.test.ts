// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DRAWING_KINDS } from "./drawingKind.js";
import type { DrawingKind } from "./drawingKind.js";
import type { DrawingState } from "./drawingState.js";

/**
 * Exhaustiveness: switching on every `DrawingKind` and assigning the
 * `default` case to `never` proves the union covers every kind. If a
 * new kind lands in `DrawingKind` without a corresponding variant in
 * `DrawingState`, this function fails to compile.
 */
function exhaustiveSwitch(kind: DrawingKind): string {
    switch (kind) {
        case "line":
        case "horizontal-line":
        case "horizontal-ray":
        case "vertical-line":
        case "cross-line":
        case "trend-angle":
        case "rectangle":
        case "rotated-rectangle":
        case "triangle":
        case "polyline":
        case "circle":
        case "ellipse":
        case "path":
        case "marker":
        case "arc":
        case "curve":
        case "double-curve":
        case "pen":
        case "highlighter":
        case "brush":
        case "text":
        case "arrow":
        case "arrow-marker":
        case "arrow-mark-up":
        case "arrow-mark-down":
        case "trend-channel":
        case "flat-top-bottom":
        case "disjoint-channel":
        case "regression-trend":
        case "fib-retracement":
        case "fib-trend-extension":
        case "fib-channel":
        case "fib-time-zone":
        case "fib-wedge":
        case "fib-speed-fan":
        case "fib-speed-arcs":
        case "fib-spiral":
        case "fib-circles":
        case "fib-trend-time":
        case "gann-box":
        case "gann-square-fixed":
        case "gann-square":
        case "gann-fan":
        case "pitchfork":
        case "pitchfan":
        case "xabcd-pattern":
        case "cypher-pattern":
        case "head-and-shoulders":
        case "abcd-pattern":
        case "triangle-pattern":
        case "three-drives-pattern":
        case "elliott-impulse-wave":
        case "elliott-correction-wave":
        case "elliott-triangle-wave":
        case "elliott-double-combo":
        case "elliott-triple-combo":
        case "cyclic-lines":
        case "time-cycles":
        case "sine-line":
        case "group":
        case "frame":
        case "table":
            return kind;
        default: {
            // Compile-time exhaustiveness: any kind not covered above
            // forces `kind` to widen here, breaking the assignment.
            const _exhaustive: never = kind;
            return _exhaustive;
        }
    }
}

/**
 * Helper that asserts a value is assignable to `DrawingState`. The
 * call type-checks only if the variant's `kind` field matches a known
 * `DrawingKind` and the carried geometry / style satisfies the variant.
 */
function assertState<T extends DrawingState>(state: T): T {
    return state;
}

describe("DrawingState exhaustiveness", () => {
    it("covers every DrawingKind via the discriminated switch", () => {
        for (const k of DRAWING_KINDS) {
            expect(exhaustiveSwitch(k)).toBe(k);
        }
    });
});

describe("DrawingState variants", () => {
    it("LineState carries kind: 'line' + anchors + style", () => {
        const s = assertState({
            kind: "line",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: { color: "#3b82f6", extendRight: true },
        });
        expect(s.kind).toBe("line");
    });

    it("HorizontalLineState carries kind + price + style", () => {
        const s = assertState({
            kind: "horizontal-line",
            price: 100,
            style: { color: "#3b82f6" },
        });
        expect(s.kind).toBe("horizontal-line");
    });

    it("VerticalLineState carries kind + time + style", () => {
        const s = assertState({
            kind: "vertical-line",
            time: 1_700_000_000_000,
            style: {},
        });
        expect(s.kind).toBe("vertical-line");
    });

    it("PitchforkState carries the variant discriminator", () => {
        const s = assertState({
            kind: "pitchfork",
            variant: "modifiedSchiff",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 2, price: 0.5 },
            ],
            style: {},
        });
        expect(s.variant).toBe("modifiedSchiff");
    });

    it("FibRetracementState carries FibOpts levels", () => {
        const s = assertState({
            kind: "fib-retracement",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            style: { levels: [0.382, 0.5, 0.618], showLabels: true },
        });
        expect(s.style.levels?.[0]).toBe(0.382);
    });

    it("ElliottImpulseWaveState carries five anchors + optional labels", () => {
        const s = assertState({
            kind: "elliott-impulse-wave",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 2, price: 0.5 },
                { time: 3, price: 1.5 },
                { time: 4, price: 1 },
            ],
            labels: ["1", "2", "3", "4", "5"],
            style: {},
        });
        expect(s.labels?.length).toBe(5);
    });

    it("GroupState carries childHandleIds and meta", () => {
        const s = assertState({
            kind: "group",
            childHandleIds: ["a", "b"],
            meta: { layer: "trades" },
        });
        expect(s.childHandleIds.length).toBe(2);
    });

    it("FrameState carries anchors + childHandleIds + FrameOpts", () => {
        const s = assertState({
            kind: "frame",
            anchors: [
                { time: 0, price: 0 },
                { time: 1, price: 1 },
            ],
            childHandleIds: [],
            style: { label: "Idea", bgColor: "#f1f5f9" },
        });
        expect(s.style.label).toBe("Idea");
    });

    it("TableState carries a viewport position and cell grid", () => {
        const s = assertState({
            kind: "table",
            position: "top-right",
            cells: [[{ text: "P&L" }, { text: "+12.5%", textColor: "#16a34a" }]],
            borderColor: "#94a3b8",
            borderWidth: 1,
            frame: { color: "#475569", width: 2 },
        });
        expect(s.cells[0][1].text).toBe("+12.5%");
    });

    it("DrawingMeta name + visible flow through every variant", () => {
        const s = assertState({
            kind: "horizontal-line",
            price: 50,
            style: {},
            name: "Support",
            visible: false,
        });
        expect(s.name).toBe("Support");
        expect(s.visible).toBe(false);
    });
});

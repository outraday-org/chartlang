// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DRAWING_KINDS, KIND_CAMELCASE, KIND_KEBABCASE } from "./drawingKind";
import type { DrawingKind } from "./drawingKind";

const EXPECTED_ORDER: ReadonlyArray<DrawingKind> = [
    "line",
    "horizontal-line",
    "horizontal-ray",
    "vertical-line",
    "cross-line",
    "trend-angle",
    "rectangle",
    "rotated-rectangle",
    "triangle",
    "polyline",
    "circle",
    "ellipse",
    "path",
    "marker",
    "arc",
    "curve",
    "double-curve",
    "pen",
    "highlighter",
    "brush",
    "text",
    "arrow",
    "arrow-marker",
    "arrow-mark-up",
    "arrow-mark-down",
    "trend-channel",
    "flat-top-bottom",
    "disjoint-channel",
    "regression-trend",
    "fib-retracement",
    "fib-trend-extension",
    "fib-channel",
    "fib-time-zone",
    "fib-wedge",
    "fib-speed-fan",
    "fib-speed-arcs",
    "fib-spiral",
    "fib-circles",
    "fib-trend-time",
    "gann-box",
    "gann-square-fixed",
    "gann-square",
    "gann-fan",
    "pitchfork",
    "pitchfan",
    "xabcd-pattern",
    "cypher-pattern",
    "head-and-shoulders",
    "abcd-pattern",
    "triangle-pattern",
    "three-drives-pattern",
    "elliott-impulse-wave",
    "elliott-correction-wave",
    "elliott-triangle-wave",
    "elliott-double-combo",
    "elliott-triple-combo",
    "cyclic-lines",
    "time-cycles",
    "sine-line",
    "group",
    "frame",
];

describe("DRAWING_KINDS", () => {
    it("contains exactly 61 entries", () => {
        expect(DRAWING_KINDS.length).toBe(61);
    });

    it("matches the canonical wire-stable order", () => {
        expect([...DRAWING_KINDS]).toEqual(EXPECTED_ORDER);
    });

    it("is frozen", () => {
        expect(Object.isFrozen(DRAWING_KINDS)).toBe(true);
    });

    it("has no duplicate entries", () => {
        expect(new Set(DRAWING_KINDS).size).toBe(DRAWING_KINDS.length);
    });
});

describe("KIND_CAMELCASE", () => {
    it("has 61 entries (one per kind)", () => {
        expect(KIND_CAMELCASE.size).toBe(61);
    });

    it("covers every kind in DRAWING_KINDS", () => {
        for (const k of DRAWING_KINDS) {
            expect(KIND_CAMELCASE.get(k)).toBeDefined();
        }
    });

    it("maps every kebab kind to a camelCase value with no hyphens", () => {
        for (const camel of KIND_CAMELCASE.values()) {
            expect(camel).not.toMatch(/-/);
            expect(camel.length).toBeGreaterThan(0);
        }
    });

    it("emits unique camelCase values (bijection ready)", () => {
        const camels = new Set(KIND_CAMELCASE.values());
        expect(camels.size).toBe(KIND_CAMELCASE.size);
    });

    it("maps specific kinds to their pinned camelCase form", () => {
        expect(KIND_CAMELCASE.get("horizontal-line")).toBe("horizontalLine");
        expect(KIND_CAMELCASE.get("fib-retracement")).toBe("fibRetracement");
        expect(KIND_CAMELCASE.get("elliott-impulse-wave")).toBe("elliottImpulseWave");
        expect(KIND_CAMELCASE.get("xabcd-pattern")).toBe("xabcdPattern");
    });
});

describe("KIND_KEBABCASE", () => {
    it("has 61 entries (round-trip of KIND_CAMELCASE)", () => {
        expect(KIND_KEBABCASE.size).toBe(61);
    });

    it("round-trips KIND_CAMELCASE for every kind", () => {
        for (const [kebab, camel] of KIND_CAMELCASE) {
            expect(KIND_KEBABCASE.get(camel)).toBe(kebab);
        }
    });

    it("maps specific camel surface names back to their wire kind", () => {
        expect(KIND_KEBABCASE.get("horizontalLine")).toBe("horizontal-line");
        expect(KIND_KEBABCASE.get("fibRetracement")).toBe("fib-retracement");
        expect(KIND_KEBABCASE.get("elliottImpulseWave")).toBe("elliott-impulse-wave");
    });

    it("returns undefined for unknown camel names", () => {
        expect(KIND_KEBABCASE.get("totallyMadeUpKind")).toBeUndefined();
    });
});

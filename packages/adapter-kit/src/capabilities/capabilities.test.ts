// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { DRAWING_KINDS, KIND_CAMELCASE } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { DrawingKind } from "../types";
import { capabilities } from "./capabilities";

describe("capabilities builders", () => {
    it("line() returns a set containing only 'line'", () => {
        const s = capabilities.line();
        expect(s.size).toBe(1);
        expect(s.has("line")).toBe(true);
    });

    it("stepLine() returns a set containing only 'step-line'", () => {
        const s = capabilities.stepLine();
        expect(s.size).toBe(1);
        expect(s.has("step-line")).toBe(true);
    });

    it("horizontalLine() returns a set containing only 'horizontal-line'", () => {
        const s = capabilities.horizontalLine();
        expect(s.size).toBe(1);
        expect(s.has("horizontal-line")).toBe(true);
    });

    it("allLines() returns the three Phase-1 line variants", () => {
        const s = capabilities.allLines();
        expect(s.size).toBe(3);
        expect(s.has("line")).toBe(true);
        expect(s.has("step-line")).toBe(true);
        expect(s.has("horizontal-line")).toBe(true);
    });

    it("histogram() returns a set containing only 'histogram'", () => {
        const s = capabilities.histogram();
        expect(s.size).toBe(1);
        expect(s.has("histogram")).toBe(true);
    });

    it("bars() returns a set containing only 'bars'", () => {
        const s = capabilities.bars();
        expect(s.size).toBe(1);
        expect(s.has("bars")).toBe(true);
    });

    it("area() returns a set containing only 'area'", () => {
        const s = capabilities.area();
        expect(s.size).toBe(1);
        expect(s.has("area")).toBe(true);
    });

    it("filledBand() returns a set containing only 'filled-band'", () => {
        const s = capabilities.filledBand();
        expect(s.size).toBe(1);
        expect(s.has("filled-band")).toBe(true);
    });

    it("label() returns a set containing only 'label'", () => {
        const s = capabilities.label();
        expect(s.size).toBe(1);
        expect(s.has("label")).toBe(true);
    });

    it("marker() returns a set containing only 'marker'", () => {
        const s = capabilities.marker();
        expect(s.size).toBe(1);
        expect(s.has("marker")).toBe(true);
    });

    it("allPhase2Plots() returns the nine Phase-1+Phase-2 plot kinds", () => {
        const s = capabilities.allPhase2Plots();
        expect(s.size).toBe(9);
        for (const k of [
            "line",
            "step-line",
            "horizontal-line",
            "histogram",
            "bars",
            "area",
            "filled-band",
            "label",
            "marker",
        ] as const) {
            expect(s.has(k)).toBe(true);
        }
    });

    it("alerts(...) returns a set containing exactly the supplied channels", () => {
        const s = capabilities.alerts("toast", "webhook");
        expect(s.size).toBe(2);
        expect(s.has("toast")).toBe(true);
        expect(s.has("webhook")).toBe(true);
    });

    it("alerts() with no args returns an empty set", () => {
        const s = capabilities.alerts();
        expect(s.size).toBe(0);
    });

    it("union(...) merges sets without duplicating values", () => {
        const s = capabilities.union(capabilities.line(), capabilities.horizontalLine());
        expect(s.size).toBe(2);
        expect(s.has("line")).toBe(true);
        expect(s.has("horizontal-line")).toBe(true);
    });

    it("union() with no args returns an empty set", () => {
        const s = capabilities.union<string>();
        expect(s.size).toBe(0);
    });

    it("union(a, a) collapses duplicates", () => {
        const a = capabilities.line();
        const s = capabilities.union(a, a);
        expect(s.size).toBe(1);
        expect(s.has("line")).toBe(true);
    });
});

type DrawBuilder = () => ReadonlySet<DrawingKind>;
type CapsRecord = Record<string, unknown>;

function builderNameFor(kind: DrawingKind): string {
    const camel = KIND_CAMELCASE.get(kind);
    if (camel === undefined) {
        throw new Error(`Missing KIND_CAMELCASE entry for '${kind}'`);
    }
    return `draw${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
}

function invokeDrawBuilder(name: string): ReadonlySet<DrawingKind> {
    const builder = (capabilities as unknown as CapsRecord)[name];
    if (typeof builder !== "function") {
        throw new Error(`capabilities.${name} is not a function`);
    }
    return (builder as DrawBuilder)();
}

describe("capabilities — Phase 3 per-kind drawing builders", () => {
    it.each(DRAWING_KINDS)(
        "draw%s() returns a single-element Set containing only the kind",
        (kind) => {
            const set = invokeDrawBuilder(builderNameFor(kind));
            expect(set.size).toBe(1);
            expect(set.has(kind)).toBe(true);
        },
    );
});

const CATEGORY_BUILDERS: ReadonlyArray<
    readonly [keyof typeof capabilities, ReadonlyArray<DrawingKind>]
> = [
    [
        "allLineDrawings",
        ["line", "horizontal-line", "horizontal-ray", "vertical-line", "cross-line", "trend-angle"],
    ],
    [
        "allBoxDrawings",
        [
            "rectangle",
            "rotated-rectangle",
            "triangle",
            "polyline",
            "circle",
            "ellipse",
            "path",
            "marker",
        ],
    ],
    ["allCurveDrawings", ["arc", "curve", "double-curve"]],
    ["allFreehandDrawings", ["pen", "highlighter", "brush"]],
    [
        "allAnnotationDrawings",
        ["text", "arrow", "arrow-marker", "arrow-mark-up", "arrow-mark-down"],
    ],
    [
        "allChannelDrawings",
        ["trend-channel", "flat-top-bottom", "disjoint-channel", "regression-trend"],
    ],
    [
        "allFibDrawings",
        [
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
        ],
    ],
    ["allGannDrawings", ["gann-box", "gann-square-fixed", "gann-square", "gann-fan"]],
    ["allPitchforkDrawings", ["pitchfork", "pitchfan"]],
    [
        "allPatternDrawings",
        [
            "xabcd-pattern",
            "cypher-pattern",
            "head-and-shoulders",
            "abcd-pattern",
            "triangle-pattern",
            "three-drives-pattern",
        ],
    ],
    [
        "allElliottDrawings",
        [
            "elliott-impulse-wave",
            "elliott-correction-wave",
            "elliott-triangle-wave",
            "elliott-double-combo",
            "elliott-triple-combo",
        ],
    ],
    ["allCycleDrawings", ["cyclic-lines", "time-cycles", "sine-line"]],
    ["allContainerDrawings", ["group", "frame"]],
];

describe("capabilities — Phase 3 category-group drawing builders", () => {
    it.each(CATEGORY_BUILDERS)(
        "%s() carries the canonical kinds + correct cardinality",
        (name, expected) => {
            const builder = capabilities[name] as DrawBuilder;
            const set = builder();
            expect(set.size).toBe(expected.length);
            for (const kind of expected) {
                expect(set.has(kind)).toBe(true);
            }
        },
    );

    it("the 13 categories are pairwise disjoint — every kind appears in exactly one category", () => {
        const counts = new Map<DrawingKind, number>(DRAWING_KINDS.map((k) => [k, 0]));
        for (const [name] of CATEGORY_BUILDERS) {
            const builder = capabilities[name] as DrawBuilder;
            for (const kind of builder()) {
                counts.set(kind, (counts.get(kind) ?? 0) + 1);
            }
        }
        for (const [kind, count] of counts) {
            expect({ kind, count }).toEqual({ kind, count: 1 });
        }
    });

    it("the union of the 13 categories equals allPhase3Drawings()", () => {
        const merged = capabilities.union(
            ...CATEGORY_BUILDERS.map(([name]) => (capabilities[name] as DrawBuilder)()),
        );
        const umbrella = capabilities.allPhase3Drawings();
        expect(merged.size).toBe(umbrella.size);
        for (const kind of umbrella) {
            expect(merged.has(kind)).toBe(true);
        }
    });
});

describe("capabilities — allPhase3Drawings umbrella", () => {
    it("contains every kind in DRAWING_KINDS", () => {
        const set = capabilities.allPhase3Drawings();
        expect(set.size).toBe(61);
        for (const kind of DRAWING_KINDS) {
            expect(set.has(kind)).toBe(true);
        }
    });
});

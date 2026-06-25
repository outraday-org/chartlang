// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawPrimitive } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import {
    type ShapeGlyphArgs,
    parseFont,
    primitiveToNode,
    resolvePaintColor,
    shapeGlyphNodes,
} from "./primitiveToNode.js";
import { MockKonva } from "./testing.js";

// Build a mock namespace and return the recorded nodes produced for one
// primitive, so each assertion reads the node type + config directly.
function build(p: DrawPrimitive): {
    konva: MockKonva;
    nodes: ReadonlyArray<MockKonva["roots"][number]>;
} {
    const konva = new MockKonva();
    const handles = primitiveToNode(konva, p);
    // `roots` holds every constructed node in creation order; the handles
    // returned are exactly those, so the recorded roots match 1:1.
    return { konva, nodes: konva.roots.slice(0, handles.length) };
}

describe("parseFont", () => {
    it("parses the IR `<px>px <family>` font string", () => {
        expect(parseFont("12px sans-serif")).toEqual({ fontSize: 12, fontFamily: "sans-serif" });
        expect(parseFont("8px serif")).toEqual({ fontSize: 8, fontFamily: "serif" });
        expect(parseFont("16.5px Courier New")).toEqual({
            fontSize: 16.5,
            fontFamily: "Courier New",
        });
    });

    it("falls back to 12px sans-serif on a malformed font", () => {
        expect(parseFont("bold")).toEqual({ fontSize: 12, fontFamily: "sans-serif" });
        expect(parseFont("")).toEqual({ fontSize: 12, fontFamily: "sans-serif" });
    });
});

describe("primitiveToNode — polyline", () => {
    it("maps an open stroked polyline to a single Line", () => {
        const { nodes } = build({
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 20 },
            ],
            closed: false,
            stroke: { color: "#3b82f6", width: 2, dash: [] },
        });
        expect(nodes).toHaveLength(1);
        expect(nodes[0].type).toBe("Line");
        expect(nodes[0].config).toMatchObject({
            points: [0, 0, 10, 20],
            closed: false,
            stroke: "#3b82f6",
            strokeWidth: 2,
        });
        // A solid (empty) dash omits the field entirely.
        expect(nodes[0].config.dash).toBeUndefined();
    });

    it("carries a dash array and a closed fill", () => {
        const { nodes } = build({
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
            ],
            closed: true,
            stroke: { color: "#000000", width: 1, dash: [6, 4] },
            fill: { color: "#dbeafe", alpha: 0.4 },
        });
        expect(nodes[0].config.dash).toEqual([6, 4]);
        expect(nodes[0].config.closed).toBe(true);
        // The fill alpha is baked into the colour hex (#rrggbbaa).
        expect(nodes[0].config.fill).toBe("#dbeafe66");
    });

    it("bakes a stroke alpha into the stroke colour", () => {
        const { nodes } = build({
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ],
            closed: false,
            stroke: { color: "#ff0000", width: 1, dash: [], alpha: 0.5 },
        });
        expect(nodes[0].config.stroke).toBe("#ff000080");
    });

    it("emits a style-less Line when neither stroke nor fill is set", () => {
        const { nodes } = build({
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ],
            closed: false,
        });
        expect(nodes[0].config.stroke).toBeUndefined();
        expect(nodes[0].config.fill).toBeUndefined();
    });

    it("drops non-finite vertices and skips an all-NaN polyline", () => {
        const { nodes: kept } = build({
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: Number.NaN, y: 5 },
                { x: 10, y: 10 },
            ],
            closed: false,
            stroke: { color: "#000000", width: 1, dash: [] },
        });
        expect(kept[0].config.points).toEqual([0, 0, 10, 10]);

        const { nodes: empty } = build({
            kind: "polyline",
            points: [{ x: Number.NaN, y: Number.POSITIVE_INFINITY }],
            closed: false,
            stroke: { color: "#000000", width: 1, dash: [] },
        });
        expect(empty).toHaveLength(0);
    });
});

describe("primitiveToNode — arc", () => {
    it("maps a full circle to a Konva ring Arc", () => {
        const { nodes } = build({
            kind: "arc",
            cx: 50,
            cy: 60,
            r: 12,
            start: 0,
            end: Math.PI * 2,
            closed: true,
            stroke: { color: "#14b8a6", width: 1, dash: [] },
        });
        expect(nodes[0].type).toBe("Arc");
        expect(nodes[0].config).toMatchObject({
            x: 50,
            y: 60,
            innerRadius: 12,
            outerRadius: 12,
            angle: 360,
            rotation: 0,
            stroke: "#14b8a6",
        });
    });

    it("carries dash + fill on a full-circle Arc", () => {
        const { nodes } = build({
            kind: "arc",
            cx: 0,
            cy: 0,
            r: 5,
            start: 0,
            end: Math.PI * 2,
            closed: true,
            stroke: { color: "#000000", width: 1, dash: [2, 3] },
            fill: { color: "#000000", alpha: 1 },
        });
        expect(nodes[0].config.dash).toEqual([2, 3]);
        expect(nodes[0].config.fill).toBe("#000000ff");
    });

    it("emits a fill-only full-circle Arc with no stroke", () => {
        const { nodes } = build({
            kind: "arc",
            cx: 1,
            cy: 2,
            r: 3,
            start: 0,
            end: Math.PI * 2,
            closed: true,
            fill: { color: "#000000", alpha: 0.25 },
        });
        expect(nodes[0].type).toBe("Arc");
        expect(nodes[0].config.stroke).toBeUndefined();
        expect(nodes[0].config.dash).toBeUndefined();
        expect(nodes[0].config.fill).toBe("#00000040");
    });

    it("maps a small partial sweep to a Path with largeArc=0, clockwise=1", () => {
        const { nodes } = build({
            kind: "arc",
            cx: 0,
            cy: 0,
            r: 10,
            start: 0,
            end: Math.PI / 2,
            closed: false,
            stroke: { color: "#3b82f6", width: 1, dash: [] },
        });
        expect(nodes[0].type).toBe("Path");
        const data = nodes[0].config.data;
        expect(typeof data).toBe("string");
        // M 10 0 A 10 10 0 0 1 … Z — largeArc 0, sweep clockwise 1.
        expect(data).toContain("A 10 10 0 0 1");
        expect(data).toContain("Z");
    });

    it("sets largeArc=1 for a sweep over π and clockwise=0 for a negative sweep", () => {
        const large = build({
            kind: "arc",
            cx: 0,
            cy: 0,
            r: 4,
            start: 0,
            end: Math.PI * 1.5,
            closed: false,
            stroke: { color: "#000000", width: 1, dash: [] },
        });
        expect(large.nodes[0].config.data).toContain("A 4 4 0 1 1");

        const negative = build({
            kind: "arc",
            cx: 0,
            cy: 0,
            r: 4,
            start: 0,
            end: -Math.PI / 4,
            closed: false,
            stroke: { color: "#000000", width: 1, dash: [3, 3] },
            fill: { color: "#ffffff", alpha: 0.5 },
        });
        // Negative sweep → counter-clockwise flag 0; dash + fill carried.
        expect(negative.nodes[0].config.data).toContain("A 4 4 0 0 0");
        expect(negative.nodes[0].config.dash).toEqual([3, 3]);
        expect(negative.nodes[0].config.fill).toBe("#ffffff80");
    });

    it("emits a style-less partial Path when no stroke/fill is set", () => {
        const { nodes } = build({
            kind: "arc",
            cx: 0,
            cy: 0,
            r: 10,
            start: 0,
            end: Math.PI / 2,
            closed: false,
        });
        expect(nodes[0].config.stroke).toBeUndefined();
        expect(nodes[0].config.fill).toBeUndefined();
    });

    it("skips an arc with a non-finite centre or radius", () => {
        expect(
            build({ kind: "arc", cx: Number.NaN, cy: 0, r: 1, start: 0, end: 1, closed: false })
                .nodes,
        ).toHaveLength(0);
        expect(
            build({ kind: "arc", cx: 0, cy: 0, r: Number.NaN, start: 0, end: 1, closed: false })
                .nodes,
        ).toHaveLength(0);
    });
});

describe("primitiveToNode — text", () => {
    it("maps text to a single Text node with parsed font + align/baseline", () => {
        const { nodes } = build({
            kind: "text",
            x: 10,
            y: 20,
            text: "RSI",
            color: "#e2e8f0",
            font: "11px sans-serif",
            align: "center",
            baseline: "middle",
        });
        expect(nodes).toHaveLength(1);
        expect(nodes[0].type).toBe("Text");
        // Konva ignores `align`/`verticalAlign` without a width/height box, so
        // the anchor is baked into x/y: center shifts left by half the glyph
        // width (3 × 11 × 0.6 / 2 = 9.9 ⇒ x 0.1); middle shifts up by half the
        // font height (11 / 2 = 5.5 ⇒ y 14.5).
        expect(nodes[0].config).toMatchObject({
            x: 10 - (3 * 11 * 0.6) / 2,
            y: 20 - 11 / 2,
            text: "RSI",
            fontSize: 11,
            fontFamily: "sans-serif",
            fill: "#e2e8f0",
            align: "center",
            verticalAlign: "middle",
        });
    });

    it("anchors left/top text at its raw coordinate (no offset)", () => {
        const { nodes } = build({
            kind: "text",
            x: 10,
            y: 20,
            text: "RSI",
            color: "#e2e8f0",
            font: "11px sans-serif",
            align: "left",
            baseline: "top",
        });
        expect(nodes[0].config).toMatchObject({ x: 10, y: 20 });
    });

    it("anchors right/bottom text by the full glyph width / font height", () => {
        const { nodes } = build({
            kind: "text",
            x: 10,
            y: 20,
            text: "RSI",
            color: "#e2e8f0",
            font: "11px sans-serif",
            align: "right",
            baseline: "bottom",
        });
        // right ⇒ x − full glyph width (3 × 11 × 0.6 = 19.8); bottom ⇒ y − font.
        expect(nodes[0].config).toMatchObject({ x: 10 - 3 * 11 * 0.6, y: 20 - 11 });
    });

    it("prepends a backing Rect when bgColor is set", () => {
        const { nodes } = build({
            kind: "text",
            x: 100,
            y: 50,
            text: "AB",
            color: "#000000",
            font: "12px sans-serif",
            align: "left",
            baseline: "top",
            bgColor: "#fde047",
        });
        expect(nodes).toHaveLength(2);
        expect(nodes[0].type).toBe("Rect");
        expect(nodes[0].config.fill).toBe("#fde047");
        // 2 glyphs × 12px × 0.6 + 2×4 pad = 22.4 wide; 12 + 2×2 = 16 tall.
        expect(nodes[0].config).toMatchObject({ x: 96, y: 48, width: 22.4, height: 16 });
        expect(nodes[1].type).toBe("Text");
    });

    it("skips a text primitive with non-finite coordinates", () => {
        expect(
            build({
                kind: "text",
                x: Number.NaN,
                y: 0,
                text: "x",
                color: "#000000",
                font: "12px sans-serif",
                align: "left",
                baseline: "top",
            }).nodes,
        ).toHaveLength(0);
    });
});

describe("primitiveToNode — marker", () => {
    const base = { kind: "marker", x: 30, y: 40, size: 8 } as const;

    it("maps a circle to a ring Arc", () => {
        const { nodes } = build({
            ...base,
            shape: "circle",
            fill: { color: "#22c55e", alpha: 1 },
        });
        expect(nodes[0].type).toBe("Arc");
        expect(nodes[0].config).toMatchObject({
            x: 30,
            y: 40,
            innerRadius: 4,
            outerRadius: 4,
            angle: 360,
            fill: "#22c55eff",
        });
    });

    it("maps a square to a centred Rect with stroke", () => {
        const { nodes } = build({
            ...base,
            shape: "square",
            stroke: { color: "#ef4444", width: 1, dash: [] },
        });
        expect(nodes[0].type).toBe("Rect");
        expect(nodes[0].config).toMatchObject({
            x: 26,
            y: 36,
            width: 8,
            height: 8,
            stroke: "#ef4444",
        });
    });

    it("maps a diamond to a closed 4-point Line", () => {
        const { nodes } = build({ ...base, shape: "diamond" });
        expect(nodes[0].type).toBe("Line");
        expect(nodes[0].config).toMatchObject({
            points: [30, 36, 34, 40, 30, 44, 26, 40],
            closed: true,
        });
    });

    it("maps triangle-up and triangle-down to closed 3-point Lines", () => {
        const up = build({ ...base, shape: "triangle-up" });
        expect(up.nodes[0].config.points).toEqual([30, 36, 34, 44, 26, 44]);
        const down = build({ ...base, shape: "triangle-down" });
        expect(down.nodes[0].config.points).toEqual([30, 44, 34, 36, 26, 36]);
    });

    it("skips a marker with non-finite coordinates or size", () => {
        expect(build({ ...base, x: Number.NaN, shape: "square" }).nodes).toHaveLength(0);
        expect(build({ ...base, size: Number.NaN, shape: "square" }).nodes).toHaveLength(0);
    });
});

describe("shapeGlyphNodes — the three stroked glyphs (cross / xcross / flag)", () => {
    const base: Omit<ShapeGlyphArgs, "shape"> = {
        x: 30,
        y: 40,
        size: 8,
        stroke: { stroke: "#f0f", strokeWidth: 1 },
    };
    function glyph(shape: ShapeGlyphArgs["shape"]): MockKonva["roots"] {
        const konva = new MockKonva();
        shapeGlyphNodes(konva, { ...base, shape });
        return konva.roots;
    }

    it("maps a cross to two open stroked Lines (plus + bar, never joined)", () => {
        const nodes = glyph("cross");
        expect(nodes).toHaveLength(2);
        // Horizontal then vertical stroke through the anchor; both OPEN
        // (`closed` unset) so the strokes do not join into a box.
        expect(nodes[0].config).toMatchObject({ points: [26, 40, 34, 40], stroke: "#f0f" });
        expect(nodes[1].config).toMatchObject({ points: [30, 36, 30, 44], stroke: "#f0f" });
        expect(nodes[0].config.closed).toBeUndefined();
    });

    it("maps an xcross to two crossing diagonal Lines", () => {
        const nodes = glyph("xcross");
        expect(nodes).toHaveLength(2);
        expect(nodes[0].config.points).toEqual([26, 36, 34, 44]);
        expect(nodes[1].config.points).toEqual([34, 36, 26, 44]);
    });

    it("maps a flag to one open stroked polyline (staff + pennant)", () => {
        const nodes = glyph("flag");
        expect(nodes).toHaveLength(1);
        expect(nodes[0].config).toMatchObject({
            points: [26, 44, 26, 36, 34, 38, 26, 40],
            stroke: "#f0f",
        });
        expect(nodes[0].config.closed).toBeUndefined();
    });

    it("skips any glyph with a non-finite anchor or size", () => {
        const konva = new MockKonva();
        expect(shapeGlyphNodes(konva, { ...base, x: Number.NaN, shape: "cross" })).toHaveLength(0);
        expect(shapeGlyphNodes(konva, { ...base, size: Number.NaN, shape: "flag" })).toHaveLength(
            0,
        );
    });

    it("defaults the stroke / fill fragments to empty when omitted", () => {
        // No stroke + no fill ⇒ the node carries neither colour value (the
        // `?? {}` defaults), so the helper never throws on a bare args bag.
        const konva = new MockKonva();
        shapeGlyphNodes(konva, { x: 0, y: 0, size: 4, shape: "square" });
        expect(konva.roots[0].config.stroke).toBeUndefined();
        expect(konva.roots[0].config.fill).toBeUndefined();
    });
});

describe("primitiveToNode — alpha baking edge cases", () => {
    it("leaves a non-#rrggbb fill colour unchanged", () => {
        const { nodes } = build({
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ],
            closed: true,
            fill: { color: "rgba(0,0,0,0.2)", alpha: 0.5 },
        });
        expect(nodes[0].config.fill).toBe("rgba(0,0,0,0.2)");
    });

    it("clamps an out-of-range fill alpha", () => {
        const { nodes } = build({
            kind: "polyline",
            points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ],
            closed: true,
            fill: { color: "#101010", alpha: 2 },
        });
        // alpha > 1 clamps to 1 → "ff".
        expect(nodes[0].config.fill).toBe("#101010ff");
    });
});

describe("resolvePaintColor — line-family colorValue 3-state", () => {
    it("falls back to the static color when colorValue is omitted", () => {
        expect(resolvePaintColor(undefined, "#26a69a", "#888")).toBe("#26a69a");
    });

    it("falls back to plotDefault when the static color is null", () => {
        expect(resolvePaintColor(undefined, null, "#888")).toBe("#888");
    });

    it("overrides with a present colorValue", () => {
        expect(resolvePaintColor("#ef5350", "#26a69a", "#888")).toBe("#ef5350");
    });

    it("returns null for an explicit colorValue:null gap", () => {
        expect(resolvePaintColor(null, "#26a69a", "#888")).toBeNull();
    });
});

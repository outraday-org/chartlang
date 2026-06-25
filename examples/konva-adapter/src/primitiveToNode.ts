// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    DrawPrimitive,
    FillStyle,
    Point2,
    StrokeStyle,
} from "@invinite-org/chartlang-adapter-kit";

import type { KonvaNamespace, KonvaNode } from "./types.js";

// A full circle is `|end - start| >= 2π`; below that the arc is a partial
// sweep that needs the SVG-path form (so it draws just the curve + chord,
// not Konva's wedge).
const TWO_PI = Math.PI * 2;

// Heuristic glyph width used to size a text primitive's optional backing
// `Rect` — the headless mock has no `measureText`, so the box is derived
// from the font pixel size × character count (≈ 0.6 em per glyph, a common
// average-advance ratio) plus a small horizontal pad. Document-only: the
// real Konva `Text` measures itself; this only fixes the backing rect's
// dimensions for the headless node tree.
const GLYPH_WIDTH_RATIO = 0.6;
const TEXT_BG_PAD_X = 4;
const TEXT_BG_PAD_Y = 2;

/**
 * Bake an `alpha ∈ [0, 1]` into a hex colour as the `#rrggbbaa` channel —
 * Konva accepts the 8-digit form, so a primitive's `fill`/`stroke` alpha
 * lands in the colour string the node-tree hash projection reads (rather
 * than a node-level `opacity` the projection would miss). A colour that
 * already carries an alpha channel, or is not a plain `#rrggbb` (e.g. a
 * named colour or an `rgba(…)` string), is returned UNCHANGED — appending
 * two more hex digits would corrupt it. This is the single guarded
 * implementation shared by the primitive sink AND the series builders
 * (`filled-band` / `area` fills) in `createKonvaAdapter.ts`.
 *
 * @since 1.4
 * @stable
 * @example
 *     withAlpha("#3b82f6", 0.5); // "#3b82f680"
 *     withAlpha("red", 0.5); // "red" (non-6-hex passes through)
 */
export function withAlpha(color: string, alpha: number): string {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
    const clamped = Math.max(0, Math.min(1, alpha));
    const byte = Math.round(clamped * 255);
    return `${color}${byte.toString(16).padStart(2, "0")}`;
}

/**
 * Resolve the per-bar paint colour for a line-family plot point under the
 * normative `PlotEmission.colorValue` 3-state precedence contract (see
 * `@invinite-org/chartlang-adapter-kit` `PlotEmission.colorValue`), mirroring
 * the canvas2d reference's `render/colorValue.ts`:
 *
 * - **`colorValue` omitted (`undefined`)** ⇒ the static colour — the point's
 *   `staticColor` (the top-level `PlotEmission.color`) falling back to
 *   `plotDefault` when that is `null`. Byte-identical to the pre-feature render.
 * - **`colorValue` present (a string)** ⇒ it OVERRIDES the static colour for
 *   this bar's segment.
 * - **`colorValue === null`** ⇒ an explicit "no colour this bar" gap; the
 *   caller paints nothing for that bar (distinct from omitted).
 *
 * Konva is forbidden from importing another example's `src/`, so this is the
 * konva-local copy of the shared contract (the precedence is shared, the code
 * is not — same posture as {@link withAlpha}). It is the ONE 3-state helper
 * the line / step-line / area / histogram builders reuse — do NOT re-inline.
 *
 * @since 1.7
 * @stable
 * @example
 *     resolvePaintColor(undefined, "#26a69a", "#888"); // ⇒ "#26a69a"
 *     resolvePaintColor(undefined, null, "#888"); // ⇒ "#888"
 *     resolvePaintColor("#ef5350", "#26a69a", "#888"); // ⇒ "#ef5350"
 *     resolvePaintColor(null, "#26a69a", "#888"); // ⇒ null (gap)
 */
export function resolvePaintColor(
    colorValue: string | null | undefined,
    staticColor: string | null,
    plotDefault: string,
): string | null {
    if (colorValue === undefined) return staticColor ?? plotDefault;
    return colorValue;
}

// Resolve a stroke's colour with its optional alpha baked in.
function strokeColor(stroke: StrokeStyle): string {
    return stroke.alpha === undefined ? stroke.color : withAlpha(stroke.color, stroke.alpha);
}

// Resolve a fill's colour with its alpha baked in.
function fillColor(fill: FillStyle): string {
    return withAlpha(fill.color, fill.alpha);
}

// A primitive vertex is renderable only when both coordinates are finite —
// a NaN anchor (e.g. a degenerate drawing) yields no node rather than a
// poisoned path. This diverges from the canvas painter, which would emit a
// `moveTo(NaN, …)` no-op; documented in the adapter's CLAUDE.md.
function isFinitePoint(p: Point2): boolean {
    return Number.isFinite(p.x) && Number.isFinite(p.y);
}

function flattenPoints(points: ReadonlyArray<Point2>): number[] {
    const out: number[] = [];
    for (const p of points) out.push(p.x, p.y);
    return out;
}

// Parse the IR `text.font` (always `"<px>px <family>"`, e.g.
// `"12px sans-serif"`) into Konva's separate `fontSize` / `fontFamily`.
// A malformed string falls back to 12px sans-serif so the node is still
// constructable.
export function parseFont(font: string): { fontSize: number; fontFamily: string } {
    const match = /^\s*(\d+(?:\.\d+)?)px\s+(.+?)\s*$/.exec(font);
    if (match === null) return { fontSize: 12, fontFamily: "sans-serif" };
    return { fontSize: Number(match[1]), fontFamily: match[2] };
}

function polylineNodes(
    K: KonvaNamespace,
    p: Extract<DrawPrimitive, { kind: "polyline" }>,
): KonvaNode[] {
    const finite = p.points.filter(isFinitePoint);
    if (finite.length === 0) return [];
    return [
        new K.Line({
            points: flattenPoints(finite),
            closed: p.closed,
            ...(p.stroke !== undefined
                ? { stroke: strokeColor(p.stroke), strokeWidth: p.stroke.width }
                : {}),
            ...(p.stroke !== undefined && p.stroke.dash.length > 0 ? { dash: p.stroke.dash } : {}),
            ...(p.fill !== undefined ? { fill: fillColor(p.fill) } : {}),
        }),
    ];
}

function arcNodes(K: KonvaNamespace, p: Extract<DrawPrimitive, { kind: "arc" }>): KonvaNode[] {
    if (!Number.isFinite(p.cx) || !Number.isFinite(p.cy) || !Number.isFinite(p.r)) return [];
    const sweep = p.end - p.start;
    if (Math.abs(sweep) >= TWO_PI) {
        // Full circle → a thin Konva ring (`innerRadius === outerRadius`),
        // which renders the closed curve with no radial wedge lines.
        return [
            new K.Arc({
                x: p.cx,
                y: p.cy,
                innerRadius: p.r,
                outerRadius: p.r,
                angle: 360,
                rotation: 0,
                ...(p.stroke !== undefined
                    ? { stroke: strokeColor(p.stroke), strokeWidth: p.stroke.width }
                    : {}),
                ...(p.stroke !== undefined && p.stroke.dash.length > 0
                    ? { dash: p.stroke.dash }
                    : {}),
                ...(p.fill !== undefined ? { fill: fillColor(p.fill) } : {}),
            }),
        ];
    }
    // Partial sweep → an SVG path: move to the start point, draw the arc,
    // then `Z` closes the chord back to the start — exactly the canvas
    // `arc(…) + closePath()` shape Konva's wedge-drawing `Arc` cannot match.
    const startX = p.cx + p.r * Math.cos(p.start);
    const startY = p.cy + p.r * Math.sin(p.start);
    const endX = p.cx + p.r * Math.cos(p.end);
    const endY = p.cy + p.r * Math.sin(p.end);
    const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
    const clockwise = sweep >= 0 ? 1 : 0;
    const data = `M ${startX} ${startY} A ${p.r} ${p.r} 0 ${largeArc} ${clockwise} ${endX} ${endY} Z`;
    return [
        new K.Path({
            data,
            ...(p.stroke !== undefined
                ? { stroke: strokeColor(p.stroke), strokeWidth: p.stroke.width }
                : {}),
            ...(p.stroke !== undefined && p.stroke.dash.length > 0 ? { dash: p.stroke.dash } : {}),
            ...(p.fill !== undefined ? { fill: fillColor(p.fill) } : {}),
        }),
    ];
}

function textNodes(K: KonvaNamespace, p: Extract<DrawPrimitive, { kind: "text" }>): KonvaNode[] {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return [];
    const { fontSize, fontFamily } = parseFont(p.font);
    // Konva's `Text` honours `align` / `verticalAlign` ONLY within an explicit
    // `width` / `height` box; with none set it draws from `(x, y)` as the
    // TOP-LEFT corner, ignoring them — so a `right`/`center` cell value (and
    // every `middle`/`bottom` baseline) would overflow its cell. The canvas
    // sink instead anchors `fillText` by `textAlign` / `textBaseline`. To
    // reproduce that, bake the anchor into the node's `(x, y)`: shift left by
    // the (heuristic) text width for `center`/`right`, up by the font height
    // for `middle`/`bottom`. The width heuristic is the SAME `0.6` em the
    // table column layout uses, so a right-aligned cell value lands flush at
    // the cell's right padding.
    const glyphWidth = p.text.length * fontSize * GLYPH_WIDTH_RATIO;
    const anchorX =
        p.align === "center" ? p.x - glyphWidth / 2 : p.align === "right" ? p.x - glyphWidth : p.x;
    const anchorY =
        p.baseline === "middle"
            ? p.y - fontSize / 2
            : p.baseline === "bottom"
              ? p.y - fontSize
              : p.y;
    const nodes: KonvaNode[] = [];
    // A `bgColor` becomes a backing `Rect` painted BEFORE the glyph — a
    // deliberate Konva enrichment (the canvas painter drops `bgColor`
    // because the structural `RenderCtx` cannot measure text). The box is
    // sized from the font px × glyph count heuristic and anchored to the
    // resolved top-left so it tracks the aligned glyph.
    if (p.bgColor !== undefined) {
        const width = glyphWidth + TEXT_BG_PAD_X * 2;
        const height = fontSize + TEXT_BG_PAD_Y * 2;
        nodes.push(
            new K.Rect({
                x: anchorX - TEXT_BG_PAD_X,
                y: anchorY - TEXT_BG_PAD_Y,
                width,
                height,
                fill: p.bgColor,
            }),
        );
    }
    nodes.push(
        new K.Text({
            x: anchorX,
            y: anchorY,
            text: p.text,
            fontSize,
            fontFamily,
            fill: p.color,
            // `align` / `baseline` are still forwarded (Konva ignores them
            // without a width/height box, but they keep the node self-describing
            // and would compose correctly if a box is ever added). The visual
            // anchor is the baked `(anchorX, anchorY)` above.
            align: p.align,
            verticalAlign: p.baseline,
        }),
    );
    return nodes;
}

/**
 * The full glyph inventory a Phase-5 `shape` plot can request — a
 * superset of the IR {@link DrawPrimitive} `marker` shape union: the
 * five filled marker shapes plus the three stroked glyphs
 * (`cross` / `xcross` / `flag`).
 *
 * @since 1.8
 * @stable
 * @example
 *     const glyph: ShapeGlyph = "cross";
 *     void glyph;
 */
export type ShapeGlyph =
    | "circle"
    | "square"
    | "diamond"
    | "triangle-up"
    | "triangle-down"
    | "cross"
    | "xcross"
    | "flag";

/**
 * Konva attr fragments + geometry inputs for {@link shapeGlyphNodes}. The
 * caller pre-resolves the `stroke` / `fill` Konva config fragments (alpha
 * already baked into the colour string) so the helper stays agnostic to
 * where the colour came from — a drawing primitive's
 * {@link StrokeStyle} / {@link FillStyle} or a plot's single `color`.
 *
 * @since 1.8
 * @stable
 * @example
 *     const args: ShapeGlyphArgs = { x: 10, y: 20, size: 8, shape: "square", fill: { fill: "#3b82f6" } };
 *     void args;
 */
export type ShapeGlyphArgs = {
    readonly x: number;
    readonly y: number;
    readonly size: number;
    readonly shape: ShapeGlyph;
    readonly stroke?: { stroke: string; strokeWidth: number };
    readonly fill?: { fill: string };
};

/**
 * Build the Konva node(s) for one glyph, shared by the `marker` drawing
 * primitive AND the `marker` / `shape` plot kinds so all eight shapes
 * have ONE geometry source. The five filled shapes
 * (`circle` / `square` / `diamond` / `triangle-up` / `triangle-down`)
 * map to a ring `Arc` / `Rect` / closed `Line`; the three stroked glyphs
 * (`cross` / `xcross` / `flag`) map to open stroked `Line`s, matching the
 * canvas2d reference (`render/shape.ts`). Non-finite anchor or size ⇒ no
 * node.
 *
 * @since 1.8
 * @stable
 * @example
 *     import { MockKonva } from "chartlang-example-konva-adapter/testing";
 *     const K = new MockKonva();
 *     const nodes = shapeGlyphNodes(K, { x: 0, y: 0, size: 6, shape: "circle", fill: { fill: "#fff" } });
 *     // nodes.length === 1
 *     void nodes;
 */
export function shapeGlyphNodes(K: KonvaNamespace, args: ShapeGlyphArgs): KonvaNode[] {
    if (!Number.isFinite(args.x) || !Number.isFinite(args.y) || !Number.isFinite(args.size)) {
        return [];
    }
    const { x, y, size } = args;
    const half = size / 2;
    const stroke = args.stroke ?? {};
    const fill = args.fill ?? {};
    switch (args.shape) {
        case "circle":
            // A circle glyph is a full Konva ring centred on the anchor.
            return [
                new K.Arc({
                    x,
                    y,
                    innerRadius: half,
                    outerRadius: half,
                    angle: 360,
                    rotation: 0,
                    ...stroke,
                    ...fill,
                }),
            ];
        case "square":
            return [
                new K.Rect({
                    x: x - half,
                    y: y - half,
                    width: size,
                    height: size,
                    ...stroke,
                    ...fill,
                }),
            ];
        case "diamond":
            return [
                new K.Line({
                    points: [x, y - half, x + half, y, x, y + half, x - half, y],
                    closed: true,
                    ...stroke,
                    ...fill,
                }),
            ];
        case "triangle-up":
            return [
                new K.Line({
                    points: [x, y - half, x + half, y + half, x - half, y + half],
                    closed: true,
                    ...stroke,
                    ...fill,
                }),
            ];
        case "triangle-down":
            return [
                new K.Line({
                    points: [x, y + half, x + half, y - half, x - half, y - half],
                    closed: true,
                    ...stroke,
                    ...fill,
                }),
            ];
        case "cross":
            // A plus sign: one horizontal + one vertical stroke. Two open
            // `Line`s (a single `Line` would join the strokes' endpoints).
            return [
                new K.Line({ points: [x - half, y, x + half, y], ...stroke }),
                new K.Line({ points: [x, y - half, x, y + half], ...stroke }),
            ];
        case "xcross":
            // An X: two diagonal strokes.
            return [
                new K.Line({ points: [x - half, y - half, x + half, y + half], ...stroke }),
                new K.Line({ points: [x + half, y - half, x - half, y + half], ...stroke }),
            ];
        case "flag":
            // A pennant: a vertical staff with a triangular flag, one open
            // stroked polyline (mirrors canvas2d's `drawShape` "flag").
            return [
                new K.Line({
                    points: [
                        x - half,
                        y + half,
                        x - half,
                        y - half,
                        x + half,
                        y - half / 2,
                        x - half,
                        y,
                    ],
                    ...stroke,
                }),
            ];
    }
}

function markerNodes(
    K: KonvaNamespace,
    p: Extract<DrawPrimitive, { kind: "marker" }>,
): KonvaNode[] {
    // The IR `marker` primitive's 5-shape union is a subset of
    // `ShapeGlyph`, so delegate to the shared helper after resolving the
    // primitive's `StrokeStyle` / `FillStyle` into Konva config fragments.
    return shapeGlyphNodes(K, {
        x: p.x,
        y: p.y,
        size: p.size,
        shape: p.shape,
        ...(p.stroke !== undefined
            ? { stroke: { stroke: strokeColor(p.stroke), strokeWidth: p.stroke.width } }
            : {}),
        ...(p.fill !== undefined ? { fill: { fill: fillColor(p.fill) } } : {}),
    });
}

/**
 * Map one renderer-agnostic {@link DrawPrimitive} to the Konva node(s)
 * that draw it on a scene-graph layer. Konva is retained-mode (nodes,
 * not an immediate-mode `ctx`), so this is the Konva sink that mirrors the
 * canvas-family `paintPrimitive`. Most primitives map to a single node;
 * a `text` carrying a `bgColor` maps to a backing `Rect` plus the glyph,
 * so the return type is a `ReadonlyArray<KonvaNode>` the caller adds in
 * order.
 *
 * Coordinates are already pixels (the IR {@link decomposeDrawing}
 * produces pixel-space primitives), so no projection happens here. A
 * primitive whose anchors are all non-finite yields no node (a documented
 * divergence from the canvas painter's `NaN` no-op).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { MockKonva } from "chartlang-example-konva-adapter/testing";
 *     const K = new MockKonva();
 *     const nodes = primitiveToNode(K, {
 *         kind: "polyline",
 *         points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
 *         closed: false,
 *         stroke: { color: "#3b82f6", width: 1, dash: [] },
 *     });
 *     // nodes.length === 1
 *     void nodes;
 */
export function primitiveToNode(K: KonvaNamespace, p: DrawPrimitive): ReadonlyArray<KonvaNode> {
    switch (p.kind) {
        case "polyline":
            return polylineNodes(K, p);
        case "arc":
            return arcNodes(K, p);
        case "text":
            return textNodes(K, p);
        case "marker":
            return markerNodes(K, p);
    }
}

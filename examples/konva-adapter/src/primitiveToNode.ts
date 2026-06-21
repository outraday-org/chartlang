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
    const nodes: KonvaNode[] = [];
    // A `bgColor` becomes a backing `Rect` painted BEFORE the glyph — a
    // deliberate Konva enrichment (the canvas painter drops `bgColor`
    // because the structural `RenderCtx` cannot measure text). The box is
    // sized from the font px × glyph count heuristic.
    if (p.bgColor !== undefined) {
        const width = p.text.length * fontSize * GLYPH_WIDTH_RATIO + TEXT_BG_PAD_X * 2;
        const height = fontSize + TEXT_BG_PAD_Y * 2;
        nodes.push(
            new K.Rect({
                x: p.x - TEXT_BG_PAD_X,
                y: p.y - TEXT_BG_PAD_Y,
                width,
                height,
                fill: p.bgColor,
            }),
        );
    }
    nodes.push(
        new K.Text({
            x: p.x,
            y: p.y,
            text: p.text,
            fontSize,
            fontFamily,
            fill: p.color,
            // The IR `align` / `baseline` map straight to Konva's `align` /
            // `verticalAlign` (same vocabulary as the canvas `textAlign` /
            // `textBaseline`), so the node-tree hash projection reads them
            // consistently with the canvas-family adapters.
            align: p.align,
            verticalAlign: p.baseline,
        }),
    );
    return nodes;
}

function markerNodes(
    K: KonvaNamespace,
    p: Extract<DrawPrimitive, { kind: "marker" }>,
): KonvaNode[] {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.size)) return [];
    const half = p.size / 2;
    const stroke =
        p.stroke !== undefined
            ? { stroke: strokeColor(p.stroke), strokeWidth: p.stroke.width }
            : {};
    const fill = p.fill !== undefined ? { fill: fillColor(p.fill) } : {};
    switch (p.shape) {
        case "circle":
            // A circle glyph is a full Konva ring centred on the anchor.
            return [
                new K.Arc({
                    x: p.x,
                    y: p.y,
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
                    x: p.x - half,
                    y: p.y - half,
                    width: p.size,
                    height: p.size,
                    ...stroke,
                    ...fill,
                }),
            ];
        case "diamond":
            return [
                new K.Line({
                    points: [p.x, p.y - half, p.x + half, p.y, p.x, p.y + half, p.x - half, p.y],
                    closed: true,
                    ...stroke,
                    ...fill,
                }),
            ];
        case "triangle-up":
            return [
                new K.Line({
                    points: [p.x, p.y - half, p.x + half, p.y + half, p.x - half, p.y + half],
                    closed: true,
                    ...stroke,
                    ...fill,
                }),
            ];
        case "triangle-down":
            return [
                new K.Line({
                    points: [p.x, p.y + half, p.x + half, p.y - half, p.x - half, p.y - half],
                    closed: true,
                    ...stroke,
                    ...fill,
                }),
            ];
    }
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

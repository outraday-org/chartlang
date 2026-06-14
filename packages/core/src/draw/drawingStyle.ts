// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Color, LineStyle } from "../types.js";

/**
 * Line / ray / horizontal-line / vertical-line / channel-edge stroke
 * style. `extendLeft` / `extendRight` collapse the invinite `ray` and
 * `extended-line` tools into a single `line` kind.
 *
 * @formula  N/A — style bag, no math
 * @anchors  N/A — style fields only
 * @since 0.3
 * @stable
 * @example
 *     const s: LineDrawStyle = { color: "#3b82f6", lineWidth: 2, lineStyle: "solid" };
 *     void s;
 */
export type LineDrawStyle = {
    readonly color?: Color;
    readonly lineWidth?: number;
    readonly lineStyle?: LineStyle;
    readonly extendLeft?: boolean;
    readonly extendRight?: boolean;
};

/**
 * Filled-shape style — rectangles, triangles, ellipses, circles. `fill`
 * is paired with `fillAlpha` for the transparent overlay; `stroke` +
 * `lineStyle` paint the outline.
 *
 * @formula  N/A — style bag, no math
 * @anchors  N/A — style fields only
 * @since 0.3
 * @stable
 * @example
 *     const s: ShapeStyle = {
 *         stroke: "#3b82f6",
 *         fill: "#dbeafe",
 *         fillAlpha: 0.4,
 *         lineWidth: 1,
 *         lineStyle: "solid",
 *     };
 *     void s;
 */
export type ShapeStyle = {
    readonly stroke?: Color;
    readonly fill?: Color;
    readonly lineWidth?: number;
    readonly lineStyle?: LineStyle;
    readonly fillAlpha?: number;
};

/**
 * Highlighter style — single colour with a fixed alpha. Used by the
 * `highlighter` freehand kind.
 *
 * @formula  N/A — style bag, no math
 * @anchors  N/A — style fields only
 * @since 0.3
 * @stable
 * @example
 *     const s: HighlighterStyle = { color: "#facc15", alpha: 0.3 };
 *     void s;
 */
export type HighlighterStyle = {
    readonly color: Color;
    readonly alpha: number;
};

/**
 * Brush stroke style — stroke + fill pair. Used by the `brush`
 * freehand kind.
 *
 * @formula  N/A — style bag, no math
 * @anchors  N/A — style fields only
 * @since 0.3
 * @stable
 * @example
 *     const s: BrushStyle = { stroke: "#000000", fill: "#ffffff" };
 *     void s;
 */
export type BrushStyle = {
    readonly stroke: Color;
    readonly fill: Color;
};

/**
 * Text annotation style. Used by the `text` annotation kind and as
 * the base for `marker` / `arrow-mark-up` / `arrow-mark-down` labels.
 *
 * @formula  N/A — style bag, no math
 * @anchors  N/A — style fields only
 * @since 0.3
 * @stable
 * @example
 *     const t: TextOpts = {
 *         color: "#1e293b",
 *         size: "normal",
 *         halign: "center",
 *         valign: "middle",
 *         bgColor: "#fef3c7",
 *     };
 *     void t;
 */
export type TextOpts = {
    readonly color?: Color;
    readonly size?: "tiny" | "small" | "normal" | "large" | "huge";
    readonly halign?: "left" | "center" | "right";
    readonly valign?: "top" | "middle" | "bottom";
    readonly bgColor?: Color;
};

/**
 * Arrow annotation style — a `LineDrawStyle` plus an optional label.
 *
 * @formula  N/A — style bag, no math
 * @anchors  N/A — style fields only
 * @since 0.3
 * @stable
 * @example
 *     const a: ArrowOpts = { color: "#dc2626", lineWidth: 2, label: "Sell" };
 *     void a;
 */
export type ArrowOpts = LineDrawStyle & {
    readonly label?: string;
};

/**
 * Arrow-marker style — used by `arrow-marker` / `arrow-mark-up` /
 * `arrow-mark-down` annotations. Compact glyph + optional one-line
 * text.
 *
 * @formula  N/A — style bag, no math
 * @anchors  N/A — style fields only
 * @since 0.3
 * @stable
 * @example
 *     const m: ArrowMarkerOpts = { color: "#10b981", text: "Long" };
 *     void m;
 */
export type ArrowMarkerOpts = {
    readonly color?: Color;
    readonly text?: string;
};

/**
 * Path style — open or closed polyline of arbitrary anchor count.
 *
 * @formula  N/A — style bag, no math
 * @anchors  N/A — style fields only
 * @since 0.3
 * @stable
 * @example
 *     const p: PathOpts = { color: "#3b82f6", lineWidth: 1, closed: true };
 *     void p;
 */
export type PathOpts = LineDrawStyle & {
    readonly closed?: boolean;
};

/**
 * Fibonacci-family style. `levels` defaults to the canonical
 * 0.236 / 0.382 / 0.5 / 0.618 / 0.786 / 1.0 / 1.272 / 1.618 / 2.618 /
 * 4.236 array when omitted; `showLabels` toggles per-level text.
 * `extendLeft` / `extendRight` apply to the level lines (mirrors the
 * `LineDrawStyle` collapse for parity).
 *
 * @formula  N/A — style bag, no math
 * @anchors  N/A — style fields only
 * @since 0.3
 * @stable
 * @example
 *     const f: FibOpts = {
 *         levels: [0.382, 0.5, 0.618],
 *         showLabels: true,
 *         color: "#facc15",
 *         extendRight: true,
 *     };
 *     void f;
 */
export type FibOpts = {
    readonly levels?: ReadonlyArray<number>;
    readonly showLabels?: boolean;
    readonly color?: Color;
    readonly extendLeft?: boolean;
    readonly extendRight?: boolean;
};

/**
 * Regression-trend style — a least-squares fit through a price series
 * with optional ±N·σ bands. `source` picks the OHLC derived series.
 *
 * @formula  N/A — style bag, no math
 * @anchors  N/A — style fields only
 * @since 0.3
 * @stable
 * @example
 *     const r: RegressionTrendOpts = {
 *         source: "close",
 *         stdevMultiplier: 2,
 *         showUpperBand: true,
 *         showLowerBand: true,
 *         color: "#3b82f6",
 *     };
 *     void r;
 */
export type RegressionTrendOpts = {
    readonly source?: "close" | "open" | "high" | "low" | "hl2" | "hlc3" | "ohlc4" | "hlcc4";
    readonly stdevMultiplier?: number;
    readonly showUpperBand?: boolean;
    readonly showLowerBand?: boolean;
    readonly color?: Color;
};

/**
 * Frame container style — the labelled rectangle that groups child
 * drawings visually. The label appears in the top-left of the frame
 * unless the adapter chooses otherwise.
 *
 * @formula  N/A — style bag, no math
 * @anchors  N/A — style fields only
 * @since 0.3
 * @stable
 * @example
 *     const f: FrameOpts = { label: "Trade idea", bgColor: "#f1f5f9" };
 *     void f;
 */
export type FrameOpts = {
    readonly label?: string;
    readonly bgColor?: Color;
};

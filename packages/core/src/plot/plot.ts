// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Color, LineStyle, Series } from "../types.js";

/**
 * Rendered-shape discriminator for `plot` emissions reaching the adapter.
 * The full 0.5 inventory is `line`, `step-line`, `horizontal-line`,
 * `histogram`, `area`, `filled-band`, `label`, `marker`,
 * `shape`, `character`, `arrow`, `candle-override`, `bar-override`,
 * `bg-color`, `bar-color`, and `horizontal-histogram`. Every expansion is
 * additive — the `apiVersion: 1` script header stays unchanged.
 *
 * Typical Phase-2 consumers:
 *
 * - `histogram` → volume bars, MACD histogram, momentum-style oscillators.
 * - `area` → filled region under a polyline (BB midline, regression).
 * - `filled-band` → Bollinger / Keltner / Donchian / Ichimoku envelopes.
 * - `label` → text annotations at a world-space anchor (fractal, pivot).
 * - `marker` → discrete glyph (circle / triangle / square / diamond) for
 *   fractals / divergence / supertrend flips.
 *
 * @since 0.1
 * @example
 *     const k: PlotKind = "line";
 *     const histogram: PlotKind = "histogram";
 *     const shape: PlotKind = "shape";
 *     void k; void histogram; void shape;
 */
export type PlotKind =
    | "line"
    | "step-line"
    | "horizontal-line"
    | "histogram"
    | "area"
    | "filled-band"
    | "label"
    | "marker"
    | "shape"
    | "character"
    | "arrow"
    | "candle-override"
    | "bar-override"
    | "bg-color"
    | "bar-color"
    | "horizontal-histogram";

/**
 * Marker glyphs shared by Phase 2 `marker` and Phase 5 `shape` plot styles.
 *
 * @since 0.5
 * @stable
 * @example
 *     const shape: PlotGlyphShape = "circle";
 *     void shape;
 */
export type PlotGlyphShape = "circle" | "triangle-up" | "triangle-down" | "square" | "diamond";

/**
 * Full glyph inventory for Phase 5 `shape` plot styles.
 *
 * @since 0.5
 * @stable
 * @example
 *     const shape: PlotShapeGlyph = "flag";
 *     void shape;
 */
export type PlotShapeGlyph = PlotGlyphShape | "cross" | "xcross" | "flag";

/**
 * Vertical anchoring mode for glyph-like Phase 5 plot styles.
 *
 * @since 0.5
 * @stable
 * @example
 *     const location: PlotLocation = "above";
 *     void location;
 */
export type PlotLocation = "above" | "below" | "absolute";

/**
 * Single row in a Phase 5 horizontal-histogram plot emission.
 *
 * @since 0.5
 * @stable
 * @example
 *     const bucket: HorizontalHistogramBucket = { price: 100, volume: 25 };
 *     void bucket;
 */
export type HorizontalHistogramBucket = Readonly<{
    readonly price: number;
    readonly volume: number;
    readonly color?: Color;
}>;

/**
 * Script-author selectable plot style. The runtime maps this to the
 * adapter-kit's wire `PlotStyle` discriminated union and fills in defaults
 * from sibling {@link PlotOpts} fields (`lineWidth` / `lineStyle`) for
 * line-like styles.
 *
 * `histogram.baseline` defaults to `0` when omitted.
 *
 * @formula  N/A — script-facing style input
 * @since 0.2
 * @stable
 * @example
 *     const lineStyle: PlotOptsStyle = { kind: "line" };
 *     const histStyle: PlotOptsStyle = { kind: "histogram", baseline: 0 };
 *     void lineStyle; void histStyle;
 */
export type PlotOptsStyle =
    | { readonly kind: "line" }
    | { readonly kind: "step-line" }
    | { readonly kind: "horizontal-line" }
    | { readonly kind: "histogram"; readonly baseline?: number }
    | {
          readonly kind: "marker";
          readonly shape: PlotGlyphShape;
          readonly size: number;
      }
    /**
     * Glyph at world-anchor — Pine's `plotshape`. Location selects vertical
     * anchoring; `size` is in CSS pixels.
     *
     * @since 0.5
     * @stable
     * @example
     *     plot(bar.close, { style: { kind: "shape", shape: "triangle-up", size: 8, location: "below" } });
     */
    | {
          readonly kind: "shape";
          readonly shape: PlotShapeGlyph;
          readonly size: number;
          readonly location?: PlotLocation;
      }
    /**
     * Text glyph at world-anchor — Pine's `plotchar`. `char` may be any
     * non-empty UTF-8 string; `size` is in CSS pixels.
     *
     * @since 0.5
     * @stable
     * @example
     *     plot(bar.close, { style: { kind: "character", char: "▲", size: 12, location: "above" } });
     */
    | {
          readonly kind: "character";
          readonly char: string;
          readonly size: number;
          readonly location?: PlotLocation;
      }
    /**
     * Directional marker at world-anchor — Pine's `plotarrow`.
     *
     * @since 0.5
     * @stable
     * @example
     *     plot(bar.low, { style: { kind: "arrow", direction: "up", size: 10 } });
     */
    | { readonly kind: "arrow"; readonly direction: "up" | "down"; readonly size: number }
    /**
     * Candle body color override — Pine's `plotcandle`.
     *
     * @since 0.5
     * @stable
     * @example
     *     plot(bar.close, { style: { kind: "candle-override", bull: "#26a69a", bear: "#ef5350" } });
     */
    | {
          readonly kind: "candle-override";
          readonly bull: Color;
          readonly bear: Color;
          readonly doji?: Color;
      }
    /**
     * OHLC bar outline override — Pine's `plotbar`.
     *
     * @since 0.5
     * @stable
     * @example
     *     plot(bar.close, { style: { kind: "bar-override", color: "#f59e0b" } });
     */
    | { readonly kind: "bar-override"; readonly color: Color }
    /**
     * Pane background color band — Pine's `bgcolor`.
     *
     * @since 0.5
     * @stable
     * @example
     *     plot(bar.close, { style: { kind: "bg-color", color: "#1d4ed8", transp: 80 } });
     */
    | { readonly kind: "bg-color"; readonly color: Color; readonly transp?: number }
    /**
     * Main candle/bar tint — Pine's `barcolor`.
     *
     * @since 0.5
     * @stable
     * @example
     *     plot(bar.close, { style: { kind: "bar-color", color: "#a855f7" } });
     */
    | { readonly kind: "bar-color"; readonly color: Color }
    /**
     * Right-edge volume-profile bars keyed by price bucket.
     *
     * @since 0.5
     * @stable
     * @example
     *     plot(bar.close, { style: { kind: "horizontal-histogram", buckets: [{ price: bar.close, volume: bar.volume }] } });
     */
    | {
          readonly kind: "horizontal-histogram";
          readonly buckets: ReadonlyArray<HorizontalHistogramBucket>;
      };

/**
 * Styling options accepted by `plot(...)`. `pane: "overlay"` (the default) is
 * the only pane the Phase-1 canvas2d adapter renders — `"new"` and named
 * panes are reserved for Phase 2+. `style` (Phase 2) lets the script pick
 * a non-line {@link PlotOptsStyle} — defaults to `{ kind: "line" }`.
 *
 * @since 0.1
 * @example
 *     const opts: PlotOpts = {
 *         color: "#3b82f6",
 *         title: "EMA(20)",
 *         lineWidth: 2,
 *         lineStyle: "solid",
 *         pane: "overlay",
 *         style: { kind: "line" },
 *     };
 */
export type PlotOpts = Readonly<{
    color?: Color;
    title?: string;
    lineWidth?: number;
    lineStyle?: LineStyle;
    pane?: "overlay" | "new" | string;
    style?: PlotOptsStyle;
    /**
     * Presentation-only render-order key (z-index). Default `0`.
     * Higher `z` renders on top; lower `z` renders behind. Marks with
     * equal `z` keep the default group order (plots below drawings) and,
     * within a group, declaration order. `z` may be any finite number —
     * fractional values (e.g. `1.5`) slot a mark between two layers
     * without renumbering. It affects **only** stacking: `value`,
     * alerts, and `state.*` are unaffected.
     *
     * @since 1.4
     * @stable
     * @example
     *     plot(ta.sma(bar.close, 50), { z: -1 }); // behind other plots
     */
    z?: number;
}>;

/**
 * Styling options accepted by `hline(...)`. `pane` follows the same shape as
 * {@link PlotOpts.pane}: omit to fall back to the script's manifest-resolved
 * default (overlay unless `defineIndicator({ overlay: false })` was declared);
 * `"overlay"` pins the line to the price pane; `"new"` opens / joins the
 * per-script subpane; named panes route to a shared subpane key.
 *
 * @since 0.1
 * @stable
 * @example
 *     const opts: HLineOpts = {
 *         color: "#ef4444",
 *         title: "RSI 70",
 *         lineStyle: "dashed",
 *         pane: "new",
 *     };
 */
export type HLineOpts = Readonly<{
    color?: Color;
    title?: string;
    lineWidth?: number;
    lineStyle?: LineStyle;
    /**
     * Routes the horizontal line to a pane. Mirrors {@link PlotOpts.pane}:
     * omit to fall back to the script's manifest-resolved default,
     * `"overlay"` pins to the price pane, `"new"` joins the per-script
     * subpane, and named keys route to a shared subpane (folded to overlay
     * with `unsupported-pane` on `subPanes: 0` adapters).
     *
     * @since 0.2
     */
    pane?: "overlay" | "new" | string;
}>;

/**
 * Styling options accepted by `bgcolor(...)` — the Pine-ergonomic alias for
 * a `bg-color` pane-background band. `transp` is the 0–100 transparency
 * (0 opaque … 100 fully transparent), mirroring {@link PlotOptsStyle}'s
 * `bg-color` arm. `title` labels the slot for host overrides.
 *
 * @since 1.4
 * @stable
 * @example
 *     const opts: BgColorOpts = { transp: 80, title: "RSI heat" };
 *     void opts;
 */
export type BgColorOpts = Readonly<{
    transp?: number;
    title?: string;
}>;

/**
 * Styling options accepted by `barcolor(...)` — the Pine-ergonomic alias for
 * a `bar-color` candle/bar tint. The `bar-color` style carries no
 * transparency, so this bag only labels the slot.
 *
 * @since 1.4
 * @stable
 * @example
 *     const opts: BarColorOpts = { title: "trend tint" };
 *     void opts;
 */
export type BarColorOpts = Readonly<{
    title?: string;
}>;

/**
 * Compile-time callable hole for `plot(value, opts?)`. The compiler rewrites
 * every callsite to dispatch to the runtime's `plot` implementation;
 * calling this outside a compiled runtime throws the sentinel.
 *
 * Accepts `number | Series<number>` — scalars emit a single bar value;
 * series emissions pull from `series.current`.
 *
 * @since 0.1
 * @stable
 * @example
 *     // Inside a compiled `compute`:
 *     //   plot(bar.close, { color: "#3b82f6" });
 *     import { plot } from "@invinite-org/chartlang-core";
 *     try { plot(0); } catch {}
 */
export function plot(_value: number | Series<number>, _opts?: PlotOpts): void {
    throw new Error("plot called outside compiled runtime");
}

/**
 * Compile-time callable hole for `hline(price, opts?)`. Same semantics as
 * `plot` but pinned to a fixed price across all bars.
 *
 * @since 0.1
 * @stable
 * @example
 *     // Inside a compiled `compute`:
 *     //   hline(70, { color: "#ef4444" });
 *     import { hline } from "@invinite-org/chartlang-core";
 *     try { hline(70); } catch {}
 */
export function hline(_price: number, _opts?: HLineOpts): void {
    throw new Error("hline called outside compiled runtime");
}

/**
 * Paint the pane background for the current bar — the Pine-ergonomic alias
 * for `plot(NaN, { style: { kind: "bg-color", color, transp } })`. Pass a
 * `Color` (a CSS / hex string, or a per-bar color expression like
 * `close > open ? "#16a34a" : "#dc2626"`). Sugar over the existing
 * `bg-color` plot style — same wire emission, same capability gate.
 *
 * @since 1.4
 * @stable
 * @example
 *     // Inside a compiled `compute`:
 *     //   bgcolor(bar.close > bar.open ? "#16a34a" : "#dc2626", { transp: 80 });
 *     import { bgcolor } from "@invinite-org/chartlang-core";
 *     try { bgcolor("#1d4ed8"); } catch {}
 */
export function bgcolor(_color: Color, _opts?: BgColorOpts): void {
    throw new Error("bgcolor called outside compiled runtime");
}

/**
 * Tint the candle / bar for the current bar — the Pine-ergonomic alias for
 * `plot(NaN, { style: { kind: "bar-color", color } })`. Sugar over the
 * existing `bar-color` plot style.
 *
 * @since 1.4
 * @stable
 * @example
 *     // Inside a compiled `compute`:
 *     //   barcolor(bar.close > bar.open ? "#16a34a" : "#dc2626");
 *     import { barcolor } from "@invinite-org/chartlang-core";
 *     try { barcolor("#a855f7"); } catch {}
 */
export function barcolor(_color: Color, _opts?: BarColorOpts): void {
    throw new Error("barcolor called outside compiled runtime");
}

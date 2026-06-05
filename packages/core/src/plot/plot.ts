// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Color, LineStyle, Series } from "../types";

/**
 * Rendered-shape discriminator for `plot` emissions reaching the adapter.
 * Phase 1 shipped `line` / `step-line` / `horizontal-line`. Phase 2 adds
 * `histogram` / `bars` / `area` / `filled-band` / `label` / `marker`.
 * Phase 5 will add `shape` / `character` / `arrow` / `candle-override` /
 * `bar-override` / `bg-color` / `bar-color` / `vertical-line` /
 * `horizontal-histogram`. Every expansion is additive — the
 * `apiVersion: 1` script header stays unchanged.
 *
 * Typical Phase-2 consumers:
 *
 * - `histogram` → volume bars, MACD histogram, momentum-style oscillators.
 * - `bars` → narrow vertical bar plotted at integer x (signed momentum).
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
 *     const band: PlotKind = "filled-band";
 *     void k; void histogram; void band;
 */
export type PlotKind =
    | "line"
    | "step-line"
    | "horizontal-line"
    | "histogram"
    | "bars"
    | "area"
    | "filled-band"
    | "label"
    | "marker";

/**
 * Script-author selectable plot style. The runtime maps this to the
 * adapter-kit's wire `PlotStyle` discriminated union (Task 1) and
 * fills in defaults from the sibling {@link PlotOpts} fields
 * (`lineWidth` / `lineStyle`). Phase 2 surfaces `line` / `step-line`
 * / `histogram` here — the kinds the runtime has wired emit paths
 * for. `horizontal-line` has its own `hline()` primitive; the other
 * Task-1 kinds (`bars`, `area`, `filled-band`, `label`, `marker`)
 * land per their consuming port.
 *
 * `histogram.baseline` defaults to `0` when omitted.
 *
 * @formula  N/A — script-facing style input
 * @since 0.2
 * @experimental
 * @example
 *     const lineStyle: PlotOptsStyle = { kind: "line" };
 *     const histStyle: PlotOptsStyle = { kind: "histogram", baseline: 0 };
 *     void lineStyle; void histStyle;
 */
export type PlotOptsStyle =
    | { readonly kind: "line" }
    | { readonly kind: "step-line" }
    | { readonly kind: "histogram"; readonly baseline?: number }
    | {
          readonly kind: "marker";
          readonly shape: "circle" | "triangle-up" | "triangle-down" | "square" | "diamond";
          readonly size: number;
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
}>;

/**
 * Styling options accepted by `hline(...)`. Unlike `plot`, `hline` is always
 * a single horizontal line at a fixed price; no pane override.
 *
 * @since 0.1
 * @example
 *     const opts: HLineOpts = { color: "#ef4444", title: "Stop", lineStyle: "dashed" };
 */
export type HLineOpts = Readonly<{
    color?: Color;
    title?: string;
    lineWidth?: number;
    lineStyle?: LineStyle;
}>;

/**
 * Compile-time callable hole for `plot(value, opts?)`. The compiler rewrites
 * every callsite (Task 2) to dispatch to the runtime's `plot` implementation;
 * calling this outside a compiled runtime throws the sentinel.
 *
 * Accepts `number | Series<number>` — scalars emit a single bar value;
 * series emissions pull from `series.current`.
 *
 * @since 0.1
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
 * @example
 *     // Inside a compiled `compute`:
 *     //   hline(70, { color: "#ef4444" });
 *     import { hline } from "@invinite-org/chartlang-core";
 *     try { hline(70); } catch {}
 */
export function hline(_price: number, _opts?: HLineOpts): void {
    throw new Error("hline called outside compiled runtime");
}

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Color, LineStyle, Series } from "../types";

/**
 * Rendered-shape discriminator for `plot` emissions reaching the adapter.
 * Phase 1 ships these three; Phase 2+ adds histograms / candles / etc.
 *
 * @since 0.1
 * @example
 *     const k: PlotKind = "line";
 */
export type PlotKind = "line" | "step-line" | "horizontal-line";

/**
 * Styling options accepted by `plot(...)`. `pane: "overlay"` (the default) is
 * the only pane the Phase-1 canvas2d adapter renders — `"new"` and named
 * panes are reserved for Phase 2+.
 *
 * @since 0.1
 * @example
 *     const opts: PlotOpts = {
 *         color: "#3b82f6",
 *         title: "EMA(20)",
 *         lineWidth: 2,
 *         lineStyle: "solid",
 *         pane: "overlay",
 *     };
 */
export type PlotOpts = Readonly<{
    color?: Color;
    title?: string;
    lineWidth?: number;
    lineStyle?: LineStyle;
    pane?: "overlay" | "new" | string;
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

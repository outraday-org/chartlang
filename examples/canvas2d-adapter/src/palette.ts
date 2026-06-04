// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Bull / bear hex values ported from
// invinite/src/components/trading-chart/lib/candle-default-colors.ts
// (© Invinite). Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the values are the behavioural reference, the
// surrounding `Palette` shape is chartlang-native.

/**
 * Colour palette consumed by the canvas2d renderer. Adapter authors who
 * copy from this folder usually swap a handful of hex values rather than
 * the whole shape — every slot is mandatory so callers cannot omit one
 * and inherit a fallback by accident.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { type Palette, DEFAULT_PALETTE } from "chartlang-example-canvas2d-adapter";
 *     const p: Palette = { ...DEFAULT_PALETTE, background: "#101820" };
 *     void p;
 */
export type Palette = {
    readonly background: string;
    readonly candleBullBody: string;
    readonly candleBearBody: string;
    readonly candleWick: string;
    readonly gridLine: string;
    readonly plotDefault: string;
    readonly alertInfo: string;
    readonly alertWarning: string;
    readonly alertCritical: string;
};

/**
 * Default palette used when the consumer omits `opts.palette`.
 * `candleBullBody` / `candleBearBody` reuse the canonical TradingView
 * `#26a69a` / `#ef5350` hex values from the invinite reference;
 * remaining slots are chartlang-native choices.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { DEFAULT_PALETTE } from "chartlang-example-canvas2d-adapter";
 *     // DEFAULT_PALETTE.candleBullBody === "#26a69a";
 *     const p = DEFAULT_PALETTE;
 *     void p;
 */
export const DEFAULT_PALETTE: Palette = Object.freeze({
    background: "#0e1218",
    candleBullBody: "#26a69a",
    candleBearBody: "#ef5350",
    candleWick: "#cccccc",
    gridLine: "#2a2f3a",
    plotDefault: "#90caf9",
    alertInfo: "#2196f3",
    alertWarning: "#ff9800",
    alertCritical: "#f44336",
});

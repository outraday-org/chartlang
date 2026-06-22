// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Bull / bear hex values ported from
// invinite/src/components/trading-chart/lib/candle-default-colors.ts
// (© Invinite). Re-licensed MIT for chartlang. The values are the
// behavioural reference, the surrounding `KonvaPalette` shape is
// chartlang-native.

/**
 * Colour palette consumed by the Konva renderer. Adapter authors who
 * copy from this folder usually swap a handful of hex values rather than
 * the whole shape — every slot is mandatory so callers cannot omit one
 * and inherit a fallback by accident. Mirrors the canvas2d reference
 * adapter's `Palette`, trimmed to the slots the Konva series renderer
 * uses (no alert colours: alerts are not rendered here).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { type KonvaPalette, DEFAULT_PALETTE } from "chartlang-example-konva-adapter";
 *     const p: KonvaPalette = { ...DEFAULT_PALETTE, background: "#101820" };
 *     void p;
 */
export type KonvaPalette = {
    readonly background: string;
    readonly candleBullBody: string;
    readonly candleBearBody: string;
    readonly candleWick: string;
    readonly paneBorder: string;
    readonly plotDefault: string;
    readonly hlineDefault: string;
    readonly glyphText: string;
    readonly axisLabel: string;
};

/**
 * Default palette used when the consumer omits `opts.palette`.
 * `candleBullBody` / `candleBearBody` reuse the canonical TradingView
 * `#26a69a` / `#ef5350` hex values from the invinite reference;
 * remaining slots are chartlang-native choices shared with the canvas2d
 * reference adapter.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { DEFAULT_PALETTE } from "chartlang-example-konva-adapter";
 *     // DEFAULT_PALETTE.candleBullBody === "#26a69a";
 *     const p = DEFAULT_PALETTE;
 *     void p;
 */
export const DEFAULT_PALETTE: KonvaPalette = Object.freeze({
    background: "#0e1218",
    candleBullBody: "#26a69a",
    candleBearBody: "#ef5350",
    candleWick: "#cccccc",
    paneBorder: "#3a4150",
    plotDefault: "#90caf9",
    hlineDefault: "#ef4444",
    glyphText: "#e2e8f0",
    // Muted grey for the right-gutter price-axis labels.
    axisLabel: "#9ca3af",
});

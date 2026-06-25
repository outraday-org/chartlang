// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/lib/bar-width-formula.ts @ cd883292.
// Itself a port of TradingView Lightweight Charts' `candlestickWidth()` /
// `optimalBarWidth()`:
//   https://github.com/tradingview/lightweight-charts/blob/master/src/renderers/series-bars-renderer.ts
//   https://github.com/tradingview/lightweight-charts/blob/master/src/renderers/optimal-bar-width.ts
// "Translate, not transcribe": pure math, no React / GL / DOM. Candle bodies
// and vertical (volume / histogram) bars share this one visual contract so the
// bar width tracks the on-screen bar pitch (no overlap when zoomed out, no
// thin-strip when zoomed in) instead of a fixed CSS-px constant.

/**
 * Options for {@link computeBarWidthPx}.
 *
 * @since 0.1
 * @stable
 * @example
 *     const o: BarWidthOptions = { maxWidthPx: 6, wickClearancePx: 1 };
 *     void o;
 */
export type BarWidthOptions = {
    /** Maximum allowed bar width in CSS pixels. Default: `Infinity` (no ceiling). */
    readonly maxWidthPx?: number;
    /** Pixel clearance reserved on each side for the wick stroke. Default: `1`. */
    readonly wickClearancePx?: number;
    /** Width-to-pitch ratio above the transition zone. Default: `0.8` (TradingView). */
    readonly widthRatio?: number;
};

const TRANSITION_LOW = 2.5;
const TRANSITION_HIGH = 4;

/**
 * TradingView Lightweight Charts `candlestickWidth()` port — resolve the
 * on-screen bar width (CSS px) from the bar pitch (CSS px between adjacent bar
 * centres).
 *
 * - `barPitchPx < 2.5` → `ceil(pitch)` — pixel-perfect dense bars, no gap, no
 *   overlap.
 * - `2.5 ≤ barPitchPx < 4` → arctangent transition between full pitch and
 *   `floor(pitch * widthRatio) - wickClearancePx` (smooths the visual corner so
 *   the formula doesn't snap when zooming through the breakpoint).
 * - `barPitchPx ≥ 4` → `floor(pitch * widthRatio) - wickClearancePx`, clamped
 *   to ≥ 1.
 *
 * Result is always an integer ≥ 1 and never exceeds `maxWidthPx`. Returns `1`
 * for non-finite or non-positive inputs.
 *
 * @since 0.1
 * @stable
 * @example
 *     computeBarWidthPx(10, { wickClearancePx: 1 }) === 7;
 *     computeBarWidthPx(2, { wickClearancePx: 1 }) === 2;
 *     computeBarWidthPx(50, { maxWidthPx: 6 }) === 6;
 */
export function computeBarWidthPx(barPitchPx: number, options?: BarWidthOptions): number {
    const maxWidthPx = options?.maxWidthPx ?? Number.POSITIVE_INFINITY;
    const wickClearancePx = options?.wickClearancePx ?? 1;
    const widthRatio = options?.widthRatio ?? 0.8;

    if (!Number.isFinite(barPitchPx) || barPitchPx <= 0) return clampToCeiling(1, maxWidthPx);

    if (barPitchPx < TRANSITION_LOW) {
        return clampToCeiling(Math.ceil(barPitchPx), maxWidthPx);
    }

    if (barPitchPx < TRANSITION_HIGH) {
        // Arctangent transition: at pitch = 2.5 the ratio approaches 1; at
        // pitch = 4 it approaches `widthRatio`.
        const t = (barPitchPx - TRANSITION_LOW) / (TRANSITION_HIGH - TRANSITION_LOW);
        const ratio = 1 - ((1 - widthRatio) * Math.atan(t * Math.PI)) / (Math.PI / 2);
        const raw = Math.floor(barPitchPx * ratio) - wickClearancePx;
        return clampToCeiling(Math.max(1, raw), maxWidthPx);
    }

    const raw = Math.floor(barPitchPx * widthRatio) - wickClearancePx;
    return clampToCeiling(Math.max(1, raw), maxWidthPx);
}

function clampToCeiling(value: number, maxWidthPx: number): number {
    if (!Number.isFinite(maxWidthPx)) return value;
    return Math.min(value, Math.max(1, Math.floor(maxWidthPx)));
}

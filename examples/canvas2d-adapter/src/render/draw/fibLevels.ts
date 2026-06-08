// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Canonical Fibonacci level ratios shared by every fib renderer
 * (`fibRetracement`, `fibTrendExtension`, `fibChannel`, `fibSpeedFan`,
 * `fibSpeedArcs`, …). Frozen so per-kind renderers cannot accidentally
 * mutate the shared array. Source: invinite's
 * `src/components/trading-chart/tools/fib-*` tools (PLAN.md §10.2).
 *
 * Order is monotonic. Both the 0 and 1 endpoints are included so a
 * retracement renderer that needs the bracket lines (the 0% and 100%
 * anchor levels) doesn't have to splice them in.
 *
 * @since 0.3
 * @experimental
 * @example
 *     for (const level of FIB_LEVELS) {
 *         // Stroke a horizontal line at `from.price + level * (to.price - from.price)`.
 *         void level;
 *     }
 */
export const FIB_LEVELS: ReadonlyArray<number> = Object.freeze([
    0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272,
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: canonical fib ratio, not √2.
    1.414, 1.618, 2.0, 2.618, 4.236,
]);

/**
 * Format a Fibonacci ratio for display alongside its level line.
 * Integer ratios (`0`, `1`, `2`) render with one decimal place (`"0.0"`,
 * `"1.0"`, `"2.0"`); fractional ratios render with three (`"0.236"`,
 * `"0.618"`, `"1.272"`). Matches the Pine-style label convention used
 * by the invinite fib tools.
 *
 * @since 0.3
 * @experimental
 * @example
 *     formatLevel(0);     // "0.0"
 *     formatLevel(0.618); // "0.618"
 *     formatLevel(1.272); // "1.272"
 */
export function formatLevel(level: number): string {
    return level === Math.floor(level) ? level.toFixed(1) : level.toFixed(3);
}

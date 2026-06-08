// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Value-format hint the adapter uses for axis-label rendering. PLAN §4.1.
 * `"price"` formats with the symbol's quote-currency rules; `"volume"` uses
 * K/M/B compact notation; `"percent"` appends `%`; `"compact"` falls back to
 * K/M/B for generic non-volume values.
 *
 * @since 0.4
 * @experimental
 * @example
 *     const f: ValueFormat = "percent";
 *     void f;
 */
export type ValueFormat = "price" | "volume" | "percent" | "compact";

/**
 * Scale axis the indicator should bind to. PLAN §4.1.
 *
 * - `"price"` — overlay on the main price pane.
 * - `"left"` / `"right"` — sub-pane axis side.
 * - `"new"` — request a fresh sub-pane keyed by the script id.
 *
 * @since 0.4
 * @experimental
 * @example
 *     const s: ScaleAxis = "right";
 *     void s;
 */
export type ScaleAxis = "price" | "left" | "right" | "new";

/**
 * Author-supplied display + budget overrides. Every field is optional;
 * missing fields fall back to adapter defaults.
 *
 * @since 0.4
 * @experimental
 * @example
 *     const o: ScriptOverrides = {
 *         shortName: "EMA(20)",
 *         precision: 4,
 *         format: "price",
 *     };
 *     void o;
 */
export type ScriptOverrides = Readonly<{
    /**
     * Max bars of historical lookback the script needs. `0` keeps the
     * runtime default. Pine `max_bars_back` parity.
     *
     * @since 0.4
     * @example
     *     const v: ScriptOverrides["maxBarsBack"] = 100;
     *     void v;
     */
    maxBarsBack?: number;
    /**
     * Value-formatting hint for axis labels + cursor read-out.
     *
     * @since 0.4
     * @example
     *     const v: ScriptOverrides["format"] = "price";
     *     void v;
     */
    format?: ValueFormat;
    /**
     * Decimal precision the adapter renders the indicator at. `0`-`10`;
     * `undefined` follows the symbol's default precision.
     *
     * @since 0.4
     * @example
     *     const v: ScriptOverrides["precision"] = 2;
     *     void v;
     */
    precision?: number;
    /**
     * Scale-axis binding. Defaults to `"price"` for overlay indicators and
     * `"right"` for sub-pane indicators.
     *
     * @since 0.4
     * @example
     *     const v: ScriptOverrides["scale"] = "right";
     *     void v;
     */
    scale?: ScaleAxis;
    /**
     * Intervals the script requires the adapter to ship in
     * `Capabilities.intervals`.
     *
     * @since 0.4
     * @example
     *     const v: ScriptOverrides["requiresIntervals"] = ["1D"];
     *     void v;
     */
    requiresIntervals?: ReadonlyArray<string>;
    /**
     * Compact display label for legend chips. Defaults to truncated `name`.
     *
     * @since 0.4
     * @example
     *     const v: ScriptOverrides["shortName"] = "EMA";
     *     void v;
     */
    shortName?: string;
}>;

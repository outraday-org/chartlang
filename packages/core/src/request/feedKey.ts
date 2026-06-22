// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Build the composite secondary-feed key from a `(symbol, interval)` pair —
 * the **single** source of the stream-key format shared by the runtime's
 * stream/cache maps and the host wire (`CandleEvent.streamKey`). Like a slot
 * id, this string is load-bearing: producer (adapter/host) and consumer
 * (runtime) must agree byte-for-byte, so never re-derive it inline.
 *
 * An **omitted** symbol (the chart's own symbol / higher-timeframe-only case)
 * encodes to the bare interval — `feedKey(undefined, "1D") === "1D"` — so the
 * symbol-omitted wire and every key stay byte-identical to the pre-multi-symbol
 * baseline. A present symbol encodes as `"<symbol>@<interval>"`.
 *
 * @since 1.3
 * @stable
 * @example
 *     feedKey(undefined, "1D"); // "1D"  (chart symbol, back-compat)
 *     feedKey("AMEX:SPY", "1D"); // "AMEX:SPY@1D"
 */
export function feedKey(symbol: string | undefined, interval: string): string {
    // The `@` separator is not a valid character in a chartlang interval
    // literal (`/^\d+[smhdwM]$/`), so a `"<symbol>@<interval>"` key can never
    // collide with a bare-interval (chart-symbol) key. An empty/undefined
    // symbol collapsing to the bare interval is what gives the omitted-symbol
    // path byte-identical keys + wire to the pre-multi-symbol baseline.
    return symbol === undefined || symbol === "" ? interval : `${symbol}@${interval}`;
}

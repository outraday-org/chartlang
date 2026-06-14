// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/read-source-field.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.

/**
 * The eight canonical OHLC + derived source fields every `ta.*`
 * primitive accepts as a `source` field. Four raw OHLC keys plus
 * four TradingView-conforming derived averages. The derived values
 * are pre-computed by the runtime's execution loop and live on
 * `StreamState.bar` / `StreamState.seriesViews` — `pickCandleSource`
 * just reads them.
 *
 * @formula  N/A — string-literal union
 * @since 0.1
 * @stable
 * @example
 *     // type S = SourceField; // "close" | "hl2" | ...
 */
export type SourceField = "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4" | "hlcc4";

const SOURCE_FIELDS: ReadonlySet<SourceField> = new Set<SourceField>([
    "close",
    "high",
    "hl2",
    "hlc3",
    "hlcc4",
    "low",
    "ohlc4",
    "open",
]);

/**
 * Coerce a loose params bag's `source` entry to one of the eight
 * canonical fields. Anything not in the set falls through to
 * `fallback` (default `"close"` — matches Pine).
 *
 * @formula  params.source ∈ SOURCE_FIELDS ? params.source : fallback
 * @since 0.1
 * @stable
 * @example
 *     // import { readSourceField } from "./readSourceField";
 *     // const s = readSourceField({ source: "hl2" }); // "hl2"
 */
export function readSourceField(
    params: Record<string, unknown>,
    fallback: SourceField = "close",
): SourceField {
    const raw = params.source;
    if (typeof raw === "string" && SOURCE_FIELDS.has(raw as SourceField)) {
        return raw as SourceField;
    }
    return fallback;
}

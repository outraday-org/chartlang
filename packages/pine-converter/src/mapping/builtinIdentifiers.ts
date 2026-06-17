// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Pine built-in identifier → chartlang expression fragment. Maps the OHLCV
 * series, the synthetic-price aggregates, `time`, and `bar_index` to their
 * chartlang `bar.*` / helper-call forms, plus the two `xloc.*` string
 * sentinels the coordinate resolver keys on.
 *
 * `bar_index` lowers to `__bar_index()` — a converter-emitted helper (Task
 * 16) that reads a per-mount monotonic bar counter, because the chartlang
 * runtime exposes `bar.time` but no native bar index.
 *
 * `na` is intentionally ABSENT: its emission is context-sensitive (the
 * numeric `Number.NaN` sentinel vs the drawing-handle `null` sentinel) and
 * is resolved per-site by the expression emitter from the semantic
 * `naKind` annotation, not by a fixed table row.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { BUILTIN_IDENTIFIER_MAP } from "./builtinIdentifiers.js";
 *     BUILTIN_IDENTIFIER_MAP.get("close"); // "bar.close"
 *     BUILTIN_IDENTIFIER_MAP.get("bar_index"); // "__bar_index()"
 */
export const BUILTIN_IDENTIFIER_MAP: ReadonlyMap<string, string> = new Map<string, string>([
    ["open", "bar.open"],
    ["high", "bar.high"],
    ["low", "bar.low"],
    ["close", "bar.close"],
    ["volume", "bar.volume"],
    ["hl2", "bar.hl2"],
    ["hlc3", "bar.hlc3"],
    ["ohlc4", "bar.ohlc4"],
    ["time", "bar.time"],
    ["bar_index", "__bar_index()"],
    // String sentinels the coordinate resolver reads when an `xloc` argument
    // resolves to one of these built-ins; they never reach output verbatim.
    ["xloc.bar_index", "bar-index"],
    ["xloc.bar_time", "bar-time"],
]);

/**
 * Resolve a Pine built-in identifier (or dotted built-in like
 * `xloc.bar_index`) to its chartlang emission, or `null` when the name is
 * not a remapped built-in (the emitter then passes the name through
 * verbatim).
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { remapIdentifier } from "./builtinIdentifiers.js";
 *     remapIdentifier("close"); // "bar.close"
 *     remapIdentifier("myVar"); // null
 */
export function remapIdentifier(name: string): string | null {
    return BUILTIN_IDENTIFIER_MAP.get(name) ?? null;
}

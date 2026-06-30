// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Pine built-in identifier → chartlang expression fragment. Maps the OHLCV
 * series, the synthetic-price aggregates, `time`, `bar_index`, and the bare
 * calendar reads (`dayofweek` / `time_close` / `timenow`) to their chartlang
 * `bar.*` / `time.*` / helper-call forms, plus the two `xloc.*` string
 * sentinels the coordinate resolver keys on. Bare `dayofweek` / `time_close`
 * lower to the no-arg accessor call (`time.dayofweek(bar.time)` /
 * `time.timeClose(bar.time)`); `timenow` lowers to the host-clock accessor
 * (`time.now()`). Explicit CALL forms are intercepted
 * earlier by `BUILTIN_CALL_MAP` ({@link lowerBuiltinCall}) so they never
 * compose with these value fragments.
 *
 * `bar_index` lowers to the internal `__barIndexBridge()` sentinel — a
 * converter-emitted helper (codegen) that reads a per-mount monotonic bar
 * counter, because the chartlang runtime exposes `bar.time` but no native bar
 * index. The sentinel is RENAMED to a readable, collision-safe `barIndex()`
 * (`codegen/emitHelpers.ts` `renameBarIndexSentinel`) before output, so it
 * never reaches the generated `.chart.ts`.
 *
 * `na` is intentionally ABSENT: its emission is context-sensitive (the
 * numeric `Number.NaN` sentinel vs the drawing-handle `null` sentinel) and
 * is resolved per-site by the expression emitter from the semantic
 * `naKind` annotation, not by a fixed table row.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { BUILTIN_IDENTIFIER_MAP } from "./builtinIdentifiers.js";
 *     BUILTIN_IDENTIFIER_MAP.get("close"); // "bar.close"
 *     BUILTIN_IDENTIFIER_MAP.get("bar_index"); // "__barIndexBridge()"
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
    // Bare value reads of the calendar built-ins (Pine exposes `dayofweek` /
    // `time_close` as series, equivalent to the no-arg call). The CALL forms
    // (`dayofweek(t)`, `time_close()`) are intercepted earlier via
    // `BUILTIN_CALL_MAP` so they never compose with these value fragments.
    ["dayofweek", "time.dayofweek(bar.time)"],
    ["time_close", "time.timeClose(bar.time)"],
    ["timenow", "time.now()"],
    ["bar_index", "__barIndexBridge()"],
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
 * @stable
 * @example
 *     import { remapIdentifier } from "./builtinIdentifiers.js";
 *     remapIdentifier("close"); // "bar.close"
 *     remapIdentifier("myVar"); // null
 */
export function remapIdentifier(name: string): string | null {
    return BUILTIN_IDENTIFIER_MAP.get(name) ?? null;
}

// Pine `syminfo.<member>` → the chartlang `SymInfoView` field name when they
// differ. Pine's `syminfo.prefix` (the chart symbol's exchange prefix, e.g.
// `"NASDAQ"`) is chartlang's `syminfo.exchange`. Members that match by name
// (`ticker`/`type`/`mintick`/`currency`/`basecurrency`/`timezone`/`session`) are
// absent — they pass through verbatim. A member with no chartlang analogue
// (`description`/`pointvalue`/`root`/…) is also absent and left verbatim (a
// best-effort residual, like any other unmodelled builtin field).
const SYMINFO_MEMBER_MAP: ReadonlyMap<string, string> = new Map<string, string>([
    ["prefix", "exchange"],
]);

/**
 * Resolve a Pine `syminfo.<member>` access to its chartlang `SymInfoView`
 * field, or `null` when the member name already matches (or has no analogue).
 *
 * @since 0.5
 * @stable
 * @example
 *     import { remapSyminfoMember } from "./builtinIdentifiers.js";
 *     remapSyminfoMember("prefix"); // "exchange"
 *     remapSyminfoMember("ticker"); // null
 */
export function remapSyminfoMember(member: string): string | null {
    return SYMINFO_MEMBER_MAP.get(member) ?? null;
}

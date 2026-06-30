// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Lower one bare-rooted Pine built-in CALL — `time(...)`, `time_close(...)`,
 * `dayofweek(...)`, `timestamp(...)` — onto its chartlang source, given the
 * already-emitted argument strings. Returns the chartlang call source, or
 * `null` when the call shape is not faithfully mappable in v1 (the caller
 * emits the `time-builtin-not-mapped` diagnostic and falls back to a
 * best-effort emit).
 *
 * These are CALL forms only — the bare value reads (`time`, `dayofweek` used
 * without parentheses) are handled by `BUILTIN_IDENTIFIER_MAP`
 * ({@link builtinIdentifiers}); routing the call form here keeps the generic
 * emitter from producing `bar.time(...)` / `time.dayofweek(bar.time)(...)`.
 *
 * The mapped forms:
 *
 * - `time()` → `bar.time` (the no-arg current-bar open timestamp; chartlang's
 *   `bar.time` is the scalar UTC ms epoch, so the call collapses to the value).
 * - `time_close()` → `time.timeClose(bar.time)` (Pine's no-arg bar-close
 *   timestamp = bar start + the current bar's interval, which
 *   `time.timeClose` reads internally).
 * - `dayofweek(t)` / `dayofweek(t, tz)` → `time.dayofweek(t)` /
 *   `time.dayofweek(t, tz)` (Pine's `1=Sun..7=Sat` convention is preserved by
 *   the chartlang accessor).
 * - `timestamp(y, m, d[, h[, min[, s[, tz]]]])` →
 *   `time.timestamp(y, m, d[, h[, min[, s[, tz]]]])`; Pine's leading-timezone
 *   overload is rejected for now because chartlang expects `tz` last.
 *
 * The `time(timeframe, session)` membership / resolution forms are NOT mapped
 * (`null`): the timeframe-resolved `time()` and the `time(spec)` session
 * membership idioms need a different chartlang shape than the bare epoch.
 *
 * @since 1.5
 * @experimental
 * @example
 *     import { BUILTIN_CALL_MAP } from "./builtinCalls.js";
 *     BUILTIN_CALL_MAP.get("dayofweek")?.(["bar.time"]); // "time.dayofweek(bar.time)"
 *     BUILTIN_CALL_MAP.get("timestamp")?.(["2024", "1", "2"]); // "time.timestamp(2024, 1, 2)"
 *     BUILTIN_CALL_MAP.get("time")?.([]); // "bar.time"
 */
export const BUILTIN_CALL_MAP: ReadonlyMap<string, (args: readonly string[]) => string | null> =
    new Map<string, (args: readonly string[]) => string | null>([
        ["time", (args) => (args.length === 0 ? "bar.time" : null)],
        ["time_close", (args) => (args.length === 0 ? "time.timeClose(bar.time)" : null)],
        [
            "timestamp",
            (args) =>
                args.length >= 3 && args.length <= 7 && !isQuotedStringLiteral(args[0])
                    ? `time.timestamp(${args.join(", ")})`
                    : null,
        ],
        [
            "dayofweek",
            (args) =>
                args.length === 0
                    ? "time.dayofweek(bar.time)"
                    : `time.dayofweek(${args.join(", ")})`,
        ],
    ]);

function isQuotedStringLiteral(source: string): boolean {
    return /^(['"]).*\1$/u.test(source);
}

/**
 * Lower a bare-rooted built-in call by name. Returns the chartlang source for
 * a mapped form, or `null` when the callee is not a mapped built-in OR the
 * argument shape is unsupported.
 *
 * @since 1.5
 * @experimental
 * @example
 *     import { lowerBuiltinCall } from "./builtinCalls.js";
 *     lowerBuiltinCall("time_close", []); // "time.timeClose(bar.time)"
 *     lowerBuiltinCall("timestamp", ["2024", "1", "2"]); // "time.timestamp(2024, 1, 2)"
 *     lowerBuiltinCall("dayofweek", ["t", "tz"]); // "time.dayofweek(t, tz)"
 *     lowerBuiltinCall("ta.sma", ["x"]); // null
 */
export function lowerBuiltinCall(name: string, args: readonly string[]): string | null {
    return BUILTIN_CALL_MAP.get(name)?.(args) ?? null;
}

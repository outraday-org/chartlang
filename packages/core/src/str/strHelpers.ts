// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Count the fractional digits a Pine-style numeric mask requests and whether
 * the fractional run is zero-padded (`0`, fixed width) or trimmed (`#`, max
 * width). Returns `null` when the mask has no fractional part. Used by
 * {@link formatNumber}; not exported to script authors.
 */
const parseMask = (mask: string): { digits: number; padded: boolean } | null => {
    const dot = mask.indexOf(".");
    if (dot < 0) {
        return null;
    }
    const fraction = mask.slice(dot + 1);
    // A fractional run is "fixed" (zero-padded) the moment it contains a `0`;
    // a pure `#` run is "trimmed". Mixed runs (`#.0#`) follow Pine: any `0`
    // pins the width.
    const padded = fraction.includes("0");
    return { digits: fraction.length, padded };
};

/**
 * Host-independent number formatter — the deterministic core of `str.tostring`
 * / `str.format`. No `Intl`, no `toLocaleString`, no locale: outputs are
 * byte-identical across the worker and quickjs hosts.
 *
 * - No `mask` → `String(value)`, but `NaN` → `"NaN"`, `+Infinity` → `"∞"`,
 *   `-Infinity` → `"-∞"` (Pine glyphs), and negative zero → `"0"`.
 * - `mask` with a fractional run of `#` (e.g. `"#.##"`) → up to N fractional
 *   digits, trailing zeros trimmed.
 * - `mask` with a fractional run containing `0` (e.g. `"0.0000"`) → exactly N
 *   fractional digits, zero-padded.
 *
 * Finite values format via `value.toFixed(n)` (in `lib.es2022`, deterministic
 * for finite doubles) then trim per the mask.
 *
 * @since 1.4
 * @stable
 * @example
 *     str.format("{0,number,#.##}", 12.349); // uses formatNumber("#.##")
 *     // formatNumber(12.349, "#.##") === "12.35"
 *     // formatNumber(1234.5, "0.0000") === "1234.5000"
 *     // formatNumber(42) === "42"
 */
export const formatNumber = (value: number, mask?: string): string => {
    if (Number.isNaN(value)) {
        return "NaN";
    }
    if (value === Number.POSITIVE_INFINITY) {
        return "∞";
    }
    if (value === Number.NEGATIVE_INFINITY) {
        return "-∞";
    }
    // Normalize negative zero before any formatting so `-0` never leaks.
    const normalized = value === 0 ? 0 : value;
    const parsed = mask === undefined ? null : parseMask(mask);
    if (parsed === null) {
        return String(normalized);
    }
    const fixed = normalized.toFixed(parsed.digits);
    if (parsed.padded || parsed.digits === 0) {
        // A `0`-padded run keeps every digit; a zero-width fractional run
        // (`"0."` / `"#."` / `"."`) has `toFixed(0)` produce a bare integer
        // with no decimal point, so the trailing-zero trim below would eat the
        // integer's own zeros (`"100"` → `"1"`). Return the integer verbatim.
        return fixed;
    }
    // Trimmed (`#`) run: drop trailing zeros, then a dangling decimal point.
    return fixed.replace(/\.?0+$/, "");
};

/**
 * Replace positional `{n}` placeholders in `template` with `args[n]`, with an
 * optional Pine-style numeric sub-mask `{n,number,MASK}` routed through
 * {@link formatNumber}. `{{` / `}}` are literal braces. An out-of-range index
 * leaves its placeholder intact (Pine parity). The deterministic core of
 * `str.format`.
 *
 * @since 1.4
 * @stable
 * @example
 *     applyFormat("{0} / {1}", ["a", "b"]); // "a / b"
 *     applyFormat("p={0,number,#.##}", [12.349]); // "p=12.35"
 *     applyFormat("{{literal}} {0}", ["x"]); // "{literal} x"
 */
export const applyFormat = (template: string, args: ReadonlyArray<string | number>): string => {
    // Order matters: consume `{{` / `}}` literals first, then `{n}` /
    // `{n,number,MASK}` placeholders. A non-greedy alternation keeps the two
    // brace-escape forms from swallowing a following placeholder.
    return template.replace(
        /\{\{|\}\}|\{(\d+)(?:,number,([^}]*))?\}/g,
        (match, indexText: string | undefined, mask: string | undefined) => {
            if (match === "{{") {
                return "{";
            }
            if (match === "}}") {
                return "}";
            }
            // indexText is defined for every non-brace branch (the regex only
            // reaches here via the `{(\d+)...}` alternative).
            const index = Number(indexText);
            const arg = args[index];
            if (arg === undefined) {
                return match;
            }
            if (mask !== undefined) {
                return formatNumber(Number(arg), mask);
            }
            return String(arg);
        },
    );
};

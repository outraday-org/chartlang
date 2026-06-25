// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { applyFormat, formatNumber } from "./strHelpers.js";

export { applyFormat, formatNumber } from "./strHelpers.js";

/**
 * Pure, frozen string namespace — Pine-parity helpers for building the dynamic
 * text that the already-shipped `draw.text` / `draw.table` / `draw.marker` /
 * `alert(...)` holes consume. Same shape as `color` / `math`: frozen,
 * deterministic, compute-time, no slot and no capability.
 *
 * Number formatting is host-independent (no `Intl`, no `toLocaleString`, no
 * locale) so outputs are byte-identical across the worker and quickjs hosts.
 * `replace` uses the **string** overload (first occurrence only — never a
 * `RegExp`, avoiding ReDoS surface and keeping determinism); `repeat` guards
 * negative / fractional counts (`String.repeat` throws on those).
 *
 * @since 1.4
 * @stable
 * @example
 *     const label = str.format("{0}={1,number,#.##}", str.upper("eth"), 12.349);
 *     void label; // "ETH=12.35"
 */
export const str = Object.freeze({
    tostring: (value: number | boolean | string, format?: string): string =>
        typeof value === "number" ? formatNumber(value, format) : String(value),
    format: (template: string, ...args: ReadonlyArray<string | number>): string =>
        applyFormat(template, args),
    length: (s: string): number => s.length,
    contains: (s: string, sub: string): boolean => s.includes(sub),
    startsWith: (s: string, sub: string): boolean => s.startsWith(sub),
    endsWith: (s: string, sub: string): boolean => s.endsWith(sub),
    replace: (s: string, target: string, repl: string): string => s.replace(target, repl),
    replaceAll: (s: string, target: string, repl: string): string => s.split(target).join(repl),
    split: (s: string, sep: string): ReadonlyArray<string> => s.split(sep),
    substring: (s: string, start: number, end?: number): string => s.substring(start, end),
    upper: (s: string): string => s.toUpperCase(),
    lower: (s: string): string => s.toLowerCase(),
    trim: (s: string): string => s.trim(),
    repeat: (s: string, count: number): string => s.repeat(Math.max(0, Math.trunc(count))),
});

/**
 * Type of the frozen {@link str} namespace.
 *
 * @since 1.4
 * @stable
 * @example
 *     const ns: StrNamespace = str;
 *     void ns;
 */
export type StrNamespace = typeof str;

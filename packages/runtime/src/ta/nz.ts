// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// No invinite source — semantics per Pine `ta.nz`.

/**
 * Replace `NaN` with a fallback. Returns `value` unchanged when it
 * is not `NaN`; otherwise returns `replacement` (defaults to `0`).
 * Stateless — does not allocate a slot, does not consult the active
 * runtime context.
 *
 * @formula  Number.isNaN(value) ? (replacement ?? 0) : value
 * @warmup   0
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const safe = ta.nz(ta.change(bar.close).current, 0);
 */
export function nz(value: number, replacement?: number): number {
    if (Number.isNaN(value)) return replacement ?? 0;
    return value;
}

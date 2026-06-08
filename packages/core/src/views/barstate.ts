// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Bar-state view. Mirrors Pine's `barstate.*`; all fields are derived per
 * step from runtime event type and bar-index bookkeeping.
 *
 * The exported module-scope value is only the default fallback. Runtime
 * implementations supply per-step snapshots through `ComputeContext`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const view: BarStateView = barstate;
 *     void view;
 */
export type BarStateView = {
    /** True on the first historical bar of this script mount. */
    readonly isfirst: boolean;
    /** True on the most recent bar, live or replay. */
    readonly islast: boolean;
    /** True if a new bar opened on this step; false on ticks within a bar. */
    readonly isnew: boolean;
    /** True if the runtime is in the historical-replay phase. */
    readonly ishistory: boolean;
    /** True if the runtime is processing a realtime feed. */
    readonly isrealtime: boolean;
    /** True if this step is a `kind: "close"` event; false on ticks. */
    readonly isconfirmed: boolean;
};

/**
 * Module-scope `barstate` fallback. Outside a script step, every field is
 * `false`; the runtime supplies the active per-step snapshot on
 * `ComputeContext.barstate`.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { barstate } from "@invinite-org/chartlang-core";
 *     void barstate;
 */
export const barstate: BarStateView = Object.freeze({
    isfirst: false,
    islast: false,
    isnew: false,
    ishistory: false,
    isrealtime: false,
    isconfirmed: false,
});

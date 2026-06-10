// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { BarStateView } from "@invinite-org/chartlang-core";

/**
 * Candle-event kind used to derive the per-step `barstate.*` snapshot.
 *
 * @since 0.4
 * @stable
 * @example
 *     const kind: EventKind = "close";
 *     void kind;
 */
export type EventKind = "history" | "close" | "tick";

/**
 * Inputs needed to build a `barstate.*` runtime view.
 *
 * @since 0.4
 * @stable
 * @example
 *     const inputs: BarStateInputs = {
 *         eventKind: "history",
 *         barIndex: 0,
 *         isLastBar: false,
 *     };
 *     void inputs;
 */
export type BarStateInputs = Readonly<{
    eventKind: EventKind;
    barIndex: number;
    isLastBar: boolean;
}>;

/**
 * Build a frozen `barstate.*` view for the current script step.
 *
 * @since 0.4
 * @stable
 * @example
 *     const view = makeBarStateView({
 *         eventKind: "tick",
 *         barIndex: 5,
 *         isLastBar: true,
 *     });
 *     void view.isrealtime;
 */
export function makeBarStateView(inputs: BarStateInputs): BarStateView {
    const { eventKind, barIndex, isLastBar } = inputs;
    return Object.freeze({
        isfirst: barIndex === 0,
        islast: isLastBar,
        isnew: eventKind === "history" || eventKind === "close",
        ishistory: eventKind === "history",
        isrealtime: eventKind === "tick",
        isconfirmed: eventKind === "close",
    });
}

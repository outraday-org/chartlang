// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Price, WorldPoint } from "@invinite-org/chartlang-core";

/**
 * `Bar.point` implementation for standalone input-bar fixtures, which carry
 * no time ring buffer. Only the current bar (`offset === 0`) resolves to the
 * bar's own time; any other offset yields a `NaN` time. The runtime injects
 * the real, history-aware `point` on its live `BarView` — these fixtures only
 * need to satisfy the {@link import("@invinite-org/chartlang-core").Bar}
 * surface for the bars fed into `onBarClose`.
 *
 * @since 0.9
 * @stable
 * @example
 *     import { inputBarPoint } from "@invinite-org/chartlang-conformance";
 *     const point = inputBarPoint(1_700_000_000_000);
 *     point(0, 42); // { time: 1_700_000_000_000, price: 42 }
 */
export function inputBarPoint(time: number): (offset: number, price: Price) => WorldPoint {
    return (offset, price) => ({ time: offset === 0 ? time : Number.NaN, price });
}

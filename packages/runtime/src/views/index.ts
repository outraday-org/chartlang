// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { BarStateView, SymInfoView, TimeframeView } from "@invinite-org/chartlang-core";

import { makeBarStateView } from "./barstateView";
export { refreshRuntimeViews } from "./refreshRuntimeViews";
import { makeSymInfoView } from "./symInfoView";
import { makeTimeframeView } from "./timeframeView";

/**
 * Mutable runtime view container. Each field is replaced with a fresh
 * frozen snapshot as the runner advances.
 *
 * @since 0.4
 * @experimental
 * @example
 *     const views: RuntimeViews = createRuntimeViews();
 *     views.barstate = views.barstate;
 */
export type RuntimeViews = {
    barstate: BarStateView;
    syminfo: SymInfoView;
    timeframe: TimeframeView;
};

/**
 * Build the default runtime view container for a script mount.
 *
 * @since 0.4
 * @experimental
 * @example
 *     const views = createRuntimeViews({
 *         syminfo: makeSymInfoView({ ticker: "DEMO" }, new Set(["ticker"])),
 *     });
 *     void views.syminfo.ticker;
 */
export function createRuntimeViews(opts: { readonly syminfo?: SymInfoView } = {}): RuntimeViews {
    return {
        barstate: makeBarStateView({ eventKind: "history", barIndex: 0, isLastBar: false }),
        syminfo: opts.syminfo ?? makeSymInfoView({}, new Set()),
        timeframe: makeTimeframeView("", undefined),
    };
}

export { makeBarStateView } from "./barstateView";
export { makeSymInfoView } from "./symInfoView";
export { makeTimeframeView } from "./timeframeView";
export type { BarStateInputs, EventKind } from "./barstateView";
export type { AdapterSymInfo } from "./symInfoView";

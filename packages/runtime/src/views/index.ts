// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { BarStateView, SymInfoView, TimeframeView } from "@invinite-org/chartlang-core";

import { makeBarStateView } from "./barstateView.js";
export { refreshRuntimeViews } from "./refreshRuntimeViews.js";
import { makeSymInfoView } from "./symInfoView.js";
import { makeTimeframeView } from "./timeframeView.js";

/**
 * Mutable runtime view container. Each field is replaced with a fresh
 * frozen snapshot as the runner advances.
 *
 * @since 0.4
 * @stable
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
 * @stable
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

export { makeBarStateView } from "./barstateView.js";
export { makeSymInfoView } from "./symInfoView.js";
export { makeTimeframeView } from "./timeframeView.js";
export type { BarStateInputs, EventKind } from "./barstateView.js";
export type { AdapterSymInfo } from "./symInfoView.js";

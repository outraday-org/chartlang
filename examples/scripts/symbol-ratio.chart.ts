// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, request } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Symbol Ratio",
    apiVersion: 1,
    // A price ratio (~0.35) is orders of magnitude below the chart's price
    // scale, so it must render in its OWN sub-pane — on the price overlay it
    // collapses to a flat line at the axis floor. `overlay: false` gives the
    // ratio its own y-scale.
    overlay: false,
    compute({ plot, request }) {
        // Read two DIFFERENT instruments at the chart interval via the
        // multi-symbol `request.security({ symbol, interval })` form. `symbol`
        // must be a compile-time literal, and a non-chart symbol requires the
        // adapter's `multiSymbol` capability — otherwise each series degrades
        // to all-NaN with one `multi-symbol-not-supported` diagnostic.
        const spy = request.security({ symbol: "AMEX:SPY", interval: "1D" });
        const qqq = request.security({ symbol: "NASDAQ:QQQ", interval: "1D" });

        // `SecurityBar.close` is a `Series<Price>` (indexable, NOT
        // number-coercible), so read `.current` for the live scalar before the
        // ratio division.
        plot(spy.close.current / qqq.close.current, { title: "SPY/QQQ" });
    },
});

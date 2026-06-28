// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Bars Since Overbought",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // ta.barssince — a counter that resets to 0 each time RSI(14) crosses above 70 and climbs by one every bar after, measuring how long since the last overbought breakout.
        const rsi = ta.rsi(bar.close, 14);
        const since = ta.barssince(ta.crossover(rsi, 70));
        plot(since, {
            color: "#ab47bc",
            title: "Bars Since RSI crossed 70",
            style: { kind: "histogram" },
        });
    },
});

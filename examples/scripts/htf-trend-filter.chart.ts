// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, request, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "HTF Trend Filter",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, request }) {
        // Current-timeframe trend.
        const fast = ta.ema(bar.close, 20);
        plot(fast, { color: "#26a69a", title: "EMA(20)" });

        // Higher-timeframe trend pulled from weekly candles via
        // request.security. The interval must be a compile-time literal;
        // alignment is no-lookahead (weekly value holds until the next
        // weekly close).
        const weekly = request.security({ interval: "1W" });
        const weeklyTrend = ta.ema(weekly.close, 10);
        plot(weeklyTrend, { color: "#ef5350", title: "Weekly EMA(10)" });
    },
});

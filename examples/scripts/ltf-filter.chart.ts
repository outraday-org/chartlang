// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, request, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "LTF Filter",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, request }) {
        // Current-timeframe RSI(14).
        const rsi = ta.rsi(bar.close, 14);
        plot(rsi, { color: "#26a69a", title: "RSI(14)" });

        // Hourly RSI(14) computed ON the 1h bars — a LOWER (finer) timeframe
        // than a daily chart — aligned no-lookahead to the chart. On each daily
        // bar this reads the value of the LAST 1h bar that closed at/before the
        // daily bar's close (the most recent sub-bar), non-repainting — the
        // finer mirror of `htf-trend-filter.chart.ts`'s forward-aligned HTF
        // trend. The callback runs on the hourly clock, so this is a true
        // hourly RSI(14), sampled once per daily bar.
        const hourlyRsi = request.security({ interval: "1h" }, (bar) => ta.rsi(bar.close, 14));
        plot(hourlyRsi, { color: "#ef5350", title: "Hourly RSI(14)" });
    },
});

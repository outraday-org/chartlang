// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Historical Volatility",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // Historical Volatility(10): annualised standard deviation of log returns, percent-scaled.
        plot(ta.historicalVolatility(bar.close, 10), { color: "#2962ff", title: "HV(10)" });
    },
});

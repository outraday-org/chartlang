// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "LSMA Regression",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.lsma (Least-Squares MA) plots the endpoint of the linear
        // regression line over the trailing window, so it leads price like a
        // projected trendline rather than averaging it. Plot LSMA(25) over a
        // plain SMA(25) to see the regression endpoint run ahead.
        plot(ta.lsma(bar.close, 25), { color: "#26a69a", title: "LSMA(25)" });
        plot(ta.sma(bar.close, 25), { color: "#ef5350", title: "SMA(25)" });
    },
});

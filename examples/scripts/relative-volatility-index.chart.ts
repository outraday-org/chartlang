// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Relative Volatility Index",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // RSI-style oscillator over rolling stddev instead of close changes, [0, 100].
        const rvi = ta.rvi(bar.close, 10);
        hline(50, { color: "#787b86", lineStyle: "dashed", title: "Midline" });
        plot(rvi, { color: "#9c27b0", title: "RVI(10)" });
    },
});

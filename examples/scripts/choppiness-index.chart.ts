// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Choppiness Index",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // Trend-vs-chop regime gauge, [0, 100], with the 61.8 / 38.2 Fibonacci guides.
        const chop = ta.chop(14);
        hline(61.8, { color: "#ef5350", lineStyle: "dashed", title: "Choppy" });
        hline(38.2, { color: "#26a69a", lineStyle: "dashed", title: "Trending" });
        plot(chop, { color: "#2962ff", title: "Choppiness(14)" });
    },
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Bollinger %B",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // Bollinger %B(20, 2): price position in the band — 0 on the lower band, 1 on the upper.
        plot(ta.bbPercentB(bar.close, 20, { multiplier: 2 }), {
            color: "#2962ff",
            title: "%B(20)",
        });

        hline(1, { color: "#ef5350", lineStyle: "dashed", title: "Upper band" });
        hline(0, { color: "#26a69a", lineStyle: "dashed", title: "Lower band" });
    },
});

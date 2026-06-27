// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "CCI",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // Commodity Channel Index(20) over hlc3 with the classic ±100 bands.
        const cci = ta.cci(bar.hlc3, 20);
        plot(cci, { color: "#2962ff", title: "CCI(20)" });

        hline(100, { color: "#ef5350", lineStyle: "dashed", title: "Overbought" });
        hline(-100, { color: "#26a69a", lineStyle: "dashed", title: "Oversold" });
    },
});

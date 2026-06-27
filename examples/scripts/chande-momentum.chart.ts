// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Chande Momentum Oscillator",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // Chande Momentum Oscillator(9), bounded [-100, 100] with ±50 guides.
        const cmo = ta.cmo(bar.close, 9);
        plot(cmo, { color: "#2962ff", title: "CMO(9)" });

        hline(50, { color: "#ef5350", lineStyle: "dashed", title: "Overbought" });
        hline(-50, { color: "#26a69a", lineStyle: "dashed", title: "Oversold" });
        hline(0, { color: "#787b86", lineStyle: "dotted", title: "Zero" });
    },
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Stochastic Oscillator",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // Classic Stochastic %K/%D(14,3,3) sourced from bar high/low/close.
        const stoch = ta.stoch({ kLength: 14, kSmoothing: 3, dLength: 3 });
        plot(stoch.k, { color: "#2962ff", title: "%K" });
        plot(stoch.d, { color: "#ff6d00", title: "%D" });

        hline(80, { color: "#ef5350", lineStyle: "dashed", title: "Overbought" });
        hline(20, { color: "#26a69a", lineStyle: "dashed", title: "Oversold" });
    },
});

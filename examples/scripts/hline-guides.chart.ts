// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Hline Guides",
    apiVersion: 1,
    overlay: false,
    compute({ bar, hline, plot, ta }) {
        // Two fixed-price hline guides frame an RSI(14) oscillator: a 70
        // overbought line and a 30 oversold line, each pinned across all bars
        // with its own color and dashed style.
        plot(ta.rsi(bar.close, 14), { title: "RSI(14)", color: "#2563eb" });
        hline(70, { title: "Overbought", color: "#ef4444", lineStyle: "dashed" });
        hline(30, { title: "Oversold", color: "#16a34a", lineStyle: "dashed" });
    },
});

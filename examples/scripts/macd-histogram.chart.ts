// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "MACD",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // MACD line + signal line over a zero-based histogram of their difference.
        const m = ta.macd(bar.close);
        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
        plot(m.hist, { color: "#26a69a", title: "Histogram", style: { kind: "histogram", baseline: 0 } });
        plot(m.macd, { color: "#2962ff", title: "MACD" });
        plot(m.signal, { color: "#ff6d00", title: "Signal" });
    },
});

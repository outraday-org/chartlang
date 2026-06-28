// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Percentage Volume Oscillator",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // MACD shape on bar.volume: line + signal + histogram normalised by the slow EMA.
        const p = ta.pvo();
        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
        plot(p.hist, {
            color: "#26a69a",
            title: "Histogram",
            style: { kind: "histogram", baseline: 0 },
        });
        plot(p.pvo, { color: "#2962ff", title: "PVO" });
        plot(p.signal, { color: "#ff6d00", title: "Signal" });
    },
});

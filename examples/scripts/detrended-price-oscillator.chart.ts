// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Detrended Price Oscillator",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // Strips the SMA(21) trend out of price to expose the short-cycle component.
        const dpo = ta.dpo(bar.close, 21);
        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
        plot(dpo, { color: "#2962ff", title: "DPO(21)" });
    },
});

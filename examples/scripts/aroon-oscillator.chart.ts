// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Aroon Oscillator",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // Aroon Up minus Aroon Down: positive = up-trend bias, negative = down.
        const osc = ta.aroonOsc(25);
        plot(osc, { color: "#7e57c2", title: "Aroon Osc(25)", style: { kind: "histogram", baseline: 0 } });
        hline(0, { color: "#9e9e9e", lineStyle: "dashed", title: "Zero" });
    },
});

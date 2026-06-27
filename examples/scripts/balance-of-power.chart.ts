// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Balance of Power",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // (close − open) / (high − low) per bar, drawn as a zero-based histogram.
        const bop = ta.bop();
        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
        plot(bop, { color: "#26a69a", title: "BOP", style: { kind: "histogram", baseline: 0 } });
    },
});

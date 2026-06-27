// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Relative Vigor Index",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // Ehlers' RVGI: smoothed (close − open) / (high − low) plus its weighted signal.
        const r = ta.rvgi();
        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
        plot(r.rvgi, { color: "#2962ff", title: "RVGI" });
        plot(r.signal, { color: "#ff6d00", title: "Signal" });
    },
});

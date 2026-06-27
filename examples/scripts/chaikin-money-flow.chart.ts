// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Chaikin Money Flow",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // CMF(20) sums money-flow volume over the window; readings above the
        // zero line signal accumulation, below it distribution.
        plot(ta.cmf(20), { color: "#7e57c2", title: "CMF(20)" });
        hline(0, { color: "#90a4ae", lineStyle: "dashed", title: "Zero" });
    },
});

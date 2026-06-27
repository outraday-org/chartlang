// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Coppock Curve",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // Long-term momentum: WMA of summed rate-of-change; zero crossings are the signal.
        const c = ta.coppock(bar.close);
        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
        plot(c, { color: "#2962ff", title: "Coppock" });
    },
});

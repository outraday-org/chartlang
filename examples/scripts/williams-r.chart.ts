// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Williams %R",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // Williams %R(14) bounded [-100, 0] with -20/-80 overbought/oversold guides.
        const wr = ta.williamsR(14);
        plot(wr, { color: "#2962ff", title: "%R(14)" });

        hline(-20, { color: "#ef5350", lineStyle: "dashed", title: "Overbought" });
        hline(-80, { color: "#26a69a", lineStyle: "dashed", title: "Oversold" });
    },
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "ADX Trend Strength",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // ADX rising above 25 marks a strengthening (directional) trend.
        const adx = ta.adx(14);
        plot(adx, { color: "#ff9800", title: "ADX(14)" });
        hline(25, { color: "#9e9e9e", lineStyle: "dashed", title: "Trend threshold" });
    },
});

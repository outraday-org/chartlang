// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Price Volume Trend",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // PVT accumulates volume scaled by each bar's percentage price change,
        // so a rising line confirms volume is flowing with the trend.
        plot(ta.pvt(), { color: "#ab47bc", title: "PVT" });
        hline(0, { color: "#90a4ae", lineStyle: "dashed", title: "Zero" });
    },
});

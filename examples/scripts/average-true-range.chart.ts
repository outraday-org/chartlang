// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Average True Range",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        // Wilder's Average True Range(14) — a volatility measure in price units.
        plot(ta.atr(14), { color: "#2962ff", title: "ATR(14)" });
    },
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Percent Change",
    apiVersion: 1,
    // `format: "percent"` is a value-formatting hint: the adapter appends `%`
    // to this output's axis labels and cursor read-out, so the bar-over-bar
    // return reads as `1.4%` instead of a bare `1.4`.
    format: "percent",
    overlay: false,
    compute({ bar, plot }) {
        const pctChange = (bar.close[0] / bar.close[1] - 1) * 100;
        plot(pctChange, { color: "#2563eb", title: "Change %" });
    },
});

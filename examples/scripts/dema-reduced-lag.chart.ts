// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "DEMA Reduced Lag",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.dema (Double EMA) is 2·EMA − EMA(EMA), which cancels much of the
        // EMA's lag — plot it against a plain EMA(20) to see DEMA lead the
        // ordinary average on the same length.
        plot(ta.dema(bar.close, 20), { color: "#26a69a", title: "DEMA(20)" });
        plot(ta.ema(bar.close, 20), { color: "#ef5350", title: "EMA(20)" });
    },
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `input.bool` example: a boolean toggle gates a plot. At the default (true)
// the EMA is shown; flipping it off plots NaN so the line disappears.

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Input · Boolean Toggle",
    apiVersion: 1,
    overlay: true,
    inputs: {
        showMa: input.bool(true, { title: "Show EMA" }),
    },
    compute({ bar, ta, plot, inputs }) {
        const showMa = inputs.showMa as boolean;
        plot(showMa ? ta.ema(bar.close, 20) : Number.NaN, {
            color: "#26a69a",
            title: "EMA(20)",
            lineWidth: 2,
        });
    },
});

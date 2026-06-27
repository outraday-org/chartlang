// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `input.symbol` example: a symbol input names the instrument this script is
// tuned for; the SMA is tinted teal when the chart's own `bar.symbol` matches
// it, grey otherwise. At the default ("GOLDEN") on the demo's GOLDEN bars the
// line reads teal. (Feeding `inputs.sym` straight into `request.security` is
// avoided here: the resolved input is typed `unknown`, and the cast it would
// need defeats the compiler's static `input.symbol` symbol resolution.)

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Input · Symbol Match",
    apiVersion: 1,
    overlay: true,
    inputs: {
        sym: input.symbol("GOLDEN", { title: "Tuned-for symbol" }),
    },
    compute({ bar, ta, plot, inputs }) {
        const sym = inputs.sym as string;
        const matches = bar.symbol === sym;
        plot(ta.sma(bar.close, 20), {
            color: matches ? "#26a69a" : "#94a3b8",
            title: "SMA(20)",
            lineWidth: 2,
        });
    },
});

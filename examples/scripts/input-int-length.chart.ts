// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `input.int` example: an integer length input drives an SMA. At the default
// (20) the demo plots SMA(20) over the close.

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Input · Integer Length",
    apiVersion: 1,
    overlay: true,
    inputs: {
        length: input.int(20, { min: 2, max: 200, title: "SMA length" }),
    },
    compute({ bar, ta, plot, inputs }) {
        const length = inputs.length as number;
        plot(ta.sma(bar.close, length), { color: "#26a69a", title: "SMA", lineWidth: 2 });
    },
});

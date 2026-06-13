// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Base Trend",
    apiVersion: 1,
    overlay: true,
    inputs: { length: input.int(50, { min: 2, max: 250 }) },
    compute({ bar, ta, inputs, plot }) {
        plot(ta.ema(bar.close, inputs.length as number), {
            title: "line",
            color: "#3b82f6",
        });
    },
});

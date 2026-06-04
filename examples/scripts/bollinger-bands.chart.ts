// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Bollinger Bands",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const bands = ta.bb(bar.close, 20, { multiplier: 2 });
        plot(bands.upper, { color: "#cccccc", title: "BB Upper", lineWidth: 1 });
        plot(bands.middle, { color: "#90caf9", title: "BB Middle", lineWidth: 2 });
        plot(bands.lower, { color: "#cccccc", title: "BB Lower", lineWidth: 1 });
    },
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Keltner Channel",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        // Keltner Channel(20, 2): an EMA(20) middle with ATR(20)-scaled bands.
        const k = ta.keltner({ length: 20, multiplier: 2 });
        plot(k.upper, { color: "#cccccc", title: "Keltner Upper", lineWidth: 1 });
        plot(k.middle, { color: "#90caf9", title: "Keltner Middle", lineWidth: 2 });
        plot(k.lower, { color: "#cccccc", title: "Keltner Lower", lineWidth: 1 });
    },
});

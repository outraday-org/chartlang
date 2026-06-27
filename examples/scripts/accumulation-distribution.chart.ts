// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Accumulation/Distribution Line",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        // The A/D line weights each bar's volume by where the close lands in
        // the bar's range, accumulating net buying vs selling pressure.
        plot(ta.adl(), { color: "#26a69a", title: "A/D Line" });
    },
});

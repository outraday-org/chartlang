// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Bollinger Bandwidth",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // Bollinger Bandwidth(20, 2): the (upper − lower) / middle ratio that compresses before breakouts.
        plot(ta.bbw(bar.close, 20, { multiplier: 2 }), { color: "#2962ff", title: "BBW(20)" });
    },
});

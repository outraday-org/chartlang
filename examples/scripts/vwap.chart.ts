// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "VWAP",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        // Session VWAP is the volume-weighted mean price; overlaying it on
        // the candles shows where the average traded price sits each session.
        plot(ta.vwap(), { color: "#2962ff", title: "VWAP" });
    },
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Bidirectional Cross",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // ta.cross — fires true on the bar where the fast EMA(9) crosses the slow EMA(21) in EITHER direction (the union of crossover and crossunder), drawn as 1-spikes on a zero baseline.
        const touched = ta.cross(ta.ema(bar.close, 9), ta.ema(bar.close, 21));
        plot(touched.current ? 1 : 0, {
            color: "#ff6d00",
            title: "Cross",
            style: { kind: "histogram", baseline: 0 },
        });
    },
});

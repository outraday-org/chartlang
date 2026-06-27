// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Time Cycles",
    apiVersion: 1,
    overlay: true,
    // Time cycles live in the "other" drawing bucket; one re-used handle is the
    // whole drawing budget we need.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 1 },
    compute({ bar, draw }) {
        // Two anchors 30 bars apart set the cycle diameter; the renderer projects
        // concentric upper-half arcs centred at their midpoint and tiles them
        // across the viewport at multiples of that diameter. We anchor the start
        // 30 bars back via `bar.point` and only emit once that lookback has warmed.
        const PERIOD = 30;
        const fromPrice = bar.close[PERIOD];
        if (Number.isFinite(fromPrice)) {
            draw.timeCycles(bar.point(-PERIOD, fromPrice), bar.point(0, bar.close[0]), {
                color: "#0ea5e9",
                lineStyle: "dashed",
            });
        }
    },
});

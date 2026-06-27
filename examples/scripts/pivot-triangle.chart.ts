// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Pivot Triangle",
    apiVersion: 1,
    overlay: true,
    // One triangle reused every bar over three pivots: the lows 20 and 0 bars
    // back plus the high 10 bars back, walked as a closed three-vertex polygon.
    maxDrawings: { lines: 0, labels: 0, boxes: 1, polylines: 0, other: 0 },
    compute({ bar, draw }) {
        draw.triangle([bar.point(-20, bar.low), bar.point(-10, bar.high), bar.point(0, bar.low)], {
            stroke: "#ef4444",
            fill: "#fee2e2",
            fillAlpha: 0.5,
        });
    },
});

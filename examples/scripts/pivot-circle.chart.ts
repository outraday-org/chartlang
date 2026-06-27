// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Pivot Circle",
    apiVersion: 1,
    overlay: true,
    // One circle reused every bar: centred on the bar 10 back (its midpoint),
    // the radius anchor reaching that bar's high so the radius is its half-range.
    maxDrawings: { lines: 0, labels: 0, boxes: 1, polylines: 0, other: 0 },
    compute({ bar, draw }) {
        draw.circle(bar.point(-10, bar.hl2), bar.point(-10, bar.high), {
            stroke: "#3b82f6",
            fill: "#dbeafe",
            fillAlpha: 0.3,
        });
    },
});

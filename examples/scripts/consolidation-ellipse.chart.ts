// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Consolidation Ellipse",
    apiVersion: 1,
    overlay: true,
    // One ellipse reused every bar, inscribed in the bounding box of the last
    // 20 bars' low and the current bar's high — a consolidation-range envelope.
    maxDrawings: { lines: 0, labels: 0, boxes: 1, polylines: 0, other: 0 },
    compute({ bar, draw }) {
        draw.ellipse(bar.point(-20, bar.low), bar.point(0, bar.high), {
            stroke: "#22c55e",
            fill: "#dcfce7",
            fillAlpha: 0.3,
        });
    },
});

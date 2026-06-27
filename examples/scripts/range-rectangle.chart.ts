// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Range Rectangle",
    apiVersion: 1,
    overlay: true,
    // One rectangle reused every bar, spanning the last 20 bars' low to the
    // current bar's high — a range box over a recent N-bar window.
    maxDrawings: { lines: 0, labels: 0, boxes: 1, polylines: 0, other: 0 },
    compute({ bar, draw }) {
        draw.rectangle(bar.point(-20, bar.low), bar.point(0, bar.high), {
            stroke: "#3b82f6",
            fill: "#dbeafe",
            fillAlpha: 0.4,
        });
    },
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Swing Curve",
    apiVersion: 1,
    overlay: true,
    // One quadratic-Bezier curve reused every bar: the middle anchor (the high
    // 10 bars back) is the OFF-curve control point — the curve bends toward it.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        draw.curve([bar.point(-20, bar.low), bar.point(-10, bar.high), bar.point(0, bar.low)], {
            color: "#22c55e",
            lineWidth: 2,
        });
    },
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Elliott Impulse Wave",
    apiVersion: 1,
    overlay: true,
    // One five-wave polyline, redrawn from the same callsite every bar.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // Anchor the five impulse pivots [1,2,3,4,5] to real recent bars via
        // negative `bar.point` offsets ending at the live bar; the up-down-up-
        // down-up zig-zag is scaled by a price-relative unit so it reads on any
        // instrument. `bar.point(offset<0)` is NaN until that many bars exist,
        // so we gate on the oldest anchor to keep the run clean while warming.
        const c = bar.close.current;
        const u = Math.abs(c) * 0.01 || 1;
        const w1 = bar.point(-40, c - 5 * u);
        const w2 = bar.point(-30, c - 7 * u);
        const w3 = bar.point(-20, c - 2 * u);
        const w4 = bar.point(-10, c - 4 * u);
        const w5 = bar.point(0, c);
        if (Number.isFinite(w1.time)) {
            draw.elliottImpulseWave([w1, w2, w3, w4, w5], {
                color: "#26a69a",
                lineWidth: 2,
            });
        }
    },
});

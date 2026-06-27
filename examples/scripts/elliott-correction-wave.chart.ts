// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Elliott Correction Wave",
    apiVersion: 1,
    overlay: true,
    // One three-wave A-B-C polyline, redrawn from the same callsite every bar.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // Anchor the three correction pivots [A,B,C] to real recent bars via
        // negative `bar.point` offsets ending at the live bar; prices form a
        // down-then-up zig-zag scaled by a price-relative unit. `bar.point(
        // offset<0)` is NaN until that many bars exist, so we gate on the oldest
        // anchor to keep the run clean while the window warms.
        const c = bar.close.current;
        const u = Math.abs(c) * 0.01 || 1;
        const a = bar.point(-30, c + 2 * u);
        const b = bar.point(-15, c - 2 * u);
        const cc = bar.point(0, c);
        if (Number.isFinite(a.time)) {
            draw.elliottCorrectionWave([a, b, cc], {
                color: "#ef5350",
                lineWidth: 2,
            });
        }
    },
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Elliott Triple Combo",
    apiVersion: 1,
    overlay: true,
    // One seven-anchor W-X-Y-X-Z triple-three polyline, redrawn from one callsite.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // Anchor the seven pivots [start,W,X1,Y,X2,Zi,Z] to real recent bars via
        // negative `bar.point` offsets ending at the live bar; the prices trace a
        // choppy three-correction wander scaled by a price-relative unit.
        // `bar.point(offset<0)` is NaN until that many bars exist, so we gate on
        // the oldest anchor to keep the run clean while the window warms.
        const c = bar.close.current;
        const u = Math.abs(c) * 0.01 || 1;
        const start = bar.point(-60, c + 1 * u);
        const wEnd = bar.point(-50, c - 2 * u);
        const x1End = bar.point(-40, c);
        const yEnd = bar.point(-30, c - 3 * u);
        const x2End = bar.point(-20, c - 1 * u);
        const zMid = bar.point(-10, c - 4 * u);
        const zEnd = bar.point(0, c - 2 * u);
        if (Number.isFinite(start.time)) {
            draw.elliottTripleCombo([start, wEnd, x1End, yEnd, x2End, zMid, zEnd], {
                color: "#ffa726",
                lineWidth: 2,
            });
        }
    },
});

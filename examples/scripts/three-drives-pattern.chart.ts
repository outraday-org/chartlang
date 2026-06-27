// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Three Drives Pattern",
    apiVersion: 1,
    overlay: true,
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // 7-point three-drives reversal [start, drive1, retr1, drive2, retr2,
        // drive3, end]: an ascending staircase scaled to a 1%-of-price unit and
        // time-anchored at fixed bar offsets via bar.point, re-emitted from one
        // callsite so it reuses a handle.
        const c = bar.close[0];
        const u = c * 0.01;
        draw.threeDrivesPattern(
            [
                bar.point(-36, c - 4 * u),
                bar.point(-30, c - 1 * u),
                bar.point(-24, c - 2 * u),
                bar.point(-18, c + 1 * u),
                bar.point(-12, c),
                bar.point(-6, c + 3 * u),
                bar.point(0, c + 2 * u),
            ],
            { color: "#f9a825", lineWidth: 2 },
        );
    },
});

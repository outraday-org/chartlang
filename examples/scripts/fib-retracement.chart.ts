// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Fib Retracement",
    apiVersion: 1,
    overlay: true,
    maxDrawings: { lines: 0, labels: 5, boxes: 0, polylines: 0, other: 5 },
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            const swingLow = { time: 1_700_000_000_000, price: 100 };
            const swingHigh = { time: 1_700_030_000_000, price: 130 };

            draw.fibRetracement(swingLow, swingHigh, {
                showLabels: true,
                extendRight: true,
            });

            draw.fibTrendExtension([swingLow, swingHigh, { time: 1_700_060_000_000, price: 115 }], {
                showLabels: true,
            });

            draw.text({ time: 1_700_030_000_000, price: 135 }, "Impulse leg + 1.618 target", {
                color: "#1e293b",
                size: "normal",
            });
        }
    },
});

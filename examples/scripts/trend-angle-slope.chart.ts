// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Trend Angle Slope",
    apiVersion: 1,
    overlay: true,
    // One angled trend line (connecting line + arc + angle label), reused
    // across bars.
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, draw, plot }) {
        // Measure the screen-space slope of the EMA(20) over the last 20 bars:
        // one reused draw.trendAngle from bar.point(-20, ema 20 bars ago) to
        // bar.point(0, ema now), which renders the line plus a small arc and a
        // `${angle}°` label at the tail anchor.
        const LOOKBACK = 20;
        const trend = ta.ema(bar.close, LOOKBACK);
        plot(trend, { color: "#26a69a", title: "EMA(20)" });
        if (Number.isFinite(trend[0]) && Number.isFinite(trend[LOOKBACK])) {
            const a = bar.point(-LOOKBACK, trend[LOOKBACK]);
            const b = bar.point(0, trend[0]);
            draw.trendAngle(a, b, { color: "#22c55e", lineWidth: 2 });
        }
    },
});

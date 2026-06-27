// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Regression Trend",
    apiVersion: 1,
    overlay: true,
    // One regression channel, re-emitted every bar from this callsite, so a
    // single "polylines" slot is the whole drawing budget we need.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // An OLS regression channel over the last 50 closes with ±2σ bands: the
        // runtime persists the anchor pair (earlier `a.time` < current `b.time`)
        // + opts and the adapter fits the line. We anchor `a` 50 bars back via
        // `bar.point(-50, …)` and only emit once that lookback has warmed.
        const SPAN = 50;
        const from = bar.close[SPAN];
        if (Number.isFinite(from)) {
            draw.regressionTrend(bar.point(-SPAN, from), bar.point(0, bar.close[0]), {
                source: "close",
                stdevMultiplier: 2,
                showUpperBand: true,
                showLowerBand: true,
                color: "#3b82f6",
            });
        }
    },
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Disjoint Channel",
    apiVersion: 1,
    overlay: true,
    // A disjoint channel is two INDEPENDENT segments (no shared geometry), so a
    // single re-used "polylines" slot is the whole drawing budget we need.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // Anchor a resistance segment along the last 30 bars' highs and an
        // independent support segment along their lows. `bar.point(-N, …)`
        // resolves each negative offset to the real historical timestamp, and
        // `bar.high[N]` / `bar.low[N]` read that bar's value; we only emit once
        // the 30-bar lookback has warmed so no anchor is a non-finite NaN.
        const SPAN = 30;
        const upperFrom = bar.high[SPAN];
        const lowerFrom = bar.low[SPAN];
        if (Number.isFinite(upperFrom) && Number.isFinite(lowerFrom)) {
            draw.disjointChannel(
                [
                    bar.point(-SPAN, upperFrom),
                    bar.point(0, bar.high[0]),
                    bar.point(-SPAN, lowerFrom),
                    bar.point(0, bar.low[0]),
                ],
                { color: "#3b82f6", lineWidth: 2 },
            );
        }
    },
});

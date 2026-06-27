// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Pitchfan",
    apiVersion: 1,
    overlay: true,
    // One pitchfan, re-emitted every bar from this callsite, so a single
    // "polylines" slot is the whole drawing budget we need.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // Same three pivots as a pitchfork, but the rays DIVERGE from the single
        // pivot through the high, the midpoint of the other two, and the low —
        // a fan rather than parallel rails. Offsets resolve to real timestamps
        // via `bar.point`, guarded so warmup bars never emit a non-finite anchor.
        const SPAN = 40;
        const MID = 20;
        const pivot = bar.low[SPAN];
        const high = bar.high[MID];
        if (Number.isFinite(pivot) && Number.isFinite(high)) {
            draw.pitchfan(
                [bar.point(-SPAN, pivot), bar.point(-MID, high), bar.point(0, bar.low[0])],
                { color: "#3b82f6", lineWidth: 2 },
            );
        }
    },
});

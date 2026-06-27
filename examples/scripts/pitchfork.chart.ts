// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Pitchfork",
    apiVersion: 1,
    overlay: true,
    // One Andrews pitchfork, re-emitted every bar from this callsite, so a
    // single "polylines" slot is the whole drawing budget we need.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // Three pivots — an older low, a mid-window high, and the current low —
        // feed the standard Andrews median (pivot → midpoint of the other two)
        // with its two parallel rails. Offsets resolve to real timestamps via
        // `bar.point`, guarded so warmup bars never emit a non-finite anchor.
        const SPAN = 40;
        const MID = 20;
        const pivot = bar.low[SPAN];
        const high = bar.high[MID];
        if (Number.isFinite(pivot) && Number.isFinite(high)) {
            draw.pitchfork(
                [bar.point(-SPAN, pivot), bar.point(-MID, high), bar.point(0, bar.low[0])],
                { variant: "standard", color: "#3b82f6", lineWidth: 2 },
            );
        }
    },
});

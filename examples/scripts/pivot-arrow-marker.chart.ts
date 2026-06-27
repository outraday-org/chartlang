// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Pivot Arrow Marker",
    apiVersion: 1,
    overlay: true,
    // One arrow-marker, reused across bars, so a single "labels" slot is the budget.
    maxDrawings: { lines: 0, labels: 1, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, state, draw }) {
        // A confirmed swing high sits 5 bars back (rightLength), so bar.point(-5, …)
        // recovers its real timestamp; track it in state.* and re-anchor one reused
        // arrow-marker glyph + label there as each new pivot is confirmed.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });
        const lastTime = state.float(Number.NaN);
        const lastPrice = state.float(Number.NaN);
        if (!Number.isNaN(pivots.high.current)) {
            const anchor = bar.point(-5, pivots.high.current);
            lastTime.value = anchor.time;
            lastPrice.value = anchor.price;
        }
        if (!Number.isNaN(lastPrice.value)) {
            draw.arrowMarker(
                { time: lastTime.value, price: lastPrice.value },
                { color: "#3b82f6", text: "Pivot" },
            );
        }
    },
});

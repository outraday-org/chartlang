// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Swing-High Sell Arrow",
    apiVersion: 1,
    overlay: true,
    // One down-arrow, reused across bars, so a single "labels" slot is the budget.
    maxDrawings: { lines: 0, labels: 1, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, state, draw }) {
        // A confirmed swing high sits 5 bars back (rightLength); bar.point(-5, …)
        // recovers its timestamp. Track it in state.* and re-anchor one reused
        // bearish down-chevron there — a sell signal at each new swing high.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });
        const lastTime = state.float(Number.NaN);
        const lastPrice = state.float(Number.NaN);
        if (!Number.isNaN(pivots.high.current)) {
            const anchor = bar.point(-5, pivots.high.current);
            lastTime.value = anchor.time;
            lastPrice.value = anchor.price;
        }
        if (!Number.isNaN(lastPrice.value)) {
            draw.arrowMarkDown({ time: lastTime.value, price: lastPrice.value }, { text: "Sell" });
        }
    },
});

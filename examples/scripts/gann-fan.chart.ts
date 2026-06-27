// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Gann Fan",
    apiVersion: 1,
    overlay: true,
    // Gann drawings live in the "other" budget bucket; one fan, reused
    // across every bar from a fixed callsite, is the whole drawing budget.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 1 },
    compute({ bar, ta, state, draw }) {
        // Fan from a real pivot: track the latest confirmed
        // `ta.pivotsHighLow` swing low (price + time recovered via
        // `bar.point(-5, …)`, the literal -5 matching `rightLength`) as the
        // fan origin `a`, and aim the 1×1 ray at the live bar's high (`b`)
        // so the nine Gann angles open up from the pivot over the swing.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });
        const pivotTime = state.float(Number.NaN);
        const pivotPrice = state.float(Number.NaN);
        if (!Number.isNaN(pivots.low.current)) {
            const pivot = bar.point(-5, pivots.low.current);
            pivotTime.value = pivot.time;
            pivotPrice.value = pivot.price;
        }
        if (!Number.isNaN(pivotPrice.value)) {
            draw.gannFan(
                { time: pivotTime.value, price: pivotPrice.value },
                bar.point(0, bar.high),
                { color: "#ef5350", lineWidth: 1 },
            );
        }
    },
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Gann Box",
    apiVersion: 1,
    overlay: true,
    // Gann drawings live in the "other" budget bucket; one box, reused
    // across every bar from a fixed callsite, is the whole drawing budget.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 1 },
    compute({ bar, ta, state, draw }) {
        // Anchor the box on a real swing: track the latest confirmed
        // `ta.pivotsHighLow` swing low (price + time recovered via
        // `bar.point(-5, …)`, the literal -5 matching `rightLength`), then
        // span the box from that pivot up to the live bar's high so its
        // GANN_LEVELS ratio grid covers the current swing range.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });
        const anchorTime = state.float(Number.NaN);
        const anchorPrice = state.float(Number.NaN);
        if (!Number.isNaN(pivots.low.current)) {
            const pivot = bar.point(-5, pivots.low.current);
            anchorTime.value = pivot.time;
            anchorPrice.value = pivot.price;
        }
        if (!Number.isNaN(anchorPrice.value)) {
            draw.gannBox(
                { time: anchorTime.value, price: anchorPrice.value },
                bar.point(0, bar.high),
                { color: "#26a69a", lineWidth: 1 },
            );
        }
    },
});

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Gann Square",
    apiVersion: 1,
    overlay: true,
    // Gann drawings live in the "other" budget bucket; one square, reused
    // across every bar from a fixed callsite, is the whole drawing budget.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 1 },
    compute({ bar, ta, state, draw }) {
        // Size the square-of-nine on a real swing: track the latest
        // confirmed `ta.pivotsHighLow` swing low (price + time recovered via
        // `bar.point(-5, …)`, the literal -5 matching `rightLength`) as one
        // corner and the live bar's high as the other; the renderer takes
        // max(|dx|, |dy|) as the side and subdivides it by GANN_LEVELS.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });
        const anchorTime = state.float(Number.NaN);
        const anchorPrice = state.float(Number.NaN);
        if (!Number.isNaN(pivots.low.current)) {
            const pivot = bar.point(-5, pivots.low.current);
            anchorTime.value = pivot.time;
            anchorPrice.value = pivot.price;
        }
        if (!Number.isNaN(anchorPrice.value)) {
            draw.gannSquare(
                { time: anchorTime.value, price: anchorPrice.value },
                bar.point(0, bar.high),
                { color: "#42a5f5", lineWidth: 1 },
            );
        }
    },
});

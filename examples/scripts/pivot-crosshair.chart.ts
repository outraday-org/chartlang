// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Pivot Crosshair",
    apiVersion: 1,
    overlay: true,
    // One crosshair (orthogonal horizontal + vertical strokes through one
    // anchor), reused across bars.
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, state, draw }) {
        // Park a crosshair on the most recent confirmed swing high — both
        // strokes span the viewport through the one anchor. The pivot sits 5
        // bars back, so bar.point(-5, …) recovers its real timestamp; the one
        // reused handle jumps to each new pivot as it confirms.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });
        const anchorTime = state.float(Number.NaN);
        const anchorPrice = state.float(Number.NaN);
        if (!Number.isNaN(pivots.high.current)) {
            const anchor = bar.point(-5, pivots.high.current);
            anchorTime.value = anchor.time;
            anchorPrice.value = anchor.price;
        }
        if (!Number.isNaN(anchorPrice.value)) {
            draw.crossLine(
                { time: anchorTime.value, price: anchorPrice.value },
                { color: "#a855f7", lineStyle: "dotted" },
            );
        }
    },
});

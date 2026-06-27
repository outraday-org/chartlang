// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Fib Time Zones",
    apiVersion: 1,
    overlay: true,
    maxDrawings: { lines: 0, labels: 16, boxes: 0, polylines: 0, other: 1 },
    compute({ bar, ta, state, draw }) {
        // Paint fib-spaced vertical time zones across the span between the
        // latest pivot low and pivot high — a swing leg tracked in state.*,
        // each pivot's timestamp recovered via bar.point(-5, …) (the -5
        // matching rightLength) so the two anchors carry distinct times,
        // re-emitted per bar so one handle is reused.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });
        const lowTime = state.float(Number.NaN);
        const lowPrice = state.float(Number.NaN);
        const highTime = state.float(Number.NaN);
        const highPrice = state.float(Number.NaN);

        if (!Number.isNaN(pivots.low.current)) {
            const p = bar.point(-5, pivots.low.current);
            lowTime.value = p.time;
            lowPrice.value = p.price;
        }
        if (!Number.isNaN(pivots.high.current)) {
            const p = bar.point(-5, pivots.high.current);
            highTime.value = p.time;
            highPrice.value = p.price;
        }

        if (!Number.isNaN(lowPrice.value) && !Number.isNaN(highPrice.value)) {
            draw.fibTimeZone(
                { time: lowTime.value, price: lowPrice.value },
                { time: highTime.value, price: highPrice.value },
                { showLabels: true },
            );
        }
    },
});

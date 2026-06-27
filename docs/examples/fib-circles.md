# Fib Circles

draw.fibCircles centred on the latest pivot low with its radius set by the latest pivot high — concentric fib-ratio circles over a tracked swing leg.

[Try it live](https://chartlang.invinite.com/?script=fib-circles#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Fib Circles",
    apiVersion: 1,
    overlay: true,
    maxDrawings: { lines: 0, labels: 16, boxes: 0, polylines: 0, other: 1 },
    compute({ bar, ta, state, draw }) {
        // Anchor the circles on a tracked swing leg: the centre is the
        // latest confirmed pivot low, the radius-point the latest pivot
        // high. Each pivot sits 5 bars back (matching rightLength), so
        // bar.point(-5, …) recovers its real timestamp; the drawing is
        // re-emitted from one callsite per bar so a single handle is reused.
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
            draw.fibCircles(
                { time: lowTime.value, price: lowPrice.value },
                { time: highTime.value, price: highPrice.value },
                { showLabels: true },
            );
        }
    },
});
```

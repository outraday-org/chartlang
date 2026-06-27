# Swing-Low Buy Arrow

draw.arrowMarkUp — a bullish up-chevron buy signal at the latest confirmed swing LOW (ta.pivotsHighLow, the pivot recovered via bar.point(-5, …)). One reused handle, tracked in state.*, follows each new swing low.

[Try it live](https://chartlang.invinite.com/?script=swing-low-buy-arrow#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Swing-Low Buy Arrow",
    apiVersion: 1,
    overlay: true,
    // One up-arrow, reused across bars, so a single "labels" slot is the budget.
    maxDrawings: { lines: 0, labels: 1, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, state, draw }) {
        // A confirmed swing low sits 5 bars back (rightLength); bar.point(-5, …)
        // recovers its timestamp. Track it in state.* and re-anchor one reused
        // bullish up-chevron there — a buy signal at each new swing low.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });
        const lastTime = state.float(Number.NaN);
        const lastPrice = state.float(Number.NaN);
        if (!Number.isNaN(pivots.low.current)) {
            const anchor = bar.point(-5, pivots.low.current);
            lastTime.value = anchor.time;
            lastPrice.value = anchor.price;
        }
        if (!Number.isNaN(lastPrice.value)) {
            draw.arrowMarkUp({ time: lastTime.value, price: lastPrice.value }, { text: "Buy" });
        }
    },
});
```

# Pivot Arrow

draw.arrow — track the latest confirmed swing low in state.* slots (recovered 5 bars back via bar.point(-5, …)) and draw one reused directional arrow from it up to the current bar, with a label near the shaft.

[Try it live](https://chartlang.invinite.com/?script=pivot-arrow#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Pivot Arrow",
    apiVersion: 1,
    overlay: true,
    // One arrow, reused across bars, so a single "labels" slot is the whole
    // drawing budget (draw.arrow's bucket is `labels`).
    maxDrawings: { lines: 0, labels: 1, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, state, draw }) {
        // Track the most recent confirmed swing low (5 bars each side, so it is
        // recovered 5 bars back via bar.point(-5, …)) and draw one reused arrow
        // from that low (tail) up to the current bar (head) — the tail jumps to
        // each new pivot as it is confirmed.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });
        const tailTime = state.float(Number.NaN);
        const tailPrice = state.float(Number.NaN);
        if (!Number.isNaN(pivots.low.current)) {
            const anchor = bar.point(-5, pivots.low.current);
            tailTime.value = anchor.time;
            tailPrice.value = anchor.price;
        }
        if (!Number.isNaN(tailPrice.value)) {
            draw.arrow(
                { time: tailTime.value, price: tailPrice.value },
                bar.point(0, bar.close[0]),
                { color: "#26a69a", lineWidth: 2, label: "Swing low" },
            );
        }
    },
});
```

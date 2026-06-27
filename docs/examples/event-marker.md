# Event Marker

draw.marker — a single-anchor marker glyph dropped at a detected event (price crossing up through its EMA(20)). The crossing bar is tracked in state.* slots so one reused marker handle jumps to each new event rather than stacking a glyph per bar.

[Try it live](https://chartlang.invinite.com/?script=event-marker#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Event Marker",
    apiVersion: 1,
    overlay: true,
    // One marker, reused across bars, so a single "labels" slot is the budget.
    maxDrawings: { lines: 0, labels: 1, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, state, draw }) {
        // Detect an event — price crossing up through its EMA(20) — and remember
        // the crossing bar in persistent state.* slots so one reused marker
        // handle jumps to each new event instead of stacking a glyph per bar.
        const ema = ta.ema(bar.close, 20);
        const lastTime = state.float(Number.NaN);
        const lastPrice = state.float(Number.NaN);
        if (ta.crossover(bar.close, ema).current) {
            lastTime.value = bar.time;
            lastPrice.value = bar.close[0];
        }
        if (!Number.isNaN(lastPrice.value)) {
            draw.marker(
                { time: lastTime.value, price: lastPrice.value },
                { text: "B", size: "large", color: "#10b981" },
            );
        }
    },
});
```

# Cross Event Marker

draw.verticalLine — drop a full-height vertical marker on the bar where a fast EMA(9) crosses above a slow EMA(21) (ta.crossover), the reused line jumping to the time of each new event.

[Try it live](https://chartlang.invinite.com/?script=cross-event-marker#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Cross Event Marker",
    apiVersion: 1,
    overlay: true,
    // One full-height marker line, reused across bars.
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, state, draw }) {
        // Drop a vertical marker on the bar where a fast EMA crosses above a
        // slow EMA (draw.verticalLine takes a single time and spans the
        // viewport height); the one reused line jumps to each new crossover.
        const fast = ta.ema(bar.close, 9);
        const slow = ta.ema(bar.close, 21);
        const eventTime = state.float(Number.NaN);
        if (ta.crossover(fast, slow).current) {
            eventTime.value = bar.time;
        }
        if (!Number.isNaN(eventTime.value)) {
            draw.verticalLine(eventTime.value, { color: "#f97316", lineStyle: "dotted" });
        }
    },
});
```

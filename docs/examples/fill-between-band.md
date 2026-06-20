# Fill between series (band)

A filled ribbon between two EMAs via draw.fillBetween — the native linefill / fill() equivalent.

[Try it live](https://chartlang.invinite.com/?script=fill-between-band#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type WorldPoint, defineIndicator, draw, plot, ta } from "@invinite-org/chartlang-core";

// Two persistent edge arrays, accumulated one { time, price } vertex per bar.
const fastEdge: WorldPoint[] = [];
const slowEdge: WorldPoint[] = [];

export default defineIndicator({
    name: "Fill Between Band",
    apiVersion: 1,
    overlay: true,
    // One ribbon, re-emitted every bar from the same source line, so a single
    // "polylines" slot (fill-between's bucket) is the whole drawing budget.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, ta, plot, draw }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);

        // Plot the two EMAs so the band's edges are visible on the candles.
        plot(fast, { color: "#3b82f6", title: "EMA(12)" });
        plot(slow, { color: "#9ca3af", title: "EMA(26)" });

        // Grow both edges by one vertex per bar. The fill is the closed polygon
        // fastEdge forward then slowEdge reversed, so the two running EMAs
        // become the top and bottom of a filled ribbon.
        if (Number.isFinite(fast.current) && Number.isFinite(slow.current)) {
            fastEdge.push({ time: bar.time, price: fast.current });
            slowEdge.push({ time: bar.time, price: slow.current });
        }

        // Re-emit the band from this same source line every bar. The runtime
        // keys the callsite by its injected slot id and merges each re-emission
        // into one persistent drawing, so the ribbon extends to the new bar
        // rather than stacking a fresh fill each step.
        if (fastEdge.length >= 2) {
            draw.fillBetween(fastEdge, slowEdge, {
                fill: "#3b82f6",
                fillAlpha: 0.2,
                color: "#3b82f6",
                lineWidth: 1,
            });
        }
    },
});
```

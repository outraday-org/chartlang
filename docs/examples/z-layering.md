# Z-Order Layering

Use the presentation-only z option to cross render bands: a draw.fillBetween band given z: -1 renders BEHIND the price plot (a drawing beneath a plot, which the default group stack forbids), while an SMA at z: 1 sits on top.

[Try it live](https://chartlang.invinite.com/?script=z-layering#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type WorldPoint, defineIndicator, draw, plot, ta } from "@invinite-org/chartlang-core";

// Two persistent edge arrays, accumulated one { time, price } vertex per bar.
const fastEdge: WorldPoint[] = [];
const slowEdge: WorldPoint[] = [];

export default defineIndicator({
    name: "Z-Order Layering",
    apiVersion: 1,
    overlay: true,
    // One ribbon, re-emitted every bar from the same source line, so a single
    // "polylines" slot (fill-between's bucket) is the whole drawing budget.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, ta, plot, draw }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);

        // Grow both edges by one vertex per bar — the fast EMA is the band's
        // top, the slow EMA its bottom.
        if (Number.isFinite(fast.current) && Number.isFinite(slow.current)) {
            fastEdge.push({ time: bar.time, price: fast.current });
            slowEdge.push({ time: bar.time, price: slow.current });
        }

        // The headline: z: -1 pulls the fill BENEATH the price plot. A draw.*
        // mark renders above plots by default (its band sits higher), so a
        // negative z is the only way to put a drawing under a plot — the fixed
        // group stack alone forbids it.
        if (fastEdge.length >= 2) {
            draw.fillBetween(fastEdge, slowEdge, {
                fill: "#3b82f6",
                fillAlpha: 0.2,
                color: "#3b82f6",
                lineWidth: 1,
                z: -1,
            });
        }

        // Declared FIRST, so the default "last plot wins" stack would render
        // the SMA at the BOTTOM. z: 1 overrides that order and lifts it back
        // above the price — that inversion is the whole point: if the SMA were
        // plotted last instead, it would sit on top by default and z would be
        // doing nothing. Emission order is unchanged by z (presentation only).
        plot(ta.sma(bar.close, 20), { color: "#ef5350", title: "SMA on top", z: 1 });

        // Declared LAST (default z = 0). The "last plot wins" rule would put it
        // on top, but the SMA's z: 1 keeps it below — while its own z = 0 still
        // holds it above the z: -1 band.
        plot(bar.close, { color: "#1e293b", title: "Price" });
    },
});
```

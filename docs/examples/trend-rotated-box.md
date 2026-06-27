# Trend Rotated Box

A tilted range box — a parallelogram whose long edge follows the 20-bar low-to-high trend.

[Try it live](https://chartlang.invinite.com/?script=trend-rotated-box#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Trend Rotated Box",
    apiVersion: 1,
    overlay: true,
    // One tilted box reused every bar: a parallelogram whose long edge runs
    // along the 20-bar low-to-high trend, offset down by half the current range.
    maxDrawings: { lines: 0, labels: 0, boxes: 1, polylines: 0, other: 0 },
    compute({ bar, draw }) {
        const lo = bar.low[0];
        const hi = bar.high[0];
        const band = (hi - lo) * 0.5;
        draw.rotatedRectangle(
            [
                bar.point(-20, lo),
                bar.point(0, hi),
                bar.point(0, hi - band),
                bar.point(-20, lo - band),
            ],
            { stroke: "#22c55e", fill: "#dcfce7", fillAlpha: 0.25 },
        );
    },
});
```

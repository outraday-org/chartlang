# Double Curve Swing

A cubic-Bezier S-shape through five anchors stepped back over the last 20 bars.

[Try it live](https://chartlang.invinite.com/?script=double-curve-swing#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Double Curve Swing",
    apiVersion: 1,
    overlay: true,
    // One cubic-Bezier S-shape reused every bar through five anchors
    // [P0, P1, mid, P3, P4] stepped back over the last 20 bars (P1/P3 controls).
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        draw.doubleCurve(
            [
                bar.point(-20, bar.low),
                bar.point(-15, bar.high),
                bar.point(-10, bar.hl2),
                bar.point(-5, bar.low),
                bar.point(0, bar.high),
            ],
            { color: "#a855f7", lineWidth: 2 },
        );
    },
});
```

# Pivot Polyline

draw.polyline — a CLOSED polyline (the renderer auto-connects the last anchor back to the first) through three data-derived points: a 40-bar low, a 20-bar high, and the current close.

[Try it live](https://chartlang.invinite.com/?script=pivot-polyline#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Pivot Polyline",
    apiVersion: 1,
    overlay: true,
    // One closed polyline, reused across bars.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, ta, draw }) {
        // A CLOSED polyline (the renderer auto-connects the last anchor back to
        // the first) through three data-derived points: a 40-bar low, a 20-bar
        // high, and the current close. One reused handle, re-built each bar.
        const lo = ta.lowest(bar.low, 40);
        const hi = ta.highest(bar.high, 20);
        if (Number.isFinite(lo[0]) && Number.isFinite(hi[0])) {
            draw.polyline(
                [bar.point(-40, lo[0]), bar.point(-20, hi[0]), bar.point(0, bar.close[0])],
                { color: "#a855f7", lineWidth: 2 },
            );
        }
    },
});
```

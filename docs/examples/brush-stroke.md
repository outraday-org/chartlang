# Brush Stroke

A freehand brush stroke — a closed, filled polyline zig-zagging through a fixed point list.

[Try it live](https://chartlang.invinite.com/?script=brush-stroke#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Brush Stroke",
    apiVersion: 1,
    overlay: true,
    // One freehand brush stroke reused every bar — a closed, filled polyline
    // zig-zagging through four low/high anchors over the last 15 bars.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        draw.brush(
            [
                bar.point(-15, bar.low),
                bar.point(-10, bar.high),
                bar.point(-5, bar.low),
                bar.point(0, bar.high),
            ],
            { stroke: "#1e293b", fill: "#dbeafe" },
        );
    },
});
```

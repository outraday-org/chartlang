# Pen Stroke

A freehand pen stroke — an open polyline through a fixed point list (no auto-close).

[Try it live](https://chartlang.invinite.com/?script=pen-stroke#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Pen Stroke",
    apiVersion: 1,
    overlay: true,
    // One freehand pen stroke reused every bar — an OPEN polyline alternating
    // open/close anchors over the last 15 bars (no auto-close, unlike brush).
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        draw.pen(
            [
                bar.point(-15, bar.open),
                bar.point(-10, bar.close),
                bar.point(-5, bar.open),
                bar.point(0, bar.close),
            ],
            { color: "#1e293b", lineWidth: 2 },
        );
    },
});
```

# Swing Arc

An arc that passes through a high apex between two swing lows (apex at t = 0.5).

[Try it live](https://chartlang.invinite.com/?script=swing-arc#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Swing Arc",
    apiVersion: 1,
    overlay: true,
    // One arc reused every bar: it passes THROUGH the high apex 10 bars back
    // (t = 0.5) between two swing lows — distinct from a curve's off-curve control.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        draw.arc([bar.point(-20, bar.low), bar.point(-10, bar.high), bar.point(0, bar.low)], {
            color: "#3b82f6",
            lineWidth: 2,
        });
    },
});
```

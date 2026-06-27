# Swing High Level

draw.horizontalLine — hold a full-width horizontal level at the most recent confirmed swing high; the single reused line jumps up to each new pivot high as it confirms.

[Try it live](https://chartlang.invinite.com/?script=swing-high-level#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Swing High Level",
    apiVersion: 1,
    overlay: true,
    // One full-width level line, reused across bars.
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ ta, state, draw }) {
        // Hold a horizontal level at the most recent confirmed swing high
        // (draw.horizontalLine takes a single price and spans the viewport);
        // the one reused line jumps up to each new pivot high as it confirms.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });
        const level = state.float(Number.NaN);
        if (!Number.isNaN(pivots.high.current)) {
            level.value = pivots.high.current;
        }
        if (!Number.isNaN(level.value)) {
            draw.horizontalLine(level.value, {
                color: "#ef5350",
                lineWidth: 1,
                lineStyle: "dashed",
            });
        }
    },
});
```

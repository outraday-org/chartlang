# Gann Square (Fixed)

draw.gannSquareFixed pinned to a single tracked anchor: an 80×80px scale-locked square-of-nine on the latest ta.pivotsHighLow swing low (time recovered via bar.point(-5, …)), the single-anchor counterpart to gann-square.

[Try it live](https://chartlang.invinite.com/?script=gann-square-fixed#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Gann Square (Fixed)",
    apiVersion: 1,
    overlay: true,
    // Gann drawings live in the "other" budget bucket; one square, reused
    // across every bar from a fixed callsite, is the whole drawing budget.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 1 },
    compute({ bar, ta, state, draw }) {
        // Fixed-scale square needs only a single world anchor (the renderer
        // paints an 80×80px square subdivided by GANN_LEVELS, scale-locked):
        // pin it to the latest confirmed `ta.pivotsHighLow` swing low, whose
        // time is recovered via `bar.point(-5, …)` (the literal -5 matching
        // `rightLength`), so the square sits on the most recent pivot.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });
        const anchorTime = state.float(Number.NaN);
        const anchorPrice = state.float(Number.NaN);
        if (!Number.isNaN(pivots.low.current)) {
            const pivot = bar.point(-5, pivots.low.current);
            anchorTime.value = pivot.time;
            anchorPrice.value = pivot.price;
        }
        if (!Number.isNaN(anchorPrice.value)) {
            draw.gannSquareFixed(
                { time: anchorTime.value, price: anchorPrice.value },
                { color: "#ab47bc", lineWidth: 1 },
            );
        }
    },
});
```

# Idiom · Bar Point Anchors

`bar.point(offset, price)` drawing anchors spanning past and future: one line from `bar.point(-20, …)` to `bar.point(+20, …)`.

[Try it live](https://chartlang.invinite.com/?script=idiom-bar-point#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Idiom · Bar Point Anchors",
    apiVersion: 1,
    overlay: true,
    // One line, redrawn every bar from the same source line, so a single
    // "lines" slot is the whole drawing budget we need.
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, draw }) {
        // Idiom: `bar.point(offset, price)` resolves an integer bar offset to a
        // `{ time, price }` WorldPoint at compute time, spanning past and future
        // (docs/language/series-and-indexing.md § "Anchoring drawings by bar
        // offset"). A NEGATIVE literal offset uses the real historical timestamp
        // (and contributes to lookback like `series[n]`); a POSITIVE offset
        // extrapolates a future timestamp (`lastTime + n * spacing`). One line is
        // re-emitted from this callsite each bar, so it slides with the chart.
        draw.line(bar.point(-20, bar.close), bar.point(20, bar.close), {
            color: "#3b82f6",
            lineWidth: 2,
        });
    },
});
```

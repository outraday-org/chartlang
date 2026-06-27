# Cyclic Lines

draw.cyclicLines — two anchors 20 bars apart set the cycle period; the renderer tiles equally spaced vertical strokes to the right at every from.time + n*period.

[Try it live](https://chartlang.invinite.com/?script=cyclic-lines#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Cyclic Lines",
    apiVersion: 1,
    overlay: true,
    // Cyclic lines live in the "other" drawing bucket; one re-used handle is the
    // whole drawing budget we need.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 1 },
    compute({ bar, draw }) {
        // Two anchors 20 bars apart set the cycle PERIOD (|to.time − from.time|);
        // the renderer then tiles equally spaced vertical strokes to the right at
        // every `from.time + n*period`. We anchor the start 20 bars back via
        // `bar.point` and only emit once that lookback has warmed.
        const PERIOD = 20;
        const fromPrice = bar.close[PERIOD];
        if (Number.isFinite(fromPrice)) {
            draw.cyclicLines(bar.point(-PERIOD, fromPrice), bar.point(0, bar.close[0]), {
                color: "#0ea5e9",
                lineStyle: "dashed",
            });
        }
    },
});
```

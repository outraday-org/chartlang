# Flat Top / Bottom

draw.flatTopBottom — two parallel HORIZONTAL rails over a 30-bar consolidation: the flat top at the window's highest high and the flat bottom at its lowest low, scanned in a bounded loop.

[Try it live](https://chartlang.invinite.com/?script=flat-top-bottom#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Flat Top / Bottom",
    apiVersion: 1,
    overlay: true,
    // One consolidation channel, re-emitted every bar from this callsite, so a
    // single "polylines" slot is the whole drawing budget we need.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // Two parallel HORIZONTAL rails over a 30-bar consolidation (indices
        // 0..29): scan the window for its highest high (the flat top) and lowest
        // low, then anchor leftEdge/rightEdge to fix the time range at the top
        // price and let oppositeHook.price carry the bottom. The `for` bound must
        // be a numeric literal, and indexing inside it is plain series reads (not
        // a stateful call), so the loop is allowed.
        let top = bar.high[0];
        let bottom = bar.low[0];
        for (let i = 1; i < 30; i++) {
            const h = bar.high[i];
            const l = bar.low[i];
            if (h > top) top = h;
            if (l < bottom) bottom = l;
        }
        if (Number.isFinite(top) && Number.isFinite(bottom)) {
            draw.flatTopBottom([bar.point(-29, top), bar.point(0, top), bar.point(0, bottom)], {
                color: "#3b82f6",
                lineStyle: "dashed",
            });
        }
    },
});
```

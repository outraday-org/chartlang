# Elliott Triangle Wave

A five-wave Elliott a-b-c-d-e triangle correction whose swing amplitude contracts toward the apex.

[Try it live](https://chartlang.invinite.com/?script=elliott-triangle-wave#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Elliott Triangle Wave",
    apiVersion: 1,
    overlay: true,
    // One five-wave a-e triangle polyline, redrawn from the same callsite.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // Anchor the five triangle pivots [a,b,c,d,e] to real recent bars via
        // negative `bar.point` offsets ending at the live bar; the swing
        // amplitude contracts toward the apex (the triangle shape) and is scaled
        // by a price-relative unit. `bar.point(offset<0)` is NaN until that many
        // bars exist, so we gate on the oldest anchor while the window warms.
        const c = bar.close.current;
        const u = Math.abs(c) * 0.01 || 1;
        const a = bar.point(-40, c + 4 * u);
        const b = bar.point(-30, c - 3 * u);
        const cPt = bar.point(-20, c + 2 * u);
        const d = bar.point(-10, c - 1 * u);
        const e = bar.point(0, c);
        if (Number.isFinite(a.time)) {
            draw.elliottTriangleWave([a, b, cPt, d, e], {
                color: "#42a5f5",
                lineWidth: 2,
            });
        }
    },
});
```

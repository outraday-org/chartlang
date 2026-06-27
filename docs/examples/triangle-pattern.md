# Triangle Pattern

draw.trianglePattern — a 3-point triangle continuation [apex, baseHigh, baseLow] converging from a base to a current-bar apex; the LineDrawStyle outline form, distinct from the solid draw.triangle shape.

[Try it live](https://chartlang.invinite.com/?script=triangle-pattern#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Triangle Pattern",
    apiVersion: 1,
    overlay: true,
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // 3-point triangle continuation [apex, baseHigh, baseLow]: a high/low
        // base 30 bars back converging to an apex at the current bar, scaled to
        // a 1%-of-price unit and time-anchored via bar.point — the outline
        // (LineDrawStyle) form, distinct from the solid draw.triangle shape.
        const c = bar.close[0];
        const u = c * 0.01;
        draw.trianglePattern(
            [bar.point(0, c), bar.point(-30, c + 3 * u), bar.point(-30, c - 3 * u)],
            { color: "#3949ab", lineWidth: 2 },
        );
    },
});
```

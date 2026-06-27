# Swing Path

draw.path — an OPEN path (no wrap-around close, unlike draw.polyline) tracing the close at five fixed bar.point offsets back to the current bar, drawn once 40 bars of history exist.

[Try it live](https://chartlang.invinite.com/?script=swing-path#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Swing Path",
    apiVersion: 1,
    overlay: true,
    // One open path, reused across bars.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // An OPEN path (no wrap-around close, unlike draw.polyline) tracing the
        // close at five fixed offsets back to the current bar. Guarded on the
        // deepest lookback so it only draws once 40 bars of history exist; one
        // reused handle, re-built each bar.
        if (Number.isFinite(bar.close[40])) {
            draw.path(
                [
                    bar.point(-40, bar.close[40]),
                    bar.point(-30, bar.close[30]),
                    bar.point(-20, bar.close[20]),
                    bar.point(-10, bar.close[10]),
                    bar.point(0, bar.close[0]),
                ],
                { color: "#3b82f6", lineWidth: 2 },
            );
        }
    },
});
```

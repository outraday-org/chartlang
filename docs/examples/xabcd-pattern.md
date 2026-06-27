# XABCD Pattern

draw.xabcdPattern — a 5-point XABCD harmonic pattern [X, A, B, C, D] time-anchored at fixed bar offsets via bar.point and scaled to a 1%-of-price unit.

[Try it live](https://chartlang.invinite.com/?script=xabcd-pattern#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "XABCD Pattern",
    apiVersion: 1,
    overlay: true,
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // 5-point XABCD harmonic pattern [X, A, B, C, D]: legs scaled to a
        // 1%-of-price unit and time-anchored at fixed bar offsets via
        // bar.point, re-emitted from one callsite so it reuses a handle.
        const c = bar.close[0];
        const u = c * 0.01;
        draw.xabcdPattern(
            [
                bar.point(-40, c + 3 * u),
                bar.point(-30, c - 3 * u),
                bar.point(-20, c + 1 * u),
                bar.point(-10, c - 2 * u),
                bar.point(0, c + 2 * u),
            ],
            { color: "#00897b", lineWidth: 2 },
        );
    },
});
```

# Head and Shoulders

draw.headAndShoulders — a 5-point head-and-shoulders reversal [leftShoulder, leftLow, head, rightLow, rightShoulder] with the head topping the shoulders over a shared neckline, anchored via bar.point.

[Try it live](https://chartlang.invinite.com/?script=head-and-shoulders#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Head and Shoulders",
    apiVersion: 1,
    overlay: true,
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // 5-point head-and-shoulders [leftShoulder, leftLow, head, rightLow,
        // rightShoulder]: the head tops the two shoulders over a shared
        // neckline, scaled to a 1%-of-price unit and time-anchored at fixed bar
        // offsets via bar.point, re-emitted from one callsite so it reuses a handle.
        const c = bar.close[0];
        const u = c * 0.01;
        draw.headAndShoulders(
            [
                bar.point(-40, c + 2 * u),
                bar.point(-30, c - 1 * u),
                bar.point(-20, c + 4 * u),
                bar.point(-10, c - 1 * u),
                bar.point(0, c + 2 * u),
            ],
            { color: "#ef5350", lineWidth: 2 },
        );
    },
});
```

# Trend Channel

draw.trendChannel — a parallel trend channel: two anchors set the primary support line over the recent lows and a third mid-window high is offset perpendicular to fix the parallel upper rail.

[Try it live](https://chartlang.invinite.com/?script=trend-channel#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Trend Channel",
    apiVersion: 1,
    overlay: true,
    // One parallel channel, re-emitted every bar from this callsite, so a
    // single "polylines" slot is the whole drawing budget we need.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        // The first two anchors define the primary trend line along the recent
        // lows (a 30-bar support leg); the third (a mid-window high) is offset
        // perpendicular to set the parallel upper rail. Offsets resolve to real
        // timestamps via `bar.point`, guarded so warmup bars never emit a NaN.
        const SPAN = 30;
        const HALF = 15;
        const primaryFrom = bar.low[SPAN];
        const parallelHook = bar.high[HALF];
        if (Number.isFinite(primaryFrom) && Number.isFinite(parallelHook)) {
            draw.trendChannel(
                [
                    bar.point(-SPAN, primaryFrom),
                    bar.point(0, bar.low[0]),
                    bar.point(-HALF, parallelHook),
                ],
                { color: "#3b82f6", lineWidth: 2 },
            );
        }
    },
});
```

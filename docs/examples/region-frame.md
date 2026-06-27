# Region Frame

A labelled rectangular frame highlighting a recent N-bar region with a background fill.

[Try it live](https://chartlang.invinite.com/?script=region-frame#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Region Frame",
    apiVersion: 1,
    overlay: true,
    // One labelled frame reused every bar from the 20-bar-back high (top-left)
    // to the current low (bottom-right) — a framed region highlight with a label.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 1 },
    compute({ bar, draw }) {
        draw.frame(bar.point(-20, bar.high), bar.point(0, bar.low), {
            label: "Range",
            bgColor: "#f1f5f9",
        });
    },
});
```

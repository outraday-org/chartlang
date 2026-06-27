# Price Zone Highlight

A thick translucent highlighter band over the close level across a recent window.

[Try it live](https://chartlang.invinite.com/?script=price-zone-highlight#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Price Zone Highlight",
    apiVersion: 1,
    overlay: true,
    // One thick translucent highlighter stroke reused every bar, banding the
    // close level across the last 20 bars — a highlighted price zone.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 1, other: 0 },
    compute({ bar, draw }) {
        draw.highlighter([bar.point(-20, bar.close), bar.point(0, bar.close)], {
            color: "#facc15",
            alpha: 0.3,
        });
    },
});
```

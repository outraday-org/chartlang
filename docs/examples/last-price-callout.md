# Last Price Callout

draw.text — a freeform text annotation anchored just above the current bar via bar.point(0, …) (offset 0 == the live bar). Re-emitting from one callsite every bar reuses a single handle, so the callout tracks the last bar.

[Try it live](https://chartlang.invinite.com/?script=last-price-callout#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Last Price Callout",
    apiVersion: 1,
    overlay: true,
    // One text annotation, reused across bars, so a single "labels" slot is the budget.
    maxDrawings: { lines: 0, labels: 1, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, draw }) {
        // Anchor a freeform text callout just above the current bar via
        // bar.point(0, …) (offset 0 == the live bar); re-emitting from this same
        // callsite every bar reuses one handle, so the label tracks the last bar.
        draw.text(bar.point(0, bar.high), "Last", {
            color: "#1e293b",
            size: "normal",
            valign: "bottom",
        });
    },
});
```

# Define · requiresIntervals

The `requiresIntervals: ["1D"]` override declaring the interval the adapter must ship for a daily-only trend line.

[Try it live](https://chartlang.invinite.com/?script=define-requires-intervals#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Daily-Required Trend",
    apiVersion: 1,
    // `requiresIntervals: ["1D"]` declares the intervals the adapter must
    // ship in `Capabilities.intervals` for this script to be meaningful —
    // here a daily trend line that only makes sense on a `1D` chart.
    requiresIntervals: ["1D"],
    overlay: true,
    compute({ bar, ta, plot }) {
        const trend = ta.sma(bar.close, 50);
        plot(trend, { color: "#9333ea", title: "Daily trend" });
    },
});
```

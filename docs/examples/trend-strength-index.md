# Trend Strength Index

ta.trendStrengthIndex — the Pearson correlation between price and the bar index over a 20-bar window, bounded [-1, +1] around a zero line.

[Try it live](https://chartlang.invinite.com/?script=trend-strength-index#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Trend Strength Index",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // Pearson correlation of price vs bar index over 20 bars, bounded [-1, +1].
        const tsi = ta.trendStrengthIndex(bar.close, 20);
        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
        plot(tsi, { color: "#2962ff", title: "Trend Strength(20)" });
    },
});
```

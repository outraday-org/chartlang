# Rate of Change

ta.roc(12): percent change versus 12 bars ago, oscillating around a zero line.

[Try it live](https://chartlang.invinite.com/?script=rate-of-change#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Rate of Change",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // Rate of Change(12): percent change vs 12 bars ago, oscillating around zero.
        const roc = ta.roc(bar.close, 12);
        plot(roc, { color: "#2962ff", title: "ROC(12) %" });

        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
    },
});
```

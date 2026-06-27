# Define · precision

The `precision: 4` override forcing four decimal places on a plotted EMA, overriding the symbol's default precision.

[Try it live](https://chartlang.invinite.com/?script=define-precision#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "High-Precision EMA",
    apiVersion: 1,
    // `precision: 4` renders this output with four decimal places in axis
    // labels and the cursor read-out, overriding the symbol's default
    // precision (`undefined` would follow the symbol).
    precision: 4,
    overlay: true,
    compute({ bar, ta, plot }) {
        const ema = ta.ema(bar.close, 20);
        plot(ema, { color: "#16a34a", title: "EMA(20)" });
    },
});
```

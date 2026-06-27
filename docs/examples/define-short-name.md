# Define · shortName

The `shortName: "EMA20"` override setting the compact legend-chip label that otherwise falls back to a truncated name.

[Try it live](https://chartlang.invinite.com/?script=define-short-name#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Exponential Moving Average (20)",
    apiVersion: 1,
    // `shortName` is the compact label shown in the legend chip; without it
    // the chip falls back to a truncated `name`.
    shortName: "EMA20",
    overlay: true,
    compute({ bar, ta, plot }) {
        const ema = ta.ema(bar.close, 20);
        plot(ema, { color: "#ea580c", title: "EMA(20)" });
    },
});
```

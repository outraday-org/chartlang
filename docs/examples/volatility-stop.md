# Volatility Stop

Volatility Stop via ta.volatilityStop(20, 2) — an ATR trailing stop that sits below price in up-trends and above it in down-trends.

[Try it live](https://chartlang.invinite.com/?script=volatility-stop#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Volatility Stop",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        // ATR trailing stop that sits below price in up-trends, above in down.
        const v = ta.volatilityStop({ length: 20, multiplier: 2 });
        plot(v.value, { color: "#ab47bc", title: "Volatility Stop", lineWidth: 2 });
    },
});
```

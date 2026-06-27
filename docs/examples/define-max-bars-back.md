# Define · maxBarsBack

The `maxBarsBack: 500` override reserving a fixed history ring (Pine `max_bars_back` parity) under a 200-period SMA.

[Try it live](https://chartlang.invinite.com/?script=define-max-bars-back#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Long Lookback SMA",
    apiVersion: 1,
    // `maxBarsBack: 500` reserves a 500-bar history ring regardless of what
    // the compiler infers from `series[N]` reads — Pine's `max_bars_back`
    // parity, for scripts whose lookback grows at runtime. `0` keeps the
    // runtime default.
    maxBarsBack: 500,
    overlay: true,
    compute({ bar, ta, plot }) {
        const ma = ta.sma(bar.close, 200);
        plot(ma, { color: "#0ea5e9", title: "SMA(200)" });
    },
});
```

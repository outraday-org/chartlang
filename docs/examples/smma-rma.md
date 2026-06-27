# Smoothed MA (RMA)

ta.smma — Wilder's smoothed/running MA (the α = 1/length recurrence under RSI and ATR) overlaid on a plain SMA(14).

[Try it live](https://chartlang.invinite.com/?script=smma-rma#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Smoothed MA (RMA)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.smma is Wilder's smoothed/running MA (RMA) — the slow α = 1/length
        // recurrence underneath RSI and ATR. Plot SMMA(14) over a plain SMA(14)
        // to see how much smoother the running average rides.
        plot(ta.smma(bar.close, 14), { color: "#26a69a", title: "SMMA(14)" });
        plot(ta.sma(bar.close, 14), { color: "#ef5350", title: "SMA(14)" });
    },
});
```

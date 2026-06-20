# Manual SMA

Define an SMA by hand from the price series: a bounded for loop sums bar.close[i] over the window (the loop index is sized precisely), averages the last 5 closes, and overlays ta.sma(5).

[Try it live](https://chartlang.invinite.com/?script=manual-sma#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Manual SMA",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // An SMA is just the mean of the last N closes. chartlang ships a
        // built-in `ta.sma`, but you can also spell the formula out by hand
        // straight from the price series.
        //
        // `bar.close` is a price series: `bar.close[0]` is the current close,
        // `bar.close[1]` is one bar ago, and so on. Index it directly — no
        // helper needed. (It still works as a plain number too, so
        // `bar.close * 2` and `ta.sma(bar.close, 5)` are fine.)
        //
        // Mean of the last 5 closes. `bar.close` is a price series, so a
        // bounded `for` loop indexes the window directly: chartlang resolves
        // `bar.close[i]` over the literal loop bounds, so the buffer is sized
        // to exactly 5 slots (maxLookback 4) with no dynamic-index warning —
        // identical to spelling out `(bar.close[0] + ... + bar.close[4]) / 5`.
        // Out-of-range reads are NaN, so this warms up over 4 bars,
        // bar-for-bar identical to ta.sma(close, 5).
        let sum = 0;
        for (let i = 0; i < 5; i++) {
            sum += bar.close[i];
        }
        const manual = sum / 5;

        // Plot the built-in red ta.sma(5) first, then the green manual line
        // last so it renders on top — they coincide bar-for-bar after warmup,
        // so the green manual SMA sits over the red automatic one.
        plot(ta.sma(bar.close, 5), { color: "#ef5350", title: "ta.sma(5)" });
        plot(manual, { color: "#26a69a", title: "Manual SMA(5)" });
    },
});
```

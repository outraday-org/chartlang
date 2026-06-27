# Idiom · Bounded Loop Window

A rolling mean expressed as a bounded `for (i < N) bar.close[i]` loop — the loop form of an unrolled `series[0] + … + series[N]`, sized identically by the compiler.

[Try it live](https://chartlang.invinite.com/?script=idiom-bounded-loop#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Idiom · Bounded Loop Window",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        // Idiom: a rolling window via a BOUNDED `for` loop over `bar.close[i]`
        // (docs/language/series-and-indexing.md § "Lookback is bounded"). The
        // loop bound MUST be a numeric LITERAL and the index an affine lookback,
        // so the compiler proves it bounded — the loop form of an unrolled
        // `bar.close[0] + … + bar.close[19]`, sized to exactly 20 slots, never
        // tripping the `dynamic-series-index` fallback.
        let sum = 0;
        for (let i = 0; i < 20; i++) {
            sum += bar.close[i];
        }
        const mean = bar.close.length >= 20 ? sum / 20 : Number.NaN;
        plot(mean, { title: "SMA(20) — bounded loop", color: "#26a69a" });
    },
});
```

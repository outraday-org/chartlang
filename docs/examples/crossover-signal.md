# Crossover Signal

ta.crossover — true only on the bar where the fast EMA(9) crosses above the slow EMA(21) (a golden-cross trigger), drawn as 1-spikes on a zero baseline.

[Try it live](https://chartlang.invinite.com/?script=crossover-signal#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Crossover Signal",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // ta.crossover — fires true only on the bar where the fast EMA(9) crosses above the slow EMA(21) (a golden-cross trigger), drawn as 1-spikes on a zero baseline.
        const up = ta.crossover(ta.ema(bar.close, 9), ta.ema(bar.close, 21));
        plot(up.current ? 1 : 0, {
            color: "#26a69a",
            title: "Cross up",
            style: { kind: "histogram", baseline: 0 },
        });
    },
});
```

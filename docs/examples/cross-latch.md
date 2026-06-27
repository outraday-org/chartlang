# Cross Latch

state.bool — a persistent boolean slot (Pine var bool) latched true the first time price crosses above its SMA(20) and held true thereafter, recording that the event happened at some point in history.

[Try it live](https://chartlang.invinite.com/?script=cross-latch#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Cross Latch",
    apiVersion: 1,
    overlay: false,
    compute({ bar, state, plot, ta }) {
        // Persistent boolean slot (Pine `var bool`): latched true the first
        // time price crosses above its SMA(20) and held true forever after,
        // so the flag records that the event happened at some point in history.
        const crossed = state.bool(false);
        const ma = ta.sma(bar.close, 20);
        if (ta.crossover(bar.close, ma).current) {
            crossed.value = true;
        }
        plot(crossed.value ? 1 : 0, { title: "Crossed once", style: { kind: "step-line" } });
    },
});
```

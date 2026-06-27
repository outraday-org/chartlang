# Bar Counter

state.int — a persistent integer slot (Pine var int) seeded once and incremented every bar, plotted as a step series so the cross-bar accumulation is visible.

[Try it live](https://chartlang.invinite.com/?script=bar-counter#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Bar Counter",
    apiVersion: 1,
    overlay: false,
    compute({ state, plot }) {
        // Persistent integer slot (Pine `var int`): seeded once on the first
        // bar, incremented every bar, and held across bars — so the plotted
        // value accumulates over the whole history instead of resetting.
        const count = state.int(0);
        count.value += 1;
        plot(count.value, { title: "Bars elapsed", style: { kind: "step-line" } });
    },
});
```

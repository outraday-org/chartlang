# Value At Cross

ta.valuewhen — the close captured at the most recent SMA(10)/SMA(30) crossover, held constant between events as a stepped reference level on price.

[Try it live](https://chartlang.invinite.com/?script=value-at-cross#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Value At Cross",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.valuewhen — the close captured at the most recent SMA(10)/SMA(30) crossover, held constant between events as a stepped reference level on price.
        const fast = ta.sma(bar.close, 10);
        const slow = ta.sma(bar.close, 30);
        const atCross = ta.valuewhen(ta.crossover(fast, slow), bar.close);
        plot(atCross, { color: "#fb8c00", title: "Close @ last cross", style: { kind: "step-line" } });
    },
});
```

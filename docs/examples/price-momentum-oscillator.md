# Price Momentum Oscillator

ta.pmo — Carl Swenlin's doubly-smoothed rate-of-change momentum line plus its EMA signal line, around zero.

[Try it live](https://chartlang.invinite.com/?script=price-momentum-oscillator#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Price Momentum Oscillator",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // Swenlin's PMO: doubly-smoothed ROC line plus its EMA signal, around zero.
        const p = ta.pmo(bar.close);
        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
        plot(p.pmo, { color: "#2962ff", title: "PMO" });
        plot(p.signal, { color: "#ff6d00", title: "Signal" });
    },
});
```

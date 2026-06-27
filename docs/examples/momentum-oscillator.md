# Momentum

ta.momentum(10): the raw close − close[10] difference oscillating around a zero line.

[Try it live](https://chartlang.invinite.com/?script=momentum-oscillator#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Momentum",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // Momentum(10): the raw close − close[10] difference around a zero line.
        const mom = ta.momentum(bar.close, 10);
        plot(mom, { color: "#2962ff", title: "Momentum(10)" });

        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
    },
});
```

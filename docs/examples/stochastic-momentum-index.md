# Stochastic Momentum Index

ta.smi(10,3,5) with its EMA(3) signal line and ±40 guides — Blau's double-smoothed Stochastic Momentum Index.

[Try it live](https://chartlang.invinite.com/?script=stochastic-momentum-index#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Stochastic Momentum Index",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // SMI(10,3,5) with its EMA(3) signal line and ±40 guide levels.
        const smi = ta.smi();
        plot(smi.smi, { color: "#2962ff", title: "SMI" });
        plot(smi.signal, { color: "#ff6d00", title: "Signal" });

        hline(40, { color: "#ef5350", lineStyle: "dashed", title: "Overbought" });
        hline(-40, { color: "#26a69a", lineStyle: "dashed", title: "Oversold" });
    },
});
```

# Ultimate Oscillator

ta.ultimateOsc — Larry Williams' weighted blend of buying-pressure / true-range ratios over 7/14/28 windows, bounded [0, 100] with 70/30 guides.

[Try it live](https://chartlang.invinite.com/?script=ultimate-oscillator#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Ultimate Oscillator",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // Williams' weighted buying-pressure ratio over 7/14/28 windows, [0, 100].
        const uo = ta.ultimateOsc();
        hline(70, { color: "#ef5350", lineStyle: "dashed", title: "Overbought" });
        hline(30, { color: "#26a69a", lineStyle: "dashed", title: "Oversold" });
        plot(uo, { color: "#9c27b0", title: "Ultimate Osc" });
    },
});
```

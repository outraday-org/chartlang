# Percentage Price Oscillator

ta.ppo — MACD's shape normalised by the slow EMA so the line, signal, and histogram are scale-invariant across symbols.

[Try it live](https://chartlang.invinite.com/?script=ppo-oscillator#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Percentage Price Oscillator",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // Scale-invariant MACD: line + signal + histogram normalised by the slow EMA.
        const p = ta.ppo(bar.close);
        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
        plot(p.hist, {
            color: "#26a69a",
            title: "Histogram",
            style: { kind: "histogram", baseline: 0 },
        });
        plot(p.ppo, { color: "#2962ff", title: "PPO" });
        plot(p.signal, { color: "#ff6d00", title: "Signal" });
    },
});
```

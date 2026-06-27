# Chaikin Oscillator

Chaikin Oscillator via ta.chaikinOsc — the difference of a fast and slow EMA of the Accumulation/Distribution line.

[Try it live](https://chartlang.invinite.com/?script=chaikin-oscillator#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Chaikin Oscillator",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // The Chaikin oscillator is the difference of a fast (3) and slow (10)
        // EMA of the Accumulation/Distribution line, measuring its momentum.
        plot(ta.chaikinOsc(), { color: "#7e57c2", title: "Chaikin Osc" });
        hline(0, { color: "#90a4ae", lineStyle: "dashed", title: "Zero" });
    },
});
```

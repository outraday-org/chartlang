# Awesome Oscillator

ta.ao — Bill Williams' SMA(hl2, 5) − SMA(hl2, 34) momentum spread drawn as a zero-based histogram.

[Try it live](https://chartlang.invinite.com/?script=awesome-oscillator#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Awesome Oscillator",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // SMA(hl2, 5) − SMA(hl2, 34) drawn as a zero-based momentum histogram.
        const ao = ta.ao();
        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
        plot(ao, { color: "#26a69a", title: "AO", style: { kind: "histogram", baseline: 0 } });
    },
});
```

# Define · scale

The `scale: "right"` override binding a sub-pane oscillator to the right axis instead of the price overlay.

[Try it live](https://chartlang.invinite.com/?script=define-scale#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Right-Scaled Oscillator",
    apiVersion: 1,
    // `scale: "right"` binds this sub-pane output to the right axis instead
    // of the price overlay (which `"price"` would request); `"left"` / `"new"`
    // pick the other side / a fresh sub-pane.
    scale: "right",
    overlay: false,
    compute({ bar, ta, plot }) {
        const osc = bar.close - ta.sma(bar.close, 20).current;
        plot(osc, { color: "#db2777", title: "Close − SMA(20)" });
    },
});
```

# Klinger Volume Oscillator

Klinger Volume Oscillator via ta.klinger — the oscillator line plus its EMA signal, with crossings flagging volume-momentum shifts.

[Try it live](https://chartlang.invinite.com/?script=klinger-oscillator#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Klinger Volume Oscillator",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // The Klinger oscillator (fast/slow EMAs of volume force) plus its
        // EMA signal line; crossings of the two flag volume-momentum shifts.
        const k = ta.klinger();
        plot(k.klinger, { color: "#2962ff", title: "Klinger" });
        plot(k.signal, { color: "#ff6d00", title: "Signal" });
        hline(0, { color: "#90a4ae", lineStyle: "dashed", title: "Zero" });
    },
});
```

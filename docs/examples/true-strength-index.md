# True Strength Index

ta.tsi(25,13) with its EMA(13) signal line around a zero centre line — Blau's double-smoothed momentum ratio.

[Try it live](https://chartlang.invinite.com/?script=true-strength-index#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "True Strength Index",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // TSI(25,13) with its EMA(13) signal line around a zero centre line.
        const tsi = ta.tsi(bar.close);
        plot(tsi.tsi, { color: "#2962ff", title: "TSI" });
        plot(tsi.signal, { color: "#ff6d00", title: "Signal" });

        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
    },
});
```

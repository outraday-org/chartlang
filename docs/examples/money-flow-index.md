# Money Flow Index

Money Flow Index(14) via ta.mfi — a volume-weighted RSI bounded 0-100 with 80/20 overbought/oversold guides.

[Try it live](https://chartlang.invinite.com/?script=money-flow-index#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Money Flow Index",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // MFI(14) is a volume-weighted RSI bounded 0-100; the 80/20 guides
        // mark the overbought / oversold money-flow extremes.
        plot(ta.mfi(14), { color: "#26c6da", title: "MFI(14)" });
        hline(80, { color: "#ef5350", lineStyle: "dashed", title: "Overbought" });
        hline(20, { color: "#26a69a", lineStyle: "dashed", title: "Oversold" });
    },
});
```

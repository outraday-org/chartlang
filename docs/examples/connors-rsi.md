# Connors RSI

ta.connorsRsi — Larry Connors' three-component composite (price RSI, streak RSI, ROC percent-rank) averaged into one [0, 100] line with 90/10 guides.

[Try it live](https://chartlang.invinite.com/?script=connors-rsi#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Connors RSI",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // Connors' three-component composite RSI, bounded [0, 100] with 90/10 guides.
        const crsi = ta.connorsRsi(bar.close);
        hline(90, { color: "#ef5350", lineStyle: "dashed", title: "Overbought" });
        hline(10, { color: "#26a69a", lineStyle: "dashed", title: "Oversold" });
        plot(crsi, { color: "#9c27b0", title: "Connors RSI" });
    },
});
```

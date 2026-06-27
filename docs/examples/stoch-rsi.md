# Stochastic RSI

ta.stochRsi %K/%D in its own pane with 80/20 overbought/oversold guide levels — the Stochastic transform of the RSI series.

[Try it live](https://chartlang.invinite.com/?script=stoch-rsi#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Stochastic RSI",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // %K/%D of the RSI series — StochRSI(14,14,3,3) defaults (RSI length 14,
        // stoch length 14, %K and %D smoothing 3) — with 80/20 overbought/
        // oversold guides.
        const stochRsi = ta.stochRsi(bar.close);
        plot(stochRsi.k, { color: "#2962ff", title: "%K" });
        plot(stochRsi.d, { color: "#ff6d00", title: "%D" });

        hline(80, { color: "#ef5350", lineStyle: "dashed", title: "Overbought" });
        hline(20, { color: "#26a69a", lineStyle: "dashed", title: "Oversold" });
    },
});
```

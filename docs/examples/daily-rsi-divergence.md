# Daily RSI Divergence

Pine-parity reference: an RSI(14) that runs only on the daily timeframe (timeframe.isdaily guard) and counts bars since the last overbought/oversold extreme in a persistent state.int slot, both plotted in their own pane.

[Try it live](https://chartlang.invinite.com/?script=daily-rsi-divergence#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pine-parity reference: "Daily RSI Divergence" — runs only on
// daily timeframe, counts bars since last divergence using a
// state.int slot. Translated from public Pine documentation.

import { defineIndicator, input, plot, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Daily RSI Divergence",
    apiVersion: 1,
    inputs: {
        tf: input.interval("1D", { title: "Main timeframe" }),
        length: input.int(14, { min: 2, max: 200, title: "RSI length" }),
    },
    compute({ bar, ta, plot, state, timeframe, inputs }) {
        if (!timeframe.isdaily) return;
        const rsi = ta.rsi(bar.close, inputs.length as number);
        const barsSince = state.int(0);
        const overbought = rsi.current > 70;
        const oversold = rsi.current < 30;
        barsSince.value = overbought || oversold ? 0 : barsSince.value + 1;
        plot(rsi.current, { color: "#7c3aed", title: "RSI", pane: "rsi" });
        plot(barsSince.value, { color: "#94a3b8", title: "Bars since divergence", pane: "rsi" });
    },
});
```

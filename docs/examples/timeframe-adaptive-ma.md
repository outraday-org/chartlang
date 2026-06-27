# Timeframe-Adaptive MA

Branches the moving-average length on `timeframe.isintraday` — a faster average intraday, a slower one on daily-and-up charts.

[Try it live](https://chartlang.invinite.com/?script=timeframe-adaptive-ma#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Timeframe-Adaptive MA",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, timeframe }) {
        // Branch the MA length on the chart's timeframe: a faster 20-period
        // average on intraday charts, a slower 50-period one on daily-and-up.
        const length = timeframe.isintraday ? 20 : 50;
        const ma = ta.sma(bar.close, length);
        plot(ma, { color: "#4f46e5", title: "Adaptive SMA" });
    },
});
```

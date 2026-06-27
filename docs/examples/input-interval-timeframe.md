# Input · Interval Match

input.interval("1D") names the tuned-for timeframe; the SMA tints teal when timeframe.period matches it, grey otherwise.

[Try it live](https://chartlang.invinite.com/?script=input-interval-timeframe#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `input.interval` example: a timeframe input names the interval this script is
// tuned for; the SMA is tinted teal when the chart's own `timeframe.period`
// matches it, grey otherwise. At the default ("1D") on the daily demo bars the
// line reads teal. (An `input.interval` value cannot feed `request.security` —
// that analyser only accepts a string literal or an `input.enum` interval.)

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Input · Interval Match",
    apiVersion: 1,
    overlay: true,
    inputs: {
        tf: input.interval("1D", { title: "Tuned-for timeframe" }),
    },
    compute({ bar, ta, plot, inputs, timeframe }) {
        const tf = inputs.tf as string;
        const matches = timeframe.period === tf;
        plot(ta.sma(bar.close, 20), {
            color: matches ? "#26a69a" : "#94a3b8",
            title: "SMA(20)",
            lineWidth: 2,
        });
    },
});
```

# WMA vs SMA

ta.wma — a linearly-weighted moving average (newest bar heaviest) overlaid on an equal-weight SMA(20) to show how the weighting pulls the line toward price.

[Try it live](https://chartlang.invinite.com/?script=wma-vs-sma#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "WMA vs SMA",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.wma weights the trailing window linearly (newest bar heaviest),
        // so it hugs price more tightly than the equal-weight ta.sma — plot
        // both at length 20 to see the weighting pull the line forward.
        plot(ta.wma(bar.close, 20), { color: "#26a69a", title: "WMA(20)" });
        plot(ta.sma(bar.close, 20), { color: "#ef5350", title: "SMA(20)" });
    },
});
```

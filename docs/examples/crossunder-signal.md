# Crossunder Signal

ta.crossunder — true only on the bar where the fast EMA(9) crosses below the slow EMA(21) (a death-cross trigger), drawn as 1-spikes on a zero baseline.

[Try it live](https://chartlang.invinite.com/?script=crossunder-signal#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Crossunder Signal",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // ta.crossunder — fires true only on the bar where the fast EMA(9) crosses below the slow EMA(21) (a death-cross trigger), drawn as 1-spikes on a zero baseline.
        const down = ta.crossunder(ta.ema(bar.close, 9), ta.ema(bar.close, 21));
        plot(down.current ? 1 : 0, { color: "#ef5350", title: "Cross down", style: { kind: "histogram", baseline: 0 } });
    },
});
```

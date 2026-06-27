# KAMA Adaptive

ta.kama — Kaufman's Adaptive MA whose smoothing follows an efficiency ratio (length / fast / slow opts), overlaid on a fixed EMA(10).

[Try it live](https://chartlang.invinite.com/?script=kama-adaptive#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "KAMA Adaptive",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.kama (Kaufman Adaptive MA) varies its smoothing by an efficiency
        // ratio: it speeds up in clean trends and flattens in chop. Length /
        // fast / slow are opts (the canonical 10 / 2 / 30 here), plotted over a
        // plain EMA(10) to contrast the adaptive vs fixed smoothing.
        plot(ta.kama(bar.close, { length: 10, fastLength: 2, slowLength: 30 }), {
            color: "#26a69a",
            title: "KAMA(10)",
        });
        plot(ta.ema(bar.close, 10), { color: "#ef5350", title: "EMA(10)" });
    },
});
```

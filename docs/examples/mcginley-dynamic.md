# McGinley Dynamic

ta.mcginley — the McGinley Dynamic, a self-correcting EMA that speeds up on strong moves and smooths in quiet bars, overlaid on a plain EMA(14).

[Try it live](https://chartlang.invinite.com/?script=mcginley-dynamic#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "McGinley Dynamic",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.mcginley (McGinley Dynamic) auto-adjusts its step by how far price
        // has run from the line, so it speeds up on strong moves and smooths in
        // quiet bars — a self-correcting EMA. Plot McGinley(14) over a plain
        // EMA(14) to compare the adaptive lag.
        plot(ta.mcginley(bar.close, 14), { color: "#26a69a", title: "McGinley(14)" });
        plot(ta.ema(bar.close, 14), { color: "#ef5350", title: "EMA(14)" });
    },
});
```

# ALMA Gaussian

ta.alma — the Arnaud Legoux MA with Gaussian weights tuned by the offset (peak position) and sigma (spread) opts (0.85 / 6), overlaid on SMA(20).

[Try it live](https://chartlang.invinite.com/?script=alma-gaussian#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "ALMA Gaussian",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.alma (Arnaud Legoux MA) applies Gaussian weights tuned by two
        // opts: `offset` (0..1) moves the weight peak toward the recent end of
        // the window and `sigma` sets its spread — here the canonical
        // responsive-yet-smooth 0.85 / 6, plotted against a plain SMA(20).
        plot(ta.alma(bar.close, 20, { offset: 0.85, sigma: 6 }), {
            color: "#26a69a",
            title: "ALMA(20)",
        });
        plot(ta.sma(bar.close, 20), { color: "#ef5350", title: "SMA(20)" });
    },
});
```

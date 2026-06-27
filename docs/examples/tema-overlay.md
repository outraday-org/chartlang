# TEMA Overlay

ta.tema — the Triple EMA (3·EMA − 3·EMA(EMA) + EMA(EMA(EMA))) overlaid on a plain EMA(20), tracking price even tighter than DEMA.

[Try it live](https://chartlang.invinite.com/?script=tema-overlay#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "TEMA Overlay",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.tema (Triple EMA) is 3·EMA − 3·EMA(EMA) + EMA(EMA(EMA)), removing
        // even more lag than DEMA — plot it over a plain EMA(20) to see the
        // tighter price tracking on the same length.
        plot(ta.tema(bar.close, 20), { color: "#26a69a", title: "TEMA(20)" });
        plot(ta.ema(bar.close, 20), { color: "#ef5350", title: "EMA(20)" });
    },
});
```

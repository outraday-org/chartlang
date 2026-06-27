# Lowest Bars Offset

ta.lowestbars — the bar offset (0 = now, -k = k bars ago) to the lowest low in the trailing 20-bar window, an oscillator of how recently the low was set.

[Try it live](https://chartlang.invinite.com/?script=lowest-bars-offset#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Lowest Bars Offset",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // ta.lowestbars — the bar offset (0 = now, -k = k bars ago) to the lowest low in the trailing 20-bar window, an oscillator of how recently the low was set.
        const lbar = ta.lowestbars(bar.low, 20);
        plot(lbar, { color: "#26a69a", title: "Lowest Bars(20)", style: { kind: "histogram" } });
    },
});
```

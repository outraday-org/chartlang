# Volume-Weighted MA

ta.vwma — a volume-weighted moving average overlaid on SMA(20); heavy-volume bars pull it harder, and it reads NaN on a feed without volume.

[Try it live](https://chartlang.invinite.com/?script=vwma-volume-weighted#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Volume-Weighted MA",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.vwma weights each bar in the window by its volume, so heavy-volume
        // bars pull the average harder than a plain SMA. Plot VWMA(20) over
        // SMA(20); on a feed without volume the VWMA reads NaN (no divisor).
        plot(ta.vwma(bar.close, 20), { color: "#26a69a", title: "VWMA(20)" });
        plot(ta.sma(bar.close, 20), { color: "#ef5350", title: "SMA(20)" });
    },
});
```

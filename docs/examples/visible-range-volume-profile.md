# Visible Range Volume Profile

ta.visibleRangeVolumeProfile — bucketizes the visible range's volume by price (the latest 100 bars via bar.viewport) and plots the POC.

[Try it live](https://chartlang.invinite.com/?script=visible-range-volume-profile#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Visible Range Volume Profile",
    apiVersion: 1,
    overlay: true,
    compute({ plot, ta }) {
        // Bucketize the visible range's volume by price and plot the POC; the
        // runtime supplies the range via bar.viewport (the latest 100 bars
        // ending at the head until adapters inject a real viewport).
        const vp = ta.visibleRangeVolumeProfile({ rowSize: 24 });
        plot(vp.poc, { color: "#ab47bc", title: "VRVP POC" });
    },
});
```

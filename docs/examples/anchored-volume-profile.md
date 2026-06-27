# Anchored Volume Profile

ta.anchoredVolumeProfile — bucketizes volume from a picked time anchor forward (input.time, pickFromChart) and plots the point of control, the price level holding the most volume.

[Try it live](https://chartlang.invinite.com/?script=anchored-volume-profile#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Anchored Volume Profile",
    apiVersion: 1,
    overlay: true,
    inputs: {
        anchor: input.time(0, { pickFromChart: true, title: "Anchor" }),
    },
    compute({ plot, ta, inputs }) {
        // Bucketize volume from the picked time anchor forward and plot the
        // point of control — the price level holding the most volume (NaN
        // until the anchor→current window has positive volume).
        const vp = ta.anchoredVolumeProfile({ anchor: inputs.anchor as number, rowSize: 24 });
        plot(vp.poc, { color: "#ab47bc", title: "Anchored POC" });
    },
});
```

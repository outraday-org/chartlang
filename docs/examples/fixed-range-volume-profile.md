# Fixed Range Volume Profile

ta.fixedRangeVolumeProfile — bucketizes volume across a fixed [from, to] time window (two input.time anchors) and plots the POC plus the value-area high/low band.

[Try it live](https://chartlang.invinite.com/?script=fixed-range-volume-profile#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Fixed Range Volume Profile",
    apiVersion: 1,
    overlay: true,
    inputs: {
        from: input.time(0, { pickFromChart: true, title: "From" }),
        to: input.time(4_102_444_800_000, { pickFromChart: true, title: "To" }),
    },
    compute({ plot, ta, inputs }) {
        // Bucketize volume across the fixed [from, to] window and plot the POC
        // plus the value-area high/low band; the defaults span the full range
        // (epoch start → year 2100) so the demo renders without picking.
        const vp = ta.fixedRangeVolumeProfile({
            from: inputs.from as number,
            to: inputs.to as number,
            rowSize: 24,
        });
        plot(vp.poc, { color: "#ab47bc", title: "Fixed Range POC" });
        plot(vp.valHigh, { color: "#90caf9", title: "Value Area High" });
        plot(vp.valLow, { color: "#90caf9", title: "Value Area Low" });
    },
});
```

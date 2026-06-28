# Parabolic SAR

Parabolic SAR via ta.psar — stop-and-reverse dots that trail price and flip side once the stop is breached, rendered as circle markers over the candles.

[Try it live](https://chartlang.invinite.com/?script=parabolic-sar#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Parabolic SAR",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        // SAR dots trail price and flip side when the stop is breached.
        const p = ta.psar();
        plot(p.sar, {
            color: "#42a5f5",
            title: "PSAR",
            style: { kind: "marker", shape: "circle", size: 2 },
        });
    },
});
```

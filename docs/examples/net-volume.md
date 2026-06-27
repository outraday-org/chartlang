# Net Volume

Net Volume via ta.netVolume — the running up-minus-down volume drawn as a histogram off the zero baseline.

[Try it live](https://chartlang.invinite.com/?script=net-volume#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Net Volume",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // Net volume is the running up-minus-down volume, drawn as a histogram
        // off the zero baseline so accumulation and distribution swings read clearly.
        plot(ta.netVolume(), {
            color: "#42a5f5",
            title: "Net Volume",
            style: { kind: "histogram", baseline: 0 },
        });
        hline(0, { color: "#90a4ae", lineStyle: "dashed", title: "Zero" });
    },
});
```

# Mass Index

Mass Index(9, 25) — a range EMA-of-EMA bulge oscillator with the 27 / 26.5 reversal-setup guides.

[Try it live](https://chartlang.invinite.com/?script=mass-index#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Mass Index",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // Mass Index(9, 25): range EMA-of-EMA bulge with the 27 / 26.5 reversal-setup guides.
        plot(ta.massIndex(), { color: "#2962ff", title: "Mass Index" });

        hline(27, { color: "#ef5350", lineStyle: "dashed", title: "Bulge" });
        hline(26.5, { color: "#26a69a", lineStyle: "dashed", title: "Reversal" });
    },
});
```

# Styled Plot

plot — a single line exercising the styling option surface: title (legend label), color, lineWidth (stroke thickness), and lineStyle (the solid/dashed/dotted dash pattern) on an EMA(20).

[Try it live](https://chartlang.invinite.com/?script=plot-styled#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Styled Plot",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot, ta }) {
        // A single plot exercising the line-style option surface: title (the
        // legend label), color, lineWidth (stroke thickness), and lineStyle
        // (the solid / dashed / dotted dash pattern).
        plot(ta.ema(bar.close, 20), {
            title: "EMA(20)",
            color: "#7c3aed",
            lineWidth: 2,
            lineStyle: "dashed",
        });
    },
});
```

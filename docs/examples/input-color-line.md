# Input · Color Line

input.color("#26a69a") sets the plot stroke; the EMA renders teal at the default.

[Try it live](https://chartlang.invinite.com/?script=input-color-line#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `input.color` example: a color picker sets the plot stroke. At the default
// (#26a69a, teal) the EMA renders in teal.

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Input · Color Line",
    apiVersion: 1,
    overlay: true,
    inputs: {
        col: input.color("#26a69a", { title: "Line color" }),
    },
    compute({ bar, ta, plot, inputs }) {
        const col = inputs.col as string;
        plot(ta.ema(bar.close, 20), { color: col, title: "EMA(20)", lineWidth: 2 });
    },
});
```

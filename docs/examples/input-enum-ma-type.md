# Input · Enum MA Type

input.enum("ema", ["ema","sma","wma"]) selects the moving-average family; the default plots an EMA(20).

[Try it live](https://chartlang.invinite.com/?script=input-enum-ma-type#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `input.enum` example: a fixed-options dropdown selects the moving-average
// family. At the default ("ema") the demo plots an EMA(20).

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Input · Enum MA Type",
    apiVersion: 1,
    overlay: true,
    inputs: {
        maType: input.enum("ema", ["ema", "sma", "wma"], { title: "MA type" }),
    },
    compute({ bar, ta, plot, inputs }) {
        const maType = inputs.maType as string;
        const ma =
            maType === "sma"
                ? ta.sma(bar.close, 20)
                : maType === "wma"
                  ? ta.wma(bar.close, 20)
                  : ta.ema(bar.close, 20);
        plot(ma, { color: "#26a69a", title: "MA(20)", lineWidth: 2 });
    },
});
```

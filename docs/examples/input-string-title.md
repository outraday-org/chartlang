# Input · String Title

input.string("Trend") names the plotted line; the EMA legend reads "Trend" at the default.

[Try it live](https://chartlang.invinite.com/?script=input-string-title#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `input.string` example: a free-text input names the plotted line. At the
// default ("Trend") the EMA legend reads "Trend".

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Input · String Title",
    apiVersion: 1,
    overlay: true,
    inputs: {
        label: input.string("Trend", { title: "Line label" }),
    },
    compute({ bar, ta, plot, inputs }) {
        const label = inputs.label as string;
        plot(ta.ema(bar.close, 20), { color: "#26a69a", title: label, lineWidth: 2 });
    },
});
```

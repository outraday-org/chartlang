# Input · External Series

input.externalSeries(...) declares an adapter-supplied overlay; with no feed at the default the script falls back to the close.

[Try it live](https://chartlang.invinite.com/?script=input-external-series#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `input.externalSeries` example: an adapter-supplied external series overlay.
// `input.externalSeries` has no default value, so until an adapter feeds data
// the resolved value is undefined; the script falls back to the close so the
// overlay still renders in the demo.

import { defineIndicator, input, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Input · External Series",
    apiVersion: 1,
    overlay: true,
    inputs: {
        earnings: input.externalSeries<number>({
            name: "earnings",
            schema: { kind: "external-series-schema" },
            title: "External series",
        }),
    },
    compute({ bar, plot, inputs }) {
        const earnings = inputs.earnings;
        const value = typeof earnings === "number" ? earnings : bar.close.current;
        plot(value, { color: "#26a69a", title: "External / close", lineWidth: 2 });
    },
});
```

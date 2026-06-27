# Input · Source Field

input.source("close") picks which bar series feeds an SMA via the resolved SourceField key; SMA(close, 20) at the default.

[Try it live](https://chartlang.invinite.com/?script=input-source-select#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `input.source` example: a source-field picker chooses which bar series feeds
// an SMA. The resolved value is a `SourceField` key, so `bar[src]` selects the
// matching `BarSeries` view. At the default ("close") the demo plots SMA(close, 20).

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";
import type { SourceField } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Input · Source Field",
    apiVersion: 1,
    overlay: true,
    inputs: {
        src: input.source("close", { title: "Source" }),
    },
    compute({ bar, ta, plot, inputs }) {
        const src = inputs.src as SourceField;
        plot(ta.sma(bar[src], 20), { color: "#26a69a", title: "SMA", lineWidth: 2 });
    },
});
```

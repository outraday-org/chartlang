# Input · External Series

input.externalSeries(...) resolves to a host-fed Series<number> read per bar via .current; unfed bars are NaN, so the script falls back to the close.

[Try it live](https://chartlang.invinite.com/?script=input-external-series#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `input.externalSeries` example: an adapter-supplied external series overlay.
// The resolved value is an indexable `Series<number>` the host advances per
// bar (`.current`, `[n]`, `.length` — it feeds `ta.*` directly). Bars the
// host has not fed read `NaN`, so the script falls back to the close and the
// overlay still renders in the demo.

import { defineIndicator, input, plot } from "@invinite-org/chartlang-core";
import type { Series } from "@invinite-org/chartlang-core";

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
        const earnings = inputs.earnings as Series<number>;
        const fed = earnings.current;
        const value = Number.isFinite(fed) ? fed : bar.close.current;
        plot(value, { color: "#26a69a", title: "External / close", lineWidth: 2 });
    },
});
```

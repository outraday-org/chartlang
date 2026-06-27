# ZigZag Swings

ta.zigZag — a streaming swing-pivot detector whose value holds the most-recently-confirmed pivot price (a 5% reversal trailing reference level), stepped between confirmations.

[Try it live](https://chartlang.invinite.com/?script=zigzag-swings#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "ZigZag Swings",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        // ta.zigZag — a streaming swing-pivot detector; value holds the most-recently-confirmed pivot price (a 5% reversal trailing reference level), stepped between confirmations.
        const z = ta.zigZag({ deviation: 5 });
        plot(z.value, { color: "#42a5f5", title: "ZigZag(5%)", style: { kind: "step-line" } });
    },
});
```

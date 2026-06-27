# Anchored VWAP

Anchored VWAP via ta.anchoredVwap — volume-weighted average price accumulated from a fixed time anchor.

[Try it live](https://chartlang.invinite.com/?script=anchored-vwap#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Anchored VWAP",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        // Anchored VWAP accumulates volume-weighted price only from a fixed
        // anchor bar onward (a UTC-ms epoch the author hard-codes), so it
        // reads the average price paid since a chosen event.
        plot(ta.anchoredVwap(1713000000000), { color: "#ff6d00", title: "Anchored VWAP" });
    },
});
```

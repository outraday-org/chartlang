# Cumulative Volume

ta.cum — the running (cumulative) sum of volume from the first bar, a NaN-safe total that only ever grows.

[Try it live](https://chartlang.invinite.com/?script=cumulative-volume#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Cumulative Volume",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // ta.cum — the running (cumulative) sum of volume from the first bar, a NaN-safe total that only ever grows.
        plot(ta.cum(bar.volume), { color: "#2962ff", title: "Cumulative Volume" });
    },
});
```

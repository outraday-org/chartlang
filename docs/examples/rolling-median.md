# Rolling Median

ta.median — the rolling middle-value of the last 20 closes, a spike-robust center line where an SMA would be dragged by outliers.

[Try it live](https://chartlang.invinite.com/?script=rolling-median#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Rolling Median",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.median — the rolling middle-value of the last 20 closes, a spike-robust center line where an SMA would be dragged by outliers.
        const m = ta.median(bar.close, 20);
        plot(m, { color: "#7e57c2", title: "Median(20)" });
    },
});
```

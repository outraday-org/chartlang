# Know Sure Thing

ta.kst — Martin Pring's weighted sum of four smoothed rate-of-change series plus its SMA signal line, around a zero line.

[Try it live](https://chartlang.invinite.com/?script=know-sure-thing#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Know Sure Thing",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // Pring's KST momentum sum plus its SMA signal line, around a zero line.
        const k = ta.kst(bar.close);
        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
        plot(k.kst, { color: "#2962ff", title: "KST" });
        plot(k.signal, { color: "#ff6d00", title: "Signal" });
    },
});
```

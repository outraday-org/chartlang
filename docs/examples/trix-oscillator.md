# TRIX

ta.trix — the rate-of-change of a triple-smoothed EMA (length 15) plus its EMA signal line, filtering out short-term noise.

[Try it live](https://chartlang.invinite.com/?script=trix-oscillator#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "TRIX",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        // Triple-smoothed EMA rate-of-change (length 15) plus its EMA signal line.
        const t = ta.trix(bar.close, 15);
        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
        plot(t.trix, { color: "#2962ff", title: "TRIX(15)" });
        plot(t.signal, { color: "#ff6d00", title: "Signal" });
    },
});
```

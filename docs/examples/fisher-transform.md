# Fisher Transform

ta.fisher — John Ehlers' Fisher Transform of the rolling hl2 midpoint plus its 1-bar-lagged trigger line.

[Try it live](https://chartlang.invinite.com/?script=fisher-transform#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Fisher Transform",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // Ehlers' Fisher Transform line plus its 1-bar-lagged trigger.
        const f = ta.fisher(9);
        hline(0, { color: "#787b86", lineStyle: "dashed", title: "Zero" });
        plot(f.fisher, { color: "#2962ff", title: "Fisher" });
        plot(f.trigger, { color: "#ff6d00", title: "Trigger" });
    },
});
```

# Ease of Movement

Ease of Movement(14) via ta.eom — price displacement relative to volume, positive when price moves on light volume.

[Try it live](https://chartlang.invinite.com/?script=ease-of-movement#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Ease of Movement",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot, hline }) {
        // EoM(14) relates price displacement to volume, so a positive line
        // means price rose on light volume (it moved easily) and vice versa.
        plot(ta.eom(14), { color: "#66bb6a", title: "EoM(14)" });
        hline(0, { color: "#90a4ae", lineStyle: "dashed", title: "Zero" });
    },
});
```

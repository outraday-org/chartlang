# DMI Directional

The Directional Movement Index via ta.dmi(14): the +DI / -DI pair plus an ADX line, the classic three-line trend-direction-and-strength read.

[Try it live](https://chartlang.invinite.com/?script=dmi-directional#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "DMI Directional",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        // The classic +DI / -DI pair with an ADX line for trend strength.
        const d = ta.dmi(14);
        plot(d.plusDi, { color: "#26a69a", title: "+DI" });
        plot(d.minusDi, { color: "#ef5350", title: "-DI" });
        plot(ta.adx(14), { color: "#ff9800", title: "ADX" });
    },
});
```

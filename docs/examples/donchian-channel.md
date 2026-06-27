# Donchian Channel

Donchian Channel(20) — the highest high and lowest low over 20 bars plus their midline overlaid on price.

[Try it live](https://chartlang.invinite.com/?script=donchian-channel#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Donchian Channel",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        // Donchian Channel(20): highest high / lowest low over 20 bars plus their midline.
        const d = ta.donchian(20);
        plot(d.upper, { color: "#cccccc", title: "Donchian Upper", lineWidth: 1 });
        plot(d.middle, { color: "#90caf9", title: "Donchian Middle", lineWidth: 2 });
        plot(d.lower, { color: "#cccccc", title: "Donchian Lower", lineWidth: 1 });
    },
});
```

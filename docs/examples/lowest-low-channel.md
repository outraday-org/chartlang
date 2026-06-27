# Lowest Low Channel

ta.lowest — the rolling minimum low over the last 20 bars, the lower edge of a Donchian-style channel.

[Try it live](https://chartlang.invinite.com/?script=lowest-low-channel#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Lowest Low Channel",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.lowest — the rolling minimum low over the last 20 bars, the lower edge of a Donchian-style channel.
        const lower = ta.lowest(bar.low, 20);
        plot(lower, { color: "#26a69a", title: "Lowest Low(20)" });
    },
});
```

# Intrabar Bar Count

Pulls the array of finer-grained bars contained in each main bar via `request.lowerTf` and plots their count.

[Try it live](https://chartlang.invinite.com/?script=intrabar-lowertf#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, request } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Intrabar Bar Count",
    apiVersion: 1,
    overlay: false,
    compute({ plot, request }) {
        // `request.lowerTf({ interval })` returns, for each main bar, the array
        // of finer-grained bars contained inside it; the requested interval
        // must be strictly LOWER than the chart's (here `1h` under a daily
        // chart). When the adapter lacks `Capabilities.multiTimeframe` — or the
        // demo's stream feeder supplies no true sub-bar data — the array is
        // empty (count 0); it renders clean and never throws.
        const intrabar = request.lowerTf({ interval: "1h" });
        plot(intrabar.current.length, { color: "#64748b", title: "Intrabar bars" });
    },
});
```

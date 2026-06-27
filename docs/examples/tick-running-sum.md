# Tick Running Sum

state.tick.float — a tick-persistent float slot (Pine varip) accumulating a running sum of close prices, committing the instant it is written. Confirmed-bar data folds in one close per bar; a live tick feed folds in every intrabar tick.

[Try it live](https://chartlang.invinite.com/?script=tick-running-sum#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Tick Running Sum",
    apiVersion: 1,
    overlay: false,
    compute({ bar, state, plot }) {
        // Tick-persistent float slot (Pine `varip`): accumulates a running sum
        // of close prices, committing the instant it is written. The demo
        // feeds CONFIRMED bars, so it folds in one close per bar; on a live
        // tick feed each intrabar tick would fold into the sum immediately.
        const sum = state.tick.float(0);
        sum.value += bar.close.current;
        plot(sum.value, { title: "Cumulative close sum" });
    },
});
```

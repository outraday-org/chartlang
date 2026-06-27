# Running Max Close

state.float — a persistent float slot (Pine var float) holding the highest close seen so far, updated only on a new high so the line ratchets up across bars and never falls.

[Try it live](https://chartlang.invinite.com/?script=running-max-close#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Running Max Close",
    apiVersion: 1,
    overlay: true,
    compute({ bar, state, plot }) {
        // Persistent float slot (Pine `var float`): holds the highest close
        // seen so far, updated only when a new high prints, so the line
        // ratchets up across bars and never falls — observable persistence.
        const maxClose = state.float(Number.NaN);
        if (Number.isNaN(maxClose.value) || bar.close.current > maxClose.value) {
            maxClose.value = bar.close.current;
        }
        plot(maxClose.value, { title: "Running max close", color: "#16a34a" });
    },
});
```

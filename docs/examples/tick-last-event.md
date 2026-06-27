# Tick Last Event

state.tick.string — a tick-persistent string slot (Pine varip) recording the current bar's direction as a label, committing on every write. Confirmed-bar data re-labels once per bar; a live tick feed re-labels each intrabar direction change.

[Try it live](https://chartlang.invinite.com/?script=tick-last-event#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Tick Last Event",
    apiVersion: 1,
    overlay: false,
    compute({ bar, state, plot }) {
        // Tick-persistent string slot (Pine `varip`): records the current
        // bar's direction as a label, committing on every write. The demo
        // feeds CONFIRMED bars so it re-labels once per bar; on a live tick
        // feed it would re-label the instant an intrabar tick changed direction.
        const lastEvent = state.tick.string("flat");
        lastEvent.value = bar.close.current > bar.open.current ? "up" : "down";
        plot(lastEvent.value === "up" ? 1 : -1, {
            title: "Last bar direction",
            style: { kind: "step-line" },
        });
    },
});
```

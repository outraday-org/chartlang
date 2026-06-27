# Session High Alert

Pine-parity reference: a running session-high tracked in a persistent state.float slot, reset on each session open, with an optional alert when the close crosses above it.

[Try it live](https://chartlang.invinite.com/?script=session-high-alert#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pine-parity reference: "Session High" — running highest high
// reset on session open, alerts on crossover. Translated from
// public Pine documentation idioms (no specific source SHA).

import { alert, defineIndicator, input, plot, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Session High Alert",
    apiVersion: 1,
    overlay: true,
    inputs: {
        alertOnCross: input.bool(true, { title: "Alert on cross" }),
    },
    compute({ bar, state, alert, plot, ta, barstate, inputs }) {
        const high = state.float(Number.NaN);
        const isSessionOpen = barstate.isfirst || bar.time % 86_400_000 === 0;
        if (isSessionOpen) {
            high.value = bar.high;
        } else if (Number.isNaN(high.value) || bar.high > high.value) {
            high.value = bar.high;
        }
        plot(high.value, { color: "#ff9900", title: "Session high" });
        if (inputs.alertOnCross && ta.crossover(bar.close, high.value).current) {
            alert("Close crossed session high", { severity: "info" });
        }
    },
});
```

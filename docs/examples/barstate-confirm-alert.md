# Barstate Confirmed Alert

Gates a crossover alert on `barstate.isconfirmed` so it fires once per closed bar instead of on every intrabar tick.

[Try it live](https://chartlang.invinite.com/?script=barstate-confirm-alert#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { alert, defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Confirmed Cross Alert",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, alert, barstate }) {
        const ema = ta.ema(bar.close, 20);
        plot(ema, { color: "#0d9488", title: "EMA(20)" });
        // `barstate.isconfirmed` is true only on a closed-bar (`kind: "close"`)
        // step, so gating the alert on it fires once per finished bar instead
        // of repeatedly on intrabar ticks.
        if (barstate.isconfirmed && ta.crossover(bar.close, ema).current) {
            alert("Close crossed EMA on bar close", { severity: "info" });
        }
    },
});
```

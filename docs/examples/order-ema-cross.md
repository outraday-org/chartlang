# Order EMA Cross

order.buy / order.position — the golden-cross strategy shape: an EMA(12)/EMA(26) crossover opens a long and a crossunder closes it, each leg guarded by a read of the nominal position so the script never doubles an entry. The runtime auto-renders the entry/exit arrows through the plot pipeline, so no drawing code appears anywhere.

[Try it live](https://chartlang.invinite.com/?script=order-ema-cross#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, order, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Order EMA Cross",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, order }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);

        plot(fast, { color: "#26a69a", title: "EMA(12)" });
        plot(slow, { color: "#ef5350", title: "EMA(26)" });

        // Hoist both crossing tests and the position read OUT of the `if`s.
        // A stateful `ta.*` callsite evaluated only on some bars desyncs its own
        // history, and hoisting the position read leaves the one-fold lag as the
        // single thing the branches depend on.
        const up = ta.crossover(fast, slow).current;
        const down = ta.crossunder(fast, slow).current;

        // `order.position()` reads the position as of the PREVIOUS confirmed
        // step — the runtime folds a bar's orders after `compute` returns, which
        // reproduces Pine's `strategy.position_size` lag. So this is "flat or
        // short going into this bar", and it is what keeps a run of consecutive
        // crossovers from stacking a second entry on an open long.
        const flatOrShort = order.position().size <= 0;

        if (flatOrShort && up) {
            order.buy({ label: "Long" });
        }
        if (!flatOrShort && down) {
            order.close({ label: "Exit" });
        }

        // No drawing code anywhere: each accepted order additionally emits an
        // `arrow` plot (and a `label` plot, since both calls pass one) through
        // the plot pipeline every adapter already renders. `marker: false` opts
        // out — see `order-silent-markers.chart.ts`.
    },
});
```

# Rolling Window Mean

state.array — a bounded collection you push many values into. Here a rolling mean over the last 20 closes: push one close per bar into a fixed-capacity FIFO ring, then iterate the ELEMENTS (a.get(i), 0 = newest) to average them. This is the bounded bag of the last K pushed values that state.series (one value's bar history) can't express.

[Try it live](https://chartlang.invinite.com/?script=rolling-window-mean#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Rolling Window Mean",
    apiVersion: 1,
    overlay: true,
    compute({ bar, state, plot }) {
        // A bounded bag of the last 20 closes. This is the case that genuinely
        // needs a PUSHED collection, not a single `state.series`: we push one
        // value per bar into a fixed-capacity FIFO ring (oldest evicted at
        // capacity) and then iterate the ELEMENTS to average them. `state.array`
        // is "a bounded bag of the last K things I pushed"; `state.series` is
        // "one value's bar history" — neither expresses the other.
        const win = state.array<number>(20);
        win.push(bar.close.current);

        // `get(i)` walks the ELEMENTS (0 = newest), not bars. The loop bound is
        // a literal and the inner `if (i < win.size)` guard skips the unfilled
        // slots during warmup — `push`/`get` are handle methods, so they are
        // legal inside the bounded loop (only the allocation call is not).
        let sum = 0;
        for (let i = 0; i < 20; i++) {
            if (i < win.size) sum += win.get(i);
        }

        plot(win.size > 0 ? sum / win.size : Number.NaN, { title: "Mean(20)" });
    },
});
```

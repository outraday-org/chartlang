# Up Streak

state.series — a writable, indexable user series. Counts consecutive up-closes: the history of a value you compute yourself (here a self-referential streak defined from its own prior bar), which bar.close[N] can't express, then reads it back three bars ago.

[Try it live](https://chartlang.invinite.com/?script=up-streak#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Up Streak",
    apiVersion: 1,
    overlay: false,
    compute({ bar, state, plot }) {
        // Consecutive up-closes. This is the case that genuinely NEEDS a
        // writable series: the value is SELF-REFERENTIAL — it is defined in
        // terms of its OWN value one bar ago — so it cannot be read off
        // `bar.close[N]` the way a plain price lookback can (that is the
        // `directly-indexable-bar-series` / Manual SMA case). `state.series`
        // both STORES this bar's streak and lets us look it back N bars later.
        const streak = state.series(0);
        const up = bar.close.current > bar.close[1];

        // `streak[1]` is the committed streak one bar ago. On the very first
        // bar it is NaN (no committed history yet), so the warmup guard treats
        // it as 0 before incrementing; a down-close resets the streak to 0.
        streak.value = up ? (Number.isFinite(streak[1]) ? streak[1] : 0) + 1 : 0;

        plot(streak.current, { title: "Up streak" });
        // The history index proves the writable series is also indexable: this
        // is the streak as it stood three bars ago (NaN during warmup).
        plot(streak[3], { title: "Streak 3 bars ago" });
    },
});
```

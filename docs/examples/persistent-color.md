# Persistent Color

The three NON-NUMERIC persistent slots a numeric state.series can't express: state.color (a CSS color that survives across bars), state.boolSeries, and state.stringSeries (writable head plus indexable history), used to latch a position-open regime and recolor the close line by it.

[Try it live](https://chartlang.invinite.com/?script=persistent-color#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { color, defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Persistent Color",
    apiVersion: 1,
    overlay: true,
    compute({ bar, state, plot }) {
        // The three NON-NUMERIC persistent slots, mirroring Pine's
        // `var color` / `var bool x; x[1]` / `var string s; s[1]` idioms a
        // numeric `state.series` cannot express.

        // A persistent COLOR scalar — a CSS string that survives across bars
        // (Pine `var color exitClr = na`). Init is a concrete color, NOT a
        // numeric NaN; `color.*` palette members are MODULE-SCOPE constants,
        // not a `compute` field.
        const exitClr = state.color(color.gray);

        // A persistent BOOLEAN series — a writable head (`.value`) PLUS an
        // indexable history (`active[1]`). On the first bar `active[1]` is the
        // deterministic `false` default (Pine v6 bool history), never NaN.
        const active = state.boolSeries(false);

        // A persistent STRING series — same writable-head + indexable-history
        // shape; first-bar/out-of-range reads default to "".
        const phase = state.stringSeries("");

        const up = bar.close.current > bar.open.current;

        // Latch the position open on an up-close and hold it: the non-up arm
        // reads the slot's own committed head one bar ago (`active[1]`), NOT
        // the live `.value` — which the bar-open advance has reset to the
        // `false` / "" default, so a `.value` self-reference would never hold.
        active.value = up ? true : active[1];
        phase.value = up ? "long" : phase[1];
        exitClr.value = up ? color.green : color.red;

        // History reads: a fresh entry is "active now AND not active last bar".
        const justEntered = active.current && !active[1];
        // String history proves the prior-bar regime label round-trips.
        const flipped = phase.current !== phase[1];

        plot(bar.close, { title: "Close", color: exitClr.value });
        plot(justEntered ? 1 : 0, { title: "Just entered" });
        plot(flipped ? 1 : 0, { title: "Phase flipped" });
    },
});
```

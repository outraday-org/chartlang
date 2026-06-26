# Volume by Level

state.map — a persistent, bounded KEY→VALUE store. Buckets each bar's volume under its rounded close price (read-modify-write one entry per level, get() ?? 0 to seed an unseen level, oldest-inserted key evicted once 64 are tracked), then walks the entries with keyAt(i) + size (v1 has no iterators) to mark the volume point of control — the price level holding the most volume. The keyed half of the collections story that state.array (a FIFO of pushed values) can't express.

[Try it live](https://chartlang.invinite.com/?script=volume-by-level#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Volume by Level",
    apiVersion: 1,
    overlay: true,
    compute({ bar, state, plot }) {
        // A keyed accumulator: bucket each bar's volume under its rounded close
        // price. This is the case that genuinely needs a KEY→VALUE store, not a
        // FIFO of pushed values: many bars revisit the same price level, so we
        // read-modify-write one entry per level. `get` returns `undefined` for a
        // never-seen level (distinct from a real 0), so `?? 0` seeds it; a new
        // level once 64 are tracked evicts the oldest-inserted one (bounded so it
        // serializes).
        const levels = state.map<number, number>(64);
        const key = Math.round(bar.close.current);
        levels.set(key, (levels.get(key) ?? 0) + bar.volume.current);

        // Mark the current point of control: the price level holding the most
        // accumulated volume so far. v1 iterates with `keyAt(i)` + `size`, not an
        // iterator — the loop bound is the literal capacity and the inner
        // `if (i < levels.size)` guard skips the unfilled slots, the same bounded
        // shape `state.array` uses (`keyAt`/`get` are handle methods, so they are
        // legal inside the bounded loop; only the allocation call is not).
        let pocLevel = Number.NaN;
        let pocVolume = -1;
        for (let i = 0; i < 64; i++) {
            if (i < levels.size) {
                const level = levels.keyAt(i);
                if (level !== undefined) {
                    const volume = levels.get(level) ?? 0;
                    if (volume > pocVolume) {
                        pocVolume = volume;
                        pocLevel = level;
                    }
                }
            }
        }

        plot(pocLevel, { color: "#ab47bc", title: "Volume POC" });
    },
});
```

# Maps (`state.map`)

`state.map<K, V>(capacity)` is a **writable, bounded, across-bars keyed
dictionary** — the keyed half of the collections story. Where
[`state.array`](../primitives/state/array.md) is a FIFO of many pushed values,
`state.map` is a key→value store that persists across bars with the same
committed/tentative slot lifecycle. It is the chartlang analogue of Pine's
`map.*`, and it unlocks per-price-level aggregation, per-session accumulators,
and custom volume profiles authored in script.

Like every `state.*` slot it is a **handle, not a value** — there is no
`+m` / `valueOf`; it is a collection.

## Surface

| Member | Meaning |
|--------|---------|
| `set(key, value)` | Insert or update `key`. A **new** key over capacity evicts the oldest-inserted one; re-`set`ting an existing key updates in place **without** re-ageing it. |
| `get(key): number \| undefined` | The stored value, or **`undefined`** when the key is absent — distinct from a stored `0`. |
| `has(key): boolean` | Whether `key` is present. |
| `delete(key): boolean` | Remove `key`; `true` if it was present. |
| `clear()` | Empty the map. |
| `size` | The current entry count (`≤ capacity`), read-only. |
| `keyAt(index): K \| undefined` | The `index`-th key in **insertion order** (`0` = oldest); `undefined` out of range. |

Keys are `string | number` (the only deterministically-hashable,
snapshot-cloneable key types). The v1 value type is `number`.

## `undefined` vs `0`

`get` returns `undefined` for a key you have never `set`, which is **not** the
same as a key whose value happens to be `0`. Seed an accumulator with `?? 0`:

```ts
import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Volume by level",
    apiVersion: 1,
    overlay: false,
    compute({ bar, state, plot }) {
        const levels = state.map<number, number>(64);
        const key = Math.round(bar.close.current);
        // `?? 0` seeds a never-seen level; a plain `+` would propagate NaN.
        levels.set(key, (levels.get(key) ?? 0) + bar.volume.current);
        plot(levels.get(key) ?? 0, { title: "Volume at level" });
    },
});
```

## Bounded capacity + FIFO eviction

`capacity` is a **required compile-time numeric literal** (the same guard
`state.array` uses) — the store is bounded so it serializes cleanly across the
host boundary and survives warm restarts. A non-literal capacity is a compile
error.

Eviction is **insertion-order FIFO**: once `size === capacity`, inserting a
**new** key evicts the **oldest-inserted** key. Updating an existing key with
`set` does not change its age; `delete` then `set` re-ages a key to newest.
(LRU is deferred.)

## Iteration: `keyAt` + `size`, not iterators

v1 has **no** `keys()` / `values()` / `entries()` iterators — a `for...of` over
an iterator would trip the compiler's `unbounded-loop` ban. Walk the map with
`keyAt(i)` bounded by the **literal capacity**, guarding the unfilled slots with
`if (i < m.size)` (the same bounded-loop shape `state.array` uses; `keyAt` /
`get` are handle methods, so they are legal inside the loop — only the
allocation call is not):

```ts
let poc = Number.NaN;
let best = -1;
for (let i = 0; i < 64; i++) {
    if (i < levels.size) {
        const level = levels.keyAt(i);
        if (level !== undefined) {
            const volume = levels.get(level) ?? 0;
            if (volume > best) {
                best = volume;
                poc = level;
            }
        }
    }
}
```

## Coming from Pine `map.*`

The [converter](../converter/supported.md) lowers Pine's `map.*` onto
`state.map` + handle methods. Because Pine maps are **unbounded**, the converter
**synthesizes** a literal capacity (default `1000`) and raises a
[`map-capacity-synthesized`](../converter/diagnostics.md#map-capacity-synthesized)
info — set a real bound. Pine `map.get` returns `na`, so the converter wraps
reads as `(m.get(k) ?? Number.NaN)`. `map.keys` / `map.values` are unsupported
(no v1 iterators) and become a placeholder +
[`map-builtin-not-mapped`](../converter/diagnostics.md#map-builtin-not-mapped).
See the [Pine migration guide](../spec/pine-migration.md).

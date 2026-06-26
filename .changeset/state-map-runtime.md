---
"@invinite-org/chartlang-runtime": minor
---

Implement the runtime `state.map<K, V>(capacity)` slot — Task 2 of the
`map-collection` feature. A bounded, insertion-ordered keyed store backed by two
`Map<MapKey, number>`s (committed + tentative) behind the identity-stable
`MutableMapSlot` handle, reusing the `state.array` committed/tentative slot
lifecycle: writes during a tick are tentative, a head-replacing tick rolls them
back to the last committed map, and a bar close commits the tentative map.

Eviction is insertion-order FIFO: inserting a **new** key once `size ===
capacity` evicts the oldest-inserted key; re-`set`ting an existing key updates in
place without changing its insertion age; `delete` then re-`set` re-ages the key
to newest. `get` returns `undefined` for an absent key (distinct from a stored
`0`); `keyAt(index)` reads the insertion-order key (`0` = oldest), `undefined`
out of range.

Snapshot/restore rides the existing persistence plumbing under a `:map`
namespace suffix: each slot serialises to insertion-ordered `[key, value]` entry
tuples (preserving the `string` vs `number` key distinction; non-finite values
ride as `null`), restores at the persisted capacity, and degrades to a fresh
slot — never throws — on a malformed or over-capacity snapshot. Warm restart,
bundle dep/sibling isolation, and `dispose` mirror `state.array`. No wire,
converter, or adapter change.

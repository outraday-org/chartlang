---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
---

Add the `state.map<K, V>(capacity)` keyed-collection primitive (core type + hole
+ registry + compiler ambient shim + literal-capacity guard). The sibling of
`state.array`: a persistent, bounded key→value store with the same
committed/tentative slot lifecycle. Task 1 of the `map-collection` feature —
the runtime store (Task 2) and converter/conformance/docs (Task 3) land
separately.

New core exports: `MutableMapSlot<K extends string | number, V>` (type) and the
`state.map` hole on the frozen `state` namespace. The v1 handle surface is
`set(k, v)`, `get(k): V | undefined`, `has(k)`, `delete(k): boolean`,
`clear()`, `readonly size`, and `keyAt(index): K | undefined` — bounded indexing
(`for (let i = 0; i < m.size; i++)`) rather than iterators, which are deferred.
Keys are `string | number`; the v1 value type is `number`; the handle is not
number-coercible. `capacity` is a required compile-time numeric literal.

`STATEFUL_PRIMITIVES` gains `{ name: "state.map", slot: true }`. The compiler's
ambient shim mirrors `MutableMapSlot` + `StateNamespace.map`, and the existing
`state.array` literal-capacity guard now also covers `state.map` (same
`state-array-capacity-not-literal` / `state-array-capacity-exceeds-max`
diagnostic codes, with the message naming the matched primitive).

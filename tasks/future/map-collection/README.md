# Persistent keyed collection — `state.map`

## Overview

Add a **writable, bounded, across-bars keyed dictionary** primitive,
`state.map<K, V>(capacity)`, the sibling of `state.array` (`../state-array/`).
Where `state.array` is a FIFO of many values, `state.map` is a key→value store
that persists across bars with the same committed/tentative slot lifecycle —
the missing collection half of Pine's `map.*`. It unlocks per-price-level
aggregation, per-session accumulators, and custom volume profiles authored in
script.

```ts
const levels = state.map<number, number>(50);

compute({ bar }) {
    const key = Math.round(bar.close.current);
    levels.set(key, (levels.get(key) ?? 0) + bar.volume.current);

    if (levels.has(key)) { /* ... */ }
    const n = levels.size;          // entry count (≤ capacity)
    for (const k of levels.keys()) { /* bounded by capacity */ }
}
```

## Current State

- `state.array<T>(capacity)` (`../state-array/`) establishes the pattern: a
  non-coercible handle (`MutableArraySlot<T>`), a `state.array` sentinel hole
  on the frozen `state` namespace (`packages/core/src/state/state.ts`), a
  `{ name: "state.array", slot: true }` entry in `STATEFUL_PRIMITIVES`
  (`packages/core/src/statefulPrimitives.ts`), the compiler ambient-shim
  mirror (`packages/compiler/src/program.ts`), a **compile-time
  literal-capacity guard** (`../state-array/` task 3), and a runtime ring store
  with committed/tentative snapshot/restore (`../state-array/` task 2).
- No keyed-collection primitive exists.

## Target State

- `state.map<K, V>(capacity)` returns a non-coercible `MutableMapSlot<K, V>`:
  `set(k, v)`, `get(k): V | undefined`, `has(k)`, `delete(k): boolean`,
  `clear()`, `readonly size`, `keys(): IterableIterator<K>`,
  `values(): IterableIterator<V>`, `entries(): IterableIterator<[K, V]>`.
- `capacity` is a required compile-time numeric literal (reuses the
  state-array guard). Inserting a **new** key when `size === capacity` evicts
  the **oldest-inserted** key (insertion-order FIFO eviction); re-`set`ting an
  existing key updates in place without changing its insertion age.
- Committed/tentative semantics: writes during a tick are tentative; on bar
  close they commit; a replaced head bar restores the prior committed map.
- Pine `map.*` maps onto `state.map` + member calls via the converter.
- Conformance scenario, docs page, skill reference, runnable example.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Handle with methods (not coercible)** | Exact mirror of `state.array` — a collection, not a value. No `valueOf`. |
| **Key type `K extends string \| number`** | These are the only deterministically-hashable, snapshot-cloneable keys. Object keys would break the structural-clone snapshot/restore and the host transferable boundary. Enforced in the type + a compiler check (reuse the literal/type-guard machinery). |
| **`V` is `number` in v1** | Matches `state.array`'s number-only v1; serialization stays a flat numeric store. `string` values deferred. |
| **Insertion-order FIFO eviction** | Deterministic, snapshot-stable, and matches the "bounded so it serializes" invariant. A new key over capacity evicts the oldest; updating an existing key does not age it. Documented; LRU deferred. |
| **`get` returns `V \| undefined`** | Distinguishes "absent" from "present-but-zero" (Pine's `map.get` returns `na`). Authors use `?? 0`. |
| **Reuse the state-array literal-capacity guard** | The compiler pass that asserts `state.array(N)`'s `N` is a numeric literal generalizes to `state.map(N)` — extend its primitive-name set rather than writing a parallel guard. |

## Dependency Graph

```
(state-array tasks 1–3 landed: handle pattern, runtime store, capacity guard)
        |
        v
Task 1 (core: MutableMapSlot type + state.map hole + registry + ambient shim + capacity-guard wiring)
        |
        v
Task 2 (runtime: bounded keyed store + committed/tentative snapshot/restore + unit/property)
        |
        v
Task 3 (conformance + pine-converter map.* + docs/skills/example)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Core type + `state.map` hole + registry + shim](./1-core-type-and-shim.md) | core, compiler | state-array | Medium |
| 2 | [Runtime keyed store + snapshot/restore](./2-runtime-map-slot.md) | runtime | 1 | High |
| 3 | [Conformance + converter + docs/skills](./3-conformance-converter-docs.md) | conformance, pine-converter, docs | 2 | Medium |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| `MutableArraySlot<T>` + `state.array` hole | `packages/core/src/state/arraySlot.ts`, `state.ts` | Template for `MutableMapSlot` + the `state.map` hole. |
| `STATEFUL_PRIMITIVES` registry | `packages/core/src/statefulPrimitives.ts` | Append `{ name: "state.map", slot: true }`. |
| Literal-capacity compiler guard | `../state-array/` task 3 output (`packages/compiler/src/...`) | Extend its primitive-name set to include `state.map`. |
| Runtime ring store + snapshot/restore | `packages/runtime/src/` (state-array task 2) | Reuse the committed/tentative slot lifecycle; swap the backing structure ring → keyed map. |

## Provenance

N/A — fresh primitive; Pine `map.*` is parity, not a port.

## Deferred / Follow-Up Work

- `string` (and union) value types.
- `map.*` analytic reductions (sum/avg over values).
- LRU eviction policy option.
- `state.map` of `state.array` values (nested collections).

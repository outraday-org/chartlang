# Task 2 — Runtime `state.map` keyed store + committed/tentative snapshot/restore

> **Status: TODO**

## Goal

Implement the runtime `state.map` slot: a bounded, insertion-ordered keyed
store with the `state.*` committed/tentative lifecycle (tentative writes during
a tick, commit on bar close, restore the prior committed map when the head bar
is replaced), exposing the `MutableMapSlot` surface. Land unit + property tests.

## Prerequisites

- Task 1 (core type + hole + registry + shim + capacity guard) complete.
- `../state-array/` task 2 runtime slot lifecycle landed (the snapshot/restore
  machinery this reuses).

## Current Behavior

- The `state.array` runtime slot (`packages/runtime/src/`, state-array task 2)
  implements the committed/tentative ring with snapshot/restore around tick
  replay. `state.map` has no runtime impl.

## Desired Behavior

- `state.map(capacity)` allocates a keyed store at slot init; subsequent calls
  on the same callsite return the same handle.
- `set`/`get`/`has`/`delete`/`size`/`keyAt`/`clear` operate on the live
  (tentative) view during a step.
- On **bar close** the tentative view commits. On a **head-bar replacement
  tick** the store restores to the last committed snapshot before replay.
- Inserting a new key at `size === capacity` evicts the oldest-inserted key;
  updating an existing key preserves its insertion age; `delete` then re-`set`
  re-ages the key (it becomes newest).

## Requirements

### 1. Keyed store (`packages/runtime/src/state/mapStore.ts`, new)

- Back it with a `Map<K, V>` (JS `Map` preserves insertion order — exactly the
  eviction order needed) plus the capacity bound. `set` of a new key when full:
  evict via `store.keys().next().value` (oldest) then insert. `set` of an
  existing key: `store.set(k, v)` updates in place without reordering (JS `Map`
  semantics — confirm: re-setting an existing key does NOT change its iteration
  order; rely on this and assert it in a unit test).
- `keyAt(index)`: walk `store.keys()` to the index (bounded by capacity);
  return `undefined` past `size`. (v1 has no public iterators per task 1.)
- Snapshot = a shallow clone of the `Map` (`new Map(store)`); restore replaces
  the live map with the snapshot clone. Hook into the **same** slot
  snapshot/restore callback the `state.array` slot registered — do not invent a
  parallel lifecycle; reuse the slot-lifecycle abstraction from state-array
  task 2 (cite its path in code).

### 2. Wire the slot (`packages/runtime/src/...`)

Register `state.map` in the runtime's stateful-primitive slot dispatch
alongside `state.array`, returning a handle object that closes over the store +
the committed/tentative gates. Match how `state.array` exposes its handle.

### 3. Tests (co-located)

- **Unit** (`packages/runtime/src/state/mapStore.test.ts`):
  - `set`/`get`/`has`/`delete`/`size`/`clear` basics; `get` absent →
    `undefined`; `get` present-zero → `0` (not `undefined`).
  - Capacity eviction: fill to capacity, insert new key → oldest evicted,
    `size === capacity`; updating an existing key at capacity evicts nothing.
  - Insertion-age: `set a,b,c` then `set a` (update) → eviction on next new key
    removes `b` (a's age unchanged); `delete b; set b` → b is newest.
  - `keyAt` orientation + out-of-range → `undefined`.
- **Property** (`packages/runtime/src/state/mapStore.property.test.ts`):
  random `set`/`delete` sequences — `size === distinct live keys` and
  `size ≤ capacity` always; every `set(k, v)` immediately readable via
  `get(k)` until evicted/deleted; replaying a snapshot restores exact
  `(key → value)` contents.
- **Lifecycle test**: tentative `set` during a simulated head-bar tick, then a
  replacement tick → store restored to committed state (drive through the same
  test harness state-array task 2 uses for its ring lifecycle).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/state/mapStore.ts` | Create | Bounded insertion-ordered keyed store + snapshot/restore. |
| `packages/runtime/src/<slot dispatch file>.ts` | Modify | Register `state.map` slot + handle. |
| `packages/runtime/src/state/mapStore.test.ts` | Create | Unit + lifecycle. |
| `packages/runtime/src/state/mapStore.property.test.ts` | Create | Property. |
| `.changeset/state-map-runtime.md` | Create | minor (runtime). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on runtime)
- `pnpm bench:ci` (if the package requires a bench for new slot stores —
  `set`/`get` must be amortized O(1); eviction O(1) via `keys().next()`).

## Changeset

`.changeset/state-map-runtime.md` — **minor** (runtime).

## Acceptance Criteria

- Bounded insertion-ordered eviction correct (new-key-at-capacity evicts
  oldest; update preserves age; delete+set re-ages).
- Committed/tentative snapshot/restore reuses the state-array slot lifecycle
  (no parallel machinery); head-bar replacement restores committed contents.
- `get` distinguishes absent (`undefined`) from stored `0`.
- Unit + property + lifecycle layers landed; 100% coverage; changeset committed.

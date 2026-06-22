# Plan — Task 2: Runtime `ArrayStateSlot` (two-ring) + allocator + snapshot

> Audit artifact for `2-runtime-array-slot.md`. Validated against the live
> workspace on 2026-06-22.

## Context

Implement `state.array<number>(capacity)` at runtime: a per-callsite
`ArrayStateSlot` holding two `Float64RingBuffer`s
(`committedRing` / `tentativeRing`) with the `state.*` committed/tentative
discipline, an identity-stable `MutableArraySlot<number>` handle, and a
per-runner snapshot/restore via the rings' existing serialise hooks. Wire it
into the execution loop alongside the `state.series` hooks.

## Pre-existing work (Task 1, landed + verified)

- `MutableArraySlot<T>` exists at `packages/core/src/state/arraySlot.ts`
  (`push`/`get`/`last`/`clear` + readonly `size`/`capacity`), exported from
  the core barrel. `@since 1.3`, `@stable`.
- `state.array<T>(capacity)` sentinel hole + `{ name: "state.array",
  slot: true }` registry entry + `program.ts` shim are landed.
- `packages/core/CLAUDE.md` already documents the `state.array` invariant.
- `.changeset/state-array.md` exists (core/compiler/runtime/pine-converter
  minor, cli patch) — runtime is already covered; no new changeset needed.

## Issues found / decisions

1. **Storage-map decision: parallel `arraySlots` map (NOT folded into
   `stateSlots`).** The task offers two options; the live `state.series`
   precedent is a parallel `ctx.seriesSlots` map with dedicated lifecycle
   helpers + dedicated `:series` persistence, NOT a `kind`-tagged
   `stateSlots`. The array slot is structurally identical to series (two
   `Float64RingBuffer`s, no flush-to-`StateStore`, snapshot serialises
   directly from the live map). Folding into `stateSlots` would force a
   discriminated union on `StateSlot<unknown>` and special-case
   `flushStateSlots` (series is deliberately NOT flushed — it is the live
   source). A parallel `arraySlots` map keeps the two collection primitives
   symmetrical and `stateSlots` (scalar) untouched. **Decision documented in
   `packages/runtime/CLAUDE.md`.** Downstream Task 4 (conformance) + Task 5
   (converter) depend on the runtime behavior, not the map name.

2. **Lifecycle is driven from `runComputeBody`, NOT the `stateSlots` loop.**
   `state.series` runs `advanceSeriesSlots`/`commitSeriesSlots` (close) and
   `resetSeriesHeads` (tick) inside `runComputeStep.ts:runComputeBody`, not
   via the `lifecycle.ts` `stateSlots` iteration. The array slot mirrors this:
   `commitArraySlots` (close, after compute) + `resetTentativeArraySlots`
   (tick, before compute). **There is NO advance hook** (the array does not
   auto-advance per bar — it only changes when the author pushes), so close
   has only `commit`, unlike series' advance+commit.

3. **Capacity-mismatch degrade is free.** `restoreBuffer(snap, capacity)`
   (`bufferSnapshot.ts:138`) returns `null` when the snapshot is incompatible
   with the target capacity (the ring's `restoreFromSnapshotBuffer` throws and
   is caught). Restore rebuilds both rings at the script's *current* capacity;
   a stale snapshot whose `values.length` differs yields `null` → slot is
   skipped → starts fresh. No new guard code; matches the series precedent.

4. **No new changeset.** `.changeset/state-array.md` already lists runtime as
   minor (Task 1's plan). Task 2 only touches `packages/runtime/src/`, which
   the existing changeset covers.

5. **Reuse `bufferSnapshot.ts` helpers verbatim** (`serialiseBuffer`,
   `restoreBuffer`, `isBufferSnapshot`, `isRecord`, `isInteger`) — the same
   helpers `seriesPersistence.ts` uses. No new snapshot primitives.

## Steps

1. `ringBuffer.ts` — add `Float64RingBuffer.copyFrom(other)`: a typed-array
   `this.buf.set(other.buf)` memcpy plus `head`/`filled` copy. Same-capacity
   precondition (both rings in a slot share `capacity`). JSDoc + `@since 1.3`.
2. `state/arrayStateSlot.ts` (new) — `ArrayStateSlot` class (two rings +
   identity-stable handle), `buildArrayHandle`, `createArrayStateSlot`,
   `restoreArrayStateSlot`. `onBarClose` → `committedRing.copyFrom(tentative)`;
   `onBarTick` → `tentativeRing.copyFrom(committed)`. Handle: `push`→tentative
   `append`, `get(n)`→tentative `at`, `last()`→`at(0)`, `clear()`→tentative
   `reset`, `size`→tentative `length`, `capacity`→slot capacity.
3. `state/arrayPersistence.ts` (new) — `isArraySlotSnapshotKey` (`:array`
   suffix), `serialiseArraySlots`, `restoreArraySlots`. Snapshot shape
   `{ kind: "state.array", capacity, committed: BufferSnapshot, tentative:
   BufferSnapshot }`. Restore rebuilds both rings via `restoreBuffer` at the
   persisted `capacity`; capacity mismatch / malformed → skip.
4. `state/lifecycle.ts` — add `resetTentativeArraySlots(ctx)` (iterate
   `arraySlots`, `slot.onBarTick()`) + `commitArraySlots(ctx)`
   (`slot.onBarClose()`). Mirror the series helpers' JSDoc.
5. `runtimeContext.ts` — add `readonly arraySlots: Map<string,
   ArrayStateSlot>` with the `:array`-key JSDoc, beside `seriesSlots`.
6. `state/stateNamespace.ts` — add `arrayKey(ctx, slotId)` (`:array` suffix),
   `getOrAllocateArray(slotId, capacity)` (store-consult via
   `restoreArrayStateSlot`-from-snapshot if present, else
   `createArrayStateSlot(capacity)`), and `array: (slotId, capacity) =>
   getOrAllocateArray(...)` on the namespace.
7. `state/index.ts` — re-export the new array lifecycle + persistence symbols.
8. `execution/runComputeStep.ts:runComputeBody` — call
   `resetTentativeArraySlots` (tick branch, with `resetSeriesHeads`) and
   `commitArraySlots` (close branch, with `commitSeriesSlots`).
9. `persistentStateStore.runtime.ts` — fold `serialiseArraySlots` into
   `primarySectionSlots` + `runnerSection`; `restoreArraySlots` into
   `restoreRunnerSlots`; strip `:array` keys in `scalarStateSlots`.
10. `execution/dispose.ts` — clear `arraySlots` (no flush — like
    `seriesSlots`).
11. `createScriptRunner.ts` — init `arraySlots: new Map()` beside
    `seriesSlots`.
12. Tests: `arrayStateSlot.test.ts`, `arrayPersistence.test.ts`,
    `arrayLifecycle.test.ts` (createScriptRunner-driven close + tick rollback
    + multi-push-per-bar), `arrayStateSlot.property.test.ts`, plus an
    allocator unit test in `stateNamespace`-adjacent coverage. Snapshot
    round-trip + bundle prefix + capacity-mismatch covered in
    `arrayPersistence.test.ts` / `arrayLifecycle.test.ts`.
13. `packages/runtime/CLAUDE.md` — document the array-slot lifecycle +
    parallel-map decision.

## Files to create / modify

| File | Action |
|------|--------|
| `packages/runtime/src/ringBuffer.ts` | Modify (`copyFrom`) |
| `packages/runtime/src/state/arrayStateSlot.ts` | Create |
| `packages/runtime/src/state/arrayStateSlot.test.ts` | Create |
| `packages/runtime/src/state/arrayStateSlot.property.test.ts` | Create |
| `packages/runtime/src/state/arrayPersistence.ts` | Create |
| `packages/runtime/src/state/arrayPersistence.test.ts` | Create |
| `packages/runtime/src/state/arrayLifecycle.test.ts` | Create |
| `packages/runtime/src/state/lifecycle.ts` | Modify (array reset/commit) |
| `packages/runtime/src/state/index.ts` | Modify (re-exports) |
| `packages/runtime/src/state/stateNamespace.ts` | Modify (allocator) |
| `packages/runtime/src/runtimeContext.ts` | Modify (`arraySlots`) |
| `packages/runtime/src/execution/runComputeStep.ts` | Modify (wiring) |
| `packages/runtime/src/execution/dispose.ts` | Modify (clear) |
| `packages/runtime/src/createScriptRunner.ts` | Modify (init) |
| `packages/runtime/src/persistentStateStore.runtime.ts` | Modify (snapshot) |
| `packages/runtime/src/ringBuffer.test.ts` | Modify (`copyFrom` coverage) |
| `packages/runtime/CLAUDE.md` | Modify (invariant) |

## Gates to keep green

- `pnpm -F @invinite-org/chartlang-runtime test` (coverage 100%)
- `pnpm -F @invinite-org/chartlang-runtime bench` (no `THRESHOLD_MS` regress)
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`

## Changeset

Covered by the existing `.changeset/state-array.md` (runtime minor). No new
changeset.

## Acceptance criteria

- [x] `state.array(capacity)` returns identity-stable `MutableArraySlot<number>`.
- [x] Two-ring tick discipline (commit on close, rollback on head-replace tick).
- [x] Per-runner snapshot/restore incl. bundle `:array` prefixes +
      capacity-mismatch degrade + legacy snapshots.
- [x] Runtime coverage 100%; benches within threshold; typecheck/lint/docs green.
- [x] Parallel-map decision documented in `packages/runtime/CLAUDE.md`.

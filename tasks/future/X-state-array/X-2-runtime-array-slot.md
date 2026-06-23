# Task 2 — Runtime: `ArrayStateSlot` (two-ring) + allocator + snapshot

> **Status: TODO**

## Goal

Implement `state.array` at runtime: a per-callsite `ArrayStateSlot` holding
**two** `Float64RingBuffer`s (`committedRing` / `tentativeRing`) with the
`state.*` committed/tentative discipline, a `MutableArraySlot<number>` handle
(`push`/`get`/`last`/`size`/`capacity`/`clear`), and a per-runner
snapshot/restore via the rings' existing serialize hooks. Wire it into the
execution loop alongside the existing `state.*` hooks — reusing
`lifecycle.ts` with **no** change if the slot shares `StateSlot`'s lifecycle
interface — and keep the 100% coverage + property + bench gates green.

## Prerequisites

Task 1 (`state.array` hole + `MutableArraySlot` type + `{ name: "state.array",
slot: true }` registry entry).

## Current Behavior

- `state.*` slots are installed by `state/stateNamespace.ts`
  (`buildStateNamespace`, line 69; `getOrAllocate`, line 36; keyed via
  `stateKey`, line 25: `${ctx.slotIdPrefix ?? ""}${slotId}:state`) and held in
  `RuntimeContext.stateSlots` (`runtimeContext.ts:166`,
  `Map<string, StateSlot<unknown>>`). Each is a scalar `StateSlot`
  (`state/stateSlot.ts:41-81`) with a committed/tentative split:
  `onBarClose()` (line 66) does `committed = tentative`; `onBarTick()`
  (line 72) does `tentative = committed` (discarding in-progress tick writes).
  `asMutableSlot` (line 93) builds the `{ get value; set value }` proxy.
- Lifecycle hooks (`state/lifecycle.ts`) each iterate `ctx.stateSlots`:
  `resetTentativeStateSlots` (line 35, calls `slot.onBarTick()`),
  `commitStateSlots` (line 51, `slot.onBarClose()`), `flushStateSlots`
  (line 67), `serialiseStateSlots` (line 86), `restoreStateSlots` (line 107).
  The execution loop (`execution/onBarClose.ts`, `onBarTick.ts`,
  `execution/runComputeStep.ts`) calls them.
- `Float64RingBuffer` (`ringBuffer.ts:104-187`): `append` (113),
  `replaceHead` (119), `at(n)` (127, `n = 0` newest, `NaN` out-of-range),
  `length` (132), `reset` (182), and the snapshot hooks
  `serialiseSnapshotBuffer` (136) / `restoreFromSnapshotBuffer` (152)
  producing/consuming `{ headIndex, filled, values }` (`null` for `NaN`).
- Snapshot: `serialiseStateSlots` / `restoreStateSlots` (`state/lifecycle.ts`)
  + the per-runner sections in `persistentStateStore.runtime.ts`.
  `RunnerSnapshot.slots` is `JsonValue` (`core/src/state/snapshot.ts:61`).

## Desired Behavior

- `const a = state.array<number>(cap)` returns a `MutableArraySlot<number>`:
  - `a.push(x)` appends `x` to the **tentative** ring (FIFO; oldest evicted
    once `cap` reached).
  - `a.get(n)` reads `tentativeRing.at(n)` (`n = 0` newest; `NaN`
    out-of-range).
  - `a.last()` === `a.get(0)`.
  - `a.size` is `tentativeRing.length` (filled count, ≤ `cap`).
  - `a.capacity` is `cap` (the literal).
  - `a.clear()` resets the tentative ring (empties it; committed unaffected
    until close).
- Tick discipline (mirrors `StateSlot`): pushes within a tick mutate the
  tentative ring; a head-bar-replacing tick resets the tentative ring from the
  committed ring (in-progress pushes discarded); a bar close commits the
  tentative ring into the committed ring.
- `state.array` slots snapshot/restore per-runner; a warm restart reads
  `a.get(n)` / `a.size` correctly.

## Requirements

### 1. Array slot module (`packages/runtime/src/state/arrayStateSlot.ts`, new)

Define an `ArrayStateSlot` holding two rings + the handle:

```ts
class ArrayStateSlot {
    readonly committedRing: Float64RingBuffer;
    readonly tentativeRing: Float64RingBuffer;
    readonly handle: MutableArraySlot<number>;   // identity-stable

    constructor(public readonly capacity: number) {
        this.committedRing = new Float64RingBuffer(capacity);
        this.tentativeRing = new Float64RingBuffer(capacity);
        this.handle = buildArrayHandle(this);   // push→tentative, get→tentative.at
    }

    onBarClose(): void { copyRing(this.committedRing, this.tentativeRing); }
    onBarTick(): void  { copyRing(this.tentativeRing, this.committedRing); }
    // serialise/restore via the rings' snapshot hooks (see §5)
}
```

- **`onBarClose` / `onBarTick` MUST have the same method names + zero-arg
  signature as `StateSlot`** (`stateSlot.ts:66`/`72`) so the `lifecycle.ts`
  loop helpers call them unchanged. This is the load-bearing reuse decision in
  the README's Architecture table.
- **`copyRing(dst, src)`** copies `src`'s entire state into `dst`. Implement
  via a typed-array `set()` memcpy plus head/filled copy — add a
  `Float64RingBuffer.copyFrom(other)` method (or reuse
  `serialiseSnapshotBuffer` → `restoreFromSnapshotBuffer` if that is cleaner;
  prefer a direct `copyFrom` for the hot path, since tick rollback runs every
  tick). This is `O(capacity)` per tick — bounded because `capacity` is a
  required literal (Task 1/3). Document the cost in a code comment referencing
  the README Architecture decision.
- **`buildArrayHandle(slot)`** returns the `MutableArraySlot<number>`:
  `push(v)` → `tentativeRing.append(v)`; `get(n)` → `tentativeRing.at(n)`;
  `last()` → `tentativeRing.at(0)`; `clear()` → `tentativeRing.reset()`;
  `size` getter → `tentativeRing.length`; `capacity` getter → `slot.capacity`.
  Plain object with getters (NO Proxy needed — `state.array` is not
  number-coercible and has a fixed method set, unlike `state.series`'s indexed
  proxy). Identity stable across bars (built once in the constructor).

> **Why push targets the *tentative* ring (mirror `StateSlot.set`):**
> `StateSlot.set` writes `tentative` for non-tick slots (`stateSlot.ts:58-64`).
> Reads (`get`) also read tentative (`stateSlot.ts:54-56`). The array slot
> follows the same rule: all author-facing reads/writes go through the
> tentative ring, and the committed ring is the rollback source. (A
> `state.tick.array` would push to committed directly — deferred.)

### 2. Allocation (`state/stateNamespace.ts` — extend `buildStateNamespace`)

Install `state.array` on the runtime `state` namespace next to
`float`/`int`/etc. `state.array(slotId, capacity)` (the compiler injects
`slotId` first, per `slot: true` + `callsiteIdInjection`) does
get-or-allocate keyed `${ctx.slotIdPrefix ?? ""}${slotId}:array`:

- Choose the storage map. **Recommended:** a parallel
  `RuntimeContext.arraySlots: Map<string, ArrayStateSlot>` (mirrors the
  `state.series` precedent of a parallel map), iterated by the SAME
  `lifecycle.ts` helpers (extend each helper to also walk `arraySlots`, OR —
  if `StateSlot`'s generic widens cleanly — store `ArrayStateSlot` in
  `stateSlots` with a `kind` discriminator so the helpers need NO edit).
  **Decide here and document the choice in `packages/runtime/CLAUDE.md`** (per
  the repo per-folder CLAUDE.md rule). The README Architecture table prefers
  whichever keeps `lifecycle.ts` smallest.
- Use a distinct key **suffix** (`:array`) so the restore router tells array
  slots from scalar `state.*` (`:state`) slots.
- First allocation: `new ArrayStateSlot(capacity)` (both rings empty,
  `size === 0`). Unlike `state.float(init)`, there is **no** seed value — an
  empty collection starts empty.
- Restore-from-store path: if the backing store has a persisted snapshot for
  the key, rebuild both rings from it via `restoreFromSnapshotBuffer` instead
  of starting empty (mirror `getOrAllocate`'s store-consult branch,
  `stateNamespace.ts:49-53`).
- Return the slot's identity-stable `handle`.
- `getCtx(name)` (`stateNamespace.ts:28`) reuse: throw the active-step
  sentinel when `ACTIVE_RUNTIME_CONTEXT.current` is null.

### 3. Execution-loop wiring (`state/lifecycle.ts` + the loop)

- If array slots live in a **parallel `arraySlots` map**: extend
  `resetTentativeStateSlots` (call `slot.onBarTick()` over `arraySlots` too),
  `commitStateSlots` (`slot.onBarClose()`), `flushStateSlots`,
  `serialiseStateSlots`, `restoreStateSlots` to also iterate `arraySlots`.
  Because the array slot exposes the same `onBarClose`/`onBarTick` names, this
  is a second `for (const slot of ctx.arraySlots.values())` loop in each
  helper — no new execution-loop call sites in `onBarClose.ts`/`onBarTick.ts`.
- If array slots are **folded into `stateSlots` with a `kind` tag**:
  `lifecycle.ts` needs NO change at all (the helpers already iterate
  `stateSlots` and call `onBarClose`/`onBarTick`); only `serialise`/`restore`
  branch on `kind`.
- **Bundle runners:** array slots are prefix-keyed (`slotIdPrefix`), so
  dep/sibling runners get their own array slots, exactly like `state.*`. They
  ride the existing dep → sibling → primary walk with no extra wiring.

Order invariant: a slot first allocated mid-compute on bar K starts empty;
the close-side `commit` (after compute) commits whatever was pushed this bar.
There is **no** "advance" hook (unlike `state.series`) — the array does not
auto-advance per bar; it only changes when the author pushes. Confirm with a
test (allocate on bar 0, push twice, assert `size === 2` after close).

### 4. `dispose`

`dispose` flushes + clears the runner-local `arraySlots` map (mirror the
`stateSlots` dispose behavior; `runtime/CLAUDE.md` "state.* snapshots are
host-owned once flushed"); do **not** clear a caller-supplied backing store
(warm restart restores from it).

### 5. Snapshot / restore

- **Serialise:** add array slots to the per-key snapshot, producing
  `{ kind: "state.array", capacity, committed:
  committedRing.serialiseSnapshotBuffer(), tentative:
  tentativeRing.serialiseSnapshotBuffer() }`. Fold into each runner's
  `slots` section (`persistentStateStore.runtime.ts`) next to
  `serialiseStateSlots`. The `:array` key suffix lets the restore router
  distinguish it. All values are JSON-clean (`{ headIndex, filled, values }`
  with `null` for `NaN`) — `RunnerSnapshot.slots` is `JsonValue`
  (`core/src/state/snapshot.ts:61`).
- **Restore:** rebuild both rings via `Float64RingBuffer
  .restoreFromSnapshotBuffer` (allocate at the persisted `capacity`, then
  restore each ring). The `handle` is recreated from the restored slot
  (identity recreated on restore — acceptable, same as `state.series` /
  `ta.*`).
- **Capacity-mismatch guard:** if a persisted snapshot's `capacity` differs
  from the script's current `state.array(cap)` literal (script edited), do NOT
  throw — start fresh (mirror how a stale ring-size snapshot degrades
  elsewhere) and optionally push a `state-snapshot-malformed`-style diagnostic
  if the codebase has that precedent for slots. Match whatever
  `restoreStateSlots` does for a shape mismatch.
- Legacy snapshots without any array slots load cleanly (absent ⇒ no array
  slots), like the existing per-runner section handling.

### 6. Tests (co-located; keep 100% coverage)

- `arrayStateSlot.test.ts`: `push` then `get(0)` / `last()` / `size`;
  FIFO eviction once full (`push` past `capacity` evicts oldest, `size`
  caps at `capacity`, `get(capacity)` is `NaN`); `clear` empties; `capacity`
  getter is the constructor value; `copyFrom` round-trips ring state; every
  handle method + getter branch covered (coverage gate).
- Lifecycle test (extend `streamState.test.ts` or a new
  `arrayLifecycle.test.ts` driving `createScriptRunner`): across N close bars
  pushing `a.push(bar.close.current)`, assert the collection accumulates and
  FIFO-evicts at `capacity`; `size` reflects pushes, not bars; a bar that
  pushes twice grows `size` by two (multi-value-per-bar — the distinguishing
  behavior vs `state.series`).
- Tick test (`onBarTick.test.ts` sibling): a tick that pushes then is replaced
  by a later head-bar tick discards the in-progress push (tentative resets
  from committed); a close after a tick commits the final tentative state.
  This is THE crux test — it proves the two-ring rollback.
- Property test (`arrayStateSlot.property.test.ts`, fast-check — parity with
  the runtime `unit + property + golden + bench` gate): for a random sequence
  of per-bar push counts across N closes, after each close
  `a.get(0..size-1)` equals the last `min(totalPushed, capacity)` committed
  values newest-first, and the size never exceeds `capacity`.
- Snapshot round-trip test: drive several bars with pushes, snapshot,
  warm-restart, assert `a.size` / `a.get(n)` survive; bundle (dep/sibling)
  array slots restore into the correct prefixed `:array` key; a
  capacity-mismatch snapshot starts fresh without throwing.
- `bench`: run `pnpm -F @invinite-org/chartlang-runtime bench`. The
  per-tick `copyRing` is `O(capacity)` and on the hot path. If a
  `THRESHOLD_MS` regresses, confirm the typed-array `set()` memcpy is used
  (not an element loop) and document the outcome in the PR. The bounded
  capacity literal guarantees the cost is capped.

## Edge cases

- An empty collection: `get(0)` / `last()` return `NaN`; `size === 0`. No
  seed value (contrast `state.float(init)`).
- `get(n)` for `n` ≥ `size` or `n < 0` returns `NaN` (the ring `at` contract,
  `ringBuffer.ts:127`) — never throws. Cover both bounds.
- `clear()` mid-tick resets the tentative ring only; a subsequent
  head-replacing tick's `onBarTick` restores from committed (the clear is
  rolled back, correctly — it was a tentative write).
- Pushing more than `capacity` in a single bar: FIFO-evicts within the bar;
  only the last `capacity` values survive to commit.
- `state.array` is NOT spread / `Object.keys`-ed in a meaningful way (it is a
  fixed-method handle); it is NOT number-coercible (`+a` is `NaN`, and that is
  fine — authors use `get`/`last`).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/state/arrayStateSlot.ts` | Create | `ArrayStateSlot` (two rings) + handle + `onBarClose`/`onBarTick`. |
| `packages/runtime/src/state/arrayStateSlot.test.ts` | Create | Handle + FIFO + copyRing coverage. |
| `packages/runtime/src/ringBuffer.ts` | Modify | Add `Float64RingBuffer.copyFrom(other)` (typed-array `set` memcpy). |
| `packages/runtime/src/state/stateNamespace.ts` | Modify | Install `state.array` get-or-allocate (`:array` key). |
| `packages/runtime/src/runtimeContext.ts` | Modify | Add `arraySlots` map (or `kind`-tag `stateSlots`). |
| `packages/runtime/src/state/lifecycle.ts` | Modify | Walk array slots in reset/commit/flush/serialise/restore (or no-op if folded). |
| `packages/runtime/src/persistentStateStore.runtime.ts` | Modify | Per-runner `:array` snapshot section. |
| `packages/runtime/src/**/*.test.ts` | Create/Modify | Lifecycle, tick-rollback, snapshot, property tests. |
| `packages/runtime/CLAUDE.md` | Modify | Document the array-slot lifecycle + storage-map choice. |

## Gates

- `pnpm -F @invinite-org/chartlang-runtime test` (coverage **100%**)
- `pnpm -F @invinite-org/chartlang-runtime bench` (no `THRESHOLD_MS` regression
  or document the `copyRing` memcpy outcome)
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`

## Changeset

Covered by Task 1's feature changeset (runtime is included as minor).

## Acceptance Criteria

- `state.array(capacity)` returns an identity-stable `MutableArraySlot<number>`:
  `push` appends (FIFO-evicting at `capacity`), `get(0)` / `last()` read the
  newest, `size` is the filled count, `capacity` is the literal, `clear()`
  empties.
- Two-ring tick discipline works: in-progress pushes are discarded on a
  head-replacing tick (`onBarTick` copies committed→tentative) and committed on
  close (`onBarClose` copies tentative→committed); `lifecycle.ts` reuse is
  documented.
- Per-runner snapshot/restore works (incl. bundle dep/sibling `:array`
  prefixes, capacity-mismatch degrade, legacy snapshots).
- Runtime coverage 100%; benches within threshold (or `copyRing` memcpy
  documented); typecheck/lint/docs:check green.

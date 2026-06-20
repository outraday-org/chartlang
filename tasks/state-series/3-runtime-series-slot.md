# Task 3 — Runtime: `state.series` slot

> **Status: TODO**

## Goal

Implement `state.series` at runtime: a per-callsite slot holding a
`Float64RingBuffer` + a number-coercible `makeSeriesView` proxy + a `.value`
get/set, advanced in lockstep with the bar lifecycle so `s[1]` is always one
committed bar back. Wire its commit/reset/advance into the execution loop
alongside the existing `state.*` hooks, snapshot/restore it per-runner, and
keep the 100% coverage + property + bench gates green.

## Prerequisites

Task 1 (`state.series` hole + `NumberSeriesSlot` type) and Task 2 (compiler
sizes `manifest.maxLookback` from `s[N]`).

## Current Behavior

- `state.*` slots are installed by `state/stateNamespace.ts` (`getOrAllocate`,
  keyed `${ctx.slotIdPrefix ?? ""}${slotId}:state`) and held in
  `RuntimeContext.stateSlots`. Each is a scalar `StateSlot`
  (`state/stateSlot.ts`) with a committed/tentative split:
  `onBarClose()` commits, `onBarTick()` resets tentative ← committed.
- Lifecycle hooks: `state/lifecycle.ts` + the execution loop
  (`execution/onBarClose.ts`, `onBarTick.ts`, `execution/runComputeStep.ts:
  runComputeBody`) call `resetTentativeStateSlots(ctx)` (tick, before compute),
  `commitStateSlots(ctx)` + `flushStateSlots(ctx)` (close, after compute).
- `ta.*` outputs hold a `Float64RingBuffer` in `stream.taSlots`, do
  `ctx.isTick ? outBuffer.replaceHead(value) : outBuffer.append(value)` per
  compute, and wrap the buffer in a cached `makeSeriesView` proxy (see
  `ta/ema.ts`). Capacity is `ctx.stream.ohlcv.close.capacity`.
- `makeSeriesView` (`seriesView.ts`) is number-coercible (`valueOf` +
  `Symbol.toPrimitive` → `buf.at(0)`), identity-stable per buffer.
- Snapshot: `serialiseStateSlots` / `restoreStateSlots` (`state/lifecycle.ts`)
  + the per-runner sections in `persistentStateStore.runtime.ts`.

## Desired Behavior

- `const s = state.series(0)` returns a `NumberSeriesSlot`: `s.value = x`
  writes the live head (`replaceHead`); `s.value` / `s.current` / `+s` /
  `s[0]` read it; `s[1..n]` read committed history; `s.length` is the filled
  count; out-of-range / pre-write reads are `NaN`.
- The ring advances once per **close** bar regardless of whether the script
  writes (script-invisible lockstep): `s[1]` is always one committed bar back.
  A bar with no write leaves a `NaN` head (gap).
- On a **tick**, the head resets to the last committed value before compute,
  then a write refines it (`replaceHead`); history stays committed-only.
- `state.series` slots snapshot/restore per-runner; warm restart reads
  `s[1]` correctly.

## Requirements

### 1. Series slot module (`packages/runtime/src/state/seriesSlot.ts`, new)

Define a `SeriesSlot` holding:

```ts
type SeriesSlot = {
    kind: "state.series";
    buffer: Float64RingBuffer;     // history ring (index 0 = live head)
    view: NumberSeriesSlot;        // the script-facing handle (stable identity)
    committedHead: number;         // head value as of the last bar close
};
```

The `view` is a single object created once and reused (identity-stable, like
`makeSeriesView`). It must satisfy **both** halves of `NumberSeriesSlot`:

- **Series reads** delegate to a `makeSeriesView(buffer)` (reuse it — do NOT
  fork): `[n]` → `buffer.at(n)`, `current`/`length`, `valueOf`/
  `Symbol.toPrimitive` → `buffer.at(0)`.
- **`.value` get** → `buffer.at(0)` (current head).
- **`.value` set** → `buffer.replaceHead(v)` (write-through to the live head).

Implement as a `Proxy` whose `get`/`set`/`has` traps add `value` (get→`at(0)`,
set→`replaceHead`) on top of the `makeSeriesView` behavior, OR compose: keep a
`makeSeriesView` proxy for reads and wrap it so `value` is intercepted. Either
way `s.value = x` and `s[1]` must both work, and the object's identity is
stable across bars. Cover every trap branch (coverage gate).

Lifecycle helpers on the slot (mirror `ta.ema`'s close/tick discipline):

- `advance(slot)` — `buffer.append(Number.NaN)` (new head for a new close bar;
  prior committed head slides to index 1).
- `commit(slot)` — `slot.committedHead = buffer.at(0)`.
- `resetHead(slot)` — `buffer.replaceHead(slot.committedHead)` (tick start).

### 2. Allocation (`state/stateNamespace.ts` or a sibling `seriesNamespace.ts`)

Install `state.series` on the runtime `state` namespace next to `float`/`int`.
`state.series(slotId, init)` (the compiler injects `slotId` first, per the
registry `slot: true` + `callsiteIdInjection`) does get-or-allocate keyed
`${ctx.slotIdPrefix ?? ""}${slotId}:series` in a new
`RuntimeContext.seriesSlots: Map<string, SeriesSlot>`:

- First allocation: `buffer = new Float64RingBuffer(ctx.stream.ohlcv.close
  .capacity)`; `buffer.append(Number.NaN)` (seed the first head);
  `committedHead = Number.NaN`; build the `view`. `init` is the pre-write head
  value — append `init` instead of `NaN` for the very first head so a never-
  written series reads `init`, not `NaN` (matches `state.float(init)`
  returning `init` before any write). Decide and **document** which: prefer
  seeding the first head with `init` so `+state.series(5)` is `5` pre-write.
- Subsequent bars: return the existing slot's `view` (already advanced by the
  loop hook in §3).

Restore-from-store path: if `ctx.stateStore` (or the dedicated series store)
has a persisted snapshot for the key, rebuild the buffer from it instead of
seeding (mirror `getOrAllocate`'s store-consult branch).

### 3. Execution-loop wiring

Add three hooks parallel to the `state.*` ones (new functions in
`state/lifecycle.ts`, e.g. `advanceSeriesSlots` / `commitSeriesSlots` /
`resetSeriesHeads`, each iterating `ctx.seriesSlots`):

- **`onBarClose.ts` / `runComputeBody` (close path):** call
  `advanceSeriesSlots(ctx)` **before** the primary compute (after
  `appendBarToStream`, alongside where OHLCV advances) so every already-
  allocated series gets a fresh `NaN` head; call `commitSeriesSlots(ctx)`
  **after** compute (next to `commitStateSlots`).
- **`onBarTick.ts` / `runComputeBody` (tick path):** call
  `resetSeriesHeads(ctx)` **before** compute (next to
  `resetTentativeStateSlots`). Do **not** advance on tick.
- **Bundle runners:** series slots are prefix-keyed (`slotIdPrefix`), so
  dep/sibling runners get their own series slots, exactly like `state.*`.
  Walk them in the same dep → sibling → primary order. Confirm
  `advance`/`commit`/`reset` run per-runner via each runner's `ctx`.

Order invariant: a slot first allocated mid-compute on bar K must NOT also be
advanced by the loop hook on bar K (it already has its seeded head). Because
`advanceSeriesSlots` runs **before** compute, only slots from bars < K exist
at advance time — newly allocated ones are seeded in §2 during compute. Verify
with a test (allocate on bar 0, check `s.length` growth is exactly one per
close bar, not two on the allocation bar).

### 4. `dispose`

`dispose` flushes + clears the runner-local `seriesSlots` map (mirror the
`stateSlots` dispose behavior); do not clear a caller-supplied backing store
(warm restart restores from it).

### 5. Snapshot / restore

- **Serialise:** add `serialiseSeriesSlots(ctx)` producing, per key,
  `{ kind: "state.series", buffer: buffer.serialiseSnapshotBuffer(),
  committedHead }`. Fold it into each runner's snapshot `slots` section
  (`persistentStateStore.runtime.ts`) next to `serialiseStateSlots`. Use a
  distinct key suffix (`:series`) so the restore router can tell series slots
  from scalar `state.*` slots.
- **Restore:** `restoreSeriesSlots(ctx, slots)` rebuilds the buffer via
  `Float64RingBuffer.restoreFromSnapshotBuffer` (or seeds the store so the
  next `state.series(slotId)` allocation reads it — mirror whichever pattern
  `restoreStateSlots` uses). The `view` is recreated from the restored buffer
  (identity is recreated on restore — acceptable, same as `ta.*`).
- Legacy snapshots without a series section load cleanly (absent section ⇒ no
  series slots), like the existing per-runner section handling.

### 6. Tests (co-located; keep 100% coverage)

- `seriesSlot.test.ts`: `s.value = x` then `s[0] === x`, `+s === x`,
  `s.current === x`; `s.value` getter returns the head; `view` identity stable
  across calls; coverage of every proxy trap branch (`value` get/set,
  `current`, `length`, `[n]`, `valueOf`, `Symbol.toPrimitive`, `has`).
- Lifecycle test (extend `streamState.test.ts` or a new
  `seriesLifecycle.test.ts` driving `createScriptRunner`): across N close
  bars writing `s.value = bar.close.current`, assert `s[1]` equals the prior
  close, `s.length` grows one per close bar, `s[k]` past filled history is
  `NaN`; a bar that skips the write leaves `s[0]` `NaN` while `s[1]` keeps the
  prior committed value (gap semantics).
- Tick test (`onBarTick.test.ts` sibling): a tick refines `s[0]` via a
  re-write but does NOT advance `s.length`; a tick that does not write sees the
  committed head (reset-on-tick); history `s[1]` stays committed.
- Capacity test: with a script indexing `s[3]`, the ring retains ≥ 4 values
  (drives the Task-2 `maxLookback` sizing end-to-end).
- Snapshot round-trip test: drive several bars, snapshot, warm-restart, assert
  `s[1]`/`s.length` survive; bundle (dep/sibling) series slots restore into the
  correct prefixed key.
- `bench`: run `pnpm -F @invinite-org/chartlang-runtime bench`. The series
  proxy `set`/coerce path is on the script hot path. If a `THRESHOLD_MS`
  regresses, specialise the slot (plain object with `value` getter/setter +
  a Proxy only for `[n]`), mirroring the option noted for the bar views;
  otherwise leave the unified proxy. Document the outcome in the PR.

## Edge cases

- Pre-write / pre-allocation reads are `NaN` (empty buffer) except the seeded
  first head (`init`). Document the `init`-seed choice.
- `s[n]` past retained history is `NaN` (ring `at` contract).
- A non-literal index relies on Task 2's `dynamicFallback` capacity (5000) —
  no special runtime handling needed beyond using `ohlcv.close.capacity`.
- Coercion must return `buffer.at(0)` (live head), so `plot(s)` and arithmetic
  see the current value, including mid-tick (`resolveValue` takes the
  `.current` path for the object — value-identical).
- `state.series` is NOT spread / `Object.keys`-ed (proxy fields are not own-
  enumerable) — same as `bar.*`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/state/seriesSlot.ts` | Create | `SeriesSlot` + view + advance/commit/resetHead. |
| `packages/runtime/src/state/seriesSlot.test.ts` | Create | Proxy-trap + value/index coverage. |
| `packages/runtime/src/state/stateNamespace.ts` (or new `seriesNamespace.ts`) | Modify/Create | Install `state.series` get-or-allocate. |
| `packages/runtime/src/state/lifecycle.ts` | Modify | `advance`/`commit`/`reset` + `serialise`/`restore` series slots. |
| `packages/runtime/src/execution/onBarClose.ts`, `onBarTick.ts`, `runComputeStep.ts` | Modify | Wire the three hooks. |
| `packages/runtime/src/persistentStateStore.runtime.ts` | Modify | Per-runner series-slot snapshot section. |
| `packages/runtime/src/runtimeContext.ts` (or where `RuntimeContext` is typed) | Modify | Add `seriesSlots` map. |
| `packages/runtime/src/**/*.test.ts` | Create/Modify | Lifecycle, tick, capacity, snapshot tests. |

## Gates

- `pnpm -F @invinite-org/chartlang-runtime test` (coverage **100%**)
- `pnpm -F @invinite-org/chartlang-runtime bench` (no `THRESHOLD_MS` regression
  or specialise + document)
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`

## Changeset

Covered by Task 1's feature changeset (runtime is included as minor).

## Acceptance Criteria

- `state.series(init)` returns an identity-stable `NumberSeriesSlot`:
  `s.value = x` writes the head, `s[1]` reads one committed bar back, `+s` /
  `s.current` / `s[0]` read the live head, `s.length` is the filled count.
- The ring advances exactly once per close bar (script-invisible lockstep);
  unwritten bars are `NaN` gaps; ticks refine the head without advancing.
- Per-runner snapshot/restore works (incl. bundle dep/sibling prefixes);
  legacy snapshots load.
- Runtime coverage 100%; benches within threshold (or slot specialised);
  typecheck/lint/docs:check green.
</content>

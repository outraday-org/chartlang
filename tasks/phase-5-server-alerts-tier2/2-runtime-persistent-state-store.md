# Task 2 — Runtime: `PersistentStateStore` sub-interface + snapshot/restore wiring

> **Status: TODO**

## Goal

Land the §6.9 cross-mount persistence layer on top of the Phase-1
slot `StateStore`. Add a `PersistentStateStore` sub-interface to
`@invinite-org/chartlang-runtime`, wire snapshot capture +
restore into `createScriptRunner`, ship `inMemoryPersistentStateStore`
for tests + conformance, and pin warm-start determinism with a
property-style cold-vs-warm equivalence test.

## Prerequisites

- Task 1: `StateSnapshot` / `StreamSnapshot` / `StateStoreKey`
  exported from `@invinite-org/chartlang-core`.

## Current Behavior

- `packages/runtime/src/stateStore.ts` declares the Phase-1 slot
  `StateStore.{get,set,has,clear}` + `inMemoryStateStore()` factory.
  No persistence interface exists.
- `packages/runtime/src/createScriptRunner.ts` accepts an optional
  `stateStore: StateStore` for primitive slot state. No
  `persistentStateStore` parameter.
- `packages/runtime/src/runtimeContext.ts` `RuntimeContext` carries
  `stateSlots` (Phase-4 `state.*` slots) but no snapshot capture.
- `packages/runtime/src/streamState.ts` has no
  `serialiseSnapshot` / `restoreFromSnapshot` methods.
- Snapshot determinism is not tested.

## Desired Behavior

- `@invinite-org/chartlang-runtime` exports a new `PersistentStateStore`
  sub-interface sitting **beside** the existing slot `StateStore`:
  - `readonly key: StateStoreKey`
  - `load(): Promise<StateSnapshot | null>`
  - `save(snapshot: StateSnapshot): Promise<void>`
  - `clear(): Promise<void>`
- A new `inMemoryPersistentStateStore({ key })` factory ships for tests
  and conformance; persists one `StateSnapshot` per process lifetime.
- `createScriptRunner({ persistentStateStore? })` accepts an optional
  store. On mount, if a non-null snapshot is `load()`-ed and its
  `lastBarTime < currentMainBarTime`, the runtime rehydrates streams +
  slots and skips full-history replay.
- Snapshot writes happen on `dispose()` and on every `kind: "close"`
  main-bar event when ≥`PERSISTENCE_INTERVAL_MS` (default
  `60_000` ms wall-clock) has passed since the last save.
- Warm-start determinism: a script running cold and a script running
  warm (snapshot taken at bar `N`, fresh runtime restored at bar `N+1`)
  produce **byte-identical** emissions from bar `N+1` onward. Property
  test pins this with a representative subset of `ta.*` primitives.

## Requirements

### 1. `packages/runtime/src/persistentStateStore.ts` (new file)

Two-line MIT header. Exports the sub-interface + the in-memory
factory:

```ts
import type { StateSnapshot, StateStoreKey } from "@invinite-org/chartlang-core";

/**
 * Cross-mount snapshot store per PLAN §6.9. Sits beside the Phase-1
 * slot {@link StateStore} — primitives still read/write slot state
 * through the slot store; the persistent store captures and restores
 * the *whole* snapshot (streams + slots + lastBarTime) on
 * mount/dispose boundaries.
 *
 * Implementations: {@link inMemoryPersistentStateStore} for tests,
 * `idbStateStore` (Task 3, shipped from `@invinite-org/chartlang-host-worker/idb`)
 * for browsers, caller-supplied for servers.
 *
 * @since 0.5
 */
export type PersistentStateStore = {
    readonly key: StateStoreKey;
    load(): Promise<StateSnapshot | null>;
    save(snapshot: StateSnapshot): Promise<void>;
    clear(): Promise<void>;
};

/**
 * In-process persistent store — one snapshot, last-write-wins.
 * Used by the conformance warm-start determinism test and by
 * adapter consumers that want a stateless runtime façade.
 *
 * @since 0.5
 * @example
 *     // const store = inMemoryPersistentStateStore({ key });
 *     // await store.save(snapshot); // (await store.load()) === snapshot
 */
export function inMemoryPersistentStateStore(
    opts: Readonly<{ key: StateStoreKey }>
): PersistentStateStore {
    let current: StateSnapshot | null = null;
    return Object.freeze({
        key: opts.key,
        async load() {
            return current;
        },
        async save(snapshot) {
            current = snapshot;
        },
        async clear() {
            current = null;
        },
    });
}
```

### 2. `packages/runtime/src/streamState.ts` — add (de)serialise

Append two methods to the existing `StreamState` factory:

- `serialiseSnapshot(): StreamSnapshot` — reads the ring buffer's
  `headIndex`, `filled`, and per-field arrays (mapping NaN → `null`
  for JSON purity) and returns a frozen `StreamSnapshot`.
- `restoreFromSnapshot(s: StreamSnapshot): void` — validates the
  shape (interval / filled / buffers length match capacity), writes
  the buffers back (mapping `null` → `NaN`), and resets `headIndex`.

Both reuse the existing ring-buffer primitives — no new internal
state. The serialise pass is `O(capacity)`; the restore is the same.

### 3. `packages/runtime/src/runtimeContext.ts` — add snapshot wiring

Extend `RuntimeContext`:

- `persistentStateStore?: PersistentStateStore` — undefined when not
  configured.
- `lastPersistTime: number` — wall-clock ms of the last successful
  `save()`; initialised to `0`.

Mutation of `lastPersistTime` is confined to `createScriptRunner.ts`.

### 4. `packages/runtime/src/createScriptRunner.ts` — add load/save flow

Extend the runner construction options:

```ts
export type CreateScriptRunnerOpts = {
    // existing fields …
    readonly persistentStateStore?: PersistentStateStore;
    readonly persistenceIntervalMs?: number;  // default 60_000
};
```

Add the mount flow:

1. Construct the runner as before.
2. If `persistentStateStore` is provided, expose `runner.warmStart()`
   — an async method the host calls before the first candle event.
   - `const snap = await persistentStateStore.load();`
   - If `snap === null` or `snap.snapshotVersion !== 1`, no-op.
   - If `snap.lastBarTime >= currentMainBarTime` (host passes this
     in), no-op + emit `state-snapshot-future-dated` diagnostic + call
     `persistentStateStore.clear()` (the snapshot is ahead of the cursor
     — runtime can't apply it).
   - Else: for each stream in `snap.streams`, find the matching
     `StreamState` (by interval) and call `restoreFromSnapshot(s)`.
     For each slot in `snap.slots`, write into the runtime's
     `stateSlots` map (Phase-4 store) via `stateStore.set(slotId, value)`.
   - Emit `state-snapshot-restored` diagnostic with the restored
     `lastBarTime`.
3. Snapshot capture lives in `onBarClose`:
   - After the normal close-side processing, check
     `now() - state.lastPersistTime >= persistenceIntervalMs`.
   - If yes, build the snapshot:
     - `streams`: for each known `StreamState`, call
       `serialiseSnapshot()`.
     - `slots`: for each entry in `stateSlots`, marshal via the
       primitive's registered `serialiseState` hook (Phase-4 store
       gains this field — extend it in step 5 below).
     - `lastBarTime = bar.time`.
     - `savedAt = now()`.
     - `snapshotVersion: 1`.
   - Validate the snapshot is `JsonValue`-clean via a structural
     guard (`validateSnapshot` helper, step 6). If invalid, emit
     `state-snapshot-malformed` and skip the save.
   - `await persistentStateStore.save(snapshot)`.
   - Update `state.lastPersistTime`.
4. `dispose()` always flushes one final snapshot (regardless of
   cadence) before clearing the runner state. Failures are swallowed
   into a `state-snapshot-save-failed` diagnostic but do not block
   teardown.

### 5. `packages/runtime/src/state/registry.ts` — add serialise hooks

Phase-4 `state.*` slot entries gain optional
`{ serialiseState?, deserialiseState? }` hooks per PLAN §6.9 last
paragraph. For Phase-4 primitives (`state.int`, `state.float`,
`state.bool`, `state.string`, `state.tick.*`), the default identity
serialise (`value`) suffices — the slot value is already
`JsonValue`-clean. For new Phase-5 ta primitives that keep ring-
buffer state (Tasks 15–18 VPs), the hook lets them marshal a
typed-array snapshot to JSON-clean numbers.

### 6. `packages/runtime/src/persistentStateStore.validate.ts` (new helper)

Pure function `validateSnapshot(snap: unknown): snap is StateSnapshot`
walking the shape: `snapshotVersion === 1`, `lastBarTime` is finite,
`streams` is `Record<string, StreamSnapshot>`, every buffer field is
an array of `number | null`, `slots` values pass a structural
JsonValue guard. On failure, returns `false` (caller skips the save).

### 7. Tests

Per §16.3, the runtime ships unit + property + golden + bench. For
this task:

#### `packages/runtime/src/persistentStateStore.test.ts`

- `inMemoryPersistentStateStore` returns the last-saved snapshot from
  `load()`; `clear()` resets it to `null`; the key is frozen.
- Construct a representative snapshot with `streams: { "1m": …, "1D": … }`
  and assert round-trip equality (deep-equal).

#### `packages/runtime/src/persistentStateStore.validate.test.ts`

- `validateSnapshot` accepts a well-formed snapshot.
- Rejects `snapshotVersion: 0`, `snapshotVersion: 2`, missing
  `lastBarTime`, non-array buffer field, non-JsonValue slot value
  (e.g. a `Function`).

#### `packages/runtime/src/createScriptRunner.persist.test.ts`

- `warmStart()` no-ops when no store is configured.
- `warmStart()` loads a saved snapshot and skips full-history replay
  (assert by piping in 10 bars before and 5 bars after; the runner
  emits only against the 5 new bars).
- `warmStart()` with `snap.lastBarTime >= currentMainBarTime` emits
  `state-snapshot-future-dated` and falls back to cold replay.
- `onBarClose` triggers a `save()` after 60s wall-clock
  (test injects a clock; bumps `now()` past the threshold).
- `dispose()` always flushes one final snapshot — assert
  `store.save` was called.
- Malformed slot value (test primitive returns a `Function`) results
  in `state-snapshot-malformed` diagnostic + no save.

#### `packages/runtime/src/persistentStateStore.determinism.test.ts`

Warm-start byte-identical equivalence (§6.9 determinism guarantee):

- Use `fast-check` to generate a series of 200 bars.
- Construct two runners; feed both 100 bars cold; capture snapshot
  from runner A.
- Construct a third runner with `persistentStateStore` carrying that
  snapshot; warm-start, feed bars 101–200.
- Continue feeding runner B bars 101–200.
- Assert every `PlotEmission` / `AlertEmission` / `DrawingEmission` is
  byte-identical between runner B (cold) and runner C (warm) from bar
  101 onward.
- Repeat with a script that exercises `ta.sma`, `ta.ema`, `ta.rsi`,
  `state.int`, `state.tick.int` — covers slot serialise + stream
  rehydrate together.

#### Bench

Skip a dedicated bench for this task — snapshot save/restore amortises
over 60s wall-clock; not a hot path. (Phase 5 bench coverage lives in
Tasks 4 / 7 / 14–18.)

### 8. JSDoc

- `PersistentStateStore` — `@since 0.5`, `@example`, `@experimental`.
- `inMemoryPersistentStateStore` — `@since 0.5`, `@example` with a
  round-trip.
- `validateSnapshot` — `@since 0.5`, `@internal` (not re-exported
  from the package barrel).
- The new `CreateScriptRunnerOpts.persistentStateStore` /
  `persistenceIntervalMs` fields get inline JSDoc with PLAN §6.9
  references.

### 9. Package barrel

`packages/runtime/src/index.ts` re-exports `PersistentStateStore` +
`inMemoryPersistentStateStore` alongside the existing `StateStore` +
`inMemoryStateStore` exports.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/persistentStateStore.ts` | Create | Sub-interface + in-memory factory |
| `packages/runtime/src/persistentStateStore.validate.ts` | Create | Structural snapshot validator |
| `packages/runtime/src/persistentStateStore.test.ts` | Create | Factory + round-trip tests |
| `packages/runtime/src/persistentStateStore.validate.test.ts` | Create | Validator tests |
| `packages/runtime/src/createScriptRunner.persist.test.ts` | Create | Mount/dispose flow tests |
| `packages/runtime/src/persistentStateStore.determinism.test.ts` | Create | Property-style warm-start equivalence |
| `packages/runtime/src/streamState.ts` | Modify | Add `serialiseSnapshot` / `restoreFromSnapshot` |
| `packages/runtime/src/runtimeContext.ts` | Modify | Add `persistentStateStore`, `lastPersistTime` |
| `packages/runtime/src/createScriptRunner.ts` | Modify | Add `warmStart`, `save` cadence, `dispose` flush |
| `packages/runtime/src/state/registry.ts` | Modify | Optional `serialiseState` / `deserialiseState` hooks |
| `packages/runtime/src/index.ts` | Modify | Re-export new types + factory |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-runtime test --coverage` (100%)
- `pnpm docs:check`
- `pnpm readme:check`

## Changeset

`.changeset/phase5-runtime-persistent-state-store.md` — `minor` bump
for `@invinite-org/chartlang-runtime`. Body cites PLAN §6.9.

## Acceptance Criteria

- [ ] `PersistentStateStore` sub-interface + `inMemoryPersistentStateStore`
      ship with full JSDoc.
- [ ] `validateSnapshot` rejects every documented failure mode.
- [ ] `createScriptRunner` accepts `persistentStateStore` +
      `persistenceIntervalMs`, exposes `warmStart()`, and flushes on
      `dispose()`.
- [ ] Determinism test pins byte-identical emissions cold vs warm
      across a representative `ta.*` + `state.*` mix (≥25
      `fast-check` runs).
- [ ] 100% coverage on every touched file; new lines exercised by
      tests.
- [ ] Phase-4 runtime invariants (per `packages/runtime/CLAUDE.md`)
      remain green — the Phase-1 slot `StateStore` interface is
      untouched.
- [ ] Changeset committed; `pnpm changeset status` lists the bump.

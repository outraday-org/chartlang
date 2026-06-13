# Task 5 — Runtime slot-id namespacing + persistence isolation

> **Status: DONE**

## Goal

Make dependency state and sibling state survive warm restarts
without colliding with the primary's state and without colliding
across deps. The previous task wired the `slotIdPrefix` field on
`RuntimeContext` for the in-memory case; this task carries the
prefix through the `StateStore`, the `PersistentStateStore`
snapshot format, and the warm-restart `warmStart` path. After this
task lands, an indicator bundle resumes cold-replay vs
warm-restart byte-identical, with deps and siblings retaining their
state across mounts.

## Prerequisites

- Task 4 — `DepRunner`, `SiblingRunner`,
  `RuntimeContext.slotIdPrefix` already in place.
- Task 1 — `dep-*` diagnostic codes available for
  snapshot-mismatch errors.

## Current Behavior

- `StateStore` (`packages/runtime/src/stateStore.ts`) keys slots
  by flat string keys derived from the compiler's slot ids
  (`<sourcePath>:<line>:<col>#<callIndex>`).
- `StateSnapshot` is declared in
  `packages/core/src/state/snapshot.ts` (not in `runtime`) and
  re-exported from `@invinite-org/chartlang-core`. Its current
  shape carries `lastBarTime: number`,
  `streams: Readonly<Record<string, StreamSnapshot>>`,
  `slots: Readonly<Record<string, JsonValue>>`, `savedAt: number`,
  `snapshotVersion: 1`. The `runtime` package consumes the type
  via `import type { StateSnapshot } from "@invinite-org/chartlang-core"`.
- `PersistentStateStore`
  (`packages/runtime/src/persistentStateStore.ts`) persists a
  single `StateSnapshot` per mount with the flat `slots:
  Record<string, JsonValue>` table.
- `warmStart(currentMainBarTime)` loads the snapshot, restores
  stream + slot state, and continues from the next bar.
- `dispose()` flushes one final snapshot.

## Desired Behavior

- `StateStore` keys carry the active `slotIdPrefix`. Each
  `DepRunner`'s state slots live at
  `dep:<localId>/<inner-slotId>`; each `SiblingRunner`'s at
  `export:<exportName>/<inner-slotId>`; the primary's at the bare
  inner slot id.
- `StateSnapshot` widens to carry per-runner sections. The flat
  `slots` map becomes a structured tree:
    - `primary.slots`
    - `siblings: Record<exportName, RunnerSnapshot>`
    - `dependencies: Record<localId, RunnerSnapshot>`
- `warmStart` restores each runner's slots into its own
  `RuntimeContext`. Missing dep snapshots are tolerated — that dep
  cold-starts. Extra dep snapshots (i.e. a snapshot has a
  `localId` the current bundle no longer declares) are dropped with
  a `state-snapshot-malformed` diagnostic (existing code) and the
  unknown section is ignored. Renaming a dep's `localId` resets
  that dep's state (the docs already say this is acceptable).
- `dispose` writes the new structured snapshot.
- Cold-start emissions for a bundle equal warm-start emissions for
  the same bundle replayed from the snapshot — invariant pinned
  by a determinism test.

## Requirements

### 1. `StateStore` key shape

In `packages/runtime/src/stateStore.ts`:

The current `inMemoryStateStore()` already keys by string. No
shape change needed at this layer — the runtime hands it the
prefixed key. Document the convention in
`packages/runtime/CLAUDE.md`: the key passed to `StateStore` is
always `<slotIdPrefix><inner-slotId>` where `slotIdPrefix` is
`""` for the primary, `dep:<localId>/` for deps,
`export:<exportName>/` for siblings.

`packages/runtime/src/state/*.ts` (the `state.*` runtime namespace
implementation) reads `ACTIVE_RUNTIME_CONTEXT.current.slotIdPrefix`
and prepends it to every slot id sent to `stateSlots` /
`StateStore`. Same for the `ta.*` slot-id paths.

### 2. `StateSnapshot` schema

The `StateSnapshot` type is declared in
`packages/core/src/state/snapshot.ts` and re-exported from the
core barrel. **Edit it in core**, not in runtime. The new shape:

```ts
// packages/core/src/state/snapshot.ts
export type RunnerSnapshot = Readonly<{
    slots: Readonly<Record<string, JsonValue>>;
}>;

export type StateSnapshot = Readonly<{
    lastBarTime: number;
    streams: Readonly<Record<string, StreamSnapshot>>;
    savedAt: number;
    snapshotVersion: 1;
    // Per-runner slot sections (new in 0.7). Replaces the prior
    // flat `slots:` map; back-compat loader maps a flat shape to
    // `primary.slots` on read.
    primary: RunnerSnapshot;
    siblings?: Readonly<Record<string, RunnerSnapshot>>;
    dependencies?: Readonly<Record<string, RunnerSnapshot>>;
}>;
```

`snapshotVersion: 1` stays at 1 — the schema is additive (the old
flat `slots:` field is gone, but the new `primary.slots` is its
direct successor, and the file is read-only-by-this-runtime). The
`streams` plural-Record field is preserved verbatim because hosts
still need multi-stream snapshots. To stay fully back-compat with
on-disk snapshots from before this task:

- `validateSnapshot` accepts both the flat shape (old) and the
  structured shape (new).
- When loading the old shape, treat the entire `slots` map as
  `primary.slots`. `siblings` / `dependencies` default to empty.
- Saving always writes the new shape.

This keeps existing IDB / R2 / Postgres rows readable across the
update without forcing a schema migration on the host side.

### 3. `restoreStateSnapshot` extension

In `packages/runtime/src/persistentStateStore.runtime.ts`:

`restoreStateSnapshot(state, snap)` walks the snapshot's three
runner sections (primary + siblings + dependencies) and restores
each into the corresponding `RuntimeContext.stateSlots` map. Slot
keys carry their prefix already — the snapshot stores the full
prefixed key — so restoration is just `stateSlots.set(key, value)`
into the right context's map.

Missing dep / sibling sections → that runner cold-starts. Existing
behaviour preserved for the primary.

Snapshot `localId` that's not in the current bundle's
`dependencies[]` → drop with the existing
`state-snapshot-malformed` diagnostic (no new code required).

### 4. `dispose` + cadence saves

`saveStateSnapshot(state, now)` and `maybeSaveStateSnapshot(state,
now, intervalMs)` walk every runner's `stateSlots` map (primary +
siblings + deps) and assemble the structured snapshot.

The cadence interval is still primary-driven (`PERSISTENCE_INTERVAL_MS`
default 60s). Deps don't get their own cadence — they piggyback
on the primary's save tick.

### 5. Slot snapshot equality test

Determinism property test:

```ts
// dep/persistence.property.test.ts
const A = mountBundle(bundle);
await A.onHistory(bars);
const drainA = A.drain();
await A.dispose();   // flushes snapshot

const B = mountBundle(bundle); // fresh, no in-memory state
await B.warmStart(bars[bars.length - 1].time);
const drainB = B.drain();

expect(hashEmissions(drainB)).toBe(hashEmissions(drainA));
```

Run across 50 randomly-generated bundles. Pin the `fast-check`
seed via the existing root setup.

### 6. Bundle dispose flushes children

`dispose()` walks every runner and:

- Flushes pending tentative state slots via
  `flushStateSlots(ctx)`.
- Clears the dep / sibling `stateSlots` maps after the snapshot
  saves.
- The shared `StateStore` (host-supplied) is **not** cleared — the
  Phase-1 invariant in `packages/runtime/CLAUDE.md` already pins
  this. The structured snapshot in `PersistentStateStore` is the
  full picture.

### 7. Worker host pass-through

`packages/host-worker/`'s persistence boundary already pipes
through `PersistentStateStore`. Confirm the new schema round-trips
via the IDB-backed store:

- `packages/host-worker/src/idbStateStore.test.ts` — extend with
  a structured-snapshot save + load test.
- `packages/host-worker/src/idbStateStore.bench.test.ts` — the
  serialised payload is slightly larger for bundle scripts. Pin a
  new `THRESHOLD_MS` against a `dep-bundle` fixture.

### 8. Test layers

- `persistentStateStore.test.ts` — extend with structured-snapshot
  round-trip, old-flat-shape compat, mismatched-`localId` warning.
- `persistentStateStore.determinism.test.ts` — extend with the
  cold-vs-warm bundle invariant.
- `persistentStateStore.validate.test.ts` — accept both shapes.
- `persistentStateStore.runtime.test.ts` (new if it doesn't
  exist; otherwise extend) — restore semantics.
- `dep/persistence.property.test.ts` — new property suite above.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/state/snapshot.ts` | modify | `StateSnapshot` widened to add `primary`/`siblings?`/`dependencies?` runner sections + introduce `RunnerSnapshot`. The `streams` and `snapshotVersion: 1` fields are preserved verbatim. |
| `packages/core/src/state/snapshot.test.ts` (or `*.types.test.ts` co-located) | modify (or create) | Smoke + type-level check of the new fields. |
| `packages/core/src/index.ts` | modify | Re-export `RunnerSnapshot`. |
| `packages/runtime/src/persistentStateStore.ts` | modify | Consume the widened `StateSnapshot` shape; in-memory store unchanged. |
| `packages/runtime/src/persistentStateStore.runtime.ts` | modify | Save / restore walks every runner; cadence unchanged. |
| `packages/runtime/src/persistentStateStore.validate.ts` | modify | Accept old flat + new structured shape. |
| `packages/runtime/src/persistentStateStore.*.test.ts` | modify | New cases per layer. |
| `packages/runtime/src/state/*.ts` | modify | Prepend `slotIdPrefix` when keying `StateStore`. |
| `packages/runtime/src/state/*.test.ts` | modify | Prefix flow asserted. |
| `packages/runtime/src/ta/*.ts` | modify (minimal) | Confirm slot-id keying flows through the existing `RuntimeContext` accessor — no per-primitive code change should be needed; verify via a focused unit test. |
| `packages/runtime/src/dep/persistence.property.test.ts` | create | Cold-vs-warm invariant. |
| `packages/runtime/src/dep/persistence.test.ts` | create | Unit cases for round-trip. |
| `packages/runtime/src/createScriptRunner.persist.test.ts` | modify | Bundle warm-restart test. |
| `packages/runtime/CLAUDE.md` | modify | Document `slotIdPrefix` convention + structured-snapshot shape. |
| `packages/host-worker/src/idbStateStore.test.ts` | modify | Structured-snapshot IDB round-trip. |
| `packages/host-worker/src/idbStateStore.bench.test.ts` | modify | `dep-bundle` fixture + pinned `THRESHOLD_MS`. |

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`,
  `pnpm readme:check`, `pnpm conformance`, `pnpm bench:ci` — green.
- 100% coverage on the runtime files touched.
- `pnpm bench:ci` confirms the bundle-snapshot bench stays under
  the pinned threshold.

## Changeset

- File: `.changeset/indicator-composition-5-persistence.md`
- Bump: **minor** for `@invinite-org/chartlang-core` (the
  `StateSnapshot` shape lives there), **minor** for
  `@invinite-org/chartlang-runtime`, **patch** for
  `@invinite-org/chartlang-host-worker` (no public API change,
  just internal snapshot shape).
- Reason: "Structured `StateSnapshot` carrying per-runner slot
  sections (primary + siblings + dependencies). Cold-start vs
  warm-restart byte-identical for indicator bundles. Flat-shape
  snapshots from before this release continue to load
  back-compat as primary-only."

## Acceptance Criteria

- [ ] `StateSnapshot` accepts both the old flat shape (back-compat
      load) and the new structured shape (save + load).
- [ ] Slot keys carry the runner's `slotIdPrefix` everywhere they
      reach a `StateStore` or snapshot field.
- [ ] Property test pins: cold-replay emissions hash =
      warm-restart emissions hash for a bundle scripted with deps.
- [ ] Dep / sibling cold-start gracefully when the snapshot has no
      matching section.
- [ ] Unknown `localId` in a snapshot drops with
      `state-snapshot-malformed` (existing code, reused) and the
      unknown section is ignored.
- [ ] `worker-host` IDB store round-trips the new shape.
- [ ] 100% coverage on touched runtime files.
- [ ] CLAUDE.md updated with the convention.
- [ ] Changeset committed.

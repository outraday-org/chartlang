# Task 2 — Runtime: non-numeric slot resolution + history buffers

> **Status: TODO**

## Goal

Implement the runtime backing for the Task 1 surface: a persistent
`state.color` scalar slot, and boolean/string **series** slots with cross-bar
history. The existing series machinery is `Float64`-backed (numeric only), so
this adds a generic / typed non-numeric ring alongside it, wired through the
same per-callsite lifecycle (advance / commit / restore) as the numeric series.

## Prerequisites

Task 1 (core factories + slot view types).

## Current Behavior

- The numeric series slot (`packages/runtime/src/state/seriesSlot.ts`) is
  backed by a **`Float64RingBuffer`**: `createSeriesSlot`,
  `makeSeriesSlotView`, `restoreSeriesSlot`, `advanceSeriesSlot`,
  `commitSeriesSlot`, `resetSeriesSlotHead`. `Float64` cannot hold
  `boolean`/`string`/`Color`.
- `state.color`/`boolSeries`/`stringSeries` are core **stubs** (Task 1) with no
  runtime binding — calling them today would not produce a working slot.
- The `state` namespace runtime binding (`packages/runtime/src/state/
  stateNamespace.ts`) maps each `state.*` factory to its slot implementation,
  keyed per callsite id; lifecycle (`lifecycle.ts`, `seriesPersistence.ts`)
  drives advance/commit/restore each bar.
- The mutable scalar slot (`stateSlot.ts`) already holds an arbitrary `T` for
  `state.float/int/bool/string` — a color scalar fits the same mechanism.

## Desired Behavior

- `state.color(init)` resolves to a persistent `MutableSlot<Color>` (cross-bar
  `.value`), reusing the existing scalar-slot path (no ring needed).
- `state.boolSeries(init)` / `state.stringSeries(init)` resolve to history
  slots: writable `.value` head + `[n]` history across bars, with
  advance/commit/restore parity with the numeric series.
- First-bar / out-of-range `[n]`: bool ⇒ `false`, string ⇒ `""` (Task 1
  defaults), deterministic across worker + quickjs hosts.

## Requirements

### 1. Non-numeric ring buffer

The numeric path uses `Float64RingBuffer`. Add a generic / typed ring for
non-numeric values (e.g. `ObjectRingBuffer<T>` over a plain `T[]`, or
`BoolRingBuffer` / `StringRingBuffer` siblings) — match the buffer API the
series slot consumes (push head, read `[n]`, committed-head restore). Keep it
**deterministic** (no host-variant serialization) and snapshot-stable.

> Decide generic-`<T>` vs. typed buffers consistently with Task 1's
> typed-sibling decision. A single `ObjectRingBuffer<T>` backing both
> bool and string slots is the smallest surface.

### 2. Non-numeric series slots (`packages/runtime/src/state/`)

Add `boolSeriesSlot.ts` / `stringSeriesSlot.ts` (or a generic
`objectSeriesSlot.ts`) mirroring `seriesSlot.ts`:
`create*`, `make*SlotView` (the `.value` head + indexed history view),
`restore*`, `advance*`, `commit*`, `reset*Head`. Reuse the numeric slot's
head/commit/restore logic — only the element type + default differ.

### 3. `state.color` binding (`packages/runtime/src/state/stateSlot.ts` +
`stateNamespace.ts`)

Bind `state.color` to the existing mutable-scalar slot path with a `Color`
default — no ring. Add the `color` factory to the runtime `state` namespace
binding next to `float`/`bool`/`string`.

### 4. Lifecycle wiring (`lifecycle.ts`, `seriesPersistence.ts`)

Register the new series slots with the per-bar advance/commit/restore +
persistence (snapshot) flow, exactly as the numeric series. Ensure the
snapshot key/format stays append-only and deterministic (runtime CLAUDE.md
persistence invariants).

### 5. Tests

- `boolSeriesSlot` / `stringSeriesSlot`: head write + `[n]` read across N bars;
  out-of-range `[n]` ⇒ default (`false`/`""`); advance/commit/restore
  round-trip (mirror `seriesSlot.test.ts` + `seriesPersistence.test.ts`).
- `state.color`: persistence across bars via the scalar-slot path.
- Property test (mirror `seriesSlot.property.test.ts`): history reads match a
  reference model for random write sequences.

## Edge cases

- `varip` non-numeric series (tick-scoped) is **out of scope** — deferred
  (mirror `varip-series-approximated`); this task is bar-committed only.
- Keep numeric `seriesSlot.ts` and its snapshots **byte-identical** — the
  non-numeric ring is additive.
- String values must serialize deterministically in snapshots (no host
  encoding variance).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/state/objectRingBuffer.ts` (or typed) | Create | Non-numeric ring buffer. |
| `packages/runtime/src/state/objectSeriesSlot.ts` (or bool/string) | Create | Bool/string series slots. |
| `packages/runtime/src/state/stateSlot.ts` | Modify | `state.color` scalar binding. |
| `packages/runtime/src/state/stateNamespace.ts` | Modify | Bind new factories per callsite. |
| `packages/runtime/src/state/lifecycle.ts` / `seriesPersistence.ts` | Modify | Advance/commit/restore + snapshot wiring. |
| `packages/runtime/src/state/*.test.ts` + `*.property.test.ts` | Create/Modify | Slot + persistence + property tests. |
| `packages/runtime/CLAUDE.md` | Modify | Document the non-numeric series slot. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-runtime test` (100% coverage)
- `pnpm docs:check`

## Changeset

Covered by Task 1's shared T12 changeset (runtime is minor).

## Acceptance Criteria

- `state.color` persists across bars; `state.boolSeries` / `state.stringSeries`
  give correct `[n]` history with `false`/`""` first-bar defaults.
- Advance/commit/restore + snapshot round-trip green; numeric series snapshots
  unchanged; runtime coverage 100%.

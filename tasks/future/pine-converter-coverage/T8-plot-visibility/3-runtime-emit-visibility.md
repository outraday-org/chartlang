# Task 3 — Runtime: resolve `visible` into the emission + validate

> **Status: TODO**

## Goal

Resolve the `PlotOpts.visible` argument at emit time and set
`PlotEmission.visible` on the wire — **omitting it when visible** (absent or
`true`) so a drawn plot stays byte-identical to today. Extend the emission
validator to accept the optional boolean and keep the per-`(slotId, bar)`
last-write-wins dedup intact.

## Prerequisites

Task 1 (core opt + wire field). Task 2 (manifest) is independent — can land
in parallel.

## Current Behavior

- `plotImpl` / `buildStyle` (`packages/runtime/src/emit/plot.ts`) build a
  `PlotEmission` from the script's `plot(value, opts)` call: resolve a finite
  numeric `value` (NaN → `null`), copy `color`, `style`, `z`. There is no
  **authoring** `visible` handling here — this is the gap T8 fills.
- The wire ALREADY carries `visible`: the **host-override** path
  (`packages/runtime/src/emit/applyPlotOverride.ts`) already sets
  `emission.visible = false` from `PlotOverride.visible` (it only ever writes
  `false`, never `true`). This task adds the parallel **authoring** path in
  `plotImpl` that reads `opts.visible`; the two compose (either source setting
  `false` hides the plot — neither writes `true`).
- `pushPlot` validates via `validateEmission` (`.../validateEmission.ts`) which
  **already accepts** an optional boolean `visible` (`plot.visible: must be a
  boolean`) — so no validator change is needed (Requirement 2 is verify-only).
  Dedup is last-write-wins per `(slotId, bar)` (runtime CLAUDE.md).
- Optional emission fields are set only when non-default (e.g. `z`, `visible`),
  keeping omitted-when-default snapshots byte-identical.

## Desired Behavior

- `plot(x, { visible: false })` → emission carries `visible: false`.
- `plot(x, { visible: true })` and `plot(x)` (no `visible`) → emission carries
  **no** `visible` field (byte-identical to today).
- `plot(x, { visible: <boolean expr> })` → the runtime evaluates the boolean
  per bar; `false` ⇒ field set, `true` ⇒ field omitted. (The author surface is
  a `boolean` — a constant or a per-bar boolean expression both resolve to a
  concrete boolean at the call.)
- Validation accepts `visible?: boolean`; dedup unchanged (the field rides the
  same emission and the same `(slotId, bar)` last-write-wins).

## Requirements

### 1. Resolve `visible` (`packages/runtime/src/emit/plot.ts`)

In `plotImpl` (the path that assembles the `PlotEmission`), read
`opts.visible`. Set `emission.visible = false` **only** when the resolved
value is exactly `false`; for `true`/`undefined` leave the field unset.

> Mirror the existing optional-field handling (e.g. how `z` is only set when
> non-default). Do NOT default `visible` to `true` on the emission object — an
> absent field IS visible; setting `true` would bloat the wire and break the
> byte-identical guarantee.

### 2. Validator (`.../validateEmission.ts`) — verify-only (already implemented)

`validateEmission` already rejects a non-boolean `visible`
(`plot.visible: must be a boolean`), with tests covering `visible:
false`/`true`/non-boolean. **No change is required here** — just confirm the
authoring-driven `false` value passes (it is the same field/value the host
path already emits). Do not add a duplicate check.

### 3. Dedup / overload seam

Confirm the script-facing / compiler-injected overload seam (the
`typeof arg1 === "string"` slot-id branch) threads `opts.visible` through
unchanged. The dedup key stays `(slotId, bar)`; a later same-bar write
overwrites `visible` along with the rest of the emission (last-write-wins).

### 4. Tests (`packages/runtime/src/emit/plot.test.ts` + validator tests)

- `plot(x, { visible: false })` → emission `.visible === false`.
- `plot(x, { visible: true })` and `plot(x)` → emission has no `visible` key
  (assert via `"visible" in emission === false`).
- A per-bar `visible: bar.close > 0` → field set/omitted per the boolean.
- (Non-boolean `visible` rejection is already covered by adapter-kit's
  `validateEmission.test.ts` — no new runtime validator test needed.)
- Dedup: two same-bar writes, the second `visible: false`, → emission
  `.visible === false`.
- Compose with host override: an authored `visible: false` AND an
  `applyPlotOverride` both leave `.visible === false` (neither writes `true`).

## Edge cases

- `value: null` (skip-bar) AND `visible: false` can co-occur; they are
  orthogonal (one is "no numeric value this bar", the other is "don't draw the
  mark"). Don't collapse them.
- Keep `visible` out of any numeric/`plot-hash` tuple — the hash hashes
  `{ bar, value }` (conformance CLAUDE.md); `visible` is asserted via a
  `plot-field` scenario in Task 5, never the numeric hash.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/emit/plot.ts` | Modify | Resolve authoring `opts.visible` → `emission.visible` (omit when visible); composes with the existing host-override path. |
| `packages/adapter-kit/src/validation/validateEmission.ts` | No change | Already accepts optional `visible: boolean`. |
| `packages/runtime/src/emit/plot.test.ts` | Modify | Authoring resolution + omit-when-default + dedup tests. |
| `packages/runtime/CLAUDE.md` | Modify | Document the authoring `visible` resolution (composing with host overrides). |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-runtime test` (100% coverage)
- `pnpm docs:check`

## Changeset

Covered by Task 1's shared T8 changeset (runtime is minor).

## Acceptance Criteria

- `visible: false` reaches the wire; `true`/absent ⇒ no field (byte-identical).
- Validator accepts the optional boolean and rejects non-booleans.
- Dedup + overload seam unchanged; runtime CLAUDE.md updated; tests green.

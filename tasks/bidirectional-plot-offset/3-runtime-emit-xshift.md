# Task 3 — Runtime: emit the x-shift on plots

> **Status: TODO**

## Goal

Make the runtime carry the offset to the plot emission as `xShift`
(Option A), stopping the value-read shift so the numeric series is
unshifted and both offset directions are expressible.

## Prerequisites

Tasks 1 (core field) + 2 (compiler no longer sizes offset depth).

## Current Behavior

- `packages/runtime/src/seriesView.ts` — `makeShiftedSeriesView(buf,
  offset)` returns a Proxy whose `current = buf.at(offset)` /
  `[n] = buf.at(n + offset)`. Negative offset → out-of-range → NaN.
- `packages/runtime/src/ta/lib/applyOffset.ts` is a legacy array-side
  helper with the same value-shift semantics (`out[i] = values[i -
  offset]`). `rg "applyOffset\\(" packages/runtime/src` shows no
  production consumers today, so leaving it unchanged would preserve
  stale Option-B behavior only in tests/docs.
- The value-read shift is **replicated across ~90 `ta.*` primitives**,
  not just one helper: each primitive that supports the universal offset
  has its own per-slot, per-offset cache and `viewForOffset` that calls
  `makeShiftedSeriesView` (e.g. `ta/sma.ts:34,67,140` —
  `viewForOffset(slot, opts?.offset ?? 0)`; `ta/pvo.ts` `resultForOffset`
  for the multi-output pattern). **ALMA is special**: its universal shift
  is `opts.barShift`, while `opts.offset` is the Gaussian-centre (see
  `ta/alma.ts:10-12,110-113`).
- `packages/runtime/src/emit/plot.ts` builds `PlotEmission` (`{ kind,
  slotId, title, style, bar, time, value, color, meta, pane }`) via the
  overloaded `plot` primitive; `pushPlot`
  (`emit/emissionsQueue.ts`) validates (via adapter-kit's
  `validateEmission`) + dedups.

## Desired Behavior (Option A)

- The `offset`/`barShift` no longer transforms the series value. Instead,
  the offset associated with a plotted series flows to the
  `PlotEmission.xShift` field set in `emit/plot.ts`; the value is the
  unshifted `buf.at(0)`.
- Resolution of "which offset applies to this plot" (**A-stay**, decided):
  use a **module-level `WeakMap<Series, number>` side-table**. Reduce
  `makeShiftedSeriesView(buf, offset)` so it returns the **unshifted**
  view (delegating to `makeSeriesView`) while registering `view → offset`
  in the WeakMap. This keeps all ~90 existing call sites
  (`viewForOffset`, `resultForOffset`, …) intact — they keep their
  per-offset cache (now caching identical unshifted views, or collapsed
  to the single `offset === 0` result) and still hand back a series whose
  declared offset is recorded. `plot(series, …)` reads the WeakMap to set
  `xShift`; a plain numeric `plot(x, …)` has no entry ⇒ no shift. (A-move
  — reading `opts.offset` straight off `plot`/`hline` — is the deferred
  follow-up, not v1.)
- For ALMA the recorded offset is `opts.barShift` (its `offset` opt stays
  the Gaussian-centre and is never tagged). Because ALMA currently returns
  a single unshifted `slot.series` and does not call
  `makeShiftedSeriesView`, this task must either add the same per
  `barShift` view-cache pattern used by `sma.ts` (preferred) or expose a
  small `tagSeriesOffset(series, offset)` helper from `seriesView.ts`; do
  not leave ALMA as a special case that cannot emit `xShift`.
- The value emitted at bar `T` is the value computed at `T` (no look-back
  read). `xShift` is presentation-only: alerts, `state.*`, and any
  `series.current` read see the unshifted value. Emission ORDER and the
  no-offset wire are byte-identical to today (a no-offset plot omits
  `xShift`).
- `xShift` validation lives in adapter-kit (Task 1); this task only
  *sets* the field on the emission.

## Requirements

1. Set `xShift` on the `PlotEmission` the runtime builds (`emit/plot.ts`),
   defaulting to **omitted** when the plotted series has no WeakMap entry
   or its recorded offset is `0`. (Integer validation is Task 1's
   `validateEmission` change — do not duplicate it here.)
2. Reduce `makeShiftedSeriesView` to the WeakMap-tagging identity view
   (see Desired Behavior); wire `plot()` to read the side-table. Do **not**
   delete `makeShiftedSeriesView` — ~90 call sites depend on its
   signature. Confirm ALMA tags `opts.barShift` (not `opts.offset`).
3. Remove or repurpose `packages/runtime/src/ta/lib/applyOffset.ts` and
   its tests so no runtime helper still documents or tests the old
   value-read offset semantics. If any hidden consumer is found during
   implementation, migrate that consumer to the WeakMap / `xShift` model
   instead of preserving array value-shift behavior.
4. Update runtime tests: `seriesView.test.ts` (the "positive offset
   shifts the read window" / "negative offset returns NaN" / property
   cases now assert the unshifted view + a WeakMap tag), `ta/*.test.ts` /
   `*.golden.test.ts` and `pvo.test.ts` that pinned the old "value N bars
   ago" outputs now pin the unshifted series + an `xShift` on the
   emission. Keep 100% coverage; re-pin goldens from the runner's
   expected-vs-actual output, not by hand.
5. Update the CLAUDE.md files whose offset invariants this task
   invalidates (root-`CLAUDE.md` rule: an invalidated invariant is fixed
   in the same PR):
   - `packages/runtime/src/ta/CLAUDE.md` — the **"Universal `opts.offset`"**
     invariant (≈ lines 83–91) currently documents the value-read model
     ("positive `offset` makes `series.current` return the value `offset`
     bars ago … paired with the `lib/applyOffset.ts` Float64Array
     helper"). Rewrite it to the Option-A model: offset is presentation
     `xShift` recorded via the `WeakMap<Series, number>` side-table, the
     series value is unshifted, `makeShiftedSeriesView` is an
     unshifted/tagging view, ALMA tags `opts.barShift`, and drop the
     `lib/applyOffset.ts` pairing.
   - `packages/runtime/src/ta/lib/CLAUDE.md` — the Phase-1 helper list
     (≈ line 70) names `applyOffset`; remove it from that list since the
     helper is deleted (req 3).
   - `packages/runtime/CLAUDE.md` — add the offset-as-presentation-`xShift`
     emission invariant (WeakMap side-table, no value-read; ALMA tags
     `barShift`; emission-order + no-offset-byte-identity).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/emit/plot.ts` | Modify | read WeakMap, set `xShift` |
| `packages/runtime/src/seriesView.ts` | Modify | `makeShiftedSeriesView` → unshifted view + WeakMap tag; expose the read/tag helper needed by `plot`/ALMA |
| `packages/runtime/src/ta/alma.ts` | Modify | tag `opts.barShift` as the offset source via a per-`barShift` view cache or explicit tagging helper |
| `packages/runtime/src/ta/lib/applyOffset.ts`, `packages/runtime/src/ta/lib/applyOffset.test.ts` | Delete / Modify | remove stale value-shift helper semantics |
| `packages/runtime/src/ta/*.ts` (offset-caching slots) | Verify / minor | call sites keep working via the WeakMap-tagging helper; collapse per-offset caches only if it simplifies coverage |
| `packages/runtime/src/**/*.{test,golden.test,property.test}.ts` | Modify | re-pin to unshifted values + `xShift` |
| `packages/runtime/src/ta/CLAUDE.md` | Modify | rewrite "Universal `opts.offset`" invariant → presentation `xShift`; drop `applyOffset` pairing |
| `packages/runtime/src/ta/lib/CLAUDE.md` | Modify | drop `applyOffset` from the Phase-1 helper list |
| `packages/runtime/CLAUDE.md` | Modify | offset = presentation x-shift emission invariant |

## Gates

- `pnpm typecheck`, `pnpm -F @invinite-org/chartlang-runtime test` (100%
  coverage; §6.7 execution-loop property tests green)

## Changeset

Rides `.changeset/bidirectional-plot-offset.md` — runtime `minor`.

## Acceptance Criteria

- A `ta.*` series value is unshifted; a plotted offset series emits an
  `xShift` (signed); a no-offset plot is byte-identical to today.
- The WeakMap side-table records the declared offset (`opts.offset`, or
  `opts.barShift` for ALMA); `makeShiftedSeriesView`'s ~90 call sites
  still compile.
- Both directions are representable (`+`/`−`); alerts/state see unshifted
  values. Runtime suite + coverage green; goldens re-pinned, CLAUDE.md
  updated.

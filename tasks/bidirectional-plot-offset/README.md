# Bidirectional plot `offset` (negative offsets shift left)

## Overview

The universal `offset` option on `ta.*` primitives must work in **both
directions**. Today a **positive** offset shifts a series' output so it
renders to the right (future) and a **negative** offset is a documented
no-op that resolves to `NaN`. Pine's plot `offset` is bidirectional —
positive shifts the plotted series right, negative shifts it left — and
chartlang should match.

```ts
// today: works — line displaced 5 bars right (reads the value 5 bars ago)
plot(ta.sma(bar.close, 20, { offset: 5 }), { title: "SMA +5" });

// today: BROKEN — every value is NaN; want: line displaced 5 bars LEFT
plot(ta.sma(bar.close, 20, { offset: -5 }), { title: "SMA -5" });
```

This is a language-surface + rendering change, so it spans core, the
compiler's lookback analysis, the runtime series/emission path, the
reference adapter's renderer, conformance goldens, and the docs / demo /
example that describe `offset`.

References: root `CLAUDE.md` (per-folder-CLAUDE + skills-mirror rules),
`CONTRIBUTING.md` §16.3 (test layers) + §22.10 (primitive landing
contract), `packages/runtime/CLAUDE.md` (execution-loop + emission
invariants), `packages/compiler/CLAUDE.md` (`extractMaxLookback` offset
note), `packages/conformance/CLAUDE.md` (`plot-hash` / `plot-field`),
`examples/canvas2d-adapter/CLAUDE.md` (renderer purity), `apps/CLAUDE.md`
(`DEMO_SCRIPTS` → `examples:generate`).

## Current State

- **Core** (`packages/core/src/ta/ta.ts`): most `*Opts` types carry an
  optional `offset?: number` (`SmaOpts`, `EmaOpts`, `StdevOpts`,
  `BbOpts`, `RsiOpts`, …). The option is documented as a value-shift:
  `series.current` reads the value `offset` bars ago. **`AlmaOpts.offset`
  is the exception** — it is the Gaussian-centre position (`[0,1]`); ALMA's
  universal shift is the distinct `AlmaOpts.barShift`. There is **no**
  `offset` on `plot` / `hline` opts (`packages/core/src/plot/plot.ts`) —
  the shift deliberately lives on the `ta` call (see the `sma-offset`
  example's prose: "the shift lives on the `ta` call — `plot` has no
  offset").
- **Emission type** (`packages/adapter-kit/src/types.ts`): `PlotEmission`
  is defined **here, not in core** (`core/src/types.ts` only holds a doc
  comment referencing it). It has no presentation x-shift field.
  `validateEmission`
  (`packages/adapter-kit/src/validation/validateEmission.ts`) validates
  plot fields field-by-field.
- **Runtime** (`packages/runtime/src/seriesView.ts`):
  `makeShiftedSeriesView(buf, offset)` is the whole implementation —
  `view.current = buf.at(offset)`, `view[n] = buf.at(n + offset)`. For
  `offset === -k` this is an out-of-range read returning the buffer
  sentinel (`NaN` for `Float64RingBuffer`). Each `ta.*` slot caches one
  shifted Proxy per `(slot, offset)` pair (see `ta/pvo.ts`
  `resultForOffset` for the multi-output pattern). `lib/applyOffset`'s
  `out[i] = values[i − offset]` is a stale array-side equivalent with no
  current production consumers; Task 3 removes or repurposes it so no
  runtime helper preserves the old value-read semantics.
- **Compiler** (`packages/compiler/src/analysis/extractMaxLookback.ts`):
  `readCallOffset` counts a **positive** literal `opts.offset` toward
  `maxLookback` (the output ring buffer is sized `maxLookback + 1`, so a
  positive offset needs the extra slots). Negative and non-literal
  offsets contribute `0` (documented: "future reads, NaN at the head, no
  extra buffer depth").
- **Reference adapter**
  (`examples/canvas2d-adapter/src/createCanvas2dAdapter.ts`): plots are
  stored per slot with their emitted `time` and rendered via
  `timeToX(time, viewport)` — there is **no x-axis display shift**; the
  runtime-supplied value series IS the
  rendered position. A line "displaced right" today is purely a
  consequence of the value-read shift, not a render-time transform.
- **Conformance** (`packages/conformance/`): `plot-hash` hashes
  `{ bar, value }` tuples in emission order; `plot-field` currently
  supports only `visible` / `color` / `lineWidth`, so Task 6 extends it
  for `xShift`. The `sma-offset` path is pinned through
  `examples/canvas2d-adapter/src/integration.test.ts` ("renders the
  sma-offset example…", a pinned `hashCallLog`).
- **Pine converter** (`packages/pine-converter/`): `emitPlot`
  (`src/transform/plotFamily.ts`) maps a plot call's `title` / `color` /
  `linewidth` only (`commonOptions`); Pine's `plot(series, offset=N)`
  `offset=` argument is **silently dropped** — no mapping, no
  diagnostic. `emitPlot` is not even passed the `DiagnosticCollector`.
- **Docs / demo / example**: `examples/scripts/sma-offset.chart.ts`,
  the `SMA_OFFSET` entry in `apps/site/src/components/demo/scripts.ts`
  (→ `docs/examples/sma-offset.md` via `examples:generate`),
  `docs/language/series-and-indexing.md`, `docs/spec/emissions.md`,
  adapter docs that describe `PlotEmission`, and the auto-generated
  `docs/primitives/ta/*.md` all describe the positive value-shift or omit
  the new `xShift` contract.

## Mechanism (DECIDED: Option A, A-stay)

**Decided:** Option **A** (unified display-shift) with **A-stay**
(`offset` keeps living on the `ta.*` opts; the runtime threads it to the
emission as `xShift`). Option B and A-move below are recorded as the
alternatives that were considered and **not** chosen — the task files
build Option A / A-stay.

A negative offset means "shift the plotted series **left**" — i.e. the
value computed at bar `T` is drawn at `x = T − |offset|`. The value-read
model **cannot** express this: reading `buf.at(-k)` is reading the
future, which does not exist at compute time. The options considered:

| Option | What changes | Pros | Cons |
|--------|--------------|------|------|
| **A. Unified display-shift (recommended, Pine parity)** | `offset` becomes a **presentation** property carried on the plot emission (an `xShift` in bars). The adapter renders the series shifted by `xShift` (right for +, left for −). The series **value** is no longer transformed by offset (`series.current` is unshifted). | Symmetric, matches Pine exactly, removes the value-read special-case, `extractMaxLookback` no longer needs offset depth. | **Breaking**: positive-offset *values* change (today `.current` = value N bars ago; new = current value, shifted only at render). Re-pin `sma-offset` hashes; rewrite the example/demo/docs; decide whether `offset` stays on `ta` opts (flowing to the emission) or moves to `plot`/`hline` opts (Pine's home for it). |
| **B. Asymmetric (smaller blast radius)** | Keep positive offset as the value-read it is today; add negative offset as a **render-only** left shift carried on the emission. | No change to existing positive behavior; existing hashes hold. | Two mental models for one option (value-read right vs display-shift left); a negative-offset series' `.current` is unshifted while a positive one's is shifted — surprising; still needs the emission `xShift` channel + adapter render shift. |

**Why Option A.** It is the only model that is internally consistent and
Pine-aligned; the migration cost (re-pin two hashes, reword the
example/demo/docs) is bounded and one-time. **A-stay** was chosen over
A-move to minimise author-facing churn — `offset` stays on the `ta.*`
opts (the `sma-offset` example keeps `ta.sma(…, { offset })`), and the
runtime threads the declared offset to the emission's `xShift`. The task
files below are written for Option A / A-stay.

## Sign convention (DECIDED)

`+n` shifts the plotted series **right** (`n` bars into the future); `−n`
shifts it **left** (`n` bars into the past). This is fixed — not an open
question for Task 1 — and is consistent with today's positive offset
(the `sma-offset` example's `{ offset: 5 }` already renders to the
right). The *mechanism* is also fixed for these tasks: Option A / A-stay.

## Target State (Option A)

- A literal or non-literal `offset` (positive **or** negative) on a
  plotted series shifts where it renders: `+n` → `n` bars right, `−n` →
  `n` bars left. `offset: 0` and the no-offset path are byte-identical to
  today's no-offset output.
- The shift is presentation-only: it rides the plot emission as an
  `xShift` field and the reference adapter renders it; the numeric value
  series is unshifted. `plot-hash` (which hashes `{ bar, value }`) is
  therefore unchanged for the *no-offset* baseline; the `sma-offset`
  goldens move from the old value-read numbers to the unshifted numbers
  and are re-pinned once.
- `extractMaxLookback` no longer adds offset depth (the value isn't read
  from a deeper slot); the positive-offset lookback note in
  `packages/compiler/CLAUDE.md` is removed.
- Example, demo, docs, and the `offset` JSDoc describe the bidirectional
  display semantics. A new demo entry (or an extended `sma-offset`) shows
  a `−offset` line displaced left next to a `+offset` line displaced
  right.
- The pine-converter threads Pine `plot(<ta.* call>, offset=N)` onto the
  emitted `ta.*` call's opts (signed, both directions); a plot whose
  value is not a direct `ta.*` call drops the offset and emits a
  documented diagnostic (chartlang has no plot-level offset — deferred).

## Dependency Graph

```
Task 1 (core + adapter-kit: offset JSDoc/semantics + PlotEmission.xShift type + validateEmission)
  |
  v
Task 2 (compiler: drop offset→maxLookback; delete stale changeset; CLAUDE — no shim change)
  |
  v
Task 3 (runtime: tag offset via WeakMap, emit xShift on plots; stop value-read shift)
  |
  v
Task 4 (canvas2d adapter: bar-offset → x projection both directions + tests)
  |
  v
Task 5 (pine-converter: plot(..., offset=) → ta offset + diagnostic + fixtures)
  |
  v
Task 6 (conformance harness + re-pin + example + demo + docs + skills + changeset + CLAUDE sweep)
```

Task 5 depends only on Task 1 (the offset language surface) + Task 3
(the runtime makes it real); it is drawn after Task 4 because its
pine-converter bump folds into Task 6's final changeset.

## Task Summary

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|-------|-----------|--------------|-----------------|
| 1 | [Core + adapter-kit: offset model + emission field](./1-core-offset-model.md) | core, adapter-kit | None | Medium |
| 2 | [Compiler: lookback + changeset cleanup](./2-compiler-lookback.md) | compiler | 1 | Medium |
| 3 | [Runtime: emit x-shift](./3-runtime-emit-xshift.md) | runtime | 1, 2 | High |
| 4 | [Adapter: render x-shift](./4-adapter-render.md) | canvas2d-adapter | 1, 3 | Medium |
| 5 | [Pine converter: `plot(..., offset=)` mapping](./5-pine-converter-plot-offset.md) | pine-converter | 1, 3 | Medium |
| 6 | [Conformance + example + demo + docs](./6-conformance-example-demo-docs.md) | conformance, examples, apps/site, docs, skills | 3, 4, 5 | Medium |

## Code Reuse

| Existing | Path | Reuse for |
|----------|------|-----------|
| `makeShiftedSeriesView` / `makeSeriesView` | `packages/runtime/src/seriesView.ts` | Option A reduces `makeShiftedSeriesView` to an unshifted view + a `WeakMap<Series,number>` offset tag (keeps ~90 call sites); exposes the helper `plot`/ALMA need to read or tag the offset |
| `resultForOffset` multi-output offset cache + ~90 per-primitive `viewForOffset` | `packages/runtime/src/ta/*.ts` (e.g. `pvo.ts`, `sma.ts`) | Call sites keep working via the WeakMap-tagging helper; ALMA tags `opts.barShift` |
| `applyOffset` | `packages/runtime/src/ta/lib/applyOffset.ts` | Remove or repurpose the stale array-side value-shift helper; no current production consumer should keep Option-B behavior alive |
| `readCallOffset` / `collectSeriesVarOffsets` | `packages/compiler/src/analysis/extractMaxLookback.ts` | The offset-literal readers to retire (Option A) |
| `PlotEmission` type + `validateEmission` | `packages/adapter-kit/src/types.ts`, `packages/adapter-kit/src/validation/validateEmission.ts` | Where the new `xShift` field + its integer validation live (Task 1) |
| `PlotEmission` build + `pushPlot` | `packages/runtime/src/emit/plot.ts`, `emit/emissionsQueue.ts` | Where the runtime *sets* `xShift` (Task 3) |
| plot render loop | `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | Where the x-shift is applied at draw time for line/histogram/glyph plot styles |
| `plot-field` assertion | `packages/conformance/src/runConformanceSuite.ts`, `packages/conformance/src/scenarios/plotStyleOverrides.scenario.ts` | Extend the assertion union/evaluator for `xShift`, then use existing scenario shape as the template |
| `sma-offset` example + demo + integration | `examples/scripts/sma-offset.chart.ts`, `apps/site/src/components/demo/scripts.ts`, `examples/canvas2d-adapter/src/integration.test.ts` | The surface to migrate + re-pin |
| `emitPlot` / `commonOptions` + `DIAGNOSTIC_CODE_ENTRIES` | `packages/pine-converter/src/transform/plotFamily.ts`, `src/diagnostics/codes.ts` | Where Task 5 reads `offset=`, threads it onto a `ta.*` call, and registers the new diagnostic |

## Provenance

No `../invinite/` port. Pine-`plot(..., offset=)`-parity feature,
chartlang-native implementation.

## Deferred / Follow-Up Work

- **Per-`plot` offset independent of the series** — if Task 1 keeps
  `offset` on `ta.*` opts, plotting the same series at two different
  offsets needs two `ta.*` calls. A `plot(series, { offset })` form could
  follow. This is also what blocks the converter (Task 5) from mapping
  Pine `plot(<non-ta value>, offset=N)` — without a plot-level offset
  there is no representable target, so that case emits a diagnostic and
  drops the offset until this follow-up lands.
- **Offset on `draw.*` anchors** — `bar.point` already covers offset
  anchoring for drawings; this feature is plot-only.
- **Negative offset interaction with alerts** — alerts fire on the
  unshifted value; a shifted *display* does not move alert bars. Document,
  do not change.

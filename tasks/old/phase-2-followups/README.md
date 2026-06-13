# Phase 2 Follow-Ups

> **Plan reference:** PLAN.md §22.10 (per-port landing rule), §7.3
> (PlotStyle wire schemas), §16.6 (math-port coverage), and
> `packages/runtime/src/ta/lib/CLAUDE.md` (the Float64-only convention).
> **Prerequisite:** Phase 2 (`0.2`) shipped — see
> `tasks/phase-2-indicator-parity/README.md`. The four items below were
> flagged by the holistic QA pass at the end of Phase 2 but ruled
> out-of-scope for that delivery to avoid bundling refactor + docs
> reconcile into the indicator-parity changeset.
> **Version target:** `0.2.1` (per-package patch).

## Goal

Close the four loose ends Phase 2's QA pass surfaced:

1. **Hoist shared helpers under `packages/runtime/src/ta/lib/`** —
   `dmi.ts`'s 3 cross-primitive helpers (`initDirectionalState` /
   `advanceDirectionalClose` / `tickDirectional` + the
   `DirectionalState` type) and the Phase-1 `sourceValue.ts`
   (`ScalarOrSeries` + `readSourceValue`) currently live next to their
   first consumer instead of the shared library. Both are imported by
   2+ primitives; both belong under `lib/`.
2. **Widen `lib/CLAUDE.md`'s convention** to accept "shared primitive
   helpers" alongside the existing Float64-only compute cores. The
   `DirectionalState` object and `Series<T>` reads in `sourceValue.ts`
   don't fit the strict Float64Array-in / Float64Array-out rule, so the
   convention text needs a small extension before the moves can land.
3. **Resolve the `PHASE_1_SCENARIOS` cardinality drift** —
   `scripts/run-conformance.ts` reports 78 scenarios while
   `PHASE_1_SCENARIOS.length` was 81 at QA-write time (currently **86**
   after subsequent work; the gap has widened from off-by-3 to off-by-8).
   Investigate the delta — most likely cause is per-scenario capability
   gating **inside** `runConformanceSuite.loadBundledScenarios` against
   the canvas2d adapter (the script just forwards everything to the
   runner with no `scenarios:` arg) — then decide whether to (a) re-key
   as `PHASE_1_SCENARIOS` + `PHASE_2_SCENARIOS`, (b) wire missing
   scenarios into the script / loud-log the runner's silent skips, or
   (c) prune dead entries — and implement the chosen resolution.
4. **Reconcile `PLAN.md §7.3` `PlotStyle` to the shipped shape.** The
   PLAN groups `line | step-line | area` under one `{ lineWidth,
   lineStyle }` variant; Phase 2 split `area` into its own variant with
   the spec-mandated `lineWidth + lineStyle + fillAlpha` triple.
   `horizontal-line` is also no longer grouped with the still-deferred
   `vertical-line`. Reconcile the PLAN to mirror
   `packages/adapter-kit/src/types.ts` as it stands.

Items 1–3 land together as a single runtime + conformance cleanup
(Task 1). Item 4 is docs-only (Task 2).

## Current State

- **`packages/runtime/src/ta/dmi.ts`** exports
  `initDirectionalState`, `advanceDirectionalClose`, `tickDirectional`
  (lines 90, 154, 260) plus the file-local `DirectionalState` type
  (line 30). `packages/runtime/src/ta/adx.ts:20-24` imports the three
  helpers from `./dmi` — the only cross-primitive coupling that
  reaches into a sibling primitive's `src/` file instead of `lib/`.
- **`packages/runtime/src/ta/sourceValue.ts`** is a Phase-1 helper
  exporting `ScalarOrSeries` + `readSourceValue`. 44 `ta/*.ts`
  primitives + `ta/registry.ts` + `ta/index.ts` import from
  `./sourceValue` (46 consumers total). It sits at top-level inside
  `packages/runtime/src/ta/` rather than under `lib/` — `ls *.ts` in
  that directory currently returns 93 files vs the package README's
  projected 90 callable surfaces.
- **`packages/runtime/src/ta/lib/CLAUDE.md`** documents the
  Float64-only convention: "Float64-only. Helpers consume and produce
  `Float64Array`. They do not touch `Bar`, `Series<T>`,
  `Float64RingBuffer`, or `ACTIVE_RUNTIME_CONTEXT`." A `DirectionalState`
  object + `Series<T>` reads don't fit; the convention needs to widen
  before the moves can land cleanly.
- **`scripts/run-conformance.ts`** drives the CLI conformance gate
  and calls `runConformanceSuite(adapterMod.default)` with no
  `scenarios:` arg, so the runner's `loadBundledScenarios()`
  (`packages/conformance/src/runConformanceSuite.ts:396-399`) is the
  one that pulls in the canonical set. The script's last reported
  count was **78** scenarios; `PHASE_1_SCENARIOS` (in
  `packages/conformance/src/scenarios/index.ts:195`) currently holds
  **86** Object.frozen entries — off-by-8 as of writing (was off-by-3
  at QA time). The export name is also a misnomer: Phase-2 ports
  added entries to `PHASE_1_SCENARIOS` instead of a sibling
  `PHASE_2_SCENARIOS`, so "Phase 1" no longer describes the contents
  (the existing `scenarios.test.ts:179` describe block already
  acknowledges this with the label `"Phase-1+Phase-2 scenario
  constants"`).
- **`PLAN.md §7.3`** still describes the original Phase-0 `PlotStyle`
  union. `area` is grouped with `line` / `step-line` (no `fillAlpha`),
  `horizontal-line` is grouped with the still-deferred `vertical-line`,
  and the deferred Phase-5 kinds (`cursors`, `shape`, `character`,
  `arrow`, `candle-override`, `bar-override`, `bg-color`, `bar-color`)
  are listed inline without any "Phase 5" annotation.

## Target State

### `packages/runtime/src/ta/lib/`

- **New** `lib/directionalState.ts` carrying the `DirectionalState`
  type + the three exports (`initDirectionalState`,
  `advanceDirectionalClose`, `tickDirectional`) — same JSDoc, same
  body, same provenance. The DMI-private `trueRange` and
  `rawDirectionalMovement` functions move along with them (they're
  only consumed by `advanceDirectionalClose` /  `tickDirectional`).
- **New** `lib/sourceValue.ts` carrying `ScalarOrSeries` +
  `readSourceValue` — same JSDoc, same body. The existing
  `sourceValue.test.ts` moves alongside it.
- **Updated** `lib/CLAUDE.md` documenting the widened convention:
  "Float64-only compute cores live here, plus shared primitive helpers
  whose types cross the Float64 boundary (`DirectionalState` records,
  `Series<T>` accessors) when 2+ primitives consume them. Helpers that
  touch `ACTIVE_RUNTIME_CONTEXT`, `Bar`, or `Float64RingBuffer` still
  belong one level up."
- **Modified** `packages/runtime/src/ta/dmi.ts` no longer exports the
  three helpers; imports them from `./lib/directionalState` instead.
  The `DirectionalState` type also imported from there.
- **Modified** `packages/runtime/src/ta/adx.ts` import path changes
  from `./dmi` → `./lib/directionalState` for the three helpers.
- **Modified** ~50 `ta/*.ts` files have their `./sourceValue` import
  rewritten to `./lib/sourceValue`. Mechanical find-replace, no
  semantic change. `ta/registry.ts` and `ta/index.ts` get the same
  treatment.
- **Deleted** `packages/runtime/src/ta/sourceValue.ts` and
  `packages/runtime/src/ta/sourceValue.test.ts` (moved, not removed
  functionally).

### `packages/conformance/`

- **`PHASE_1_SCENARIOS` renamed to `ALL_SCENARIOS`** (or split into
  `PHASE_1_SCENARIOS` + `PHASE_2_SCENARIOS` if Task 1 investigation
  finds a clean seam). The deprecated `PHASE_1_SCENARIOS` re-export
  stays for one release (`@deprecated since 0.2.1, use ALL_SCENARIOS`)
  so external adapters don't break mid-version.
- **`scripts/run-conformance.ts`** counts the renamed export. The
  off-by-N gap is reconciled to zero — either by adding missing
  scenarios to the script's drive loop, removing dead scenarios, or
  swapping `PHASE_1_SCENARIOS` for the full union.
- New test `packages/conformance/src/scenarios/scenarios.test.ts`
  assertion: "`run-conformance` script and `ALL_SCENARIOS` iterate
  the same set" (compares scenario IDs, not just count).

### `PLAN.md`

- **§7.3 `PlotStyle` union mirrors `packages/adapter-kit/src/types.ts`
  exactly** as of the reconcile commit:
  - `line`, `step-line`, `horizontal-line` — each its own variant with
    `lineWidth + lineStyle`. (Currently grouped in PLAN.)
  - `histogram | bars` — kept grouped (matches shipped shape).
  - `area` — its own variant with `lineWidth + lineStyle + fillAlpha`.
    (Currently grouped under the line variant; missing `fillAlpha`.)
  - `filled-band`, `label`, `marker` — verbatim from the shipped
    types.
  - Phase-5-deferred kinds (`cursors`, `shape`, `character`, `arrow`,
    `candle-override`, `bar-override`, `bg-color`, `bar-color`,
    `vertical-line`) annotated with `// Phase 5 — not in 0.2 surface`
    so the PLAN doesn't read as a contract for shipped Phase-2 code.
- A short "Phase-2 update (0.2)" note added under the `PlotStyle`
  union pointing at the per-port tasks that introduced each kind
  (`X-1-plotkind-expansion.md` for histogram / bars / area /
  filled-band / label / marker; `X-21-volume-vol-vwap-anchoredvwap.md`
  for the runtime `histogram` emit wiring; `X-26-sr-chandelier-...md`
  for the runtime `marker` emit wiring).

## Architecture Decisions

| Decision | Rationale |
|---|---|
| **Move shared helpers to `lib/` rather than a new `_shared/` sub-dir** | `lib/` already has the established CLAUDE.md, the established test-layer table, and the established provenance-header convention. Spawning a new sibling directory for "helpers that don't fit Float64-only" would split documentation and confuse future readers about where to put the next shared helper. Widening the `lib/` convention by one sentence is cheaper. |
| **Widen the `lib/CLAUDE.md` convention rather than carving exceptions** | `DirectionalState` and `Series<T>` accessors are the obvious shared-helper shapes; carving them as named exceptions while keeping the strict "Float64-only" headline invites every future shared helper to argue for its own exception. The widened text — "Float64 compute cores plus shared primitive helpers that don't touch RuntimeContext / Bar / RingBuffer" — captures the actual invariant we care about. |
| **Investigate-then-resolve for the off-by-N scenarios drift (not blind rename)** | The QA agent saw 78 vs 81; current `PHASE_1_SCENARIOS.length` is 86 and the script still reports 78 (off-by-8). The script does not import `PHASE_1_SCENARIOS` by name — it forwards to `runConformanceSuite` with no scenarios arg, so the runner's `loadBundledScenarios()` is the iteration source. The silent drop is almost certainly per-scenario capability-gating inside the runner, but a blind rename + cardinality assertion would freeze in whichever drift exists today. The Task-1 investigation step identifies which entries are dropped and picks the right resolution. |
| **Bundle items 1–3 into one task (refactor)** | All three touch `packages/runtime/` and `packages/conformance/` in a single PR-sized diff (~46 import-path rewrites + 2 new lib files + 1 renamed export + 1 script reconcile). Splitting them adds 2 extra changesets, 2 extra coverage runs, and 2 extra review cycles for ~150 lines of churn. The placement moves and the scenarios reconcile are also independent — failure of one doesn't block the other — so they can be staged as separate commits inside the task. |
| **PLAN reconcile is its own task (item 4)** | Docs-only; no code touched; doesn't gate on Task 1. Reviewer audience is different (spec readers vs runtime engineers). Keeping it standalone means the doc fix can ship even if the refactor stalls on coverage tweaks. |
| **`PHASE_1_SCENARIOS` keeps a deprecated re-export for one release** | At least one external consumer (`canvas2d-adapter` example, `scripts/run-conformance.ts`) imports the name. A hard rename in `0.2.1` would break those at the dependency-bump boundary. A deprecated alias buys one release for downstream cleanup; it costs 3 lines + a JSDoc tag. |
| **Phase-5-deferred PlotStyle kinds get a `// Phase 5` annotation in PLAN, not deletion** | The PLAN is a roadmap; the kinds are real future work. Deleting them would make the PLAN no longer a complete spec. Annotating them flags "this is the long-term shape, not the 0.2 surface" without losing the design intent. |

## Dependency Graph

```
Task 1 (runtime + conformance cleanup)
    |
    v
Task 2 (PLAN.md §7.3 reconcile — docs-only, no code dep)
```

Task 2 has no hard dependency on Task 1 — they could ship in either
order. The numbering is execution preference (refactor before docs)
so PR review batching stays sensible.

## Task Summary

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|---|---|---|---|
| 1 | [Runtime + conformance cleanup (hoist shared helpers + scenarios cardinality)](./1-runtime-conformance-cleanup.md) | runtime, conformance, scripts | None | Medium |
| 2 | [PLAN.md §7.3 PlotStyle reconcile](./2-plan-plotstyle-reconcile.md) | docs only | None | Low |

## Code Reuse

| Reuse | Source | Notes |
|---|---|---|
| `packages/runtime/src/ta/lib/CLAUDE.md` template | Phase 1 + Phase 2 | The widened convention text extends the existing structure; no new template file needed. |
| `packages/runtime/src/ta/lib/wilderSmoothing.ts` provenance header pattern | Phase 1 | `lib/directionalState.ts` carries the same 4-line invinite header (commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02` per `tasks/phase-2-indicator-parity/X-16-trend-adx-dmi-trix.md`). |
| `packages/runtime/src/ta/lib/applyOffset.test.ts` test-file structure | Phase 1 | The relocated `sourceValue.test.ts` keeps its existing structure; only the file path and the imports under test change. |
| `packages/conformance/src/scenarios/index.ts` `Object.freeze` + `ReadonlyArray<Scenario>` pattern | Phase 1 | If Task 1's investigation splits into `PHASE_1_SCENARIOS` + `PHASE_2_SCENARIOS`, both new exports follow the same shape. The frozen-array assertion in `scenarios.test.ts` (line 268) extends to the new export(s). |
| `packages/adapter-kit/src/types.ts` `PlotStyle` (the shipped truth) | Phase 1 + Phase 2 Task 1 | Task 2's reconcile copies this shape verbatim into `PLAN.md §7.3`. The PLAN doesn't gain a new variant; it loses the stale groupings. |

## Provenance

No new ports. Task 1 relocates code that already carries its Phase-1
or Phase-2 provenance header — the headers move with the files
unchanged. `dmi.ts`'s in-file provenance refers to invinite commit
`078f41fe2569d659d5aba726da8bcb5d3e2ced02`; the relocated
`lib/directionalState.ts` keeps that same header verbatim.

## Deferred / Follow-Up Work

- **`packages/runtime/src/ta/lib/` Phase-1 helper backfill to the
  4-file test layer set** — `applyOffset`, `readSourceField`,
  `pickCandleSource`, `wilderSmoothing`, etc. shipped with only
  `.test.ts` per the existing `lib/CLAUDE.md` carve-out. The Phase-2
  convention requires `.property.test.ts` + `.bench.ts` +
  `.bench.test.ts`. Opportunistic backfill stays out of scope here.
- **Volume-profile family + `horizontal-histogram` PlotKind** (Phase 5
  per PLAN.md §19) — `vertical-line` removal from the PLAN-7.3 grouping
  in Task 2 doesn't unblock these; they still need their own input /
  viewport / session plumbing.
- **`PHASE_1_SCENARIOS` complete rename across external consumers** —
  Task 1 keeps the deprecated alias. A future `0.3` task can remove
  the alias once downstream adapters have migrated.
- **`scripts/run-conformance.ts` Phase-5 evolution** — the script
  predates the per-scenario `inlineSource` path; it currently imports
  the runner without distinguishing inline-source vs file-source
  scenarios. Phase-3+ refactor.

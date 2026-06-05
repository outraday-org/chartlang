# Runtime + Conformance Cleanup — Hoist Shared Helpers + Reconcile Scenarios Cardinality

> **Status: TODO**

## Goal

Move `dmi.ts`'s 3 cross-primitive helpers (`initDirectionalState`,
`advanceDirectionalClose`, `tickDirectional` + the `DirectionalState`
type) and the Phase-1 `sourceValue.ts` (`ScalarOrSeries` +
`readSourceValue`) into `packages/runtime/src/ta/lib/`. Widen
`lib/CLAUDE.md`'s convention to permit "shared primitive helpers
crossing the Float64 boundary." Then reconcile the off-by-N drift
between `scripts/run-conformance.ts`'s scenario count and
`PHASE_1_SCENARIOS.length` — investigate the gap, rename the misnomered
export, and assert iteration parity between script and exported array.

## Prerequisites

None. Phase 2 (`0.2`) shipped; this is a self-contained cleanup against
the post-Phase-2 tree.

## Current Behavior

- `packages/runtime/src/ta/dmi.ts` exports `initDirectionalState`
  (line 90), `advanceDirectionalClose` (line 154), `tickDirectional`
  (line 260), and declares `type DirectionalState` (line 30) as
  file-local. `packages/runtime/src/ta/adx.ts:20-24` imports the three
  helpers from `./dmi`. This is the only cross-primitive coupling that
  reaches into a sibling primitive's `src/` file instead of `lib/`.
- `packages/runtime/src/ta/sourceValue.ts` exports `ScalarOrSeries`
  + `readSourceValue`. 44 `ta/*.ts` primitives + `ta/registry.ts` +
  `ta/index.ts` import from `./sourceValue` (46 consumers total).
  The file sits at top-level inside `packages/runtime/src/ta/`.
- `packages/runtime/src/ta/lib/CLAUDE.md` documents the Float64-only
  convention: helpers consume + produce `Float64Array`; do not touch
  `Bar`, `Series<T>`, `Float64RingBuffer`, or `ACTIVE_RUNTIME_CONTEXT`.
- `packages/conformance/src/scenarios/index.ts:195` exports
  `PHASE_1_SCENARIOS` as a `ReadonlyArray<Scenario>` containing **86**
  frozen entries (count as of this task's drafting; the existing
  `scenarios.test.ts:179` describe block already labels them
  `"Phase-1+Phase-2 scenario constants"`). Many entries are
  Phase-2 ports — the export name is a misnomer.
- `scripts/run-conformance.ts` drives the CLI conformance gate by
  calling `runConformanceSuite(adapterMod.default)` with no
  `scenarios:` arg — the script does **not** import
  `PHASE_1_SCENARIOS` by name. The last reported scenario count from
  CI was **78** — off by 8 from `PHASE_1_SCENARIOS.length === 86`.
- `packages/conformance/src/runConformanceSuite.ts:396-399` defines
  `loadBundledScenarios()` which dynamically imports
  `PHASE_1_SCENARIOS` as the default scenario set when the caller
  doesn't provide one — so the runner pulls all 86, but its
  per-scenario gate (or the script's count line) drops 8 silently.

## Desired Behavior

- Two new files in `packages/runtime/src/ta/lib/`:
  `directionalState.ts` + `sourceValue.ts`. Existing helpers + types
  live there; dmi.ts and the ~50 `ta/*.ts` consumers re-route through
  the new paths.
- `lib/CLAUDE.md` documents the widened convention so future shared
  helpers know where to land.
- `PHASE_1_SCENARIOS` either renamed or paired with
  `PHASE_2_SCENARIOS` (decided during the investigation step). The
  off-by-N gap reconciles to zero. A test asserts the script and the
  exported array iterate the same scenario IDs.

## Requirements

### 1. Move `dmi.ts` directional-state helpers to `lib/directionalState.ts`

Create `packages/runtime/src/ta/lib/directionalState.ts`. The file
carries the standard 2-line MIT header + the 4-line invinite
provenance header (lib helpers convention per
`packages/runtime/src/ta/lib/CLAUDE.md`):

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/directionalState.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
```

Move from `packages/runtime/src/ta/dmi.ts` verbatim (preserving
JSDoc, including `@formula`, `@since 0.2`, `@experimental`,
`@example`):

- `type DirectionalState` (line 30) — keep `readonly` fields exactly
  as currently declared, including `prevClosedSmoothedPlusDm`,
  `prevClosedSmoothedMinusDm`, `prevClosedSmoothedTr`, `plusDi`,
  `minusDi`.
- `function trueRange(high, low, prevClose): number` (line 114) —
  file-local helper consumed by `advanceDirectionalClose` /
  `tickDirectional`. Stays file-local in the new file too.
- `function rawDirectionalMovement(high, low, prevHigh, prevLow):
  { plusDm; minusDm }` (line 124) — file-local helper. Stays
  file-local.
- `export function initDirectionalState(length: number):
  DirectionalState` (line 90).
- `export function advanceDirectionalClose(s, h, l, c):
  { plusDi: number; minusDi: number }` (line 154).
- `export function tickDirectional(s, h, l, c):
  { plusDi: number; minusDi: number }` (line 260).

The `DirectionalState` type also becomes exported (`export type
DirectionalState`) so external consumers (`adx.ts`) can name it.

Add `.test.ts` co-located: `lib/directionalState.test.ts`. Existing
DMI tests cover the math end-to-end; the new unit test covers
`initDirectionalState` zero-initialisation + a single Wilder-recurrence
step through `advanceDirectionalClose` and `tickDirectional`. Per
`lib/CLAUDE.md`'s test-layer table: compute cores require `.test.ts`
+ `.property.test.ts` + `.bench.ts` + `.bench.test.ts`. Although the
directional-state helpers are technically the **stateful wrapper**
around `wilderDirectional` (which itself already has a full 4-file
set under `lib/`), they encode a closed Wilder recurrence + DI
computation per bar and own the tick-replay-vs-close dual-path
invariant — they are compute cores for testing purposes. Ship the
full four-file set:

- `lib/directionalState.test.ts` — unit cases (zero-init, single
  step, Wilder seed-completion boundary).
- `lib/directionalState.property.test.ts` — fast-check property:
  feeding the same `(high, low, close)` stream into
  `advanceDirectionalClose` vs running `tickDirectional` then
  `advanceDirectionalClose` should yield matching `plusDi/minusDi` at
  the close (the dual-path invariant that lets dmi.ts switch on
  `barJustClosed`).
- `lib/directionalState.bench.ts` + `.bench.test.ts` — bench a
  10 000-bar stream through `advanceDirectionalClose` and pin a
  threshold per `packages/runtime/CLAUDE.md`'s bench convention.

### 2. Update `dmi.ts` and `adx.ts` import paths

`packages/runtime/src/ta/dmi.ts`:
- Remove `type DirectionalState`, `trueRange`,
  `rawDirectionalMovement`, `initDirectionalState`,
  `advanceDirectionalClose`, `tickDirectional` declarations.
- Add `import { type DirectionalState, initDirectionalState,
  advanceDirectionalClose, tickDirectional } from "./lib/directionalState";`.
- All internal call sites (`initSlot` at line 307+, the slot-tick
  loop at lines 377/381) keep their existing call shapes — only the
  import source changes.
- Coverage on `dmi.ts` will drop slightly (the three helpers + the
  two file-private helpers no longer contribute branches to this
  file). Verify the package still hits 100% by running
  `pnpm --filter @invinite-org/chartlang-runtime test`.

`packages/runtime/src/ta/adx.ts`:
- Change the import on line 20-24 from `./dmi` to
  `./lib/directionalState` for the three helpers.

### 3. Move `sourceValue.ts` to `lib/sourceValue.ts`

Create `packages/runtime/src/ta/lib/sourceValue.ts` by moving (not
copying) the existing file. The 2-line MIT header at the top is
already present and stays. No new provenance header — `sourceValue.ts`
has no invinite source per the §3.1 contract; the existing header is
sufficient (Phase-1 helpers with no invinite parent ship the standard
2-line MIT block only, per `lib/CLAUDE.md`).

The existing file exports:
- `export type ScalarOrSeries = number | Series<number>` (line 21).
- `export function readSourceValue(s: ScalarOrSeries): number` (per
  the existing JSDoc, "Read the current value off a `ScalarOrSeries`.
  Returns the scalar directly; reads `.current` off a Series.
  `Series` is duck-typed.").

JSDoc on both exports is intact and meets the docs:check gate (per
the gate's current pass). Don't re-edit JSDoc — preserve verbatim.

Move the co-located test: `packages/runtime/src/ta/sourceValue.test.ts`
→ `packages/runtime/src/ta/lib/sourceValue.test.ts`. The test imports
from `./sourceValue`; change to `./sourceValue` (same relative path
inside `lib/`) — but verify the file still typechecks against any
imports it pulls from `..` (likely none).

Delete `packages/runtime/src/ta/sourceValue.ts` and
`packages/runtime/src/ta/sourceValue.test.ts`.

### 4. Rewrite the 46 consumer imports

Mechanical find-replace across `packages/runtime/src/ta/*.ts`:

- `from "./sourceValue"` → `from "./lib/sourceValue"`
- `from "./sourceValue.js"` → `from "./lib/sourceValue.js"` (if any
  ESM-extension callers exist — unlikely in this repo)

Files affected (44 primitives + `index.ts` + `registry.ts` = 46
files; verified by `grep -rln "from.*sourceValue" packages/runtime/src/`):

- `alma.ts`, `bb.ts`, `bbPercentB.ts`, `bbw.ts`, `cci.ts`, `change.ts`,
  `cmo.ts`, `connorsRsi.ts`, `coppock.ts`, `crossover.ts`,
  `crossunder.ts`, `dema.ts`, `dpo.ts`, `ema.ts`, `envelope.ts`,
  `highest.ts`, `historicalVolatility.ts`, `hma.ts`, `kama.ts`,
  `kst.ts`, `lowest.ts`, `lsma.ts`, `macd.ts`, `maRibbon.ts`,
  `mcginley.ts`, `median.ts`, `momentum.ts`, `pmo.ts`, `ppo.ts`,
  `roc.ts`, `rsi.ts`, `rvi.ts`, `sma.ts`, `smma.ts`, `stdev.ts`,
  `stochRsi.ts`, `tema.ts`, `trendStrengthIndex.ts`, `trix.ts`,
  `tsi.ts`, `ulcerIndex.ts`, `valuewhen.ts`, `vwma.ts`, `wma.ts`,
  `index.ts`, `registry.ts`.

Use a single Bash `find ... -exec sed -i ''` or a scripted Edit batch.
Do **not** hand-edit each file. Verify with `git diff --stat` that
exactly one line changed per consumer.

### 5. Widen `lib/CLAUDE.md` convention text

Edit `packages/runtime/src/ta/lib/CLAUDE.md`. The current "Invariants"
section opens with:

> - **Float64-only.** Helpers consume and produce `Float64Array`.
>   They do not touch `Bar`, `Series<T>`, `Float64RingBuffer`, or
>   `ACTIVE_RUNTIME_CONTEXT`.

Replace with:

> - **Float64 compute cores + shared primitive helpers.** The
>   majority of files here are pure compute cores (`Float64Array`-in
>   / `Float64Array`-out, no `Bar`, no `RuntimeContext`, no slot
>   state) so the same function backs both the incremental primitive
>   (called once per bar) and the reference computation used by
>   property + golden tests (full-recompute over a closed array).
> - **Shared primitive helpers** may cross the Float64 boundary
>   when their consumers are 2+ `ta.*` primitives and the cross-
>   primitive coupling would otherwise reach into a sibling
>   primitive's `src/` file. `directionalState.ts` (a stateful
>   `DirectionalState` record consumed by `ta.dmi` and `ta.adx`)
>   and `sourceValue.ts` (a `Series<T>` accessor consumed by every
>   source-taking `ta.*`) are the canonical examples. These helpers
>   still do **not** touch `ACTIVE_RUNTIME_CONTEXT`, `Bar`,
>   `BarView`, or `Float64RingBuffer` — those types live one level
>   up where the slot state and runtime context live.

Update the "Types-only files" sub-section to reference both
`maTypes.ts` and any new types-only exports introduced (none from
this task — both moves carry behaviour).

### 6. Investigate + reconcile `PHASE_1_SCENARIOS` off-by-N

**Investigation step.** Before touching exports:

1. Run `pnpm conformance` from repo root and capture the script's
   reported "passed" count + "failures" count.
2. Read `packages/conformance/src/scenarios/index.ts:195` and count
   the `PHASE_1_SCENARIOS` array entries directly.
3. If counts differ, diff the runner's iteration vs the array's
   contents. The script forwards everything to
   `runConformanceSuite(adapterMod.default)` with no scenarios arg,
   so the silent drop happens **inside** the runner, not in the
   script. Most-likely-first culprits:
   - **Runner per-scenario capability gate skips silently.** The
     runner builds the canvas2d adapter capabilities once, then
     compares each scenario's required `Capabilities.plots` (or
     similar) against the declared adapter set. Phase-2 added
     `histogram` + `marker` PlotKinds; canvas2d wires them in
     Phase-2 Task 1 + Task 26. If 8 scenarios require capabilities
     the adapter doesn't (yet) declare, the runner drops them
     without counting them as failures. Grep `runConformanceSuite.ts`
     for any `continue`/`return` path that skips a scenario without
     touching `passed` or `failures`.
   - **Inline-source vs file-source path divergence.** Phase-2
     introduced `inlineSource` per scenario; if the runner still
     branches on `scenario.scriptPath` existence and inline-source
     scenarios fall through a skip arm, exactly the N-dropped count
     surfaces.
   - **Runner double-counts or drops the
     `PLOT_KIND_COVERAGE_SCENARIO`** because its emit shape conflicts
     with single-scenario path assumptions.
   - **Reporting bug only.** The runner iterates all 86 and reports
     "passed: 78" because the report's `passed` field excludes some
     bucket (e.g., "deferred" or "skipped"). If `report.passed +
     report.failed + (report.skipped ?? 0) === 86`, this is the
     case — fix the script's log to surface skipped too.

Pick **one** resolution based on the finding:

**(a) Rename to `ALL_SCENARIOS`** (preferred if the runner is
iterating the full set and the count discrepancy is reporting-only;
the existing describe-block label "Phase-1+Phase-2 scenario
constants" already acknowledges the misnomer):

- Rename the export in `packages/conformance/src/scenarios/index.ts`
  to `ALL_SCENARIOS`.
- Add `@deprecated since 0.2.1, use ALL_SCENARIOS` re-export of
  `PHASE_1_SCENARIOS` pointing at the same frozen array.
- Update internal consumers
  (`packages/conformance/src/index.ts`,
  `packages/conformance/src/runConformanceSuite.ts:397`,
  `packages/conformance/src/index.test.ts`,
  `packages/conformance/src/scenarios/scenarios.test.ts`,
  `packages/conformance/src/runConformanceSuite.test.ts`).
- `scripts/run-conformance.ts` does **not** need its imports changed
  for the rename — it only imports `runConformanceSuite` and the
  canvas2d adapter, and the runner's `loadBundledScenarios()`
  dynamic-imports the new name. It does, however, need its log
  format updated if option (a) is paired with a new `skipped`
  bucket — extend `"conformance: N scenarios passed, M failures."`
  to surface `K skipped` so the silent-drop count is visible.

**(b) Split into `PHASE_1_SCENARIOS` + `PHASE_2_SCENARIOS`** (if the
investigation finds a clean Phase-1 vs Phase-2 boundary in scenarios):

- Phase 1 entries: `EMA_CROSS_SCENARIO`, `BOLLINGER_BANDS_SCENARIO`,
  `RSI_DIVERGENCE_SCENARIO`. Possibly `PLOT_KIND_COVERAGE_SCENARIO`
  (depends on whether it's classified as foundation or per-port).
- Phase 2 entries: everything else (the 80+ `TA_*_SCENARIO` exports
  + `PLOT_KIND_COVERAGE_SCENARIO` if it lands in the Phase-2 bucket).
- Add `ALL_SCENARIOS = Object.freeze([...PHASE_1_SCENARIOS,
  ...PHASE_2_SCENARIOS])` for default runner consumption.
- Keep `PHASE_1_SCENARIOS` as a real (now smaller) export.

**(c) Fix the script's silent skip + keep `PHASE_1_SCENARIOS` name**
(if the investigation finds the script is silently dropping
inline-source / capability-gated scenarios):

- Patch `scripts/run-conformance.ts` to either (i) error loud when
  it skips, or (ii) include the previously-dropped scenarios.
- Add the iteration-parity test (see below) so the regression can't
  recur.
- Defer the rename to a future phase.

**Output of the investigation step is a 5-line note recorded
both** (a) as a leading comment on the new iteration-parity test in
`scenarios.test.ts` and (b) as a paragraph in the changeset body —
chartlang has no separate "implementation log" artifact: "Found N
scenarios in script, M in array, gap is [cause]. Resolution: [option
a/b/c]." Then implement that resolution.

### 7. Add iteration-parity test

Add the new `it(...)` **inside the existing
`describe("Phase-1+Phase-2 scenario constants", ...)` block in
`packages/conformance/src/scenarios/scenarios.test.ts:179`** (right
after the existing frozen-array assertion at line 268). Use the
in-process approach — chartlang is ESM (`"type": "module"`), so
`__dirname` is undefined, and shelling out to `pnpm tsx` from a unit
test is prohibitively heavy for the CI cold-start. The runner +
canvas2d adapter give us everything we need in-process:

```ts
import { runConformanceSuite } from "../runConformanceSuite";
import canvas2dAdapter from "@invinite-org/chartlang-example-canvas2d-adapter";

it("runConformanceSuite iterates ALL_SCENARIOS exactly (no silent skips)", async () => {
    const report = await runConformanceSuite(canvas2dAdapter);
    // The script logs `passed + failures` only; the runner must
    // account for every scenario somewhere in the report. If a
    // `skipped` bucket exists post-Task-1, include it; if the
    // resolution path puts everything into `passed`/`failed`, that
    // sum must equal ALL_SCENARIOS.length.
    const accounted =
        report.passed +
        report.failed +
        ("skipped" in report ? report.skipped : 0);
    expect(accounted).toBe(ALL_SCENARIOS.length); // or PHASE_1_SCENARIOS.length if option (c)
});
```

Leave a leading comment on the test that names the investigation
finding (one of options a / b / c from §6) so future readers know
which resolution path the count assertion encodes. The 5-line
investigation note (see §6) lives **here, as that leading comment**
plus a paragraph in the changeset body — chartlang has no separate
"implementation log" artifact.

If the chosen resolution path puts the silent-skip count in a new
`report.skipped` field that didn't exist before, also extend the
existing `report` shape assertion in
`packages/conformance/src/runConformanceSuite.test.ts` to cover the
new field.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/runtime/src/ta/lib/directionalState.ts` | Create | Hoist DirectionalState type + 3 helpers from `dmi.ts` |
| `packages/runtime/src/ta/lib/directionalState.test.ts` | Create | Unit tests for the relocated helpers |
| `packages/runtime/src/ta/lib/directionalState.property.test.ts` | Create | Property: `advanceDirectionalClose` ≡ N×`tickDirectional` then `advanceDirectionalClose` at bar close |
| `packages/runtime/src/ta/lib/directionalState.bench.ts` | Create | 10 000-bar bench (per `runtime/CLAUDE.md` bench-pair convention) |
| `packages/runtime/src/ta/lib/directionalState.bench.test.ts` | Create | Bench threshold `it(...)` companion |
| `packages/runtime/src/ta/dmi.ts` | Modify | Import 3 helpers from `./lib/directionalState`; remove duplicated declarations + the two file-local helpers (`trueRange`, `rawDirectionalMovement`) |
| `packages/runtime/src/ta/adx.ts` | Modify | Change import path from `./dmi` to `./lib/directionalState` for the 3 helpers |
| `packages/runtime/src/ta/lib/sourceValue.ts` | Create (via move) | Hoist `ScalarOrSeries` + `readSourceValue` |
| `packages/runtime/src/ta/lib/sourceValue.test.ts` | Create (via move) | Existing test moves alongside |
| `packages/runtime/src/ta/sourceValue.ts` | Delete | Replaced by lib version |
| `packages/runtime/src/ta/sourceValue.test.ts` | Delete | Moved |
| `packages/runtime/src/ta/{44 primitives}.ts` + `index.ts` + `registry.ts` | Modify | Import path rewrite, one line each (full file list in §4) |
| `packages/runtime/src/ta/lib/CLAUDE.md` | Modify | Widen convention to permit shared primitive helpers |
| `packages/conformance/src/scenarios/index.ts` | Modify | Rename / split `PHASE_1_SCENARIOS` per chosen resolution |
| `packages/conformance/src/index.ts` | Modify | Re-export the new name + deprecated alias |
| `packages/conformance/src/runConformanceSuite.ts` | Modify | Update dynamic-import name in `loadBundledScenarios` (line 397); also surface a `skipped` bucket in the returned report if option (a)/(b) lands the loud-skip wiring |
| `packages/conformance/src/index.test.ts` | Modify | Test the new name + the deprecated alias |
| `packages/conformance/src/scenarios/scenarios.test.ts` | Modify | Add iteration-parity test inside the existing `describe("Phase-1+Phase-2 scenario constants", ...)` block (line 179) |
| `packages/conformance/src/runConformanceSuite.test.ts` | Modify | Use the new name + extend the report-shape assertion if a `skipped` field is added |
| `scripts/run-conformance.ts` | Modify (option a/b/c) | No import change needed for the rename (script imports `runConformanceSuite` only); extend the log line `"conformance: N scenarios passed, M failures."` to `"… K skipped …"` if option (a)/(b) surfaces a skipped bucket; load-loud the runner's silent skips if option (c) |

## Gates

This task must keep all gates green. Run before opening PR:

- `pnpm typecheck` — every package
- `pnpm lint` — Biome
- `pnpm test` — workspace, **100% coverage on `packages/runtime/` and
  `packages/conformance/`** (the moves shift line counts; new lib
  files need their tests to cover them)
- `pnpm docs:check` — JSDoc gate (new exports keep their @example /
  @since / stability marker / @formula tags)
- `pnpm readme:check` — package READMEs unchanged
- `pnpm conformance` — script still passes; count line now matches
  the canonical export
- `pnpm bench:ci` — new `lib/directionalState.bench.ts` lands a
  threshold; the existing DMI bench may shift slightly (lower) since
  the bench harness now covers fewer file-local helpers in `dmi.ts`
  itself

## Changeset

`.changeset/phase-2-followups-runtime-conformance-cleanup.md`:

```
---
"@invinite-org/chartlang-runtime": patch
"@invinite-org/chartlang-conformance": patch
---

Hoist shared `ta.*` primitive helpers to `lib/`: relocate
`DirectionalState` + the 3 directional-state helpers from `dmi.ts`
to `lib/directionalState.ts` so `ta.adx` no longer cross-imports
into a sibling primitive's `src/` file. Relocate
`ScalarOrSeries` + `readSourceValue` from top-level `sourceValue.ts`
to `lib/sourceValue.ts` to consolidate the shared helper surface.
Widen `packages/runtime/src/ta/lib/CLAUDE.md` to document the
shared-primitive-helper carve-out alongside the Float64-only compute
cores.

Reconcile `PHASE_1_SCENARIOS` cardinality with `scripts/run-conformance.ts`
(rename to `ALL_SCENARIOS` with a deprecated alias / split per
investigation finding). Add iteration-parity test so script and
canonical export can never drift again.
```

## Acceptance Criteria

- [ ] `packages/runtime/src/ta/lib/directionalState.ts` exists with
      the full 4-line invinite provenance header + 2-line MIT
      preamble.
- [ ] `lib/directionalState.{test,property.test,bench,bench.test}.ts`
      all exist and pass at 100% coverage on the new file.
- [ ] `packages/runtime/src/ta/dmi.ts` no longer declares
      `DirectionalState` or the three helpers; imports them from
      `./lib/directionalState`.
- [ ] `packages/runtime/src/ta/adx.ts` imports the three helpers
      from `./lib/directionalState`.
- [ ] `packages/runtime/src/ta/lib/sourceValue.ts` exists; old
      `packages/runtime/src/ta/sourceValue.ts` + `.test.ts` deleted.
- [ ] Every consumer of `./sourceValue` rewritten to
      `./lib/sourceValue`; `git diff --stat` shows exactly one line
      changed per consumer file.
- [ ] `packages/runtime/src/ta/lib/CLAUDE.md` updated with the
      widened convention text.
- [ ] 5-line investigation note (finding + chosen resolution)
      recorded as both (a) a leading comment on the new
      iteration-parity test in `scenarios.test.ts` and (b) a
      paragraph in the changeset body.
- [ ] `PHASE_1_SCENARIOS` renamed or split per chosen resolution;
      deprecated alias re-exports if applicable.
- [ ] Iteration-parity test added in
      `scenarios.test.ts`; runs in CI.
- [ ] `pnpm conformance` "N scenarios" matches the canonical
      export's length.
- [ ] All gates green (`pnpm typecheck`, `pnpm lint`, `pnpm test`
      at 100% coverage, `pnpm docs:check`, `pnpm readme:check`,
      `pnpm conformance`, `pnpm bench:ci`).
- [ ] Changeset `.changeset/phase-2-followups-runtime-conformance-cleanup.md`
      committed.

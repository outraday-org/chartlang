# Catalogue Model, Generators & Coverage Gate

> **Status: TODO**

## Goal

Establish the infrastructure that the ~200 per-primitive examples plug
into: a pure `examples/catalogue.ts` metadata registry, a generator
that emits `DEMO_SCRIPTS` from the canonical `.chart.ts` sources +
catalogue meta, a derivation of the e2e `EXAMPLE_SCRIPTS` list from the
catalogue, and a `scripts/examples-coverage.ts` gate that asserts every
`docs/primitives/**` page has ≥1 example — seeded with a full
allowlist so CI stays green until the population tasks land. Migrate
**every** existing example script — the 25 `DEMO_SCRIPTS` entries **and**
the additional `.chart.ts` files already in the CLI e2e set (31 ids
total) — into the new shape, classifying each per the §6a fold rule
(single-primitive → family default, multi-primitive → `complex`).

## Prerequisites

None.

## Current Behavior

- `apps/site/src/components/demo/scripts.ts` hand-authors `DEMO_SCRIPTS`
  with inlined `source` strings duplicated from `examples/scripts/`.
- `packages/cli/src/e2e.test.ts` hand-maintains `EXAMPLE_SCRIPTS`.
- `scripts/gen-examples-docs.ts` renders `docs/examples/**` from
  `DEMO_SCRIPTS`.
- No coverage relationship exists between examples and primitives.

## Desired Behavior

- `examples/catalogue.ts` is the author-facing registry. `scripts.ts`
  is **generated** and carries the `AUTO-GENERATED` sentinel.
- `pnpm examples:generate` regenerates `scripts.ts` **and**
  `docs/examples/**`; `pnpm examples:gate` byte-diffs both.
- `pnpm examples:coverage` fails if any primitive doc page lacks an
  example and the id is not in the allowlist.

## Requirements

### 1. `examples/catalogue.ts` (new)

Pure type + data module (no React, no Node imports) so both
`apps/site` (client bundle), `scripts/`, and `packages/cli` can import
it.

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Fixed taxonomy for the demo's categorized browser dialog AND the
 * invinite template dialog (the canonical category set both products
 * share — see Tasks 23-25). `complex` holds only the curated
 * *multi-primitive* showcase demos (composition / MTF / pane-routing /
 * idiom). Single-primitive demos are folded in as their primitive's
 * family-category default, never `complex` (see §6a fold rule).
 */
export type ExampleCategory =
    | "complex"
    | "ta-moving-averages"
    | "ta-momentum"
    | "ta-trend"
    | "ta-bands-volatility"
    | "ta-volume"
    | "ta-volume-profile"
    | "ta-pivots-utility"
    | "draw-lines"
    | "draw-shapes"
    | "draw-markers"
    | "draw-channels"
    | "draw-fibonacci"
    | "draw-gann"
    | "draw-elliott"
    | "draw-patterns"
    | "math"
    | "str"
    | "inputs"
    | "state-plot-alert"
    | "define-bar-context";

/** Human-readable category labels for the dialog sidebar. */
export const CATEGORY_LABELS: Readonly<Record<ExampleCategory, string>> = {
    /* … one entry per union member, e.g. "ta-moving-averages":
       "TA · Moving Averages", … */
} as const;

/** Display order of categories in the dialog + docs sidebar. */
export const CATEGORY_ORDER: ReadonlyArray<ExampleCategory> = [
    /* same order as the union above */
];

export type ExampleMeta = Readonly<{
    /** Matches `examples/scripts/<id>.chart.ts` basename. */
    id: string;
    label: string;
    description: string;
    category: ExampleCategory;
    /** Canonical primitive ids this example demonstrates (≥1). */
    primitives: ReadonlyArray<string>;
}>;

/**
 * Assembled from per-task fragment modules under `examples/catalogue/`
 * so the ~19 population tasks (3–21) each own a disjoint file and can
 * run in parallel without colliding on this barrel — see README
 * "Execution Plan & Parallelization". Each fragment default-exports a
 * `ReadonlyArray<ExampleMeta>`; this barrel concatenates them in
 * `CATEGORY_ORDER`. The migrated entries (§6) live in
 * `examples/catalogue/complex.ts` + the relevant family fragments.
 */
export const EXAMPLE_CATALOGUE: ReadonlyArray<ExampleMeta> = [
    ...complexFragment,
    ...taMovingAveragesFragment,
    /* …one spread per fragment, in CATEGORY_ORDER… */
];
```

- **Fragment convention.** `examples/catalogue/<task-slug>.ts` (e.g.
  `ta-moving-averages.ts`, `draw-fibonacci.ts`, `core-inputs.ts`) each
  default-export their array of `ExampleMeta`. Task 1 creates the
  directory, the barrel, and the `complex.ts` fragment (migrated
  showcase demos); population tasks 3–21 each create exactly one
  fragment. A `catalogue.test.ts` assertion confirms the barrel spreads
  every fragment (no orphan file, no missing spread).

- **Primitive id scheme** (must match the gate's page→id mapping, §4):
  - `ta/<file>.md` → `ta.<file>` (e.g. `ta.rsi`).
  - `draw/<kebab>.md` → `draw.<camelKind>` (kebab → camelCase, e.g.
    `fib-retracement` → `draw.fibRetracement`).
  - `input/<name>.md` → `input.<name>`.
  - `state/<name>.md` → `state.<name>`; tick variants `state/tick-<t>.md`
    → `state.tick.<t>`. (Now includes `state/array.md` → `state.array`,
    `state/series.md` → `state.series`, and — once the in-flight
    `tasks/state-map` work lands its doc page — `state/map.md` →
    `state.map`.)
  - `plot/plot.md` → `plot`; `plot/hline.md` → `hline`.
  - `request/security.md` → `request.security`;
    `request/lowerTf.md` → `request.lowerTf`.
  - `alert/alert.md` → `alert`.
  - `define/<name>.md` → `define.<name>`.
  - `barstate.md`/`syminfo.md`/`timeframe.md` →
    `barstate`/`syminfo`/`timeframe`.
  - Top-level namespace pages `math.md`/`str.md`/`session.md`/`time.md`
    → `math`/`str`/`session`/`time` (each namespace is a **single** doc
    page, so one example covers the whole namespace — `math.*`/`str.*`
    are not one-page-per-function).
- Add a unit test `examples/catalogue.test.ts`: ids are unique, each
  `primitives` array is non-empty, every `category` is a known union
  member, and each `id` is a valid filename slug.

### 2. `scripts/gen-demo-scripts.ts` (new) → folded into `examples:generate`

- Reads every `examples/scripts/<id>.chart.ts` named by
  `EXAMPLE_CATALOGUE` and emits
  `apps/site/src/components/demo/scripts.ts` with:
  - the MIT header + `AUTO-GENERATED by pnpm examples:generate` sentinel,
  - `export type DemoScript = Readonly<{ id; label; description;
    category: ExampleCategory; source: string }>` (extend with
    `category`),
  - `export const DEMO_SCRIPTS: ReadonlyArray<DemoScript>` with each
    `source` inlined from the `.chart.ts` file (escaped as a template
    literal; preserve the trailing newline contract `gen-examples-docs`
    relies on).
- Catalogue order = `DEMO_SCRIPTS` order (stable, deterministic).
- Re-export `ExampleCategory`/`CATEGORY_LABELS`/`CATEGORY_ORDER` from
  `scripts.ts` (re-export from `examples/catalogue`) so
  `DemoBody.tsx` and `config.ts` import one module.
- Wire into `scripts/gen-examples-docs.ts`: `pnpm examples:generate`
  runs `gen-demo-scripts` **first** (so `docs/examples` is rendered
  from fresh `scripts.ts`), and `--check` byte-diffs `scripts.ts` too.
  Update the `OUT_OF_DATE_MESSAGE` set accordingly.
- A missing `.chart.ts` for a catalogue id, or a stray `.chart.ts`
  with no catalogue entry, is a hard error.

### 3. Derive `EXAMPLE_SCRIPTS` in `e2e.test.ts`

Replace the hand-maintained array with:

```ts
import { EXAMPLE_CATALOGUE } from "../../../examples/catalogue";
const EXAMPLE_SCRIPTS = EXAMPLE_CATALOGUE.map(
    (e) => `examples/scripts/${e.id}.chart.ts` as const,
);
```

Keep the existing per-script assertions (`__manifest`,
`apiVersion === 1`). Add a note that the loop now compiles ~200 files;
if wall-clock becomes the CI long pole, follow up by sharding (see
README §9). `COMPILE_TIMEOUT_MS` is already `15_000` and per-`it`
(verified) — keep it.

> **The current `EXAMPLE_SCRIPTS` array holds 27 files, not 11** — the
> 13 originally listed here (`ema-cross`, `bollinger-bands`,
> `rsi-divergence-alert`, `fib-retracement`, `session-high-alert`,
> `daily-rsi-divergence`, `mintick-snapped-entry`, `base-trend`,
> `trend-confirmation`, `htf-trend-filter`, `sma-offset`,
> `pivot-high-ray`, `forecast-line`) **plus 14 added since the plan was
> written**: `anchored-line`, `up-streak`, `rolling-window-mean`,
> `volume-by-level`, `rolling-zscore`, `symbol-ratio`, `z-layering`,
> `weekday-close-filter`, `bgcolor-barcolor`, `tick-snapped-levels`,
> `str-formatted-hud`, `math-scalar-band`, `str-label-builder`,
> `fill-between-band` (these already compile in e2e and back the new
> `math.*`/`str.*`/`state.array`/`state.map`/`draw.fillBetween` surface).
> Deriving `EXAMPLE_SCRIPTS` from the catalogue therefore requires that
> **every one of these on-disk files has a catalogue entry** (§6), or
> the loop silently drops them from e2e and the gen-demo-scripts
> stray-file check (§2) hard-errors. Note also that `e2e.test.ts` has
> **standalone** `it()` blocks that reference `daily-rsi-divergence`,
> `session-high-alert`, `base-trend`, and `trend-confirmation` by path
> (sidecar / dependency assertions) — those files stay on disk and those
> tests are unaffected by the derivation change.

### 4. `scripts/examples-coverage.ts` (new) → `pnpm examples:coverage`

- Walk `docs/primitives/**/*.md` (exclude every `index.md`), mapping
  each path to a canonical primitive id per §1's scheme. This set is
  the **coverage target** — no hardcoded primitive list.
- Build the **covered** set = union of all `primitives` across
  `EXAMPLE_CATALOGUE`.
- Load `examples/coverage-allowlist.json` (`string[]` of ids permitted
  to be uncovered).
- **Fail** if: (a) a target id is neither covered nor allow-listed
  (`MISSING`), (b) a catalogue `primitives` id is not a real target
  page (`UNKNOWN`), (c) an allowlist id is actually covered or not a
  real target (`STALE_ALLOWLIST`). Structured stderr + `exitCode = 1`,
  mirroring `docs-gate.ts`.
- Co-locate `scripts/examples-coverage.test.ts` (100% on the helper).
- Add root `package.json` scripts:
  `"examples:coverage": "pnpm tsx scripts/examples-coverage.ts"` and
  include it in the aggregate `test`/CI gate chain (wherever
  `examples:gate` / `docs:gate` are invoked — verify `.github/`
  workflow + any `gate`-aggregating script).

### 5. `examples/coverage-allowlist.json` (new)

Seed with **every** canonical primitive id **except** those already
covered by the migrated examples (§6). Each population task removes
the ids it covers. Sort ids for stable diffs; add a top-of-file pointer
in `examples/CLAUDE.md` explaining the shrink-to-empty lifecycle.

### 5b. `examples/catalogue.json` (generated artifact)

`pnpm examples:generate` also emits `examples/catalogue.json` — a
machine-readable `{ id, label, description, category, primitives,
source }[]` (sources inlined from each `.chart.ts`). This is the
artifact the published `@invinite-org/chartlang-examples` package wraps
(Task 23) and that invinite's template sync consumes (Task 24). It is
byte-checked by `examples:gate` like the other generated outputs. Sort
entries by catalogue order for stable diffs.

### 6. Migrate every existing example script

There are **two** legacy sources of truth and they do **not** fully
overlap — migrate the **union (31 distinct ids)**:

1. **The 25 `DEMO_SCRIPTS`** in `scripts.ts`: `ema-cross`,
   `bollinger-bands`, `rsi-divergence-alert`, `smoothed-rsi-cross`,
   `explicit-pane-routing`, `manual-sma`, `trend-composition`,
   `htf-trend-filter`, `sma-offset`, `pivot-high-ray`, `forecast-line`,
   `fill-between-band`, `anchored-line`, `up-streak`,
   `rolling-window-mean`, `volume-by-level`, `rolling-zscore`,
   `symbol-ratio`, `z-layering`, `weekday-close-filter`,
   `bgcolor-barcolor`, `tick-snapped-levels`, `str-formatted-hud`,
   `math-scalar-band`, `str-label-builder`. Four are demo-only (no
   file): `manual-sma`, `smoothed-rsi-cross`, `explicit-pane-routing`,
   `trend-composition` — **create** their
   `examples/scripts/<id>.chart.ts` from the current inlined `source`.
   The other 21 already exist on disk.
2. **The 6 on-disk `.chart.ts` files in the e2e set that are NOT in
   `DEMO_SCRIPTS`**: `base-trend`, `daily-rsi-divergence`,
   `mintick-snapped-entry`, `session-high-alert`, `trend-confirmation`,
   `fib-retracement`. These already compile in e2e and exist on disk;
   the stray-file check (§2) + the catalogue-derived `EXAMPLE_SCRIPTS`
   (§3) make cataloguing them **mandatory**, not optional.

> Note `trend-composition` (a self-contained demo-only file with
> `baseTrend` inlined) is **distinct** from the on-disk
> `trend-confirmation` + `base-trend` pair (cross-file composition via
> `import baseTrend from "./base-trend.chart"`). Catalogue all three;
> they are different files/ids.

#### 6a. Fold rule — single-primitive default vs. `complex` composite

The original plan swept **all** curated demos into a `complex` bucket.
That over-collects: a demo that exists to showcase **one** headline
primitive **is** that primitive's per-primitive default example. So:

- **Single-primitive demo → the per-primitive default.** If a migrated
  example demonstrates a single headline primitive, give it that
  primitive's **family category** (never `complex`) and credit exactly
  that primitive. The family population task (3–21) then **skips**
  authoring a duplicate (its table already flags the id `covered`).
- **Multi-primitive composite / idiom → `complex`.** Demos that show
  *composition* (cross-file imports, MTF wiring, pane routing,
  pivot→ray chains, manual-computation idioms, divergence detection)
  stay in `complex` — they demonstrate something no single-primitive
  default does.
- **Remove redundant single-primitive `complex` entries.** If an example
  currently parked in `complex` is in fact a single-primitive duplicate
  of an existing default, **do not preserve a second copy** — fold it
  into the default (drop the `complex` entry / reassign its category).
  This is the only removal the rule makes; genuine multi-primitive
  composites are always kept. (As it happens the original `complex`
  list is all genuine composites, so this clause primarily governs the
  14 newer on-disk scripts and any future additions.)

#### 6b. Category + crediting for every migrated id

Author **all** migrated entries in the Task-1
`examples/catalogue/complex.ts` fragment (the only migrated fragment
Task 1 owns — its **filename** is historical; the `category` **field**
of each entry, not the file, drives the dialog + docs grouping). The
population tasks 3–21 create their own fragments with only **new**
(non-migrated) entries and never touch `complex.ts`, keeping the
parallel waves disjoint.

| id | Category | Kind | `primitives` credit |
|----|----------|------|---------------------|
| `ema-cross` | `ta-moving-averages` | default | `ta.ema` |
| `sma-offset` | `ta-moving-averages` | default | `ta.sma` |
| `bollinger-bands` | `ta-bands-volatility` | default | `ta.bb` |
| `rsi-divergence-alert` | `ta-momentum` | default | `ta.rsi` |
| `fib-retracement` | `draw-fibonacci` | default | `draw.fibRetracement` |
| `anchored-line` | `draw-lines` | default | `draw.line` |
| `fill-between-band` | `draw-lines` | default | `draw.fillBetween` |
| `up-streak` | `state-plot-alert` | default | `state.series` |
| `rolling-window-mean` | `state-plot-alert` | default | `state.array` |
| `volume-by-level` | `state-plot-alert` | default | `state.map` †|
| `symbol-ratio` | `define-bar-context` | default | `request.security` |
| `tick-snapped-levels` | `math` | default | `math` |
| `math-scalar-band` | `math` | default | `math` |
| `str-formatted-hud` | `str` | default | `str` |
| `str-label-builder` | `str` | default | `str` |
| `weekday-close-filter` | `inputs` | default | `input.session`, `time` |
| `smoothed-rsi-cross` | `complex` | composite | (omit — building blocks owned by defaults) |
| `manual-sma` | `complex` | composite | (omit — manual-computation idiom) |
| `explicit-pane-routing` | `complex` | composite | (omit — pane-routing idiom) |
| `trend-composition` | `complex` | composite | (omit — cross-file composition) |
| `trend-confirmation` | `complex` | composite | (omit) |
| `base-trend` | `complex` | composite | (omit) |
| `htf-trend-filter` | `complex` | composite | (omit — `request.security` now owned by `symbol-ratio`) |
| `pivot-high-ray` | `complex` | composite | `ta.pivotsHighLow`, `draw.horizontalRay` |
| `forecast-line` | `complex` | composite | (omit) |
| `daily-rsi-divergence` | `complex` | composite | (omit) |
| `rolling-zscore` | `complex` | composite | (omit — `state.array` owned by `rolling-window-mean`) |
| `z-layering` | `complex` | composite | (omit — `draw.fillBetween` owned by `fill-between-band`) |
| `bgcolor-barcolor` | `complex` | composite | (omit — `bgcolor`/`barcolor` have no doc page yet) |
| `mintick-snapped-entry` | `complex` | composite | `syminfo` |
| `session-high-alert` | `complex` | composite | `alert` |

† `state.map` only becomes a real gate target once the in-flight
`tasks/state-map` doc page lands. Until then keep `state.map` in the
allowlist and credit `volume-by-level` with `state.array` instead (it
uses both); flip the credit to `state.map` when the page exists.

- **Crediting rule.** A `default` credits exactly its headline
  primitive. A `composite` credits only a primitive that is **genuinely
  its canonical demo and has no cleaner single-primitive default** —
  `pivot-high-ray` (`ta.pivotsHighLow` + `draw.horizontalRay`),
  `mintick-snapped-entry` (`syminfo`), `session-high-alert` (`alert`).
  Composites whose every primitive now has a single-primitive default
  credit **nothing** (the `(omit)` rows) — the default owns the
  coverage, so the composite cannot preempt it. This is the mechanical
  form of the fold rule: redundant credits collapse onto the default.

Then remove all covered ids from the allowlist seed. After migration,
`pnpm examples:generate` must reproduce a `scripts.ts` whose
`DEMO_SCRIPTS` is behaviorally identical for the existing 25 (same
ids/labels/sources, plus the new `category` field; the 6 newly-catalogued
on-disk files now also appear) and `pnpm examples:gate` + existing
`apps/site` Playwright demo tests stay green.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/catalogue.ts` | Create | Barrel: taxonomy + spreads every fragment. |
| `examples/catalogue/complex.ts` | Create | Migrated showcase demos fragment. |
| `examples/catalogue/<task-slug>.ts` | (Tasks 3–21) | One disjoint fragment per population task — enables parallel waves. |
| `examples/catalogue.test.ts` | Create | Invariants + barrel-spreads-every-fragment check. |
| `examples/coverage-allowlist.json` | Create | Shrinking uncovered-id allowlist. |
| `examples/catalogue.json` | Create (generated) | Machine-readable artifact for the published package (Task 23). |
| `examples/scripts/{manual-sma,smoothed-rsi-cross,explicit-pane-routing,trend-composition}.chart.ts` | Create | Promote demo-only sources to canonical files. |
| `examples/catalogue/complex.ts` (entries for `base-trend`, `daily-rsi-divergence`, `mintick-snapped-entry`, `session-high-alert`, `trend-confirmation`, `fib-retracement`) | Modify | Catalogue the 6 on-disk e2e scripts not in `DEMO_SCRIPTS` (else stray-file / e2e break). |
| `examples/catalogue/complex.ts` (entries for the 14 scripts added since the plan: `anchored-line`, `up-streak`, `rolling-window-mean`, `volume-by-level`, `rolling-zscore`, `symbol-ratio`, `z-layering`, `weekday-close-filter`, `bgcolor-barcolor`, `tick-snapped-levels`, `str-formatted-hud`, `math-scalar-band`, `str-label-builder`, `fill-between-band`) | Modify | Catalogue per the §6b table — single-primitive ones as **defaults** (family category), composites as `complex`. |
| `scripts/gen-demo-scripts.ts` | Create | Emit `scripts.ts` from catalogue + sources. |
| `scripts/gen-examples-docs.ts` | Modify | Run gen-demo-scripts first; byte-check `scripts.ts`. |
| `scripts/examples-coverage.ts` | Create | Coverage gate. |
| `scripts/examples-coverage.test.ts` | Create | Gate unit tests. |
| `apps/site/src/components/demo/scripts.ts` | Modify | Now generated; `DemoScript` gains `category`. |
| `packages/cli/src/e2e.test.ts` | Modify | Derive `EXAMPLE_SCRIPTS` from catalogue. |
| `package.json` | Modify | Add `examples:coverage`; wire into gate chain. |
| `examples/CLAUDE.md` | Modify | Document catalogue + generator + allowlist lifecycle. |
| `.github/` workflow (as needed) | Modify | Run `examples:coverage` in CI. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on `scripts/`-tested helpers + `examples/`)
- `pnpm examples:gate` (scripts.ts + docs/examples byte-clean)
- `pnpm examples:coverage` (green via full allowlist)
- `apps/site` Playwright demo smoke (unchanged behavior)

## Changeset

`.changeset/examples-coverage-infra.md` — **patch** (tooling +
`examples/`; `apps/site` is private, no package version bump). Note the
`DemoScript` type gained `category`.

## Acceptance Criteria

- `examples/catalogue.ts` exports the taxonomy (incl. `math`/`str`) +
  every migrated entry (the 25 `DEMO_SCRIPTS` + the 6 on-disk e2e scripts
  not in it = 31 ids; all 27 on-disk `.chart.ts` files plus the 4
  demo-only sources have a catalogue entry), each classified per the
  §6b fold rule (single-primitive → family default, composite →
  `complex`).
- `pnpm examples:generate` regenerates `scripts.ts` + `docs/examples`;
  `pnpm examples:gate` is byte-clean.
- `EXAMPLE_SCRIPTS` is derived from the catalogue; `e2e.test.ts` green.
- `pnpm examples:coverage` passes with the seeded allowlist and fails
  (verified by a unit test) when an id is removed from the allowlist
  while still uncovered.
- 100% coverage on new gate/generator helpers; `examples/CLAUDE.md`
  updated; changeset committed.

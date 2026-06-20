# Task 3 — Conformance + Pine `array.*` converter + docs/skills/example

> **Status: TODO**

## Goal

Add a conformance scenario asserting a rolling reduction series is byte-stable,
map Pine's `array.*` reductions onto the chartlang surface in the converter,
and publish the author-facing docs / skill reference / example.

## Prerequisites

- Tasks 1–2 complete (`array.*` namespace + handle methods + runtime impl).

## Current Behavior

- No conformance scenario exercises `state.array` reductions.
- The Pine converter maps `state.array` creation (from `../state-array/`
  task 5) but not the `array.*` reduction family.

## Desired Behavior

| Pine | chartlang |
|------|-----------|
| `array.sum(id)` | `array.sum(win)` *(or `win.sum()`)* |
| `array.avg(id)` | `array.avg(win)` |
| `array.min/max(id)` | `array.min/max(win)` |
| `array.stdev(id)` | `array.stdev(win)` |
| `array.variance(id)` | `array.variance(win)` |
| `array.median(id)` | `array.median(win)` |
| `array.percentile_linear_interpolation(id, p)` | `array.percentile(win, p)` |
| `array.percentile_nearest_rank(id, p)` | **unsupported** → diagnostic + `// TODO` (deferred) |
| `array.sort(id, order.descending)` | `array.sort(win, "desc")` *(note: Pine sorts in place; chartlang returns a copy — emit a clarifying comment)* |
| `array.indexof(id, v)` / `array.includes(id, v)` | `array.indexOf(win, v)` / `array.includes(win, v)` |

## Requirements

### 1. Conformance scenario (`packages/conformance/src/scenarios/`)

- `arrayRollingStats.scenario.ts`: a script that pushes a fixed OHLC close
  series into `state.array(14)` and `plot`s `array.stdev(win)` +
  `array.median(win)`, asserting the emitted plot series are byte-stable across
  adapters (mirror an existing rolling-series scenario shape, e.g. the
  state-array `rolling-window` conformance from `../state-array/` task 4).
- Register in the scenario index.

### 2. Pine converter (`packages/pine-converter/src/transform/`)

- Extend the `array.*` family transform (or the file added by `../state-array/`
  task 5) with the reduction mappings in the table. Pine reductions take the
  array id as the first arg → chartlang `array.fn(win, ...)`, which is a direct
  shape match.
- `array.sort` in place vs copy: emit `win = array.sort(win)` is **wrong**
  (handle is not reassignable); instead convert `array.sort(id, order)` →
  `const sorted = array.sort(win, "desc")` with a `// NOTE: chartlang sort
  returns a copy` comment, or pass through with a diagnostic if the Pine code
  relies on in-place mutation afterward. Document the chosen rule in the
  transform.
- `percentile_nearest_rank` + any unmapped `array.*` → existing
  `unsupported-*` diagnostic + `// TODO`, never a hard failure.
- Co-locate converter unit tests for each mapped name + the unsupported paths.

### 3. Docs (`docs/`)

- Extend the `state.array` reference page (or add an `array` namespace section)
  with the reduction methods + `array.*` aliases: one row per name, signature,
  NaN policy, the population-vs-sample default, percentile interpolation note,
  and the sort-returns-copy caveat.
- Update nav if a new page.

### 4. Author skill (`skills/chartlang-coding/`)

- Add the `array.*` reduction mapping to
  `references/translating-from-pine.md` (the table above).
- Note both call styles (method `win.avg()` and free `array.avg(win)`) and
  that they are identical.

### 5. Example + live-demo wiring (`examples/scripts/` + `apps/site`)

Follow the example pipeline (`examples/CLAUDE.md`, `apps/CLAUDE.md`,
`tasks/examples-full-coverage/`):

1. **Source** — `examples/scripts/rolling-zscore.chart.ts`: push `close` into
   `state.array(20)`, compute a z-score `(close − win.avg()) / win.stdev()`,
   `plot` it — a compact, real use of methods + the aliases.
2. **e2e compile** — append to `EXAMPLE_SCRIPTS` in
   `packages/cli/src/e2e.test.ts:13`.
3. **Live demo + docs Examples** — add a `DEMO_SCRIPTS` entry in
   `apps/site/src/components/demo/scripts.ts` (`source` inlined as a string);
   language/utilities category if the categorized dialog has landed.
4. **Generate + gate** — `pnpm examples:generate`; keep `pnpm examples:gate`
   green.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/scenarios/arrayRollingStats.scenario.ts` | Create | Rolling stdev/median byte-stability. |
| `packages/conformance/src/scenarios/index.ts` (registry) | Modify | Register scenario. |
| `packages/pine-converter/src/transform/<array family>.ts` | Modify | Map `array.*` reductions. |
| `packages/pine-converter/src/transform/<array family>.test.ts` | Modify/Create | Converter unit tests. |
| `docs/language/state-array.md` (or `array.md`) | Modify/Create | Reduction reference. |
| `docs/.vitepress/config.*` | Modify | Nav (if new page). |
| `skills/chartlang-coding/references/translating-from-pine.md` | Modify | Mapping table. |
| `examples/scripts/rolling-zscore.chart.ts` | Create | Example. |
| `packages/cli/src/e2e.test.ts` | Modify | Add example to `EXAMPLE_SCRIPTS`. |
| `apps/site/src/components/demo/scripts.ts` | Modify | `DEMO_SCRIPTS` entry (live demo + docs Examples). |
| `.changeset/array-analytics-converter.md` | Create | patch (pine-converter, conformance). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on pine-converter + conformance)
- `pnpm conformance`
- `pnpm docs:check`
- `pnpm readme:check`
- `pnpm examples:gate` (after `pnpm examples:generate`)
- `pnpm skills:gate`

## Changeset

`.changeset/array-analytics-converter.md` — **patch** (pine-converter,
conformance).

## Acceptance Criteria

- Conformance rolling-stat series byte-stable on the reference adapter.
- Every mapped Pine `array.*` name converts; nearest-rank + in-place-sort
  reliance emit diagnostics, never hard failures.
- Docs + skill mapping updated; example compiles in e2e (`EXAMPLE_SCRIPTS`)
  and appears in the live demo (`DEMO_SCRIPTS`); `examples:gate` green.
- Coverage + conformance + docs + readme + skills gates green; changeset
  committed.

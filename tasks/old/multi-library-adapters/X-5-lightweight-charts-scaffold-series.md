# lightweight-charts adapter: scaffold + series / candles / panes

> **Status: TODO**

## Goal

Scaffold `examples/lightweight-charts-adapter/` and implement everything
**except drawings**: package wiring, the full `Capabilities`, the headless
`DEFAULT_ADAPTER` conformance export, and the real `createLightweightChartsAdapter`
factory that maps chartlang candles + plots + horizontal-lines + sub-panes
onto lightweight-charts' **native** series/panes. Drawings land in Task 6.

## Prerequisites

- Tasks 1–3 (geometry layer) — for the `Capabilities` template and so the
  package depends on the finished adapter-kit surface. (Task 4 not strictly
  required but recommended first.)

## Current Behavior

No lightweight-charts adapter exists.

## Desired Behavior

A private `chartlang-example-lightweight-charts-adapter` package whose
default export passes conformance and whose factory renders candles + all
plot kinds + hlines + panes via TradingView's lightweight-charts v5 API.

## Requirements

### 1. Scaffold

1. Append `"examples/lightweight-charts-adapter"` to `PACKAGE_DIRS` in
   `scripts/scaffold.ts` (alphabetical within the `examples/` block).
2. Run `pnpm scaffold` — generates the §22.4 six-file template. Do **not**
   hand-edit generated files; if a template field is wrong, fix
   `scripts/scaffold.ts` and re-run.
3. Edit `package.json`:
   ```json
   {
     "name": "chartlang-example-lightweight-charts-adapter",
     "private": true,
     "exports": {
       ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
     },
     "dependencies": {
       "@invinite-org/chartlang-adapter-kit": "workspace:^",
       "@invinite-org/chartlang-host-worker": "workspace:^",
       "lightweight-charts": "^5"
     },
     "devDependencies": {
       "@invinite-org/chartlang-compiler": "workspace:^",
       "@invinite-org/chartlang-core": "workspace:^",
       "@invinite-org/chartlang-runtime": "workspace:^",
       "@types/node": "^20.0.0"
     }
   }
   ```
   Mirror `examples/canvas2d-adapter/package.json` (private, no
   `publishConfig`, `engines.node >= 20`).

### 2. Capabilities — `src/capabilities.ts`

Export `LWC_CAPABILITIES` and `LWC_SYM_INFO` mirroring
`examples/canvas2d-adapter/src/capabilities.ts`: **all** plot kinds
(`capabilities.allPhase5Plots()`), **all** drawing kinds
(`capabilities.allPhase3Drawings()` + `table`), alerts `("log","toast")`,
`multiTimeframe(true)`, `subPanes(Number.MAX_SAFE_INTEGER)`, all
`symInfoFields`, `maxDrawingsPerScript`, `maxLookback`, `maxTickHz`,
`alertConditions(true)`, `logs(true)`, and the interval list. Use the
`capabilities` builders + `union` from
`@invinite-org/chartlang-adapter-kit` — do not hand-build `Set`s.

### 3. Headless default export — `src/defaultAdapter.ts`

Mirror `examples/canvas2d-adapter/src/defaultAdapter.ts`: a frozen
`Adapter` with `id`/`name`/`capabilities`/`symInfo` and no-op
`candles`/`onEmissions`/`dispose` (+ empty `resolveInputs`). Export as the
package `default`. This is what conformance consumes.

### 4. Factory — `src/createLightweightChartsAdapter.ts`

`createLightweightChartsAdapter(opts): LwcAdapterHandle` where
`LwcAdapterHandle = Adapter & { host: ScriptHost }`, following the
canvas2d factory shape (WeakMap-held state, `host` for the worker).

Map to **native** lightweight-charts facilities (do NOT hand-draw). Use
the **v5 unified series API** — `chart.addSeries(SeriesType, options,
paneIndex?)` — not the v4 `addCandlestickSeries()`/`addLineSeries()`
helpers (those were removed in v5). See the repo's own
`docs/adapters/reference/lightweight-charts.md` ("Lightweight Charts 5.2
creates built-in series with `chart.addSeries(...)`"):

- **Candles** → `chart.addSeries(CandlestickSeries)` fed from the `Bar`
  stream in `candles()`/`applyCandleEvent`.
- **Plots** → per `slotId`, create the matching native series:
  - `line` / `step-line` → `addSeries(LineSeries, …)` (`lineType` step for step).
  - `area` → `addSeries(AreaSeries, …)`.
  - `histogram` → `addSeries(HistogramSeries, …)`.
  - `horizontal-line` → a `createPriceLine` on the relevant series.
  - `filled-band` → two line series + the band (LC has no native band;
    emit upper/lower line series; the *fill* between is a drawing handled
    in Task 6 — note this seam).
  - `label`/`marker`/glyph kinds (`shape`/`character`/`arrow`) →
    `createSeriesMarkers(series, [...])` (v5 markers plugin) where LC
    supports it; the rest defer to the Task-6 series-primitive path.
  - **Override/style kinds** (`candle-override`, `bar-override`,
    `bg-color`, `bar-color`, `horizontal-histogram`) — these are part of
    the declared `allPhase5Plots()` surface (see
    `CANVAS2D_PLOT_KINDS`). Map each to the closest native facility
    (e.g. `candlestickSeries.applyOptions(...)` / per-point color, chart
    background option) **or** route to the Task-6 primitive path; for any
    kind with no sensible native mapping, no-op it and **document the
    decision in a comment** so the full-surface claim is honest.
  - **Document which plot kinds are native vs primitive-painted vs
    no-op in a comment.**
- **Sub-panes** → lightweight-charts v5 panes (`chart.addPane()` /
  `series` pane index). Route `PlotEmission.pane` (`"overlay"` | `"new"` |
  string) to pane indices, mirroring canvas2d's `paneOrder`.
- **onEmissions** ingest: validate via `validateEmission`; update series
  data; buffer drawings for Task 6.
- **dispose**: `chart.remove()`.

### 5. Mock library surface (headless test seam) — `src/testing.ts`

lightweight-charts needs a DOM container; for CI we mock its API. Create
`MockLwcApi` (and a `createMockChart()` factory) that records the calls
the factory makes — `addSeries` (with the series-type tag),
`series.setData`, `series.update`, `createPriceLine`,
`createSeriesMarkers`, `addPane`, `remove`, etc. — into a
`RecordedCall[]`, reusing the
`hashCallLog` canonicalisation approach from
`@invinite-org/chartlang-adapter-kit/canvas`. The factory takes an
`opts.chartApi?` test seam (like canvas2d's `opts.ctx`) so tests inject
the mock and production passes a real `createChart(container)`.

### 6. Tests (co-located, 100% coverage)

- `capabilities.test.ts` — full surface asserted.
- `defaultAdapter.test.ts` — headless export shape + frozen.
- `createLightweightChartsAdapter.test.ts` — drive candles + each plot
  kind + hlines + multi-pane through the mock; assert the recorded
  call/hash. Cover the `pane` routing branches and dispose.
- `index.test.ts` — barrel exports.

### Edge cases

- Empty candle stream → factory builds chart, no series data, no throw.
- `filled-band` upper/lower `null` values → skip those points (match
  runtime null semantics).
- Plot `visible: false` (override) → series hidden, not removed.
- `pane: "new"` vs a named pane string → deterministic pane index assignment.
- NaN plot values → LC `whitespace` data point (no line break artefact).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/scaffold.ts` | Modify | append to `PACKAGE_DIRS` |
| `examples/lightweight-charts-adapter/**` (scaffolded) | Create | package skeleton |
| `.../src/capabilities.ts` (+test) | Create | `LWC_CAPABILITIES`, `LWC_SYM_INFO` |
| `.../src/defaultAdapter.ts` (+test) | Create | headless conformance export |
| `.../src/createLightweightChartsAdapter.ts` (+test) | Create | native series/candle/pane factory |
| `.../src/testing.ts` (+test) | Create | `MockLwcApi` recording seam |
| `.../src/index.ts` (+test) | Modify | barrel + `default` export |
| `examples/lightweight-charts-adapter/CLAUDE.md` | Create | adapter invariants (native series map; mock seam; drawings deferred to Task 6) |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (new package 100% coverage)
- `pnpm readme:check` (README ≤ 100 lines)

## Changeset

Example package is private → no public changeset required. If the repo
changesets private packages, add `.changeset/lwc-adapter-scaffold.md`
(patch). No adapter-kit change in this task.

## Acceptance Criteria

- Package scaffolds via `pnpm scaffold`; `PACKAGE_DIRS` updated.
- `default` export passes `runConformanceSuite` (capabilities-only).
- Candles, all plot kinds, hlines, and sub-panes render through native
  lightweight-charts series, verified via `MockLwcApi` hashed tests.
- 100% coverage; README + JSDoc gates green.
- Drawings explicitly deferred to Task 6 (seam documented).

# ECharts adapter: scaffold + series / candles / panes

> **Status: TODO**

## Goal

Scaffold `examples/echarts-adapter/` and implement everything except
drawings: package wiring, full `Capabilities`, headless `DEFAULT_ADAPTER`
conformance export, and the `createEChartsAdapter` factory that maps
chartlang candles + plots + hlines onto ECharts' **native** candlestick /
line / bar series and `grid` sub-panes via `setOption`.

## Prerequisites

- Tasks 1–3 (geometry layer).

## Current Behavior

No ECharts adapter exists.

## Desired Behavior

A private `chartlang-example-echarts-adapter` whose default export passes
conformance and whose factory renders candles + all plot kinds + hlines
via ECharts, ready for drawings (Task 10).

## Requirements

### 1. Scaffold

1. Append `"examples/echarts-adapter"` to `PACKAGE_DIRS`; run `pnpm scaffold`.
2. `package.json` (private, mirror canvas2d): deps adapter-kit + host-worker
   (`workspace:^`) + `echarts` (`^5`); devDeps compiler/core/runtime +
   `@types/node`. Name `chartlang-example-echarts-adapter`, single `.` export.

### 2. Capabilities + headless export

- `src/capabilities.ts` — `ECHARTS_CAPABILITIES` / `ECHARTS_SYM_INFO`,
  full surface via the `capabilities` builders.
- `src/defaultAdapter.ts` — frozen headless `Adapter`, package `default`.

### 3. Factory — `src/createEChartsAdapter.ts`

`createEChartsAdapter(opts): EChartsAdapterHandle` (`= Adapter & { host:
ScriptHost }`), WeakMap-held state. Drive ECharts declaratively by
maintaining an `EChartsOption` and calling `chart.setOption(opt, ...)` on
each emission drain.

- **Candles** → a native `candlestick` series on a `time`/`value` axis
  pair, data from the `Bar` stream.
- **Plots** → per `slotId`:
  - `line` / `step-line` → `line` series (`step: 'end'` for step).
  - `area` → `line` series with `areaStyle`.
  - `histogram` / `horizontal-histogram` → `bar` series.
  - `filled-band` → two line series + a stacked/`areaStyle` band.
  - `horizontal-line` → a `markLine` on the series.
  - `label`/`marker`/glyph → `markPoint` / `scatter` where native; the
    rest defer to the Task-10 `graphic` path. Document native-vs-graphic.
- **Sub-panes** → multiple ECharts `grid`s sharing the x axis (one grid
  per `PlotEmission.pane`), mirroring canvas2d's `paneOrder`.
- **onEmissions** ingest → `validateEmission`; rebuild the relevant series
  data; buffer drawings for Task 10.
- **dispose** → `chart.dispose()`.

### 4. Mock library surface — `src/testing.ts`

ECharts needs a DOM container + sizing. Provide `MockECharts` capturing
the `EChartsOption`s passed to `setOption` (and `dispose`) into a
`RecordedCall[]`, hashed via `hashCallLog` from
`@invinite-org/chartlang-adapter-kit/canvas`. The factory takes an
`opts.echartsFactory?` seam (like canvas2d's `opts.ctx`) so tests inject
the mock and production passes `echarts.init(container)`. Assert the
emitted option tree (series kinds, grid count, data) — not pixels.

### 5. Tests (100% coverage)

- `capabilities.test.ts`, `defaultAdapter.test.ts`, `index.test.ts`.
- `createEChartsAdapter.test.ts` — drive candles + each plot kind + hlines
  + multi-grid through the mock; assert the recorded `setOption` trees.

### Edge cases

- Empty data → valid base option, no throw.
- `filled-band` null bounds → gap.
- NaN plot values → ECharts `'-'` empty value (line gap).
- Plot `visible: false` → series omitted/hidden, not deleted from state.
- Deterministic grid index per pane key (overlay grid index 0).
- **Override/style plot kinds** (`candle-override`, `bar-override`,
  `bg-color`, `bar-color`) are part of the declared `allPhase5Plots()`
  surface (mirrors `CANVAS2D_PLOT_KINDS`; `horizontal-histogram` is
  already covered by the `bar` series above). Map each to the closest
  ECharts facility (per-point `itemStyle`, the chart `backgroundColor`,
  `visualMap`) or no-op it with a documented comment — do not silently
  drop them.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/scaffold.ts` | Modify | append `PACKAGE_DIRS` |
| `examples/echarts-adapter/**` (scaffolded) | Create | skeleton |
| `.../src/capabilities.ts` (+test) | Create | full caps |
| `.../src/defaultAdapter.ts` (+test) | Create | headless export |
| `.../src/createEChartsAdapter.ts` (+test) | Create | native series/grid factory |
| `.../src/testing.ts` (+test) | Create | `MockECharts` option-recorder |
| `.../src/index.ts` (+test) | Modify | barrel + default |
| `examples/echarts-adapter/CLAUDE.md` | Create | invariants (declarative setOption; grid panes; graphic drawings deferred) |

## Gates

- `pnpm typecheck` / `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm readme:check`

## Changeset

Private example → no public changeset (patch if repo changesets privates).

## Acceptance Criteria

- Scaffolds via `pnpm scaffold`; `PACKAGE_DIRS` updated.
- Default export passes conformance.
- Candles + all plot kinds + hlines + multi-grid panes render via native
  ECharts series, verified by `MockECharts` option-tree tests.
- 100% coverage; README + JSDoc gates green.
- Drawings deferred to Task 10 (graphic seam documented).

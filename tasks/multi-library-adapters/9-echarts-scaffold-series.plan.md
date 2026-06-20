# Plan — Task 9: ECharts adapter scaffold + series / candles / panes

## Context

Implement `examples/echarts-adapter/` EXCEPT drawings (drawings = Task 10).
Render chartlang candles + every plot kind + horizontal-lines + multi-pane
sub-grids onto ECharts **native** series via a declarative
`chart.setOption(option, …)` per emission drain. The package is the fourth
full-surface example adapter, mirroring `examples/canvas2d-adapter/` in shape
(library package + test seam + capabilities-only conformance default export),
headless and CI-gateable.

Geometry/decomposition lives in `@invinite-org/chartlang-adapter-kit` (Tasks
1–3, COMPLETE). ECharts does NOT consume the canvas sink — candles/series/panes
use ECharts' native facilities; drawings (Task 10) will use the `graphic` path.

## Pre-existing work (do NOT redo)

- Package scaffolded (six-file §22.4 template present:
  `package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`,
  `src/index.ts`, `src/index.test.ts`).
- Registered in `pnpm-workspace.yaml`; `package.json` deps already present
  (`adapter-kit` + `host-worker` `workspace:^`, `echarts` `^5`; devDeps
  `compiler`/`core`/`runtime` + `@types/node`). `pnpm install` already run —
  `node_modules/echarts -> echarts@5.6.0` symlink confirmed.
- ECharts type surface validated: `init`, `EChartsType` (instance with
  `setOption(option, opts?)` + `dispose()` + `resize()`), `EChartsOption`,
  `CandlestickSeriesOption`, `LineSeriesOption`, `BarSeriesOption`,
  `ScatterSeriesOption`, `GridOption`, `XAXisOption`, `YAXisOption`,
  `MarkLineOption`, `MarkPointOption` all exported from `echarts`.

## Validated references

- `capabilities` builders + `union`, `PHASE_5_PLOT_KINDS`,
  `allPhase3Drawings()`, `intervals`/`multiTimeframe`/`subPanes`/
  `symInfoFields`/`maxDrawingsPerScript`/`alertConditions`/`logs` —
  `@invinite-org/chartlang-adapter-kit` (verified in capabilities.ts).
- `defineAdapter`, `validateEmission`, `mockCandleSource`, all emission +
  `Capabilities` + `Adapter` + `AdapterSymInfo` types — adapter-kit barrel.
- `ScriptHost`, `createWorkerHost`, `WorkerLike` — `host-worker`.
- `Bar` — `chartlang-core`.
- `hashCallLog` exists at `@invinite-org/chartlang-adapter-kit/canvas` but is
  typed `ReadonlyArray<RecordedCall>` (canvas-call union) — see Issues §1.

## Issues found

1. **`hashCallLog` cannot type-check an ECharts option tree.** The public
   `hashCallLog(calls: ReadonlyArray<RecordedCall>)` switches over
   canvas-specific call kinds; ECharts `setOption` trees are arbitrary
   `EChartsOption` objects, not `RecordedCall`s. The sibling LC task (§) words
   this as "reusing the **canonicalisation approach**", and the konva task
   (records arbitrary node config) reads the same way. Resolution: implement a
   local `hashOptionLog(calls)` in `src/testing.ts` that mirrors the EXACT
   canonicalisation (canonical-key JSON + 4-dp finite-float rounding +
   SHA-256), applied to the recorded `RecordedOptionCall[]`. Primary test
   assertions inspect the option tree structurally (the task's stated
   priority: "Assert the emitted option tree … not pixels"); the hash is a
   secondary stable pin. **Deviation flagged to team lead.** (No way to call
   the canvas `hashCallLog` on option trees without an `as`-cast through
   `unknown`, which the conventions forbid.)

## Improvements (reuse-first)

- Capabilities mirror `CANVAS2D_CAPABILITIES` exactly via the builders +
  `union`, declaring the FULL drawing set now (Task 10 implements them) so the
  adapter is interchangeable and conformance covers the whole surface.
- Plot dispatch keyed on `plot.style.kind` mirrors canvas2d's `applyPlot`
  partition (series kinds vs hline vs glyph/overlay vs candle-state override).
- Pane→grid index map mirrors canvas2d's `paneOrder` (overlay = index 0).

## Declarative ECharts mapping (per drain → one `setOption(opt, { notMerge: true })`)

- **Candles** → `candlestick` series, data `[open, close, low, high]` per bar,
  category x-axis of bar times, on grid 0 / xAxisIndex 0 / yAxisIndex 0.
- **line / step-line** → `line` series (`step: 'end'` for step-line),
  `connectNulls: false`; NaN/`null` value → `'-'` (ECharts gap).
- **area** → `line` series + `areaStyle`.
- **histogram / horizontal-histogram** → `bar` series (horizontal-histogram is
  the bar arm per task note; one `bar` series covers both).
- **filled-band** → two `line` series (`lower`, `upper`) where `upper` stacks
  on `lower` via `stack` + `areaStyle` (the band); `null` bound → `'-'` gap.
- **horizontal-line** → a `markLine` (`yAxis` value) attached to a hidden
  carrier `line` series in the hline's pane.
- **shape / marker / character / arrow / label** → native where possible:
  `scatter` (shape/marker) + `markPoint` (label/character/arrow as labelled
  symbols). Glyph kinds not natively expressible defer to the Task-10
  `graphic` path — documented per kind.
- **candle-override / bar-override / bar-color** → per-point `itemStyle` on the
  candlestick series at that bar (documented). **bg-color** → chart
  `backgroundColor` (last-write-wins; documented). These never create a series.
- **Sub-panes** → one ECharts `grid` per `paneOrder` key (overlay = grid 0),
  each with its own x/y axis pair sharing the bar-time categories; series route
  to their pane's grid/axis indices, mirroring canvas2d `paneOrder`.
- **visible: false** → series omitted from the option tree but the slot stays
  in state (not deleted), so re-enabling re-emits it.
- **Empty data** → a valid base option (empty `series`, single grid) — no throw.
- **dispose** → `chart.dispose()` + state reset.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/capabilities.ts` (+ `.test.ts`) | Create | `ECHARTS_CAPABILITIES` / `ECHARTS_SYM_INFO` full surface via builders + union |
| `src/defaultAdapter.ts` (+ `.test.ts`) | Create | frozen headless `DEFAULT_ADAPTER`, package default |
| `src/createEChartsAdapter.ts` (+ `.test.ts`) | Create | `EChartsAdapterHandle = Adapter & { host: ScriptHost }`; WeakMap state; declarative `setOption` mapping; `runRendererLoop` |
| `src/testing.ts` (+ `.test.ts`) | Create | `MockECharts` (records `setOption`/`dispose` calls); `RecordedOptionCall`; `hashOptionLog` |
| `src/index.ts` | Modify | barrel + default export |
| `src/index.test.ts` | Modify | assert barrel surface |
| `examples/echarts-adapter/CLAUDE.md` | Create | invariants (declarative setOption; grid panes; default-export-is-capabilities-only; drawings deferred to Task 10) |
| `README.md` | Modify | §17.1 structure, ≤100 lines, real public surface |
| `9-echarts-scaffold-series.plan.md` | Create | this file |

## Coverage strategy

canvas2d's `vitest.config.ts` excludes `index.ts` + `types.ts` only; the
scaffolded echarts `vitest.config.ts` is identical. The `setOption`-driven
factory is fully covered by driving the `MockECharts` seam (`opts.echartsFactory`)
through every plot-kind branch + multi-grid + dispose + the `runRendererLoop`
abort/foreign-handle branches — mirroring canvas2d's mock-`ctx` coverage of its
render code. No browser/jsdom. The integration-style test compiles an inline
literal `{ manifest, compute }` bundle through a `MessageChannel` worker (the
canvas2d integration pattern) to exercise the real ingest path.

## Conventions

- MIT header on every new `.ts`. No `any` / no `!` / no incompatible `as`.
  `import type` for type-only imports.
- Consume shared surface ONLY via `@invinite-org/chartlang-adapter-kit` (+
  `/canvas` if needed) and `host-worker` public boundaries — never cross-import
  another example's `src`.
- JSDoc with `@example` + `@since` + stability marker on every export.
- Private example package → NO changeset.

## Gates

- `pnpm --filter chartlang-example-echarts-adapter test` (100% coverage) —
  run sparingly.
- Final: `pnpm typecheck`, `pnpm lint`, `pnpm readme:check` reported to lead
  (lead runs full-workspace gates).

## Deviations (as implemented)

1. **`hashOptionLog` (local) instead of canvas `hashCallLog`.** Per Issue §1
   — the public `hashCallLog` is typed against the canvas `RecordedCall`
   union and cannot accept ECharts `EChartsOption` trees without an `as`-cast
   through `unknown` (forbidden). `src/testing.ts` ships a local `hashOptionLog`
   mirroring the exact canonicalisation approach (sorted-key JSON + 4-dp
   finite-float rounding + SHA-256), matching the LC task's "reuse the
   canonicalisation approach" wording. The integration test pins a golden hash.
2. **`echarts` types imported from the `echarts/types/dist/echarts` subpath**
   (in the package's official `exports` map). The `.` entry is an `export =`
   namespace, which `verbatimModuleSyntax` rejects for a named `import type`.
3. **Added `./testing` subpath to this package's `package.json#exports`**
   (mirroring canvas2d) so `MockECharts` / `hashOptionLog` are importable.
   No `scripts/scaffold.ts` edit (out of scope; per orchestrator).
4. **No dep added** — `echarts` + workspace deps were already present.
5. `readme-check.ts` only gates `packages/*` + `examples/canvas2d-adapter`,
   so it does NOT check this package's README (left to Task 13/15 wiring) —
   the README still follows §17.1 and is 86 lines.

## Acceptance checklist

- [ ] Default export passes conformance (capabilities-only headless adapter).
- [ ] Candles + every plot kind + hlines + multi-grid render via native
      ECharts series, verified by `MockECharts` option-tree assertions.
- [ ] Edge cases: empty data, filled-band null bounds gap, NaN→`'-'`,
      visible:false omits-not-deletes, deterministic grid index per pane.
- [ ] Override/style kinds (candle-override / bar-override / bg-color /
      bar-color) mapped to itemStyle / backgroundColor, not dropped.
- [ ] 100% coverage; README ≤100 lines; JSDoc gates green.
- [ ] CLAUDE.md documents invariants + Task-10 graphic seam deferral.

# examples/

Reference / demo artefacts that ship alongside the published
`@invinite-org/chartlang-*` packages but are **not themselves
published to npm**.

## Layout

- `examples/canvas2d-adapter/` — `chartlang-example-canvas2d-adapter`,
  the Phase-1 reference adapter. Private package
  (`"private": true`); intended to be copied as the starting point
  for a consumer-repo adapter. Exposes a default export that the
  Task-12 conformance suite consumes (capabilities-only;
  `candles`/`onEmissions`/`dispose` are no-ops).
- **Six bundled example adapters total** — `canvas2d-adapter` (the
  coverage-gated reference), the four library adapters
  (`lightweight-charts-adapter`, `uplot-adapter`, `echarts-adapter`,
  `konva-adapter`), and `webgl-adapter`
  (`chartlang-example-webgl-adapter`), a zero-dependency raw WebGL2 GPU
  renderer like canvas2d. All six are baked into the CLI bundle
  (`scripts/adapters/registry.ts` SSOT), wired into the react-starter
  seam + create-chartlang installer + apps/site demo, and run through the
  shared conformance suite. Only `canvas2d-adapter` is in the 100%
  coverage gate; the other five have tests but no coverage gate.
- `examples/scripts/` — author-style example `.chart.ts` files,
  compiled end-to-end by `packages/cli/src/e2e.test.ts` and driven
  through the runtime by `packages/conformance/src/scenarios/` and
  `examples/canvas2d-adapter/src/integration.test.ts`. The Phase-1
  seed is `ema-cross.chart.ts`, `bollinger-bands.chart.ts`, and
  `rsi-divergence-alert.chart.ts`; later phases add the `draw.*`,
  Pine-port, composition, and multi-timeframe samples. The MTF sample
  `htf-trend-filter.chart.ts` overlays a current-timeframe EMA plus a
  true weekly trend via the `request.security` **expression form**
  (`request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20))`,
  so the EMA runs on the weekly clock) — its runtime test feeds a synthetic
  1W secondary stream via `createMultiStreamCandlePump`. The single-timeframe `sma-offset
  .chart.ts` sample overlays an unshifted `ta.sma(bar.close, 20)` line
  plus a `+5` copy displaced right and a `−5` copy displaced left via the
  universal `ta` `offset` option — a presentation-only display shift
  (`xShift` on the emission; the values stay unshifted). The `pivot-high-ray.chart.ts` sample tracks the
  latest `ta.pivotsHighLow` swing high in `state.*` slots and draws one
  reused `draw.horizontalRay` from it, anchoring the pivot's timestamp
  with `bar.point(-5, …)`. The `fill-between-band.chart.ts` sample
  accumulates a fast/slow EMA pair into two persistent edge arrays and
  re-emits one `draw.fillBetween(edgeA, edgeB, …)` per bar — the native
  filled ribbon (Pine `linefill`/`fill()` equivalent). The
  `anchored-line.chart.ts` sample composes both X-axis anchor styles in one
  `draw.line` — an absolute-time start (first bar's `bar.time`/`bar.close`
  pinned in `state.*`) to a bar-index end (`bar.point(0, …)`). The
  `z-layering.chart.ts` sample demonstrates the presentation-only `z`
  render-order key: a `draw.fillBetween` band given `z: -1` so it renders
  **behind** the price `plot` (a drawing beneath a plot, which the default
  group stack forbids), plus an SMA at `z: 1` on top. The
  `bgcolor-barcolor.chart.ts` sample demonstrates the Pine-ergonomic
  `barcolor` / `bgcolor` emitters: `barcolor` tints each candle by its own
  up/down direction and `bgcolor` washes the pane background by trend regime
  (price vs `ta.ema(bar.close, 50)`) with a `transp` transparency — both lower
  to the same emission as the verbose
  `plot(NaN, { style: { kind: "bar-color" | "bg-color" } })` form.

## Phase-1 scope

- The three scripts under `scripts/` are the Phase-1 conformance
  seed. Each one exercises a stateful primitive that Task 12's
  scenario pins against the 10 000-bar `goldenBars.json` fixture.
- `examples/canvas2d-adapter`'s default export is exactly what
  `scripts/run-conformance.ts` auto-imports — the adapter's
  `capabilities` field is the test surface, not its renderer.

## Deferred (Phase 3+)

- `examples/scripts/fib-retracement.chart.ts` — deferred to Phase 3
  alongside the `draw.*` namespace and 61-entry `DrawingKind` union.
  The Phase-1 example surface intentionally ships three scripts only;
  the fib script would require drawing primitives that don't land
  until Phase 3.

## Convention notes

- **Scripts must use top-level imports AND destructured params
  together.** The pattern is:
  ```ts
  import { defineIndicator, ta, plot, alert } from "@invinite-org/chartlang-core";
  export default defineIndicator({
      apiVersion: 1,
      compute({ bar, ta, plot, alert }) { /* destructured impls */ },
  });
  ```
  The top-level imports give the compiler's `extractCapabilities`
  pass the named-import signal it needs; the destructured params
  give the runtime its slot-aware implementations (per the runtime's
  `buildComputeContext.ts`). The compiler's `resolveCallee` matches
  destructured params whose type comes from core's `ComputeContext`
  — see `packages/compiler/src/transformers/resolveCallee.ts`.

# examples/scripts/

Example `.chart.ts` scripts compiled by `packages/cli/src/e2e.test.ts`.

## Shipped scripts

- Phase 1 ships `ema-cross.chart.ts`, `bollinger-bands.chart.ts`, and
  `rsi-divergence-alert.chart.ts`.
- Phase 3 ships `fib-retracement.chart.ts` for the `draw.*` namespace.
- Phase 4 ships `session-high-alert.chart.ts` for `state.float` +
  `barstate.isfirst`, `daily-rsi-divergence.chart.ts` for
  `timeframe.isdaily` + `input.interval`, and
  `mintick-snapped-entry.chart.ts` for `syminfo.mintick` snapping.
- Phase 7 ships `base-trend.chart.ts` (producer with one titled output)
  and `trend-confirmation.chart.ts` (multi-export consumer — one private
  dep `fastTrend`, one drawn named export `slowTrend`, one default
  consumer reading both). The CLI's e2e test asserts the single-script
  vs multi-export sidecar shapes both round-trip.
- `htf-trend-filter.chart.ts` demonstrates the multi-timeframe
  `request.security` **expression form**: a current-timeframe
  `ta.ema(bar.close, 20)` plus a true weekly trend
  `request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20))` —
  the EMA runs on the weekly clock (~140 days), NOT 20 main bars of a
  weekly-stepped series (the data-form bug). Its
  `manifest.requestedIntervals` is `["1W"]` and
  `manifest.securityExpressions` carries one unit (asserted by the CLI e2e
  test). The runtime path is exercised by
  `examples/canvas2d-adapter/src/integration.test.ts` ("renders the
  htf-trend-filter example…" + the history-batch demo path), which drives it
  through `createMultiStreamCandlePump` with a synthetic 1W secondary stream
  (25 weekly bars so the EMA(20) warms). The hand-written
  `phase4ModuleSource` htf branch reads the security-expr + plot slot ids off
  the LIVE `compiled.manifest` so they can never drift from the fresh compile
  (the runner registry dispatch keys on `securityExpressions[*].slotId`). The
  plot title is `Weekly EMA(20)`.
- `sma-offset.chart.ts` demonstrates the universal `ta` `offset` option:
  two `ta.sma(bar.close, 20)` lines on the candles, the second built with
  `{ offset: 5 }` so its `.current` reads the SMA value from 5 bars ago
  (the shift lives on the `ta` call — `plot` has no offset). Its runtime
  path is exercised by `examples/canvas2d-adapter/src/integration.test.ts`
  ("renders the sma-offset example…").
- `pivot-high-ray.chart.ts` demonstrates persistent `state.*` slots +
  `bar.point`: it tracks the most recent `ta.pivotsHighLow` swing high's
  price and time (the time recovered via `bar.point(-5, …)`, the offset-
  anchored historical timestamp — the literal `-5` matches `rightLength`
  and sizes the lookback buffer), then draws one `draw.horizontalRay`
  reused across bars so the single ray follows each new pivot. Compile-
  only in the CLI e2e gate (like `fib-retracement.chart.ts`); it is not
  in the integration render test.
- `forecast-line.chart.ts` demonstrates the POSITIVE (future)
  `bar.point(+N, …)` offset: it reads the EMA(20) slope from the last
  20 bars (`trend[0] - trend[LOOKBACK]`) and draws one reused
  `draw.line` from `bar.point(0, …)` to `bar.point(+20, …)`, where the
  forward offset resolves to an extrapolated future timestamp
  (`lastTime + 20 * spacing`) so the dotted line projects to the RIGHT
  of the last candle. Negative + current offsets are covered by
  `pivot-high-ray.chart.ts`; this is the future path. Compile-only in
  the CLI e2e gate (like `pivot-high-ray.chart.ts`); it is not in the
  integration render test.
- `fill-between-band.chart.ts` demonstrates `draw.fillBetween` — the
  native filled ribbon between two edges (Pine's `linefill` / `fill()`
  equivalent). It accumulates one `{ time, price }` vertex per bar into
  two module-level edge arrays (a fast EMA(12) top and a slow EMA(26)
  bottom), then re-emits one `draw.fillBetween(fastEdge, slowEdge, …)`
  from a fixed callsite every bar so the runtime merges each re-emission
  into one persistent ribbon (the same per-bar-re-emit idiom as
  `pivot-high-ray`/`forecast-line` — NOT `handle.update`). The band sits
  in the `polylines` budget bucket (`maxDrawings.polylines: 1`).
  Compile-only in the CLI e2e gate; it is not in the integration render
  test.

## Conventions

- Every script carries the two-line MIT header at the top — same as
  workspace package sources.
- Each script default-exports exactly one `defineIndicator({ ... })`
  with `apiVersion: 1`. `defineAlert` / `defineDrawing` exports are
  Phase 2+ and are NOT shipped here yet.
- Scripts use **both** top-level imports AND the destructured
  `compute({ ta, plot, alert })` argument. The top-level imports
  let the compiler's `extractCapabilities` pass walk the named-
  import set; the destructured params let the runtime hand the
  script its slot-aware `ta`/`plot`/`alert`/`hline` impls (via
  `buildComputeContext.ts`). The compiler's `resolveCallee`
  pattern-matches destructured params whose type comes from core's
  `ComputeContext`, so callsite-id injection works for the
  destructured calls.
- These files are user-author-style sources, not workspace package
  source. They are excluded from `docs-check.ts` and from per-package
  coverage gates by design — the CLI's e2e test is their gate.
- Adding, renaming, or removing a script requires updating the path
  list in `packages/cli/src/e2e.test.ts`. Runtime-rendered examples
  also belong in `examples/canvas2d-adapter/src/integration.test.ts`.

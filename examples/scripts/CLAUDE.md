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
- `sma-offset.chart.ts` demonstrates the universal `ta` `offset` option as
  a bidirectional presentation display shift: an unshifted
  `ta.sma(bar.close, 20)` line plus a `+5` copy displaced RIGHT (future)
  and a `−5` copy displaced LEFT (past). `offset` rides the plot emission
  as a signed `xShift`; the numeric value stays unshifted (the shift lives
  on the `ta` call — `plot` has no offset). Plot titles are `SMA(20)`,
  `SMA(20) +5`, `SMA(20) −5`. Its runtime path is exercised by
  `examples/canvas2d-adapter/src/integration.test.ts` ("renders the
  sma-offset example…"), which asserts the `+5`/`−5` emissions carry
  `xShift: 5` / `xShift: -5`.
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
- `anchored-line.chart.ts` demonstrates the TWO X-axis anchor styles
  composing in one `draw.line`: the START is an ABSOLUTE-time anchor — a
  literal `{ time, price }` built from the first bar's `bar.time`/`bar.close`
  captured once into `state.*` slots (`NaN` sentinel for "not captured yet")
  — and the END is a BAR-INDEX anchor via `bar.point(0, bar.close)` (offset 0
  == the live bar). Re-emitting from the same callsite every bar reuses one
  line handle, so the head stays pinned to the first bar's time while the tail
  tracks the current bar. The companion offset-only examples are
  `pivot-high-ray.chart.ts` (negative/current `bar.point`) and
  `forecast-line.chart.ts` (positive `bar.point`); this one pins the
  absolute-time ↔ bar-index interaction. **Stores `bar.close[0]` (the indexed
  scalar), NOT `bar.close`** into the `state.*` price slot — `bar.close` is a
  Series VIEW object, so persisting it directly makes the drawing's price
  anchor non-finite and the runtime drops the line as a `malformed-emission`
  (the end anchor escapes this only because `bar.point` coerces via `Number`).
  Exercised by `examples/canvas2d-adapter/src/integration.test.ts` ("renders
  anchored-line…"), which asserts the line survives validation and the start
  anchor is pinned to the first bar — a render regression test, since the CLI
  e2e gate is compile-only and would not catch the malformed drop.
- `z-layering.chart.ts` demonstrates the presentation-only `z`
  render-order key: it builds a fast/slow EMA(12)/EMA(26) ribbon exactly like
  `fill-between-band.chart.ts`, then gives the `draw.fillBetween` call
  `{ z: -1 }` so the fill renders **behind** the `plot(bar.close)` price line
  (a drawing beneath a plot — which the default group stack, drawings-above-
  plots, forbids), plus an `SMA(20)` plot at `z: 1` on top to prove `z`
  crosses bands both ways. The `SMA(20)` plot is declared **first** (before
  `plot(bar.close)`) ON PURPOSE: the default "last plot wins" stack would put
  it at the BOTTOM, so `z: 1` lifting it back on top is what actually proves
  `z` does something — if it were plotted last it would sit on top by default
  and `z` would be a no-op. `z: 0` (the default) is byte-identical to omitting
  it; the option never touches `value`/alerts/`state.*`. Compile-only in the
  CLI e2e gate (like `fill-between-band.chart.ts`); not in the integration
  render test. Mirrored by the `z-layering` `DEMO_SCRIPTS` entry.
- `rolling-window-mean.chart.ts` demonstrates the persistent **collection**
  primitive `state.array<number>(capacity)`: it pushes one `bar.close` per bar
  into a 20-slot FIFO ring and averages the ELEMENTS in a bounded `for` loop
  (literal bound `< 20` + an inner `if (i < win.size)` guard, since
  `push`/`get` are handle methods legal inside a loop — only the allocation
  call is the registry callsite). This is the "bounded bag of the last K pushed
  values" idiom that `state.series` (one value's bar history, see
  `up-streak.chart.ts`) can't express. Compile-only in the CLI e2e gate; not in
  the integration render test. Mirrored by the `rolling-window-mean`
  `DEMO_SCRIPTS` entry.
- `rolling-zscore.chart.ts` demonstrates the `state.array` numeric **reductions**:
  it pushes one `bar.close` per bar into a 20-slot window and computes a z-score
  `(close − win.avg()) / win.stdev()`, showing BOTH call styles — `win.avg()`
  (the handle method) and `array.stdev(win)` (the Pine-parity free-function alias
  that delegates 1:1, imported module-scope from core, NOT destructured in
  `compute`). The reductions skip NaN and return NaN on an empty window, so the
  divide is guarded while the window warms. `overlay: false` (a z-score is an
  oscillator). Compile-only in the CLI e2e gate; not in the integration render
  test. Mirrored by the `rolling-zscore` `DEMO_SCRIPTS` entry.
- `symbol-ratio.chart.ts` demonstrates the multi-symbol
  `request.security({ symbol, interval })` form: it reads two DIFFERENT
  instruments (`AMEX:SPY` and `NASDAQ:QQQ`) at the chart interval and plots
  their close ratio. The `symbol` must be a compile-time literal (string
  literal / `input.symbol` / `input.enum`), and a non-chart symbol requires the
  adapter's `multiSymbol` capability — otherwise each series degrades to all-NaN
  with one `multi-symbol-not-supported` diagnostic. Reads `.close.current` for
  the live scalar because `SecurityBar.close` is a `Series<Price>` (indexable,
  NOT number-coercible), so a raw `spy.close / qqq.close` would not type-check.
  Compile-only in the CLI e2e gate; not in the integration render test. Mirrored
  by the `symbol-ratio` `DEMO_SCRIPTS` entry (which the demo drives against a
  synthetic second-symbol stream via `createMultiSymbolCandlePump`).
- `weekday-close-filter.chart.ts` demonstrates the calendar accessor
  `time.dayofweek`: it plots `bar.close` only on weekdays
  (`time.dayofweek(bar.time) >= 2 && <= 6`, Pine's `1=Sun..7=Sat`), else `NaN`,
  so the line breaks across each weekend. Calendar fields come from `bar.time`
  (UTC ms epoch) through the host-owned accessors — never `Date`/`Intl`
  (forbidden on the author path). It deliberately does **not** use
  `session.isOpen` / `input.session`: the demo's `bars.json` fixture is daily
  candles all timestamped ~22:13 UTC (one time-of-day), so any session window
  is trivially all-open or all-closed and could not discriminate bar-to-bar.
  The session accessors from the same X-task are exercised instead by the
  conformance scenarios (`calendarSession`, `taSessionVolumeProfile`), which
  use intraday fixtures. Compile-only in the CLI e2e gate; not in the
  integration render test. Mirrored by the `weekday-close-filter`
  `DEMO_SCRIPTS` entry.
- `bgcolor-barcolor.chart.ts` demonstrates the Pine-ergonomic `barcolor` /
  `bgcolor` color emitters: `barcolor(bar.close.current > bar.open.current ? … : …)`
  tints each candle by its own up/down direction, and
  `bgcolor(bar.close.current > trend.current ? … : …, { transp: 85 })` washes the
  pane background by trend regime (price vs `ta.ema(bar.close, 50)`). Both
  evaluate their color expression per bar and lower to the same emission as the
  verbose `plot(NaN, { style: { kind: "bar-color" | "bg-color", color, transp } })`
  form; `bgcolor` carries the `transp` (0 opaque … 100 transparent) opt, `barcolor`
  has none. Adapters render them only when their `Capabilities.plots` include the
  `bar-color` / `bg-color` kinds (a silent no-op otherwise). Compile-only in the
  CLI e2e gate; not in the integration render test. Mirrored by the
  `bgcolor-barcolor` `DEMO_SCRIPTS` entry.
- `tick-snapped-levels.chart.ts` demonstrates the chart-aware `math.*`
  namespace: it computes a support/resistance band around the close from a
  `bandPercent` input and snaps each edge to the symbol's tick grid with
  `math.roundToMintick(level, syminfo.mintick)` before drawing it as a
  `draw.horizontalLine`. `math` is a **module-scope import** (NOT a `compute`
  field — do not destructure it); `syminfo` IS the `compute` field supplying the
  tick size. Distinct from `mintick-snapped-entry.chart.ts`, which PLOTS a
  single snapped target rather than snapping multiple levels into drawings.
  Bare `Math.*` stays available — the namespace only adds the extras `Math`
  lacks. Compile-only in the CLI e2e gate; not in the integration render test.
  Mirrored by the `tick-snapped-levels` `DEMO_SCRIPTS` entry and proven
  byte-stable across adapters by the `math-round-to-mintick` conformance
  scenario.
- `math-scalar-band.chart.ts` is the comprehensive `math.*` companion to
  `tick-snapped-levels` (which shows only `roundToMintick`): it builds a
  direction-aware band around the bar's typical price from the pure scalar
  reducers — `math.avg` / `math.sum` (variadic skip-NaN), `math.clamp`
  (bound the half-width), `math.sign` (candle direction), `math.roundTo`
  (snap the midline to cents), and an `math.nz` guard — exercising
  `math.{nz,clamp,avg,sum,sign,roundTo}`. `math` is a **module-scope import**
  (NOT a `compute` field); `plot` is top-level imported AND destructured.
  Compile-only in the CLI e2e gate; not in the integration render test.
  Mirrored by the `math-scalar-band` `DEMO_SCRIPTS` entry.
- `str-label-builder.chart.ts` is the comprehensive `str.*` companion to
  `str-formatted-hud` (which shows only `tostring` / `format` / `upper`): a
  `draw.table` watchlist HUD whose rows are sanitized and formatted entirely
  with the string namespace — `str.split` the comma list, `str.trim` each
  token, `str.replace` a leading hash, `str.substring` + `str.upper` for a
  3-char code, `str.startsWith` / `str.contains` to flag, and `str.repeat`
  for a bullet divider — exercising `str.{split,contains,startsWith,replace,
  trim,substring,repeat}`. `str` is a **module-scope import** (NOT a `compute`
  field); `input` / `draw` are top-level imported AND destructured. The
  `str.split(...).map(...)` row build is plain JS array work (only stateful
  `ta.*` / `draw.*` calls are loop-restricted), so the mapped `str.*` calls
  run freely. Compile-only in the CLI e2e gate; not in the integration render
  test. Mirrored by the `str-label-builder` `DEMO_SCRIPTS` entry.

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
- **Most scripts here are mirrored by a same-`id` `DEMO_SCRIPTS` entry**
  in `apps/site/src/components/demo/scripts.ts` (the inlined demo / docs
  copy). `pnpm examples:sync` token-compares the two and fails CI on code
  drift (comments / whitespace / wrapping / trailing commas are ignored).
  When you change a mirrored script's CODE, change BOTH copies in the same
  PR, then re-run `pnpm examples:generate`. Scripts with no demo entry
  (e.g. `base-trend`, `fib-retracement`) are skipped by the gate.

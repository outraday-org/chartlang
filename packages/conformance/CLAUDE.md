# packages/conformance/

`@invinite-org/chartlang-conformance` — adapter conformance suite.
Drives every Phase-1 example script through the compiler + runtime
against a target adapter's declared `capabilities` and asserts pinned
plot hashes, alert counts, and diagnostic codes.

## Invariants

- **`fixtures/goldenBars.json` lives OUTSIDE `src/`.** The 10 000-bar
  JSON would otherwise count as uncovered "code" against the §16.1
  100% coverage thresholds. The fixture is shipped as a sibling of
  `src/` (and the package's `files` array carries it) so consumers
  installing the package via `dist/` still get the canonical bars.
  Per-package `vitest.config.ts` explicitly excludes `fixtures/**` in
  addition to the §16.1 defaults.
- **Bundle execution goes through a tmp file under `.cache/`, not a
  `data:` URL.** The compiler's `bundle.ts` emits ESM with
  `import { defineIndicator } from "@invinite-org/chartlang-core"`
  retained; a `data:` URL cannot resolve workspace bare specifiers.
  `runConformanceSuite` writes the bundle to
  `packages/conformance/.cache/<scenarioId>-<rand>.mjs`, dynamically
  `import()`s it via `file://`, and `rm`s the file in a `finally`
  block. Do not "optimise" this into a `data:` URL — the test
  fixtures would silently break for any script that exercises a
  workspace primitive.
- **`plot-hash` SHA-256 covers `{ bar, value }` tuples in JSON-
  stringified emission order.** Adding fields to the tuple (e.g.
  `time`, `color`) would invalidate every pinned hash. The hash is
  deterministic across runs because §6.4 pins runtime emission order
  per bar.
- **Scenario assertion arrays are pinned via the first deterministic
  run.** The runner returns `expected` vs `actual` in every failure
  message — re-pin by copying the `actual` hash into the scenario
  constant when the math intentionally changes (gate behind a
  `BREAKING:` changeset per §16.6). The pinning workflow does not
  need a separate "regenerate" script; the failure-message text
  suffices.
- **`runConformanceSuite` reads `adapter.capabilities` only.** It
  does not drive `adapter.candles` or call `adapter.onEmissions`.
  The runner owns the candle iteration + emission buffer so the
  test surface is exactly the runtime ↔ capability-bag contract,
  not the rendering pipeline. The canvas2d default export is a
  no-op `Adapter` for the same reason — spinning up a Worker host
  + canvas renderer would be wasted work for an emission-contract
  test.
- **Pane routing is exercised by the `rsi-subpane-routing`
  scenario.** Scripts declaring `defineIndicator({ overlay: false })`
  emit on the script-level default pane key (`script:<sanitised-name>`);
  the scenario asserts every `PlotEmission.pane` equals that key (via the
  `all-plots-on-pane` variant) and **no** `unsupported-pane` diagnostic
  is pushed against an adapter declaring `subPanes >= 1` (the canvas2d
  reference). Adapters declaring `subPanes: 0` instead see the
  `unsupported-pane` warning + the overlay fold — exercised by
  `runConformanceSuite.test.ts` against a synthetic `pane: "new"` script
  under a `subPanes: 0` capability bag.
- **`assertions: ReadonlyArray<ScenarioAssertion>` is declared
  ABOVE each `Scenario` literal, not inlined.** TypeScript's literal
  narrowing of `Object.freeze([...])` produces a tuple type that
  fails to widen to `ReadonlyArray<ScenarioAssertion>` because the
  `code` literals lose their `DiagnosticCode` bondage. The
  top-of-file `const ASSERTIONS: ReadonlyArray<ScenarioAssertion>`
  binding gives TS the right context to flow each element to the
  union — keeping the `Scenario.assertions: ASSERTIONS` line a
  trivial reference.

## Phase-2 invariants

- **`Scenario` carries either `scriptPath` or `inlineSource`, never
  both, never neither.** `runConformanceSuite`'s `resolveSource`
  enforces the mutual-exclusion contract; both-set throws "cannot
  define both", neither-set throws "must define either". Phase-1
  scenarios continue to use `scriptPath` against curated files in
  `examples/scripts/`; Phase-2 ports inline their 6-line
  `defineIndicator` source into their `*.scenario.ts` file so the
  curated example set stays at three scripts.
- **Inline-source `sourcePath` is the virtual
  `<inline:${scenario.id}>.chart.ts` literal.** This is the
  `sourcePath` the runner passes to the compiler so callsite-id
  injection produces a stable, pinnable slot-id
  prefix — assertions can pin
  `slotId: "<inline:ta-wma>.chart.ts:7:13#0"`. Do not change the
  literal format without updating every Phase-2 scenario's pinned
  slotIds.

## Phase-7 invariants

- **`Scenario.additionalSources` requires `inlineSource`.** When set,
  the runner writes the consumer's inline source AND every
  `additionalSources` entry into a per-scenario tmp directory under
  `.cache/<scenarioId>-<rand>/` so the compiler's default file-walking
  producer resolver can resolve `./X.chart` siblings. The consumer's
  `sourcePath` becomes the absolute path of the on-disk `inline.chart.ts`.
  Cleanup `rm -rf`s the directory in the `finally` block. The
  mutual-exclusion guard (`additionalSources` without `inlineSource`)
  throws at `resolveSource`.
- **Dep-family scenarios pin emission hashes + `dep-*` diagnostic
  codes.** The five `dep-*` scenarios in `ALL_SCENARIOS`
  (`dep-private-single-file`, `dep-multi-export`, `dep-diamond`,
  `dep-error-halts-parent`, `dep-cross-file`) run the full
  compile→bundle→runtime pipe against the canvas2d capability bag.
  `dep-cross-file` uses `additionalSources` so the compiler resolves
  an imported sibling `.chart.ts` producer on disk. Re-pin via the
  runner's "expected vs actual" failure message exactly like every
  other scenario.

## Phase-8 invariants

- **The suite drives the RUNTIME directly, NOT the hosts.**
  `runConformanceSuite` compiles each scenario and runs it through
  `createScriptRunner` (the runtime's `ScriptRunner`); it never imports
  `host-worker` / `host-quickjs`, and the package depends on
  adapter-kit / compiler / core / runtime ONLY. Do not add a host
  dependency here to "run scenarios through both hosts" — that inverts
  the dependency graph. **Cross-host byte-identical parity** (incl. the
  plot-override wire) lives in
  `packages/host-quickjs/src/integration.test.ts`, which boots both
  hosts and diffs the drained JSON. The "determinism / parity" wording
  elsewhere refers to the runtime emission-order contract, not a
  host-driving harness.
- **Plot overrides are keyed by `manifest.plots` ORDINAL, never a
  literal slotId.** `PLOT_STYLE_OVERRIDES_SCENARIO` declares
  `plotOverrides` (mount) + `overrideEvents` (live `setPlotOverrides`)
  whose `slotIndex` the runner resolves to the real `slotId` from the
  compiled `manifest.plots` at run time — so the scenario survives
  slotId-format changes. An out-of-range `slotIndex` resolves to no
  entry (keeps the suite robust under a stubbed compiler that emits no
  `manifest.plots`); a genuinely mis-authored override then surfaces as
  a failing `plot-field` assertion rather than a throw.
- **The `plot-field` assertion inspects override-baked AND runtime-set
  presentation fields.** `plot-hash` deliberately hashes only
  `{ bar, value }` (color/width are excluded so existing hashes stay
  stable), so `plot-field` exists to assert `visible` / `color` /
  `style.lineWidth` / `xShift` / `z` on the emission for a
  `(slotIndex, bar)` pair. `expected: undefined` asserts an omitted
  field — a visible plot carries no `visible` flag, a non-line-family
  style carries no `lineWidth`, a no-offset plot carries no `xShift`, and
  a no-`z`/`z:0` plot carries no `z`. Each non-`default` field needs an
  explicit `case` in the reader switch (`runConformanceSuite.ts`); the
  `default` arm is `visible`, so a new field added to the union WITHOUT a
  matching `case` would silently read `visible`. The empty-override
  parity guarantee is pinned by re-using `plot-hash` on the recolored
  slot (its numeric series is byte-identical to the no-override run).
- **`xShift` is the bidirectional plot-offset presentation field.**
  `PLOT_OFFSET_XSHIFT_SCENARIO` plots an unshifted `bar.close` plus a `+3`
  and a `−3` `ta.sma(..., { offset })` line, then asserts (via
  `plot-field: "xShift"`) `xShift = 3` / `−3` on the shifted slots and an
  omitted field on the unshifted slot, plus a `plot-hash` on the unshifted
  slot proving the value series is never transformed by `offset` (it is a
  presentation display shift, `+n` right / `−n` left, carried on the
  emission and rendered by the adapter). Re-pin the hash via the
  "expected vs actual" message like every other scenario.
- **`z` is the plot render-order (z-index) presentation field.**
  `Z_ORDER_SCENARIO` plots an un-`z`'d `bar.close` plus a
  `plot(ta.sma(...), { z: -1 })`, then asserts (via `plot-field: "z"`)
  `z = -1` on the `z`'d slot and an omitted field on the un-`z`'d slot
  (the omit-when-`0` byte-identity guard against a stray `z: 0` leaking
  onto the wire), plus a `plot-hash` on the un-`z`'d slot proving the
  value series is never transformed by `z` (its hash is byte-identical to
  the xShift scenario's unshifted `bar.close` slot —
  `857ce0c6…` — since `z` is presentation-only). The scenario is
  **plots-only**: drawing-`z` is unassertable here (no `drawing-field`
  kind, and `drawing-hash` hashes `DrawingState`, which does not carry
  the top-level `z`) — it is covered by the runtime unit test and the
  canvas2d adapter render test instead.
- **`plot-visible` asserts the WIRE field only — the harness never
  renders.** `PLOT_VISIBLE_SCENARIO` plots `bar.close` (no `visible`),
  `bar.hl2` (`{ visible: false }`), and `bar.hlc3` (`{ visible: true }`),
  then asserts (via `plot-field: "visible"`) `visible === false` on the
  hidden slot and an OMITTED field on BOTH the absent slot and the
  explicit-`true` slot — the byte-identity guard proving `visible` absent
  OR `true` ⇒ the pre-feature wire (the runtime only ever writes `false`).
  `visible: false` is the UNIVERSAL cross-adapter contract (suppress the
  mark + exclude from y-scale); the suite drives the runtime directly and
  cannot observe rendering, so the per-adapter render/skip + autoscale-
  exclusion proofs live in the adapter render tests, and the persistent-
  legend "keep slot listed" SHOULD is intentionally NOT asserted here. A
  control `plot-hash` on the `bar.close` slot proves `visible` is never in
  the `{ bar, value }` tuple; it is NOT the `plotStyleOverrides`
  `232ef794…` baseline (that one is `bar.hl2`, this is `bar.close`).
  Re-pin via the runner's "expected vs actual" message only when the
  golden bars change.

## Pine round-trip invariants

- **The `pine-converter-round-trip-*` scenarios convert a committed
  `.pine` fixture at SCENARIO-MODULE-LOAD time.** Each scenario
  `readFileSync`s a `packages/pine-converter/fixtures/<n>.pine` file (via an
  `import.meta.url`-relative URL), calls `convert(source, { barInterval:
  60_000, barIndexOrigin: 1_700_000_000_000 })`, throws if `output === null`,
  and sets `inlineSource = output`. The harness then compiles + runs that
  string exactly like any other inline scenario — the scenario module NEVER
  imports `compile`/`createScriptRunner`, preserving the harness contract.
  This makes `@invinite-org/chartlang-pine-converter` a `dependencies` entry of
  this package (the scenarios are `src`, shipped in `dist`). The drawing camps
  (A/B/table) pin a `drawing-hash`; the two value-lowering round-trips
  (`var-series` → `state.series`, `var-array` → `state.array`) pin a
  `plot-hash` instead (they emit plots, not drawings).
- **The pinned `drawing-hash` is GENERATED from a real
  convert→compile→runtime run, not hand-authored.** Re-pin via the harness's
  "expected vs actual" failure message (run
  `runConformanceSuite(canvas2dAdapter, { scenarios: [theScenario] })`), exactly
  like every other `drawing-hash`. The fixture choice is constrained to
  COMPILE-CLEAN Pine: the round-trip fixtures avoid `str.tostring(...)` /
  `close[i]` cells (unmapped/ill-typed in chartlang) — those idioms still ride
  the golden corpus (`golden.test.ts`), which only pins the emitted SOURCE, not
  a compiled run. Converter-emitted diagnostics (e.g. `ring-eviction-implicit`)
  are asserted in the per-fixture `*.expected.diagnostics.json`, NOT here — the
  conformance harness only observes runtime diagnostics from the compiled
  chartlang script.

## `state.series` history invariant

- **`state-series-history` pins `s[2]` and `bar.close[2]` to ONE shared
  `HISTORY_LAG_HASH` constant.** The scenario republishes `bar.close`
  through a user `state.series` (`s.value = bar.close.current` each bar);
  the user series' two-bar-old committed history MUST be byte-identical to
  a direct `bar.close[2]` read (warmup `NaN`s included). Both `plot-hash`
  entries reference the same constant on purpose. If a future run splits
  them, the runtime `state.series` advance/commit discipline (Task 3)
  regressed — fix the runtime, do NOT re-pin the two hashes apart. `s[0]`
  (the live head) tracks the unshifted close and pins to its own
  `LIVE_HASH`. Re-pin both via the runner's "expected vs actual" message
  only when the golden bars change.

## `state.array` rolling-window invariant

- **`state-array-rolling-window` bounds its accumulation loop by the
  capacity LITERAL, not `win.size`.** The scenario pushes `bar.close.current`
  into a `state.array<number>(5)` each bar and sums the window. The natural
  `for (let i = 0; i < win.size; i++)` form is a COMPILE ERROR
  (`unbounded-loop` — the compiler requires a literal numeric bound), so the
  loop counts to the literal `5` and an inner `if (i < win.size)` guard skips
  the unfilled slots during warmup. The in-loop `win.get(i)` is a HANDLE
  method (loop-legal); only the allocation `state.array(...)` is a stateful
  registry callsite. The window-mean plot pins to its own SHA-256; the
  `ta.sma(close, 5)` plot pins to the SAME `TA_SMA_HASH` as
  `barCloseDirectIndex.scenario.ts` (the runtime SMA is deterministic over
  the shared golden bars). Do NOT assert the window-mean and ta.sma hashes
  are equal — the window mean is finite from bar 0 (averages over `size < 5`)
  while ta.sma has a NaN warmup. Re-pin via the runner's "expected vs actual"
  message only when the golden bars change.

## `state.map` keyed-collection invariant

- **`map-accumulator` accumulates per-rounded-price volume into a
  `state.map<number, number>(32)` and pins two byte-stable plot hashes.** Each
  bar buckets `bar.volume.current` under `Math.round(bar.close.current)`
  (`get() ?? 0`-seeded so an unseen level reads `0`, not NaN; a new key over 32
  evicts the oldest-inserted), then plots the current level's value
  (`VALUE_AT_LEVEL_HASH` `9aa49424…`) and `levels.size`
  (`LEVELS_TRACKED_HASH` `3fca90e0…`). `state.map` is pure compute that rides the
  existing `plot` hole — NO new wire primitive, NO per-adapter code — so the
  single registered scenario is the all-adapter proof. The slot ids are line
  `11`/`12` (`#0`); re-derive from `compile(...).manifest.plots` if the SOURCE
  changes, and re-pin the hashes via the runner's "expected vs actual" message
  only when the golden bars change.
- **`phase2Coverage.test.ts` tracks the `state.map` registry addition via
  `STATE_MAP_STATEFUL_ADDITIONS` (one `{ name: "state.map", slot: true }`
  entry).** `state.map` is the keyed sibling of `state.array`: only the
  allocation callsite is `slot: true`; `set`/`get`/`has`/`delete`/`clear`/`keyAt`
  are handle methods, not registry callsites. It bumps the
  `STATEFUL_PRIMITIVES.size` baseline by one alongside `state.array`.

## `request.security` expression-form invariants

- **`mtfSecurityExpressionEma` / `mtfSecurityExpressionNanFallback` prove the
  callback overload.** Both inline
  `plot(request.security({ interval: "1D" }, (bar) => ta.ema(bar.close, 2)))`
  and reuse `MTF_DAILY_FIXTURE_BARS` (the 3-bar daily fixture the data-form
  `mtfRequestSecurityClose` uses). The EMA length is **2, not 10**: a length-10
  EMA over only three HTF bars is all-NaN (Pine warmup), a degenerate golden
  byte-identical to the NaN fallback that proves nothing. Length 2 warms in two
  HTF closes, so the happy-path `plot-hash` (`e105d8e0…`) carries FINITE values
  (565/675 — the HTF-clock EMA over the 510/620/730 secondary closes), which is
  also the conformance-side distinctness proof: those values live in a price
  band the main golden stream (~100) never reaches. Re-mint the hash via the
  harness's "expected vs actual" message exactly like every other scenario.
- **The distinctness contract has a dedicated guard test.** The harness's
  assertion vocabulary cannot express "mean-absolute-difference vs a
  same-length main EMA", so `mtfSecurityExpressionEma.test.ts` compiles the
  scenario source, drives it through `createScriptRunner` with a
  `multiTimeframe: true` bag + the daily fixture, and asserts finite output +
  MAD > 50 against a same-length main EMA(2). This is the regression guard that
  the EMA actually runs on the HTF clock (the original "weekly EMA looks like
  the daily EMA" bug). Both scenarios are also in `PHASE_4_SCENARIOS` for the
  end-to-end pass in `runConformanceSuite.test.ts`.
- **No compile-fail scenario for `request-security-expr-captures-local`.** The
  harness only observes RUNTIME diagnostics after a successful compile; the
  capture check is an error-severity COMPILE diagnostic, so its authoritative
  coverage stays in the compiler's `validateSecurityExpr.test.ts`. Adding a
  conformance scenario for it would require extending the `Scenario` type +
  `runConformanceSuite` with a compile-fail assertion mode first.

## Multi-symbol `request.security` invariants

- **`Scenario.secondaryFeeds` keys secondary streams by the composite
  `feedKey(symbol, interval)`, NOT a hand-composed string.** It is the
  multi-symbol sibling of the interval-keyed `secondaryCandles`
  (back-compat). `runOne`'s `resolveSecondaryStreams` flattens both into one
  `streamKey → bars` list; a `secondaryFeeds` entry derives its `streamKey`
  via the core `feedKey(feed.symbol, feed.interval)` helper so the wire key
  matches the runtime's composite stream key byte-for-byte (the load-bearing
  format both sides must agree on). The harness then feeds each bar tagged
  with that `streamKey` exactly as it does for `secondaryCandles`, so NO
  routing change was needed — the runtime already keys secondary streams by
  `feedKey`. The two fields may be combined; their keys must not collide.
- **`multiSymbolRatio` / `multiSymbolNotSupported` prove the two-symbol key
  end-to-end.** Both inline `plot(spy.close.current / qqq.close.current)` for
  `AMEX:SPY` + `NASDAQ:QQQ` at `"1D"`, fed via `secondaryFeeds`
  (`MTF_SPY_FIXTURE_BARS` 600/620/640, `MTF_QQQ_FIXTURE_BARS` 300/310/320 —
  timestamp-aligned to `MTF_DAILY_FIXTURE_BARS`). The happy-path golden
  (`f3c29388…`, `multiTimeframe: true` + `multiSymbol: true`) carries the
  finite ratio (~2) — a value reachable ONLY if the composite key routed the
  two fixtures to distinct streams (the main golden band is ~100, a
  same-symbol read would be 1). `SecurityBar.close` is `Series<Price>` (NOT
  number-coercible like `bar.close`), so the ratio reads `.current`. The
  capability-false sibling (`multiSymbol: false`, `multiTimeframe: true`)
  pins an all-NaN `plot-hash` (`18fb0cce…`, byte-identical to
  `mtfCapabilityFalse`'s all-NaN hash — same `{ bar, value: null }` tuples,
  do not assume divergence on a re-pin) + `diagnostic-code-present:
  "multi-symbol-not-supported"`. Re-mint hashes via the harness's "expected
  vs actual" failure message exactly like every other scenario.
- **`multiSymbolRatio.test.ts` is the distinctness guard.** The harness
  vocabulary cannot express "the two symbol series are distinct", so the
  co-located test compiles the ratio source, drives it through
  `createScriptRunner` with the `{ multiTimeframe: true, multiSymbol: true }`
  bag + both fixtures pushed under their `feedKey` streamKeys, and asserts the
  ratio is finite and ≠ 1 (~2) — the regression guard that the composite key
  actually separates symbols rather than collapsing them onto one stream.
  Both scenarios are in `ALL_SCENARIOS` and in `MULTI_SYMBOL_SCENARIOS` for
  the end-to-end pass in `runConformanceSuite.test.ts`. The compiler typechecks
  the `{ symbol, interval }` opts against its in-memory core ambient shim
  (`packages/compiler/src/program.ts`), so a STALE compiler `dist` (missing
  `RequestSecurityOpts.symbol`) makes these scenarios compile-fail — rebuild
  core + compiler first if that happens.

## Calendar / session UTC-determinism invariants

- **`calendar-session` pins `time.*` calendar fields + `session.isOpen`
  membership over the FIXED UTC fixture, and that fixture's
  fixed-time-of-day is load-bearing.** The golden bars are daily candles
  spaced exactly `MS_PER_DAY` from `START_TIME = 1_700_000_000_000`, so EVERY
  bar shares one time-of-day (`1_700_000_000_000 % 86_400_000 = 80_000_000`
  ms = **22:13:20 UTC**). Consequence: `time.hour`/`minute`/`second` are
  CONSTANT across the stream while `time.year`/`month`/`dayofmonth`/`dayofweek`
  advance one civil day per bar, and `session.isOpen` membership is constant
  per window (no intra-fixture transitions are possible on a fixed-time-of-day
  fixture). The scenario deliberately picks `"2000-2300"` (half-open
  `[1200, 1380)` minutes), which CONTAINS minute 1333 (22:13:20), so
  `session.isOpen(t, "2000-2300", "UTC")` is `true` every bar — the open
  branch (which folds the per-bar-varying `dayofweek` into the close) is the
  one that emits, the stronger proof. A 0/1-membership second scenario is
  intentionally NOT added: it would be a constant series (no transition
  coverage). Both `tz` args are the explicit `"UTC"` so the script never
  touches the deferred DST path; `tz-dst-unsupported` + `lookback-exceeded`
  are asserted absent (UTC + no accessor buffering).
- **The two `plot-hash`es are byte-identical across all five conformance
  adapters** (`CALENDAR_HASH` `2dac8fb7…`, `MONTH_HASH` `79a9fd0c…`). This is
  the determinism contract for `time.*` / `session.*`: pure integer UTC epoch
  math (Howard Hinnant `civil_from_days`), no `Date`/`Intl` on the runtime
  author path, so the same numbers reproduce on every host/adapter. Re-pin via
  the runner's "expected vs actual" message ONLY if the golden bars change —
  a hash that diverges between adapters means the UTC determinism regressed
  (fix the runtime, do not re-pin per adapter).
- **The slot ids are line `12`/`13` (`#0`), not the README's example `11`/`12`.**
  The inline `SOURCE` template begins with the `import` line, so the two `plot`
  callsites land at `<inline:calendar-session>.chart.ts:12:9#0` (Calendar) and
  `:13:9#0` (Month). When editing the SOURCE, re-derive slot ids from
  `compile(...).manifest.plots` rather than hand-counting.
- **`phase2Coverage.test.ts` tracks the calendar/session registry additions
  via `CALENDAR_SESSION_STATEFUL_ADDITIONS` (ten `slot: false` entries).** The
  `time.*` accessors (incl. `time.timeClose`) + `session.isOpen` are stateless
  `slot: false` like `ta.nz`, so they extend BOTH the
  `STATEFUL_PRIMITIVES.size` sum AND the `slot:false` expected set. Adding a
  new calendar/session accessor means appending to that constant.

## `math.*` namespace invariant

- **`math-round-to-mintick` is the all-adapter proof for the pure-scalar
  `math` namespace.** `math.*` emits NO new wire primitive — its outputs are
  `number`s flowing into the existing `plot`/`draw` holes — so the scenario
  needs no per-adapter code. It snaps two levels with
  `math.roundToMintick(level, syminfo.mintick)` → two `draw.horizontalLine`s on
  bar 0 and pins ONE `drawing-hash` (`38b4e1a2…`, 2 emissions). The inline
  source **imports `math` at the top but does NOT destructure it** — `math` is
  a module-scope frozen namespace, not a `ComputeContext` field, so
  `compute({ bar, draw, syminfo })` destructures only `syminfo` (the tick-size
  view). Destructuring `math` is a `TS2339` compile error. Re-pin via the
  runner's "expected vs actual" message exactly like every other `drawing-hash`.

## `str.*` namespace invariant

- **`str-formatted-table` is the all-adapter proof for the pure-compute `str`
  namespace.** `str.*` emits NO new wire primitive — `str.format` /
  `str.tostring("#.##")` / `str.upper` produce plain `string`s that flow into
  the existing `draw.table` cell-text hole — so the scenario needs no
  per-adapter code. It renders a 2×2 OHLC HUD and pins ONE `drawing-hash`
  (`d6d8c911…`, 3 emissions: one `draw.table` per candle over `candleLimit: 3`);
  the hash is byte-identical across all six conformance adapters, which is the
  byte-stable-text proof. Like `math`, the inline source **imports `str` at the
  top but does NOT destructure it** — `str` is a module-scope frozen namespace,
  not a `ComputeContext` field, so `compute({ bar, draw })` never lists it.
  Re-pin via the runner's "expected vs actual" message exactly like every other
  `drawing-hash`.

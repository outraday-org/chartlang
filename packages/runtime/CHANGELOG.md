# @invinite-org/chartlang-runtime

## 1.8.0

### Minor Changes

- 5266c46: Treat a `history` push that **overlaps** already-processed history on a
  non-fresh runner (`state.barIndex > 0` and the batch's first bar not strictly
  newer than the last closed bar) as a full **re-seed** instead of an append. A
  forward-continuation batch (every bar strictly newer — the chunked-history
  shape hosts emit, e.g. to interleave secondary closes) still appends,
  byte-identically to before. The runner rebuilds its whole state (main +
  secondary streams, ta / `state.*` slots, dep / sibling runners, external-series
  slots) and replays the supplied bars from bar 0, so re-pushed bars land at
  `0..N-1` — not `N..2N-1`. This is the durable fix for external-series feeds and
  plot-override maps that changed after the first seed: the latest live
  `setExternalSeries` / `setPlotOverrides` maps are **preserved** across the
  re-seed and re-read from bar 0, while a fresh runner (`barIndex === 0`) stays
  byte-identical to before.

  Two behavior caveats:

  - **Undrained pre-reseed emissions are dropped** — their bar indices conflict
    with the replayed `0..N-1` range, and a host that re-pushes history has
    abandoned the prior emission stream.
  - **Secondary streams reset empty** — the runtime cannot know the host's
    secondary history sources, so a `request.security` script re-seeded without a
    secondary re-push reads warmup-`NaN` until the caller re-pushes the secondary
    history.

  A new `resetStateForHistoryReseed(state)` is exported from the runtime entry
  (the re-seed mechanism; also the host-bundle preflight marker). The guard fires
  identically through both `runner.onHistory(bars)` and
  `runner.push({ kind: "history", bars })`. No `warmStart` is auto-run on re-seed.

- 5e2be68: Compiled bundles now carry the real manifest on their `default` export (no
  longer a stub), and a shared `buildBundleFromModule` loader merges `__manifest`
  and throws on a stub-shaped manifest instead of silently collapsing series
  capacity to 1.
- 55ca8ff: Emit `candle` / `ohlc-bar` plot styles from `plotcandle` / `plotbar`, gated on adapter capability.
- f92d131: Expose host-injected wall-clock time through `time.now()` and map Pine `timenow` to it.
- 55ca8ff: Add `ta.cross` (bidirectional cross) and `ta.cum` (running sum) primitives.
- 55ca8ff: Add `ta.rising` / `ta.falling` monotonic-direction boolean primitives.

### Patch Changes

- Updated dependencies [55ca8ff]
- Updated dependencies [55ca8ff]
- Updated dependencies [f92d131]
- Updated dependencies [55ca8ff]
- Updated dependencies [55ca8ff]
- Updated dependencies [55ca8ff]
- Updated dependencies [5e2be68]
  - @invinite-org/chartlang-adapter-kit@1.9.0
  - @invinite-org/chartlang-core@1.8.0

## 1.7.0

### Minor Changes

- fb6f60a: Resolve `input.externalSeries` descriptors to runtime numeric series, add runner external feed APIs, expose load-time/live external-series feeds through adapter-kit, worker host, and QuickJS host, and add conformance coverage for feed history plus live replacement.

### Patch Changes

- Updated dependencies [d542f99]
- Updated dependencies [d542f99]
- Updated dependencies [fb6f60a]
  - @invinite-org/chartlang-adapter-kit@1.8.0
  - @invinite-org/chartlang-core@1.7.0

## 1.6.0

### Minor Changes

- bd0ef6e: Add lower-than-main `request.security` alignment. When the requested secondary
  interval is **finer** than the chart's main interval, each main bar now aligns to
  the value of the **last secondary bar that closed at/before the main bar's
  close** (the most recent sub-bar), read non-repainting. Previously the alignment
  kernel always mapped each main bar to the first sub-bar by open time and
  repainted as later sub-bars arrived — correct only for a coarser/equal secondary.

  The new `alignSecondaryFinerThanMain` branch is a pure O(n+m) two-pointer pass
  selected by a `secondaryIsFinerThanMain` flag derived at the `request.security`
  call sites from the main (`ctx.stream.bar.interval`) vs secondary interval
  durations (via core's `intervalToSeconds`). Coarser/equal secondaries are
  byte-identical to before, and there is no new runtime rejection of finer
  secondaries. Both the data form and the expression form route through the flag,
  and the alignment cache validates it so a finer secondary never reuses a
  coarser-aligned array.

## 1.5.1

### Patch Changes

- 903f14a: Resolve Pine's empty-interval idiom (`request.security({ interval: "" })`) to the
  chart's own timeframe instead of all-NaN. An empty interval combined with the
  chart symbol is "the chart's own clock" (Pine's
  `request.security(syminfo.tickerid, "", x)`), which on TradingView simply returns
  the chart's own series. `makeSecurityBar` now short-circuits the
  `symbol === undefined && interval === ""` case to a `SecurityBar` view over the
  MAIN stream's own series — reusing the stream's O(1) head-relative views — BEFORE
  the symbol / `multiTimeframe` / `unsupported-interval` / secondary-stream gates,
  so it needs no adapter capability and no registered secondary feed. A different
  symbol at `interval: ""` is unchanged (it stays the `multiSymbol` secondary path,
  NaN when unsupported), and a non-empty interval still flows through the secondary
  alignment path. Adds the `empty-interval-passthrough` conformance scenario proving
  the passthrough close is byte-identical to a direct `bar.close` plot under
  `multiTimeframe: false`. The expression form (`request.security({ interval: "" },
expr)`) is unchanged: the compiler treats the chart timeframe as the main clock
  (no HTF expression unit), so its callsite routes into the same data-form
  passthrough.
- 903f14a: Treat Pine's empty-interval sentinel (`interval: ""`) as an always-valid
  interval in the `request.security` capability gate, so a DIFFERENT-symbol feed
  on the chart's own timeframe no longer trips a misleading `unsupported-interval`
  diagnostic.

  `""` is "the chart's own timeframe" — never a literal interval an adapter lists
  in `capabilities.intervals` — so validating it there was wrong. Both
  `makeSecurityBar` and `resolveSecondaryOrDiagnose` (`request/security.ts`) now
  short-circuit the interval check on `interval === ""`. For the CHART symbol the
  existing main-stream passthrough still runs first (unchanged); for a DIFFERENT
  symbol at `interval: ""` ("that instrument on the chart clock") the request now
  flows past the interval gate and is gated only by `multiSymbol` plus the
  secondary-stream lookup keyed `feedKey(symbol, "")` — reading that stream's data
  when registered, or falling back to the accurate `unknown-secondary-stream` when
  not. A different-symbol NON-empty unsupported interval still trips
  `unsupported-interval` (the relaxation is strictly `interval === ""`).

- 903f14a: Fix a real-path NaN bug across the `ta.*` OHLC-sourcing primitive family.
  `bar.high`/`.low`/`.close`/`.open`/`.volume` (and the derived `hl2`/`hlc3`/…)
  are number-coercible `makeSeriesView` proxies, not primitive numbers, so any
  primitive that read one and passed it to `Number.isFinite(...)` (or stored it
  as a `number`) bailed to its NaN fallback on every real bar. The unit harness
  (`ta/__fixtures__/runPrimitive.ts`) masked it by overwriting the bar fields
  with plain numbers each step; it now keeps the real proxies, matching
  `onBarClose`.

  Each affected primitive now coerces at the read (`+bar.x`) when the value is
  used as a scalar, while keeping the proxy when it is passed as a `Series`
  source to `highest`/`lowest`/`dispatchMa`. Primitives fixed: `atr`, `adx`,
  `dmi`, `vortex`, `ultimateOsc`, `pivotsStandard`, `psar`, `aroon`, `adr`,
  `zigZag`, `supertrend`, `volatilityStop`, `adl`, `obv`, `bop`, `cmf`, `eom`,
  `klinger`, `mfi`, `netVolume`, `nvi`, `pvi`, `pvt`, `rvgi`, `vwap`,
  `anchoredVwap`, `vwma`, and the mixed series/scalar `chop`, `williamsR`,
  `fisher`, `pivotsHighLow`. The math is byte-identical to the pinned goldens.

  Conformance: the `ta.atr`/`ta.adx`/`ta.dmi`/`ta.vwap`/`ta.williamsR` scenarios
  now pin a `plot-hash` so the real-path (non-NaN) output is value-checked and
  can't silently regress.

- Updated dependencies [f89117d]
  - @invinite-org/chartlang-core@1.6.0

## 1.5.0

### Minor Changes

- 70cb92f: Add non-numeric persistent state: `state.color` plus boolean/string series
  slots (`state.boolSeries` / `state.stringSeries`), enabling `var color` and
  `var bool/string` history conversion.

  `state.color(init)` is a persistent color scalar (`MutableSlot<Color>`, the
  `Color` string seeded with `init`). `state.boolSeries(init)` /
  `state.stringSeries(init)` are the non-numeric siblings of the numeric
  `state.series` — a writable `.value` head plus integer-indexed `[n]` history
  (`BoolSeriesSlot` / `StringSeriesSlot`). First-bar / out-of-range history reads
  are `false` for booleans (Pine v6 semantics) and `""` for strings. The numeric
  `state.series` / `NumberSeriesSlot` signature is unchanged (numeric snapshots
  stay byte-identical). The compiler ambient `state` shim mirrors all three
  factories + the two new slot types in lockstep.

  The Pine converter now lowers a `var color` scalar to `state.color` (a Pine `na`
  color → the concrete transparent CSS string `"#00000000"`), and a history-indexed
  `var bool` / `var string` to `state.boolSeries` / `state.stringSeries` (value
  read / `[n]` history / `:=` write split, mirroring the numeric series). The
  `series-history-non-numeric` info is retired for `bool`/`string` (now first-class)
  and narrowed to the still-unsupported `color` history case.

- 70cb92f: Add a per-plot authoring `visible` opt — `plot(x, { visible })` (and Pine
  `display = display.all | display.none` conversion). Wired into the existing
  `PlotEmission.visible` wire field; omitted when visible so existing emissions
  stay byte-identical. (adapter-kit needs no change — its `visible` wire field +
  validator already exist @since 0.8.)

  The compiler also threads a boolean-literal `visible` into a new optional
  `manifest.plots[*].defaultVisible` static hint (a host can pre-toggle a legend
  entry); an input-driven `{ visible }` is resolved per run and leaves the field
  absent, so unused-visibility manifests stay byte-identical.

  The conformance suite adds the `PLOT_VISIBLE_SCENARIO` export pinning the wire
  contract cross-adapter: `plot(value, { visible: false })` emits `visible: false`
  while a no-`visible` plot AND a `visible: true` plot both omit the field
  (byte-identical wire), with a control `plot-hash` proving `visible` is never in
  the numeric `{ bar, value }` tuple.

  The Pine converter (minor — new capability + a new diagnostic code) maps a
  `plot(..., display=...)` named arg onto the `{ visible }` opt:
  `<cond> ? display.all : display.none` → `{ visible: <cond> }` (the inverted
  arm order → `{ visible: !(<cond>) }`), a bare `display.none` → `{ visible:
false }`, and a constant `display.all` (or an omitted `display=`) omits the key
  for byte-clean output. Any other `display.*` target (`status_line`/`price_scale`/
  `pane`/`data_window`) is left visible with a new `plot-display-approximated`
  warning — `display=` is never silently dropped.

### Patch Changes

- Updated dependencies [70cb92f]
- Updated dependencies [70cb92f]
  - @invinite-org/chartlang-core@1.5.0

## 1.4.0

### Minor Changes

- 382d1f1: Implement the `MutableArraySlot<number>` numeric-reduction bodies on the
  `state.array` runtime handle: `sum`, `avg`, `min`, `max`, `range`,
  `variance(biased?)`, `stdev(biased?)`, `median`, `percentile(p)`,
  `indexOf(value)`, `includes(value)`, `sort(order?)`. Each reads the slot's
  tentative ring's filled region directly (O(size) via `at(i)`, never the handle's
  `get(n)` proxy). The Pine-parity `array.*` namespace delegates to these methods,
  so there is one implementation.

  Semantics: statistical reductions skip `NaN` (empty / all-`NaN` window → `NaN`,
  never `0`); variance is the numerically-stable Welford single pass (population
  by default, sample when `biased === false`, `NaN` when `count < 2`);
  median/percentile use linear interpolation between closest ranks (`percentile`
  clamps `p` to `[0, 100]`); `indexOf` is strict (cannot find `NaN`) while
  `includes` is SameValueZero (finds `NaN`); `sort` returns a fresh sorted copy
  and never mutates the ring. Lands unit + property + golden tests.

- 382d1f1: Implement the runtime `state.map<K, V>(capacity)` slot — Task 2 of the
  `map-collection` feature. A bounded, insertion-ordered keyed store backed by two
  `Map<MapKey, number>`s (committed + tentative) behind the identity-stable
  `MutableMapSlot` handle, reusing the `state.array` committed/tentative slot
  lifecycle: writes during a tick are tentative, a head-replacing tick rolls them
  back to the last committed map, and a bar close commits the tentative map.

  Eviction is insertion-order FIFO: inserting a **new** key once `size ===
capacity` evicts the oldest-inserted key; re-`set`ting an existing key updates in
  place without changing its insertion age; `delete` then re-`set` re-ages the key
  to newest. `get` returns `undefined` for an absent key (distinct from a stored
  `0`); `keyAt(index)` reads the insertion-order key (`0` = oldest), `undefined`
  out of range.

  Snapshot/restore rides the existing persistence plumbing under a `:map`
  namespace suffix: each slot serialises to insertion-ordered `[key, value]` entry
  tuples (preserving the `string` vs `number` key distinction; non-finite values
  ride as `null`), restores at the persisted capacity, and degrades to a fresh
  slot — never throws — on a malformed or over-capacity snapshot. Warm restart,
  bundle dep/sibling isolation, and `dispose` mirror `state.array`. No wire,
  converter, or adapter change.

- 48e8ebb: Make numeric `input.enum` execution complete (T4 Task 4 counterpart to Task 1's
  core widening).

  - **Runtime — `resolveInputs.matchesDescriptor`'s `enum` arm accepts a numeric
    override.** It previously type-gated an adapter override to `string`, so a
    numeric-enum override (`input.enum(21, [8, 21, 30])` overridden to `30`) was
    wrongly rejected with `input-coercion-failed` and fell back to the default.
    The arm now accepts a `string` OR `number` value that names a valid option.
    String-enum behaviour is byte-stable (a string value still checks string
    membership).
  - **Compiler — `extractInputs` serialises numeric enum options.** The manifest
    extractor previously required `input.enum` options to be string literals, so
    a numeric dropdown emitted `input-default-not-literal` and failed to compile.
    A uniform numeric or uniform string options list now serialises; a mixed
    string/number list is still rejected (it cannot type-check). The numeric
    default already round-tripped.
  - **Editor — the inputs form renders numeric enums and preserves their type.**
    `InputsFormOption.value` widens to `string | number`, the `<select>` value
    stringifies numeric current values so the control matches an option, and the
    change handler coerces the DOM string back to a number for numeric-enum
    options. Without this, a numeric override picked in the form was emitted as a
    string and silently discarded by the runtime's typed membership check.

### Patch Changes

- Updated dependencies [3770236]
- Updated dependencies [382d1f1]
- Updated dependencies [48e8ebb]
- Updated dependencies [810125e]
- Updated dependencies [382d1f1]
- Updated dependencies [810125e]
- Updated dependencies [810125e]
  - @invinite-org/chartlang-adapter-kit@1.7.0
  - @invinite-org/chartlang-core@1.4.0

## 1.3.0

### Minor Changes

- e620ba8: Add `bgcolor(color, opts?)` and `barcolor(color, opts?)` — Pine-ergonomic
  top-level aliases for the `bg-color` / `bar-color` plot styles. One call
  (`bgcolor(close > open ? "#16a34a" : "#dc2626", { transp: 80 })`) replaces
  the verbose `plot(NaN, { style: { kind: "bg-color", … } })`. Surfaced in the
  generated primitive reference and taught in the chartlang-coding skill.

  Deliverable 2 (per-bar dynamic color): `PlotEmission` gains an optional
  `colorValue: Color | null` channel; the runtime resolves the `bgcolor` /
  `barcolor` per-bar color into it (omitted on the static `plot` path → wire
  byte-identical, every pinned `plot-hash` untouched), validates it
  (non-empty color string or `null`), and dedups it last-write-wins per
  `(slotId, bar)` like `value`. Adapters prefer `colorValue` over the static
  `style.color` at render time — this precedence is now the normative
  adapter-kit contract (`PlotEmission.colorValue` JSDoc) and is implemented in
  the canvas2d reference renderer (`null` ⇒ paint-nothing gap; omitted ⇒ static
  fallback). The Pine converter emits the real per-bar dynamic color
  (`bgcolor(close > open ? "#16a34a" : "#dc2626")`) instead of a static
  `plot(NaN, …)`, so `bgcolor`/`barcolor` round-trip with per-bar semantics
  intact.

- 08cba38: Add `time.*` calendar accessors (`time.year/month/dayofmonth/dayofweek/hour/
minute/second/timestamp`), a `time.timeClose(t, tz?)` bar-close accessor
  (Pine's `time_close()` = bar start + interval), a `session.isOpen(t, spec, tz?)`
  helper, and an `input.session` kind. Calendar fields are derived from a `Time`
  epoch via the host (authors stay sandboxed — `Date`/`Intl` remain banned). v1
  is UTC + fixed-offset only; exchange-tz/DST is a scoped follow-up. The Pine
  converter lowers `dayofweek` / `time()` / `time_close()` / `input.session`.
- 1efb49c: Add multi-symbol support to `request.security`. `request.security({ symbol,
interval })` now reads a **different instrument** (not just a higher
  timeframe), e.g. `request.security({ symbol: "AMEX:SPY", interval: "1D" })`.
  `symbol` is optional (defaults to the chart symbol) and must be a compile-time
  literal (`input.symbol` / `input.enum` resolved). A new `multiSymbol` adapter
  capability gates non-chart-symbol requests: a different-symbol request against
  an adapter declaring `multiSymbol: false` degrades to an all-NaN
  bar/series with a single deduped `multi-symbol-not-supported` diagnostic,
  mirroring `multi-timeframe-not-supported` (the symbol gate precedes the
  timeframe gate, so a both-different request emits only the symbol diagnostic).
  The Pine converter now lowers `request.security("OTHER", tf, expr)`, and the
  `chartlang scaffold-adapter` template advertises `multiSymbol`.
- 1efb49c: Add `state.array<T>(capacity)` — a persistent, bounded FIFO collection. Push
  many values across bars (`a.push(v)`) into a fixed-capacity ring and read
  them back by element (`a.get(0)` = newest, `a.last()`, `a.size`,
  `a.capacity`, `a.clear()`). Bounded literal capacity keeps it
  serialization-clean. The Pine converter lowers a bounded numeric
  `var array<…>` Camp B ring to it.

  The compiler guards the capacity: it must be a compile-time numeric literal
  (a `const` numeric binding is accepted) that is a positive integer within
  `MAX_STATE_ARRAY_CAPACITY` (100_000). A non-literal capacity errors
  `state-array-capacity-not-literal`; an out-of-range / non-integer literal
  errors `state-array-capacity-exceeds-max`.

### Patch Changes

- Updated dependencies [189493a]
- Updated dependencies [8bc628e]
- Updated dependencies [ab8b218]
- Updated dependencies [8bc628e]
- Updated dependencies [ab8b218]
- Updated dependencies [189493a]
- Updated dependencies [e620ba8]
- Updated dependencies [08cba38]
- Updated dependencies [1efb49c]
- Updated dependencies [1efb49c]
  - @invinite-org/chartlang-adapter-kit@1.6.0
  - @invinite-org/chartlang-core@1.3.0

## 1.2.0

### Minor Changes

- 850ae21: Add `bar.point(offset, price)` — index authoring sugar for anchoring drawings
  by bar offset instead of an absolute timestamp.

  `bar.point` resolves the offset to the existing time-based `WorldPoint`
  (`{ time, price }`) at compute time, so it composes directly with every
  `draw.*` anchor argument and introduces no new wire format or anchor union:

  - `bar.point(0, price)` — the current bar.
  - `bar.point(-n, price)` — `n` bars back, using the real historical timestamp
    from the runtime's time ring buffer (`NaN` time past retained history; never
    throws).
  - `bar.point(n, price)` — a future bar, with the time extrapolated from the
    median recent bar spacing (falling back to the parsed bar interval when
    fewer than two bars are retained).

  The compiler's max-lookback analysis now counts a negative integer-literal
  `bar.point(-n, …)` offset toward `maxLookback` exactly like a `series[n]`
  lookback, so the runtime sizes the time buffer deeply enough; positive (future)
  offsets and dynamic offsets contribute no extra depth. The recogniser peels
  parentheses, so the converter's emitted form `bar.point(-(n), …)` is sized
  identically to a hand-written `bar.point(-n, …)` (without it, a converted
  historical tracking line sized its buffer to 0 and resolved to a NaN anchor).

  The Pine v6 converter now lowers `bar_index` drawing anchors to
  `bar.point(<signed offset>, <price>)` and drops the dead `__BAR_INTERVAL_MS`
  sentinel and its `bar.time ± (N * __BAR_INTERVAL_MS)` arithmetic — future
  anchors resolve at runtime instead of needing a host-supplied bar interval.

- ca19e20: Bidirectional plot `offset` — negative offsets shift a plotted series left.

  `offset` becomes a presentation-only **display shift** in bars with the
  fixed sign convention `+n` = right (future), `−n` = left (past); the
  numeric series value is unshifted. This replaces the old value-read model
  (where a positive offset made `series.current` read the value N bars ago
  and a negative offset resolved to `NaN`). The `*Opts` `offset` JSDoc (and
  ALMA's `barShift`) now describe both directions and drop the old
  "negative ⇒ NaN" wording (`AlmaOpts.offset`, the Gaussian-centre
  position, is unchanged).

  `PlotEmission` gains an optional presentation field `xShift?: number`
  (signed integer bars; omitted/`0` ≡ no shift, so a no-shift emission is
  byte-identical to today). `validateEmission` rejects a non-integer
  `xShift`. The compiler no longer counts `offset` toward `maxLookback`
  (the value is no longer read from a deeper slot). The runtime threads the
  declared offset onto the emission as `xShift` (reading a
  `WeakMap<Series, number>` offset tag set by `makeShiftedSeriesView`; ALMA
  tags `opts.barShift`) and stops the old value-read shift so
  `series.current` is unshifted; the reference adapter renders it by
  projecting `xShift` onto the x-axis (extending the viewport for
  future-shifted points).

  The Pine converter now maps `plot(<ta.* call>, offset=N)` onto the
  emitted `ta.*` call's `offset` opt (signed, both directions); a plot
  whose value is not a direct `ta.*` call drops the offset and emits the
  new `plot-offset-needs-ta-call` warning, and a plot-level offset
  replacing the ta call's own `offset=` emits `plot-offset-overrides-ta-offset`.

  The conformance harness's `plot-field` assertion gains an `xShift` field,
  and a new scenario pins both shift directions plus the unshifted value
  series.

- 6235ad7: Make the compute bar's OHLCV + derived fields directly indexable as a series.

  `bar.close`, `bar.open`, `bar.high`, `bar.low`, `bar.volume`, and the derived
  `bar.hl2` / `bar.hlc3` / `bar.ohlc4` / `bar.hlcc4` are now `PriceSeries` /
  `VolumeSeries` (`number & Series<number>`) on the bar passed to `compute`
  (`ComputeContext.bar`, typed as the new `BarSeries`). Each field is **both** a
  scalar — `bar.close * 2`, `plot(bar.close)`, `ta.ema(bar.close, 20)` keep
  working unchanged — **and** an indexable series, so a script can read prior
  bars directly:

  ```ts
  const sma5 =
    (bar.close[0] + bar.close[1] + bar.close[2] + bar.close[3] + bar.close[4]) /
    5;
  ```

  This removes the `ta.ema(bar.close, 1)` identity-trick that scripts previously
  needed to "republish" a scalar price as an indexable `Series`.

  The adapter-supplied candle type `Bar` (and `request.lowerTf` intrabar bars) is
  unchanged — it stays scalar OHLCV; only the streaming `compute` bar gains the
  series shape. `request.security`'s higher-timeframe bar remains the separate
  `SecurityBar`.

  Migration note: because the field is now an object, `Number.isFinite(bar.close)`
  is always `false` (it does not coerce) and `bar.close === 42` is `false` (object
  vs number). Use `bar.close.current` or `+bar.close` in those raw-number
  contexts. `bar.point(0, bar.close)` continues to work — the runtime coerces the
  anchor price to a scalar.

- 3bf391a: Add the `draw.fillBetween(edgeA, edgeB, opts?)` drawing primitive — a
  native filled ribbon between two edges (the closed polygon `edgeA`
  forward then `edgeB` reversed). It is the chartlang equivalent of Pine's
  `linefill.new(line1, line2, color)` / `fill(plot1, plot2)`. The
  pine-converter now lowers static two-line `linefill.new` to it instead of
  approximating with `draw.rotatedRectangle`, retiring the
  `linefill-rotatedrect-approximated` diagnostic.
- 8086003: Add an optional presentation-only `z` (render-order / z-index) option to
  `plot()` and every `draw.*` primitive. Default `0`; higher renders on
  top, ties fall back to the existing group + declaration order. Finite
  numbers only. Affects stacking only — values, alerts, and `state.*` are
  unchanged.

  Adapter kit: `PlotEmission` and `DrawingEmission` gain the matching
  presentation-only `z?: number` wire field, validated by
  `validateEmission` as a finite number (NaN / ±Infinity rejected;
  fractional and negative allowed). Omitted/`0` stays byte-identical to a
  pre-feature emission, so existing goldens and conformance hashes are
  untouched.

  Runtime: `plotImpl` reads `opts.z`, and the drawing-emit path
  (`createDrawingHandle`) lifts `z` out of `state.style` — into a shallow
  clone with `z` removed, where the per-kind `draw.*` impls fold the opts
  bag — and threads it onto the top-level `PlotEmission.z` /
  `DrawingEmission.z` with the same omit-when-`0` conditional spread used
  for `xShift`. `z` is persisted **beside** the drawing slot's `state`
  (never inside `DrawingState`), so an `update` retains the last value. A
  no-`z` plot or drawing emits no `z` key — byte-identical to the
  pre-feature baseline. `draw.table` / `draw.group` do not carry `z` in
  v1.

  Pine converter: `explicit_plot_zorder` is now a recognized no-op instead
  of an unmapped warning. chartlang already layers marks by declaration
  order within their group (the normative ordering contract), which is
  exactly what Pine's `explicit_plot_zorder=true` makes authoritative — so
  the flag is satisfied by default and needs no chartlang option.
  `mapDeclarationArgs` no longer raises `indicator-arg-not-mapped` for it;
  instead it emits a single `explicit-plot-zorder-default` info note
  (covering both `explicit_plot_zorder=true` and the Pine-default
  `=false`). The converter still never _emits_ a numeric `z` — Pine has no
  per-element z source construct. Other unmapped `indicator(...)` args
  (`timeframe`, etc.) keep warning.

  Compiler: the ambient `@invinite-org/chartlang-core` `.d.ts` shim gains a
  `ZOrdered { z?: number }` mixin intersected into `PlotOpts` and every
  `draw.*` option type (mirroring core's `drawingStyle.ts`), so a compiled
  script's `plot(value, { z })` **and** `draw.*(…, { z })` type-check (the
  shim stays in lockstep with core).

  Conformance: a new `z-order` scenario pins the plot `z` →
  `PlotEmission.z` wire contract — a `plot(value, { z: -1 })` emits
  `z: -1`, a no-`z` plot omits the field (omit-when-`0` byte-identity), and
  a value-hash proves `z` never transforms the series. The `plot-field`
  assertion's `field` union widens to also accept `"z"`.

- 073f41b: Add the higher-timeframe expression/callback overload to `request.security`.
  Alongside the existing data form `request.security({ interval })` →
  `SecurityBar`, scripts can now write `request.security({ interval }, (bar) =>
…)` → `Series<number>`, where the callback runs on the **higher-timeframe
  clock** — `request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20))`
  is a true weekly EMA(20) (20 weekly bars), not 20 main bars of a weekly-stepped
  series. The result is aligned no-lookahead down to the main timeline.

  - **core** — the `SecurityExpr` callback type (re-exported from the package
    root), the second `security` overload, and the shared `statefulPrimitives`
    entry annotated as covering both arities.
  - **compiler** — records one `SecurityExpressionDescriptor { slotId, interval,
paramName }` per expression callsite in `manifest.securityExpressions`
    (sorted by `slotId`, omitted for the data-only form), and validates each
    callback against the allowed subset — its `bar` parameter and body locals,
    the ambient `ta` / `inputs`, safe `Math.*` globals, and literals — rejecting
    any captured outer binding with the new
    `request-security-expr-captures-local` diagnostic.
  - **runtime** — mounts one `SecurityExprRunner` per manifest entry: the
    callback is captured lazily on the first main compute, driven once per HTF bar
    close through a dedicated fold `StreamState` so `ta.*` accumulate on the HTF
    clock, and one sampled value per HTF bar feeds a per-slot output buffer that
    `request.security(opts, expr)` returns aligned no-lookahead to the main
    timeline. Capability / interval / stream fallbacks return an all-NaN series
    with a deduped diagnostic.
  - **host-worker / host-quickjs** — boot the expression form unchanged; the
    `__manifest` sidecar already carries `securityExpressions`.
  - **pine-converter** — Pine's `request.security(sym, "D", ta.ema(close, 9))`
    now lowers to the chartlang callback form
    `request.security({ interval: "1d" }, (bar) => ta.ema(bar.close, 9))` (a bare
    OHLCV third arg keeps lowering to the data form).
  - **conformance** — new scenarios prove the weekly expression value differs
    from a same-length main-timeframe EMA, plus the `multiTimeframe: false` NaN
    fallback.

- 5a9c24d: Add `state.series(init)` — a writable, indexable user series. Store an
  arbitrary value each bar (`s.value = expr`) and read its history N bars
  back (`s[1]`). Number-coercible (`+s`, `s.current`) and usable as a `ta.*`
  source. The Pine converter lowers a history-indexed `var` to it.
- 08c536c: Add the `ta.highestbars` / `ta.lowestbars` primitives plus the cross-package
  wiring that makes them usable as drawing anchors and Pine-converter targets.

  - **core / runtime:** `ta.highestbars(source, length, opts?)` and
    `ta.lowestbars(source, length, opts?)` return the bar OFFSET (≤ 0) to the
    highest / lowest `source` value over the trailing `length` bars (window
    INCLUDES the current bar). `0` → current bar is the extreme; `-k` → the
    extreme occurred `k` bars ago. Ties resolve to the most recent bar; NaN
    inputs are skipped; warmup is `length − 1` bars; tick-mode replays the
    in-progress head as the offset-0 candidate. Registered in
    `STATEFUL_PRIMITIVES` (now 174 entries) and `TA_REGISTRY` (now 96 entries).
  - **compiler:** a literal-length `ta.highestbars` / `ta.lowestbars` call
    contributes `length − 1` toward `maxLookback`, so the runtime sizes the time
    ring buffer deep enough for a `bar.point(<that offset>, …)` anchor to resolve.
    A non-literal length contributes 0.
  - **pine-converter:** `ta.highestbars` / `ta.lowestbars` now map to the real
    chartlang primitives (previously lossy passthroughs to `ta.highest` /
    `ta.lowest`). **Behavior change:** a DYNAMIC `bar_index + <non-literal>`
    drawing-x anchor no longer raises the hard `requires-bar-interval` error —
    the offset is resolved by `bar.point` at runtime sign-agnostically (a
    negative runtime offset, e.g. what `ta.highestbars` returns, resolves to the
    historical timestamp via the time buffer). Only the literal `bar_index + N`
    future case still requires a bar interval.
  - **conformance:** new `TA_HIGHEST_LOWEST_BARS_SCENARIO` export pins both
    primitives end-to-end through the compiler + runtime over the bundled
    `goldenBars.json` fixture, and is added to `ALL_SCENARIOS`.

### Patch Changes

- 850ae21: Promote every remaining `@experimental` symbol to `@stable`. The entire
  `pine-converter` public surface, the three `pineConverterRoundTrip*` conformance
  scenarios, and `runtime/barPoint.ts` now carry the stable maturity marker.
  Annotation-only — no behavior, API, or output changes; goldens and conformance
  reports are byte-identical. The hand-authored `docs/converter/index.md`
  stability line is updated to match.
- Updated dependencies [850ae21]
- Updated dependencies [ca19e20]
- Updated dependencies [6235ad7]
- Updated dependencies [3bf391a]
- Updated dependencies [8086003]
- Updated dependencies [850ae21]
- Updated dependencies [073f41b]
- Updated dependencies [5a9c24d]
- Updated dependencies [08c536c]
  - @invinite-org/chartlang-core@1.2.0
  - @invinite-org/chartlang-adapter-kit@1.3.0

## 1.1.1

### Patch Changes

- 71ea0a5: Inline original TypeScript sources into emitted `.js.map` files (`inlineSources: true`). Published sourcemaps no longer reference missing `../src/*.ts` files, fixing "points to missing source files" warnings in downstream bundlers (e.g. Vite).
- Updated dependencies [71ea0a5]
  - @invinite-org/chartlang-adapter-kit@1.2.1
  - @invinite-org/chartlang-core@1.1.1

## 1.1.0

### Minor Changes

- 2123181: `createScriptRunner` accepts `CompiledScriptBundle`, mounting a
  `DepRunner` per private dep + `SiblingRunner` per drawn export.
  Executes deps + siblings before the primary each bar; filters
  emissions per export-status; surfaces `dep-error` with parent-bar
  halt semantics. `__chartlang_depOutput` is exposed via the new
  `@invinite-org/chartlang-runtime/internal` subpath for compiler-
  emitted bundles. Single-`CompiledScriptObject` callers byte-identical.
- 2123181: Structured `StateSnapshot` carrying per-runner slot sections (primary +
  siblings + dependencies) so a `CompiledScriptBundle`'s cold-replay
  emissions match its warm-restart emissions byte-identically. Slot keys
  now carry the active runner's `slotIdPrefix` everywhere they reach a
  `StateStore` (`dep:<localId>/` for deps, `export:<exportName>/` for
  siblings, empty for the primary). Flat-shape snapshots from before this
  release continue to load back-compat as primary-only.
- 2123181: Indicator composition (Phase 7 closeout): one chartlang indicator can
  read another indicator's titled plot output as a typed `Series<number>`.

  - Compose via local `const` binding plus `<binding>.output("title")` —
    no new public API beyond the chainable `.output` / `.withInputs`
    accessors on `CompiledScriptObject`.
  - A single `.chart.ts` MAY declare a default export plus any number of
    named exports plus any number of private `const` deps. Export form
    determines render policy: drawn exports render with the
    `export:<exportName>/` slot-id prefix; private `const` deps are data
    feeds only and their visuals are dropped.
  - Cross-file `import baseTrend from "./base-trend.chart"` resolves
    recursively; shared producers inline exactly once per consumer.
  - Additive within `apiVersion: 1.x`. The 172-entry
    `STATEFUL_PRIMITIVES` set is unchanged. `DiagnosticCode` widens to 32
    with the new `dep-*` codes (`dep-error`, `dep-cycle`,
    `dep-unknown-output`, `dep-invalid-input-override`, `dep-dynamic`,
    `dep-output-not-titled`).
  - Five conformance scenarios in `@invinite-org/chartlang-conformance`
    pin the runtime contract end-to-end (`dep-private-single-file`,
    `dep-multi-export`, `dep-cross-file`, `dep-diamond`,
    `dep-error-halts-parent`). `Scenario.additionalSources` lets
    cross-file scenarios ship producer + consumer side-by-side.
  - Two new example scripts in `examples/scripts/`:
    `base-trend.chart.ts` (producer) + `trend-confirmation.chart.ts`
    (multi-export consumer). React-demo gains a fifth catalogue entry
    exercising the feature end-to-end in the browser.
  - Docs: `docs/language/indicator-composition.md` narrative guide,
    `docs/spec/manifest.md` + `docs/spec/semantics.md` +
    `docs/spec/versioning.md` updates, five new glossary entries.

- 2123181: Light up the end-to-end cross-file dep path for indicator composition. The
  compiler's `rewriteDependencyAccessors` transformer now collapses
  `const <alias> = <root>.withInputs({...})...` chains to the bare root
  identifier so the runtime sentinel never fires at module load; the merged
  effective inputs flow through the `__dependencies[i].inputOverrides` slot
  into the runtime's `DepRunner`. Cross-file producers' `@invinite-org/chartlang-core`
  imports are hoisted above the inlined IIFE so esbuild dedupes them against
  the consumer's imports and pulls in every symbol the producer uses
  (`input.int`, `ta.ema`, …). The `__dependencies` export is now prepended
  pre-bundle so esbuild's tree-shaker keeps each alias binding alive. The
  `dep-cross-file` conformance scenario joins `ALL_SCENARIOS` and the suite
  runs 225 scenarios green.
- 4d77f4d: Apply host-supplied plot overrides at emit time and add a live `setPlotOverrides` channel. The runtime resolves an initial `plotOverrides` map at mount (`args.plotOverrides ?? args.resolvePlotOverrides?.(...)`), applies the matching `PlotOverride` to every `PlotEmission` by `slotId` via the new pure `applyPlotOverride` helper (visibility / color / line width / line style for line-family kinds; silent no-op otherwise), and exposes `ScriptRunner.setPlotOverrides(next)` for a recompute-free live swap. Both `host-worker` and `host-quickjs` forward an initial `plotOverrides` on the `load` frame (mirroring `inputOverrides`) and relay a new `setPlotOverrides` host→guest frame; `ScriptHost.setPlotOverrides(...)` is added for cross-host parity. Fully additive: with no overrides supplied, every emission is byte-identical to before (the `visible` field is omitted unless a slot is explicitly hidden).
- 0427459: Turn `paneResolver.ts` into a real pane router. `RuntimeContext` now
  carries mount-resolved `defaultPane` + `scriptPane` keys derived from
  `manifest.overlay` / `manifest.name`: `overlay: false` scripts default
  to a sanitised `script:<name>` subpane, and explicit `pane: "new"`
  coalesces to one stable per-script subpane. Named panes pass through
  unchanged when the adapter declares `subPanes >= 1`; on `subPanes: 0`
  adapters everything still folds to overlay with the existing
  `unsupported-pane` diagnostic. `hline()` now routes `opts.pane` through
  the same resolver instead of hard-coding `pane: "overlay"`.

  Step 2 of the `subpane-rendering` feature. Additive for `overlay: true`
  and no-`overlay` scripts (byte-identical overlay emissions); `overlay:
false` scripts now emit a non-overlay pane string, which is the
  explicit intent of the feature. The canvas2d adapter and demos consume
  these keys in tasks 3-5.

### Patch Changes

- Updated dependencies [d6d1a1f]
- Updated dependencies [f0c8eb8]
- Updated dependencies [2123181]
- Updated dependencies [2123181]
- Updated dependencies [2123181]
- Updated dependencies [2123181]
- Updated dependencies [4d77f4d]
- Updated dependencies [3b4952d]
- Updated dependencies [0427459]
  - @invinite-org/chartlang-core@1.1.0
  - @invinite-org/chartlang-adapter-kit@1.2.0

## 1.0.2

### Patch Changes

- 9f5d7cb: `onHistory` now accumulates emissions across the bulk history walk so a single `drain` after a `history` event returns every bar's emissions (PLAN §6.1), instead of only the final bar's. Previously the per-bar reset inside `onBarClose` (correct for per-event drains) discarded the prior bars' emissions because `onHistory` walked the bars with no accumulator. Visible symptom in adapter consumers: indicator plots only rendered for the streamed tail after warmup, not the bulk-filled history.

## 1.0.1

### Patch Changes

- 98599b2: Clamp `adxFromDi` outputs to [0, 100]: the Wilder seed mean and recurrence could overshoot 100 by a few ulps of floating-point error.
- d1de692: Fix end-user-blocking Node-ESM packaging bug. Every published `dist/index.js` previously failed to load under Node's strict ESM resolver because `tsc` had been configured with `moduleResolution: "Bundler"` and emitted relative specifiers verbatim, so `dist/index.js` carried `from "./api"` (extensionless) and Node rejected the resolution. Workspace consumers never saw this because tsx / vitest / Vite resolve loosely, but `npm install @invinite-org/chartlang-compiler` followed by `import` failed immediately for any Node consumer, and `examples/react-demo/vite.config.ts`'s server-side compile plugin broke at dev-config-load time.

  This release switches `tsconfig.base.json` to `module: "NodeNext"` / `moduleResolution: "NodeNext"`, and rewrites every relative import / export / dynamic-import / `typeof import("…")` specifier across all packages' source to carry an explicit `.js` (or `/index.js`) suffix. The new resolution mode also surfaces this bug class as a compile error rather than runtime breakage, so it cannot regress.

  No behavioural change for runtime consumers — the rewritten specifiers resolve to the same TypeScript sources at build time and the same `dist/<path>.js` files at consumer-load time.

- Updated dependencies [4d44a9c]
- Updated dependencies [d1de692]
- Updated dependencies [98599b2]
  - @invinite-org/chartlang-adapter-kit@1.1.0
  - @invinite-org/chartlang-core@1.0.1

## 1.0.0

### Major Changes

- chartlang `1.0.0` -- the `apiVersion: 1` standard.

  - `apiVersion: 1` frozen: compiler accepts only the frozen language
    version; `STATEFUL_PRIMITIVES` locked at 172 entries by exact
    name-set; every shipping export `@stable`; pre-1.0 deprecations
    removed (`PHASE_1_SCENARIOS`).
  - Canonical language spec published (`docs/spec/`): grammar,
    semantics, manifest, emissions, versioning -- self-contained for
    alternate implementations. The `v1.0.0` tag is the frozen spec
    snapshot.
  - Public conformance reports: `pnpm conformance --report` emits
    `CONFORMANCE.md` + `conformance-report.json`; canvas2d reference
    report published and drift-gated.
  - Adapter-author path proven end-to-end: scaffolded adapters ship a
    wired conformance test; full writing-an-adapter tutorial +
    Lightweight Charts porting walkthrough.
  - Pine migration guide finalised with a pattern-coverage matrix
    audited against the top ~50 Pine scripts.

### Minor Changes

- d14a034: Add phase 5 server alerts, multi-timeframe request handling, runtime persistence, QuickJS hosting, expanded plot and table rendering, color helpers, alert conditions, and volume profile primitives.
- 3cfff10: Add lower-timeframe bar bucketing and cache helpers.
- 3cfff10: Phase 6 closeout for Tier-3 ergonomics and lower-timeframe support.
- 3cfff10: Wire runtime `request.lowerTf`, advertise sub-minute canvas2d intervals, and add LTF conformance scenarios.

### Patch Changes

- Pre-1.0 surface cleanup: remove the deprecated `PHASE_1_SCENARIOS`
  alias (use `ALL_SCENARIOS`) and promote every shipping export from
  `@experimental` to `@stable` ahead of the `apiVersion: 1` freeze.
- Updated dependencies [d14a034]
- Updated dependencies [3cfff10]
- Updated dependencies [3cfff10]
- Updated dependencies [3cfff10]
- Updated dependencies [3cfff10]
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @invinite-org/chartlang-adapter-kit@1.0.0
  - @invinite-org/chartlang-core@1.0.0

## 0.5.0

### Phase 5

#### Minor Changes

- Ship Phase 5 `defineAlertCondition`, compiler manifest extraction, runtime `signal()` emissions, adapter validation, and conformance coverage per PLAN §11.2.
- Add `draw.table` with `TableCell`/`TablePosition` types, runtime emission,
  viewport-anchored canvas2d rendering, and conformance coverage per PLAN §10.2.
- Add Phase 5 plot kinds, runtime emission dispatch, validation, conformance scenarios, and canvas2d reference renderers.
- Add the PLAN.md §6.8 HTF-to-LTF alignment kernel and WeakMap cache ported from invinite commit 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
- Add the Phase 5 `runtime.log.*` and `runtime.error()` surface, log emissions, runtime halt diagnostics, and conformance coverage.
- Add the PLAN.md §6.9 persistent runtime snapshot store, warm-start restore flow, close/dispose snapshot saves, and snapshot diagnostics.
- Replace the Phase 4 `request.security` NaN-only path with real
  multi-timeframe secondary stream alignment per PLAN.md §6.8 and §7.2.
  Adapters can route tagged `CandleEvent.streamKey` candles, the worker
  host dispatches them through `ScriptRunner.push`, conformance includes
  MTF scenarios, and the private canvas2d reference adapter now declares
  `multiTimeframe: true`.
- Port `ta.anchoredVolumeProfile` from invinite commit 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4, adding the PLAN §9.2 horizontal-histogram volume-profile primitive and PLAN §10.1.1 input-time anchor workflow.
- Add `ta.fixedRangeVolumeProfile`, completing the Phase 5 volume-profile set
  from PLAN §9.2 and §10.1.1 with fixed `[from, to]` anchors, frozen post-range
  histograms, and `fixed-range-inverted` diagnostics. Ported from invinite
  commit `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4`.
- Port `ta.sessionVolumeProfile` from invinite commit 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4, adding the PLAN §9.2 horizontal-histogram session volume-profile primitive, PLAN §4.8 syminfo-session fallback diagnostics, and compiler/runtime registration.
- Add `ta.visibleRangeVolumeProfile` per PLAN §9.2, ported from invinite commit `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4`, with runtime histogram emission, compiler/core type surfaces, conformance coverage, and generated docs.

#### Patch Changes

- Snapshot alert metadata at emission time so later Proxy revocation or source
  mutation cannot corrupt host drain serialization.
- Port the Phase 5 volume-profile shared math helpers for PLAN §9.2 and the §10.1.1 anchored profile primitives from invinite commit 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @invinite-org/chartlang-core@0.5.0
  - @invinite-org/chartlang-adapter-kit@0.5.0

## 0.4.0

### Minor Changes

- 3f3ce38: Replace the Phase-0 placeholder with the Phase-1 runtime data
  structures: `RingBuffer<T>` + `Float64RingBuffer` per PLAN.md §6.6,
  `makeSeriesView` Proxy with stable identity across bars,
  `createStreamState` (10-field OHLCV ring-buffer set + mutable `BarView`
  - cached `Series<number>` views + `taSlots` map), `StateStore`
    interface + `inMemoryStateStore` default, and `RuntimeContext` +
    `ACTIVE_RUNTIME_CONTEXT` slot. Add `@invinite-org/chartlang-core` and
    `@invinite-org/chartlang-adapter-kit` as workspace dependencies and
    `fast-check ^3.20.0` as a devDep (first consumer; Tasks 6-7 reuse).
    The execution loop and primitives land in Tasks 6-8.
- 3f3ce38: Add the Phase-1 emission primitives (`plot` / `hline` / `alert`) plus
  the supporting `emissionsQueue` push helpers, the shared pane
  resolver, and the FNV-1a alert dedupe-key hash. Each primitive runs
  against `ACTIVE_RUNTIME_CONTEXT`, gates against the adapter's
  `Capabilities` per PLAN §7.4 silent-no-op semantics, validates via
  `@invinite-org/chartlang-adapter-kit`'s `validateEmission` at the
  push boundary, and dedupes on `(slotId, bar)`. The runtime exports
  expose dual signatures — script-facing `(value, opts?)` matches the
  `ComputeContext` typing while the compiler-injected `(slotId, value,
opts?)` is what actually executes. Replaces the Task-6 throw-stub
  bodies in `primitives.ts`; identity is preserved through the barrel
  chain.
- 3f3ce38: Add `createScriptRunner` + the per-bar execution loop (`onHistory` /
  `onBarClose` / `onBarTick` / `drain` / `dispose`) per PLAN §6.1 + §6.7.
  The runner owns the `bar` / `series` synchronisation invariants, the
  per-bar emission queue reset, and the `ACTIVE_RUNTIME_CONTEXT` slot
  mutation around `compute`. Introduces a throw-stub `primitives.ts`
  seam at `ta` / `plot` / `hline` / `alert` that Tasks 7-8 replace with
  the real stateful implementations. End-to-end no-primitive `compute`
  scripts now run through the full lifecycle, pinned by a 500-bar
  determinism test and four §6.7 property invariants under fast-check.
- 3f3ce38: Port the nine Phase-1 `ta.*` primitives (`sma` / `ema` / `stdev` / `bb`
  / `rsi` / `macd` / `atr` / `crossover` / `crossunder`) plus the shared
  math helpers (`applyOffset`, `readSourceField`, `pickCandleSource`,
  `smaFloat64`, `emaFloat64`, `rollingStddev`, `trSeries`,
  `wilderSmoothing`) from the invinite reference math at HEAD
  `d2d1043c1b039f66d2f3674526d303d31cf2f1e0`. Each primitive ships with
  the §16.6 five-file test set (impl + unit + property + golden +
  bench-threshold pair) and uses the chartlang primitive shape — a
  slot-aware function with cached `Series<T>` output identity, an
  `onBarTick` head-replace mode, and JSON-clean slot state for Phase-5
  persistence. The runtime barrel re-exports `ta` (the script-facing
  namespace, identity-equal to `TA_REGISTRY`), `TA_REGISTRY` (the
  frozen 9-entry map Task 9's worker boot iterates), and
  `RuntimeTaNamespace` (the slot-prefixed type). `primitives.ts` swaps
  its `ta` throw-stub body for the real registry while preserving
  identity, so `buildComputeContext` and `createScriptRunner` need no
  change. BB and MACD compose their sub-EMAs / SMA / stdev via derived
  sub-slot ids — a fix to a leaf primitive propagates for free.
- 38fb475: Phase 2 — `0.2` full indicator parity.

  - 81 new `ta.*` primitives (6 cross-functional + 75 §9.2 ports);
    `TA_REGISTRY` cardinality 9 -> 90; `STATEFUL_PRIMITIVES`
    cardinality 12 -> 93.
  - 5 new chained-MA helpers + 5 new stats/volatility helpers in
    `packages/runtime/src/ta/lib/`.
  - 6 new `PlotKind`s (histogram, bars, area, filled-band, label,
    marker) + canvas2d renderers + `validateEmission` arms.
  - `Bar` extended with `hl2` / `hlc3` / `ohlc4` / `hlcc4` derived
    source fields — runtime already pre-computes on `BarView`.
  - `Scenario` extended with `inlineSource?: string` so Phase-2
    scenarios stay self-contained without bloating
    `examples/scripts/`.
  - `STATEFUL_PRIMITIVES` shape widened from `ReadonlySet<string>`
    to `ReadonlySet<{ name: string; slot: boolean }>` to support
    `ta.nz` (the only stateless `ta.*`).
  - Universal `opts.offset` honoured on every `ta.*` primitive
    (Phase-1 backfill in Task 29).
  - `chartlang docs` subcommand generates
    `docs/primitives/ta/<id>.md` per primitive.
  - `PHASE_2_INDICATORS` + `PHASE_5_DEFERRED` inventories exported
    from `@invinite-org/chartlang-conformance` and pinned by
    `phase2Coverage.test.ts` (Task 30).
  - 100% coverage maintained across every published package.
  - `apiVersion: 1` script header unchanged; Phase 2 is additive
    at runtime.

- 38fb475: Phase-2 Task 5 — cross-functional `ta.*` primitives + `STATEFUL_PRIMITIVES`
  shape evolution.

  Ships six new Pine-canonical `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.nz(value, replacement?)` — stateless NaN-replacement.
  - `ta.highest(source, length)` — rolling max (monotone deque + window
    recompute).
  - `ta.lowest(source, length)` — rolling min (mirror of `highest`).
  - `ta.change(source, opts)` — first-difference `source[0] − source[length]`.
  - `ta.valuewhen(condition, source, occurrence)` — source value at the
    n-th most recent matching bar.
  - `ta.barssince(condition)` — bars since the last `condition === true`.

  Each primitive ships the §22.10 set: impl + unit + property + golden +
  bench pair + conformance scenario (using the Phase-2 `inlineSource`
  extension from Task 1) + auto-generated `docs/primitives/ta/<id>.md`.

  `STATEFUL_PRIMITIVES` widens from `ReadonlySet<string>` to
  `ReadonlySet<{ name: string; slot: boolean }>` so `ta.nz` (the only
  stateless cross-functional primitive) can opt out of compiler slot-id
  injection. Phase-1 entries flip to `slot: true`; `ta.nz` is the only
  `slot: false` entry; the set cardinality grows from 12 → 18. The shape
  update cascades through every compiler consumer
  (`packages/compiler/src/api.ts`, `program.ts`,
  `analysis/statefulCallInLoop.ts`, `transformers/callsiteIdInjection.ts`,
  and their tests). The `statefulCallInLoop` analysis still flags every
  entry inside a loop body — `slot: false` primitives are forbidden in
  loops by Pine-parity convention.

  `TA_REGISTRY` cardinality grows from 9 → 15. `RuntimeTaNamespace`
  mirrors core's `TaNamespace` 1:1 with the standard `slotId` first-arg
  on every method except `nz` (which carries the script-author signature
  verbatim).

  Compiler change is `patch`-level — the public API surface is
  unchanged; only the internal `STATEFUL_PRIMITIVES` parameter shape
  widens. Core/runtime/conformance bump `minor` for the new exports and
  the new scenarios.

- 38fb475: Phase-2 Task 4 — stats / volatility / regression / pearson helpers.

  Ports five new internal helpers into `packages/runtime/src/ta/lib/`:

  - `donchianMid(high, low, length)` — `(max(high) + min(low)) / 2`
    over a trailing window. Consumed by `ta.donchian` (Task 18) and
    `ta.ichimoku` (Task 17).
  - `wilderDirectional(high, low, close, length)` — Wilder `+DM` /
    `-DM` + `+DI` / `-DI` per bar, smoothed via `wilderStep` (reused
    from Phase-1 `lib/wilderSmoothing.ts`). Consumed by `ta.dmi` and
    `ta.adx` (Task 16).
  - `adxFromDi(plusDi, minusDi, length)` — `DX = 100 * |+DI - -DI| /
(+DI + -DI)`, Wilder-smoothed over `length`. Consumed by `ta.adx`
    (Task 16).
  - `linearRegression(source, length)` — rolling OLS slope /
    intercept / value at the last bar of the window. Consumed by
    `ta.lsma` (Task 8), `ta.dpo` (Task 10), and Phase-3's
    `regressionTrend` drawing.
  - `pearson(a, b, length)` — rolling Pearson correlation of two
    equal-length series, output clamped to `[-1, 1]`. Consumed by
    `ta.trendStrengthIndex` (Task 17); future Phase-5
    `correlationCoeff` shares the helper.

  Each helper carries the §16.6 test set scoped to its hot-path
  status: unit + property tests for all five; bench pair for
  `wilderDirectional`, `linearRegression`, and `pearson`
  (`donchianMid` and `adxFromDi` reduce to two Math.max/min scans
  and a Wilder smooth respectively — the consumer primitive benches
  in Tasks 16, 18 cover the perf surface).

  All five helpers carry the 4-line provenance header pinned at
  invinite commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`.

- 38fb475: Phase-2 Task 7 — MA ports (`ta.dema`, `ta.tema`, `ta.kama`, `ta.alma`).

  Adds four chained / adaptive moving averages on top of the Phase-1
  EMA primitive + the Task-6 MA backbone. DEMA / TEMA compose EMA
  sub-slots through `TA_REGISTRY` (`${slotId}/ema1` / `/ema2` / `/ema3`);
  KAMA is Kaufman's adaptive MA with an efficiency-ratio-driven
  smoothing constant; ALMA is the Arnaud Legoux MA with a precomputed
  Gaussian weight kernel.

  Each primitive ships the §22.10 set (impl + four test layers +
  conformance scenario + auto-generated docs page). ALMA's `offset`
  opt is the Gaussian-centre position in `[0, 1]` (default `0.85`) —
  distinct from the universal bar-shift, which lives on `opts.barShift`
  for ALMA only.

  Compiler patch: the ambient shim mirrors the four new
  `TaNamespace` methods + opt bags.

- 38fb475: Phase-2 Task 8 — final §9.2 MA ports (`ta.lsma`, `ta.mcginley`, `ta.maRibbon`).

  Closes out the §9.2 moving-averages list. `ta.lsma` is the linear-
  regression value at the trailing window (reuses Task-4's
  `linearRegression` helper for the property-test reference);
  `ta.mcginley` is the McGinley Dynamic recurrence with NaN-correct
  zero-anchor handling; `ta.maRibbon` is a fan of K MAs at different
  lengths, dispatched per-bar through `TA_REGISTRY`'s registered MA
  primitives (`sma` / `ema` / `wma` / `smma`) via sub-slot ids
  `${slotId}/ma_<length>`.

  `MaRibbonResult` is a dynamic-keyed record `{ ma_<length>:
Series<number> }`. The exported `maRibbonOutputKeys(opts)` helper
  returns the ordered keys for stable iteration. `maRibbon` is
  registry-tagged as multi-output via `TA_REGISTRY_METADATA` with its
  default `primarySeriesKey: "ma_50"` + default visible keys
  `["ma_10", "ma_20", "ma_30", "ma_40", "ma_50"]` + `{ kind: "auto" }`
  y-domain — runtime metadata for legend chips and pane axes.

  Core also adds the `MaTypeNoVolume` string-literal union (parallel to
  the runtime's `lib/maTypes.ts` alias) so script authors can type the
  `maType` opt directly. Each primitive ships the §22.10 set (impl +
  four test layers + conformance scenario + auto-generated docs page).

  Compiler patch: the ambient shim mirrors the three new `TaNamespace`
  methods + opt bags + `MaTypeNoVolume` alias + `MaRibbonResult` type.

- 38fb475: Phase-2 Task 6 — MA ports (`ta.wma`, `ta.vwma`, `ta.hma`, `ta.smma`).

  Adds four moving-average primitives on top of the Task-3 chained-MA
  helpers. `ta.wma` is a linear-weighted MA over the trailing window;
  `ta.vwma` is the volume-weighted variant; `ta.smma` is Wilder's
  smoothed MA (α = 1/N); `ta.hma` is the Hull MA composed via three WMA
  sub-slots derived from the parent slot id (`${slotId}/half`,
  `${slotId}/full`, `${slotId}/final`).

  Each primitive ships the §22.10 set (impl + four test layers +
  conformance scenario + auto-generated docs page). The opts bags
  (`WmaOpts`, `VwmaOpts`, `HmaOpts`, `SmmaOpts`) carry the universal
  `offset` + `lineStyle` fields — typed surface only; the runtime
  wiring lands in Task 29's universal-offset backfill.

  Compiler patch: the ambient shim mirrors the four new
  `TaNamespace` methods + opt bags.

- 38fb475: Phase-2 Task 13 — momentum ports (`ta.ao`, `ta.cmo`, `ta.momentum`,
  `ta.roc`).

  Ships four new momentum primitives under `packages/runtime/src/ta/`:

  - `ta.ao(opts?)` — Awesome Oscillator. `SMA(hl2, fastLength) − SMA(hl2,
slowLength)`. Defaults to Pine-canonical `5` / `34`. Composes two
    `ta.sma` sub-slots (`${slotId}/fastSma`, `${slotId}/slowSma`); a fix
    to `sma` flows in for free.
  - `ta.cmo(source, length, opts?)` — Chande Momentum Oscillator. Range
    `[-100, 100]`. Trailing-window of per-bar gain / loss diffs with
    incremental sum maintenance + flat-line (zero-denominator) NaN
    guard.
  - `ta.momentum(source, length, opts?)` — Pine `mom`. First-difference
    `source[0] − source[length]`. Implemented as a thin shim around
    `ta.change` (`${slotId}/change` sub-slot) — no private subtraction
    loop.
  - `ta.roc(source, length, opts?)` — Rate of Change. `100 ×
(source[0] − source[length]) / source[length]`. Zero lookback →
    NaN.

  Each primitive ships the §22.10 set: impl + unit + property + golden +
  bench pair + conformance scenario (using the Phase-2 `inlineSource`
  extension from Task 1) + auto-generated `docs/primitives/ta/<id>.md`.

  `STATEFUL_PRIMITIVES` gains four new `slot: true` entries; `TaNamespace`

  - `RuntimeTaNamespace` gain four new methods; `TA_REGISTRY` gains four
    new entries. Four new opts types exported from core: `AoOpts`,
    `CmoOpts`, `MomentumOpts`, `RocOpts` (each carries `offset?: number` and
    `lineStyle?: PlotLineStyle` forward-compat fields; `AoOpts` also
    carries `fastLength?: number`, `slowLength?: number`).

  Provenance: ported from `invinite/src/components/trading-chart/
indicators/{ao,cmo,momentum,roc}.ts` at commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`.

- 38fb475: Phase-2 Task 14 — momentum ports (`ta.pmo`, `ta.smi`, `ta.tsi`).

  Ships three double-smoothed momentum primitives under
  `packages/runtime/src/ta/`:

  - `ta.pmo(source, opts?)` — Carl Swenlin's Price Momentum Oscillator
    (`{ pmo, signal }`). Three-pass smoothing of the 1-bar ROC, scaled
    to PMO's characteristic ±10 swing range. The two inner stages use
    a non-canonical "Swenlin EMA" factor (`α = 2 / length`) instead of
    the standard `α = 2 / (length + 1)`; the signal-line EMA composes
    the canonical `ta.ema` via a `${slotId}/signal` sub-slot. Defaults
    `(firstSmoothing, secondSmoothing, signalLength) = (35, 20, 10)`
    per TradingView's published formula.
  - `ta.smi(opts?)` — William Blau's Stochastic Momentum Index
    (`{ smi, signal }`). Composes `ta.highest` over `bar.high` and
    `ta.lowest` over `bar.low` (`kLength` window) for the rolling
    midpoint and range, then double-EMA-smooths both numerator
    (`bar.close − midpoint`) and denominator (`range / 2`) through two
    EMA layers each, then computes `100 × numSmoothed / denSmoothed`
    and feeds it through a signal EMA. Bounded `[-100, 100]` (flat
    range → NaN at smi). Defaults `(kLength, firstSmoothing,
secondSmoothing, dLength) = (10, 3, 5, 3)`.
  - `ta.tsi(source, opts?)` — William Blau's True Strength Index
    (momentum-class; `{ tsi, signal }`). Double-EMA-smoothed ratio of
    one-bar price changes vs their absolute values, scaled ×100.
    Bounded `[-100, 100]` (flat input → NaN at tsi). Defaults
    `(firstSmoothing, secondSmoothing, signalLength) = (25, 13, 13)`
    per TradingView's published TSI study. Note: this is the
    **momentum**-class TSI; the **trend**-class True Strength Index
    ships in Task 17 as `ta.trendStrengthIndex`.

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md` page.

  `TA_REGISTRY_METADATA` extends with three new entries: `pmo` and
  `tsi` advertise `primarySeriesKey` + `visibleSeriesKeys` with
  `yDomain: { kind: "auto" }`; `smi` is `{ kind: "fixed", min: -100,
max: 100 }`.

  Core surface widens with `PmoOpts` / `PmoResult`, `SmiOpts` /
  `SmiResult`, `TsiOpts` / `TsiResult` plus matching `TaNamespace`
  methods and throw-sentinel stubs. `STATEFUL_PRIMITIVES` extends
  with `ta.pmo` / `ta.smi` / `ta.tsi` (all `slot: true`).

  Three conformance scenarios (`taPmo.scenario.ts`,
  `taSmi.scenario.ts`, `taTsi.scenario.ts`) registered against
  `ALL_SCENARIOS` via the Task-1 `inlineSource` extension.
  Plot-hash pinning deferred to Phase-2 closeout (Task 30) per the
  established cross-functional scenario convention.

  Provenance: ported from `invinite/src/components/trading-chart/
indicators/{pmo,smi,tsi}.ts` at commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`.

- 38fb475: Phase-2 Task 29 — Universal `opts.offset` backfill on Phase-1 primitives.

  Wires the universal `opts.offset` (PLAN.md §9.1) onto every Phase-1
  `ta.*` primitive: `sma`, `ema`, `stdev`, `bb`, `rsi`, `macd`, `atr`,
  `crossover`, `crossunder`. Positive `offset` shifts the returned
  series so `series.current` reads the value `offset` bars ago
  (matching `lib/applyOffset`'s `out[i] = values[i − offset]`
  semantics); negative `offset` reads into the future (NaN /
  undefined at the head). `offset === 0` is the strict identity
  fast path — returns the slot's cached un-shifted Series with the
  same reference as before this change (existing identity-pinned
  tests continue to pass).

  Surface expansion (core, minor):

  - `offset?: number` added to `SmaOpts`, `EmaOpts`, `StdevOpts`,
    `BbOpts`, `RsiOpts`, `MacdOpts`, `AtrOpts` (Phase-1 opts types
    that previously had no `offset` field).
  - New `CrossoverOpts` / `CrossunderOpts` types (the two cross
    primitives previously took no opts bag); `TaNamespace.crossover`
    / `crossunder` signatures gain an optional 3rd opts arg.
  - New `makeShiftedSeriesView` runtime helper next to
    `makeSeriesView` (in `packages/runtime/src/seriesView.ts`,
    re-exported from the runtime barrel) — wraps a `RingBufferLike<T>`
    in a Proxy that adjusts `at(n)` reads by `offset`.

  Composite primitives (`bb`, `macd`) shift all outputs in lockstep
  under a single `offset` value, returning a frozen result record
  cached per offset on the slot. Sub-slot outputs (sma's middle,
  ema's signal) are accessed through their captured ring-buffer
  reference so the parent primitive doesn't re-enter the sub-slot's
  compute on the shifted-view lookup.

  Compiler patch: the ambient shim in `packages/compiler/src/program.ts`
  mirrors the core type changes (new `offset?` fields + new
  `CrossoverOpts` / `CrossunderOpts` types + extended `TaNamespace`
  signatures).

  Goldens, bench thresholds, and conformance scenarios are
  unchanged — `offset === 0` is the default and exercises the
  existing code paths. New per-primitive `<id>.test.ts` and
  `<id>.property.test.ts` cases cover positive, negative, zero, and
  identity-cache behaviour for offset.

- 38fb475: Phase-2 Task 9 — oscillator ports: `ta.cci`, `ta.stoch`, `ta.williamsR`.

  Ships three foundational momentum / oscillator primitives under
  `packages/runtime/src/ta/`:

  - `ta.cci(source, length, opts?)` — Commodity Channel Index over a
    configurable source (typically `bar.hlc3`). Lambert constant
    `scaling = 0.015` hard-coded; flat-window (`meanDev === 0`) emits
    `NaN`. Unbounded by construction.
  - `ta.stoch(opts?)` — Stochastic Oscillator (`%K` + `%D`) over
    `bar.high` / `bar.low` / `bar.close`. Composes `ta.highest` +
    `ta.lowest` + two chained `ta.sma` smoothing layers via sub-slot
    ids. Bounded `[0, 100]` (or `NaN`). Defaults `(kLength=14,
kSmoothing=3, dLength=3)`.
  - `ta.williamsR(length, opts?)` — Williams %R over `bar.high` /
    `bar.low` / `bar.close`. Composes `ta.highest` + `ta.lowest`.
    Bounded `[-100, 0]` (or `NaN`).

  Each primitive ships the §22.10 set: impl + unit + property + golden

  - bench pair + conformance scenario (inlined per Task 1) +
    auto-generated `docs/primitives/ta/<id>.md`.

  Introduces a new metadata layer on the runtime registry:

  - `TA_REGISTRY_METADATA: Readonly<Partial<Record<keyof typeof
TA_REGISTRY, PrimitiveMetadata>>>` — per-primitive `primarySeriesKey`,
    `visibleSeriesKeys`, and `yDomain` hints for renderers (pane layout,
    legend ordering, y-axis scaling). `ta.stoch` records
    `primarySeriesKey: "k"`, `visibleSeriesKeys: ["k", "d"]`,
    `yDomain: { kind: "fixed", min: 0, max: 100 }`; `ta.williamsR`
    records `yDomain: { kind: "fixed", min: -100, max: 0 }`. Unbounded
    primitives (e.g. `ta.cci`, `ta.sma`) carry no metadata entry —
    consumers default to `auto`.

  Core surface widens with `CciOpts`, `StochOpts`, `WilliamsROpts` opts
  bags + `StochResult` two-output type, plus the matching `TaNamespace`
  methods and throw-sentinel stubs. `STATEFUL_PRIMITIVES` extends with
  `ta.cci` / `ta.stoch` / `ta.williamsR` (all `slot: true`). Compiler
  shim mirrors the new core surface.

  Three conformance scenarios (`taCci.scenario.ts`, `taStoch.scenario.ts`,
  `taWilliamsR.scenario.ts`) registered against `ALL_SCENARIOS` via
  the Task-1 `inlineSource` extension. Plot-hash pinning deferred to
  Phase-2 closeout (Task 30) per the established cross-functional
  scenario convention.

  DIVERGENCE from invinite reference (`stoch.ts`): the spec requires
  flat-window (`hh === ll`) → `NaN` at `k`, whereas invinite falls back
  to the prior valid kRaw (or 50 on the first slot, per TradingView).
  The task spec overrides; documented in the impl's provenance header.

  `CciOpts` intentionally narrows away invinite's `scaling` knob —
  chartlang hard-codes the canonical Lambert constant.

- 38fb475: Phase-2 Task 12 — oscillator ports: `ta.kst`, `ta.fisher`,
  `ta.klinger`, `ta.rvgi`.

  Ships four more multi-output oscillator primitives under
  `packages/runtime/src/ta/`:

  - `ta.kst(source, opts?)` — Know Sure Thing (Martin Pring, 1992).
    Weighted sum of four SMA-smoothed percentage ROCs plus an SMA
    signal line. Composes 4 `ta.sma` sub-slots for the per-ROC
    smoothing plus one `ta.sma` for the signal; the four percentage
    ROCs are computed inline against a shared `sourceWindow` ring
    (mirrors `ta.coppock` — `ta.change` emits absolute deltas, while
    KST needs percentage rate-of-change). Defaults
    `(10, 15, 20, 30, 10, 10, 10, 15, 9)`.
  - `ta.fisher(length, opts?)` — John Ehlers' Fisher Transform over
    rolling `bar.hl2`. Composes `ta.highest` + `ta.lowest` sub-slots;
    the clamp / atanh / EMA-blend recurrence is bespoke. The `trigger`
    output is the prior bar's `fisher` value (1-bar lag); first bar's
    `trigger` is NaN. Diverges from invinite's ±0.999 clamp per task
    spec — when the recurrence would drive `|x| ≥ 1` we emit NaN at
    `fisher` and hold the recurrence state.
  - `ta.klinger(opts?)` — Klinger Volume Oscillator. Per-bar Volume
    Force accumulator drives the difference of two `ta.ema` sub-slots
    (`fastLength` / `slowLength`); the `signal` is a third
    `ta.ema(klinger, signalLength)`. Defaults `(34, 55, 13)`.
  - `ta.rvgi(opts?)` — Relative Vigor Index (John Ehlers, 2002).
    4-bar `(1, 2, 2, 1) / 6` weighted numerator (`close − open`) and
    denominator (`high − low`), each smoothed via `ta.sma` sub-slot;
    `rvgi = numSma / denSma`. Signal is a 4-bar weighted sum of the
    rvgi line. Defaults `length = 10`; flat-range bars emit NaN.

  Each primitive ships the §22.10 set: impl + unit + property + golden

  - bench pair + conformance scenario (inlined per Task 1) +
    auto-generated `docs/primitives/ta/<id>.md`.

  Extends `TA_REGISTRY_METADATA` with four new entries (all
  `primarySeriesKey` + `visibleSeriesKeys`; all `yDomain: { kind:
"auto" }` per task §5):

  - `kst`: `primarySeriesKey: "kst"`, `visibleSeriesKeys: ["kst", "signal"]`.
  - `fisher`: `primarySeriesKey: "fisher"`, `visibleSeriesKeys: ["fisher", "trigger"]`.
  - `klinger`: `primarySeriesKey: "klinger"`, `visibleSeriesKeys: ["klinger", "signal"]`.
  - `rvgi`: `primarySeriesKey: "rvgi"`, `visibleSeriesKeys: ["rvgi", "signal"]`.

  Core surface widens with `KstOpts`, `FisherOpts`, `KlingerOpts`,
  `RvgiOpts` opts bags + `KstResult`, `FisherResult`, `KlingerResult`,
  `RvgiResult` two-output types, plus the matching `TaNamespace`
  methods and throw-sentinel stubs. `STATEFUL_PRIMITIVES` extends
  with `ta.kst` / `ta.fisher` / `ta.klinger` / `ta.rvgi` (all
  `slot: true`). Compiler shim mirrors the new core surface.

  Four conformance scenarios (`taKst.scenario.ts`,
  `taFisher.scenario.ts`, `taKlinger.scenario.ts`,
  `taRvgi.scenario.ts`) registered against `ALL_SCENARIOS` via the
  Task-1 `inlineSource` extension. Plot-hash pinning deferred to
  Phase-2 closeout (Task 30) per the established multi-output scenario
  convention.

- 38fb475: Phase-2 Task 10 — oscillator ports: `ta.ppo`, `ta.dpo`,
  `ta.connorsRsi`.

  Ships three derived oscillator primitives under
  `packages/runtime/src/ta/`:

  - `ta.ppo(source, opts?)` — Percentage Price Oscillator, the
    scale-invariant cousin of MACD. Three outputs (`{ ppo, signal,
hist }`) over `100 * (fastEma - slowEma) / slowEma`. Composes three
    `ta.ema` sub-slots (`${slotId}/fast`, `${slotId}/slow`,
    `${slotId}/signal`) per §9.4 — folds invinite's private EMA copy
    onto the canonical primitive. Defaults `(12, 26, 9)`. `slow === 0`
    emits `NaN` at the PPO line; signal can still be defined off prior
    values.
  - `ta.dpo(source, length, opts?)` — Detrended Price Oscillator
    (non-centered, TradingView default). `dpo[i] = source[i -
displacement] - sma[i]` with `displacement = floor(length / 2) +
1`. Composes one `ta.sma` sub-slot plus a per-slot source-window
    Float64RingBuffer for the O(1) per-bar shifted-source lookup.
  - `ta.connorsRsi(source, opts?)` — Connors RSI, a `[0, 100]`-bounded
    blend of `RSI(source, rsiLength)`, `RSI(streak, streakLength)`,
    and `PercentRank(ROC(source, 1), rocLength)`. Composes two
    `ta.rsi` sub-slots — no private RSI math duplication. Defaults
    `(3, 2, 100)`. Sub-component NaN → component skipped in the
    average (per task spec §6, diverges from invinite's stricter
    all-finite requirement to align with the Pine semantic).

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (inlined per Task 1) +
  auto-generated `docs/primitives/ta/<id>.md`.

  `TA_REGISTRY_METADATA` extends with:

  - `ppo`: `primarySeriesKey: "ppo"`, `visibleSeriesKeys: ["ppo",
"signal", "hist"]`, `yDomain: { kind: "auto" }`.
  - `connorsRsi`: `yDomain: { kind: "fixed", min: 0, max: 100 }`.
  - `dpo`: no metadata entry (unbounded — consumers default to
    `auto`).

  Core surface widens with `PpoOpts`, `DpoOpts`, `ConnorsRsiOpts`
  opts bags + `PpoResult` three-output type, plus the matching
  `TaNamespace` methods and throw-sentinel stubs.
  `STATEFUL_PRIMITIVES` extends with `ta.ppo` / `ta.dpo` /
  `ta.connorsRsi` (all `slot: true`). Compiler shim mirrors the new
  core surface.

  Three conformance scenarios (`taPpo.scenario.ts`,
  `taDpo.scenario.ts`, `taConnorsRsi.scenario.ts`) registered against
  `ALL_SCENARIOS` via the Task-1 `inlineSource` extension.
  Plot-hash pinning deferred to Phase-2 closeout (Task 30) per the
  established cross-functional scenario convention.

  DEVIATIONS from invinite reference (commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`):

  - `ppo.ts` — invinite carries a private EMA copy
    (`computeMaSeries(oscillatorMaType, ...)`); chartlang routes
    through the canonical `ta.ema` primitive via sub-slot
    composition (matches `ta.macd`). §9.4 fold satisfied.
  - `dpo.ts` — only the non-centered (TradingView default) render
    mode is shipped. Invinite's `centered: true` mode emits
    `dpo[i] = src[i] - sma[i + displacement]`, which depends on the
    future SMA; chartlang's append-only ring-buffer contract can't
    backfill, so that mode is deferred. Documented in the impl's
    provenance header.
  - `connorsRsi.ts` — invinite requires all three components finite
    for the CRSI line to define; the task spec (§6) overrides with
    "sub-component NaN → component skipped in the average". We
    follow the spec, which tightens alignment with the Pine
    `ta.connorsRsi` semantic where streak-RSI warmup doesn't gate
    the rsi-on-close component.

- 38fb475: Phase-2 Task 11 — oscillator ports: `ta.stochRsi`, `ta.ultimateOsc`,
  `ta.coppock`.

  Ships three more oscillator primitives under
  `packages/runtime/src/ta/`:

  - `ta.stochRsi(source, opts?)` — Stochastic RSI (`%K` + `%D`).
    Composes `ta.rsi` + `ta.highest` + `ta.lowest` + two chained
    `ta.sma` smoothing layers via sub-slot ids. Bounded `[0, 100]`
    (or `NaN`). Defaults `(rsiLength=14, stochLength=14, kSmoothing=3,
dSmoothing=3)`. Flat-RSI-window (`hh === ll`) emits `NaN` at `k`
    — diverges from invinite's prev-or-50 fallback per task spec.
  - `ta.ultimateOsc(opts?)` — Larry Williams' Ultimate Oscillator over
    `bar.high` / `bar.low` / `bar.close`. Weighted average of three
    buying-pressure / true-range ratios across `shortLength` /
    `mediumLength` / `longLength` windows (defaults `7` / `14` / `28`).
    Bounded `[0, 100]` (or `NaN`); zero-TR window emits `NaN`.
  - `ta.coppock(source, opts?)` — Edwin Coppock's Curve.
    `WMA(ROC(source, roc1Length) + ROC(source, roc2Length),
wmaLength)` over percentage ROC. Defaults `(11, 14, 10)`. Unbounded;
    zero-crossings are the canonical signal. Inlines the percentage-ROC
    computation against its own `sourceWindow` (the spec's hint to
    compose `ta.change` does not fit — `ta.change` emits absolute
    deltas, not percentages).

  Each primitive ships the §22.10 set: impl + unit + property + golden

  - bench pair + conformance scenario (inlined per Task 1) +
    auto-generated `docs/primitives/ta/<id>.md`.

  Extends `TA_REGISTRY_METADATA` with two new bounded-oscillator
  entries:

  - `stochRsi`: `primarySeriesKey: "k"`, `visibleSeriesKeys: ["k", "d"]`,
    `yDomain: { kind: "fixed", min: 0, max: 100 }`.
  - `ultimateOsc`: `yDomain: { kind: "fixed", min: 0, max: 100 }`.

  `ta.coppock` is unbounded — no metadata entry; consumers default to
  `auto`.

  Core surface widens with `StochRsiOpts`, `UltimateOscOpts`,
  `CoppockOpts` opts bags + `StochRsiResult` two-output type, plus the
  matching `TaNamespace` methods and throw-sentinel stubs.
  `STATEFUL_PRIMITIVES` extends with `ta.stochRsi` / `ta.ultimateOsc` /
  `ta.coppock` (all `slot: true`). Compiler shim mirrors the new core
  surface.

  Three conformance scenarios (`taStochRsi.scenario.ts`,
  `taUltimateOsc.scenario.ts`, `taCoppock.scenario.ts`) registered
  against `ALL_SCENARIOS` via the Task-1 `inlineSource` extension.
  Plot-hash pinning deferred to Phase-2 closeout (Task 30) per the
  established cross-functional scenario convention.

- 38fb475: Phase-2 Task 26 — S/R ports: `ta.chandelier`, `ta.chandeKrollStop`,
  `ta.williamsFractal`.

  Ships three new S/R `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.chandelier(opts?)` — Chandelier Exit returning
    `{ long, short }`. Composes Phase-1 `ta.atr` plus Task-5
    `ta.highest` / `ta.lowest` at sub-slots `${slotId}/atr` /
    `${slotId}/highHigh` / `${slotId}/lowLow`. `long = highest(high,
length) − multiplier · atr(length)`; `short` symmetric. Defaults
    `length = 22`, `multiplier = 3` per Pine canonical. Source
    hard-coded to `bar.high` / `bar.low` (deliberate divergence from
    invinite's `source` parameter — matches Pine `ta.chandelier_exit`).

  - `ta.chandeKrollStop(opts?)` — Chande Kroll Stop returning
    `{ long, short }`. Two-pass smoothed trailing stop: first pass
    computes `firstHigh = highest(high, length) − multiplier · atr` /
    `firstLow = lowest(low, length) + multiplier · atr` (composed via
    `ta.atr` + `ta.highest` / `ta.lowest` sub-slots); second pass
    walks a slot-owned `Float64RingBuffer` of size `smoothingLength`
    for the rolling max / min. Defaults `length = 10`, `multiplier = 1`,
    `smoothingLength = 9` (matches Chande Kroll's 1995 paper).

  - `ta.williamsFractal(opts?)` — Williams Fractal returning
    `{ up, down }` as **price-level series** (NaN when no fractal,
    `bar.high(centre)` for up-fractal, `bar.low(centre)` for down).
    Self-contained centred-window scan over a `2 · length + 1` ring
    buffer per side. Output is centred: at live bar `t`, the value
    emitted reflects bar `t − length`'s fractal status (when bar `t`
    closes, we now have the right-window bars to confirm bar
    `t − length`). Default `length = 2` (5-bar window). Strict
    comparison: tied highs/lows in the window → no fractal.

    Deviation from the task spec's literal `Series<boolean>` wording:
    emits price levels instead so the `marker` plot has a meaningful
    y-anchor. Matches invinite's `upFractals[i] = high` shape.

  Each primitive ships the §22.10 set (impl + unit + property + golden
  hash + bench pair) plus a `taChandelier.scenario.ts`,
  `taChandeKrollStop.scenario.ts`, and `taWilliamsFractal.scenario.ts`
  conformance scenario. JSDoc per §17.2 with `@formula`, `@warmup`,
  `@since 0.2`, `@experimental`, `@example`, and `@anchors`.

  **`PlotOptsStyle` marker widening (core + runtime + compiler shim).**
  Adds the `marker` variant to `PlotOptsStyle` in core (mirrors the
  adapter-kit's `PlotStyle.marker` shape declared by Task 1), the
  matching dispatch branch to `buildStyle` in
  `packages/runtime/src/emit/plot.ts`, and the same widening in the
  compiler's ambient shim. The Williams Fractal scenario is the first
  to exercise the marker plot kind end-to-end. The cap-gated dispatch
  path is unit-covered in `plot.test.ts`'s new marker case.

  `TaNamespace` (core) and `RuntimeTaNamespace` (runtime) extend with
  three new methods + matching opts / result types. `STATEFUL_PRIMITIVES`
  appends three new `slot: true` entries. `TA_REGISTRY` adds three
  entries plus `TA_REGISTRY_METADATA` records for each
  (`primarySeriesKey` / `visibleSeriesKeys` / `yDomain = auto`).

  Auto-generated documentation pages land at
  `docs/primitives/ta/{chandelier,chandeKrollStop,williamsFractal}.md`
  via the Task-2 generator. The `docs/primitives/ta/index.md` carries a
  new "S/R (Task 26)" subsection.

- 38fb475: Phase-2 Task 25 — S/R ports: `ta.psar` and `ta.supertrend`.

  Ships two new flagship trend-following S/R `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.psar(opts?)` — Wilder Parabolic SAR returning
    `{ sar, direction }`. Self-contained state machine over
    `bar.high` / `bar.low` / `bar.close` with extreme-point +
    acceleration-factor tracking and trend-flip semantics. Defaults
    `accelerationStart = 0.02`, `accelerationStep = 0.02`,
    `accelerationMax = 0.2` per Pine / Wilder. Bar 0 emits the seed
    (`sar = bar.low`, `direction = +1`); bar 1 decides the initial
    direction from `close[1] >= close[0]`; bar 2+ runs the standard
    recurrence with the lower/upper-bound clamps against the prior
    two bars' lows/highs.
  - `ta.supertrend(opts?)` — ATR-driven trailing-stop trend follower
    returning `{ line, direction }`. Composes Phase-1 `ta.atr` at
    sub-slot `${slotId}/atr`, so a fix to ATR flows in for free.
    Defaults `length = 10`, `multiplier = 3`. Reads `bar.hl2` for the
    band midpoint (Pine-canonical). The final-band persistence rule
    carries the prior band forward unless the prior close pierced it;
    direction flips when the current close crosses the prior
    `finalUpper` / `finalLower`.

  Both primitives suspend their recurrence state on NaN OHLC so the
  next finite bar resumes from the prior state. `replaceHead`
  correctness is asserted via append-vs-replaceHead property tests
  over adversarial sharp-reversal sequences — both implementations
  snapshot the state at the start of each bar BEFORE the close-side
  recurrence advances so a final tick replays from the seed.

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA` carries the
  multi-output / y-domain hints (`psar: { primarySeriesKey: "sar",
visibleSeriesKeys: ["sar", "direction"], yDomain: auto }`,
  `supertrend: { primarySeriesKey: "line", visibleSeriesKeys:
["line", "direction"], yDomain: auto }`).

  Core adds `PsarOpts`, `PsarResult`, `SupertrendOpts`,
  `SupertrendResult` exports + the two `TaNamespace` methods.
  `STATEFUL_PRIMITIVES` grows by 2 (`ta.psar`, `ta.supertrend`; both
  `slot: true`). `TA_REGISTRY` mirrors with the leading
  `slotId: string` on each method.

- 38fb475: Phase-2 Task 27 — S/R ports: `ta.zigZag`, `ta.pivotsHighLow`,
  `ta.pivotsStandard`, and `ta.volatilityStop` (closes §9.2's S/R
  list).

  Ships four new S/R `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.zigZag(opts?)` — streaming swing-pivot detector. Walks the
    close series tracking a running candidate pivot; confirms a new
    pivot when the price has reversed by ≥ `deviation %` AND `depth`
    bars have elapsed. Returns `{ value, direction }` where `value`
    carries the most-recently-confirmed pivot price (held constant
    between confirmations, NaN before the first) and `direction` is
    `+1` / `-1` / NaN. Defaults `deviation = 5`, `depth = 10`.
    Streaming adaptation of invinite's batch ZigZag — invinite's
    linear-interpolation rendering between pivots isn't representable
    in the append-only `Series` model, so the output is the closest
    surface (a "trailing reference level").
  - `ta.pivotsHighLow(opts?)` — centred-window swing-pivot detector
    with asymmetric `(leftLength, rightLength)` confirmation windows.
    Returns `{ high, low }` (price-level series — `bar.high(centre)`
    or `bar.low(centre)` when a pivot confirms, NaN otherwise).
    Mirrors invinite's tie-break: strict-greater on the left window,
    geq on the right (matches Pine `ta.pivothigh`). Defaults
    `leftLength = rightLength = 4` (9-bar window).
  - `ta.pivotsStandard(opts?)` — classical daily pivot-point levels
    (P, R1..R3, S1..S3) derived from the previous UTC-day's HLC.
    Returns seven `Series<number>` (`{ pp, r1, s1, r2, s2, r3, s3 }`).
    Four formula systems: `"classic"` (default), `"fibonacci"`,
    `"camarilla"`, `"woodie"`. UTC-day boundary detection via
    `Math.floor(bar.time / 86_400_000)`. R4 / R5 / S4 / S5 levels
    (Camarilla's full table) and DeMark / Traditional systems
    intentionally defer per the Phase-2 README "Deferred / Follow-Up
    Work" footnote.
  - `ta.volatilityStop(opts?)` — PSAR-like trend-following stop
    driven by ATR. Composes Phase-1 `ta.atr` at sub-slot
    `${slotId}/atr`. Returns `{ value, direction }` (`+1` uptrend →
    stop is BELOW price; `-1` downtrend → stop ABOVE). Defaults
    `length = 20`, `multiplier = 2`. Source hard-coded to `bar.close`
    (Pine `ta.vstop` convention; invinite's `source` field is
    omitted, a `source` opt could land in a follow-up).

  All four primitives suspend their recurrence state on NaN OHLC so
  the next finite bar resumes from the prior state. `replaceHead`
  correctness is asserted via append-vs-replaceHead property tests
  over `arbBar` fixtures — ZigZag and Volatility Stop snapshot their
  state-machine state at the start of each bar BEFORE the close-side
  recurrence advances so a final tick replays from the seed
  (mirrors Task 25's PSAR / Supertrend pattern).

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA` carries the
  multi-output / y-domain hints (all four use `yDomain: { kind:
"auto" }`).

  Core adds `ZigZagOpts`, `ZigZagResult`, `PivotsHighLowOpts`,
  `PivotsHighLowResult`, `PivotsStandardOpts`,
  `PivotsStandardResult`, `PivotsStandardSystem`,
  `VolatilityStopOpts`, and `VolatilityStopResult` exports + four
  `TaNamespace` methods. `STATEFUL_PRIMITIVES` grows by 4 (all
  `slot: true`). `TA_REGISTRY` mirrors with the leading
  `slotId: string` on each method.

  Compiler patch: the ambient shim mirrors the four new methods +
  nine new types.

- 38fb475: Phase-2 Task 28 — statistical `ta.*` ports: `ta.median`, `ta.adr`,
  `ta.ulcerIndex`.

  Ships three new statistical primitives under
  `packages/runtime/src/ta/`:

  - `ta.median(source, length, opts?)` — rolling median over the
    trailing `length` source values. Odd-`length` → middle value;
    even-`length` → mean of the two middle values. NaN slots are
    dropped from the sort (window length effectively shrinks). Range
    invariant pinned: `min(window) ≤ out ≤ max(window)`. Tick-mode
    substitutes the head value before sorting (closed window
    unchanged).
  - `ta.adr(opts?)` — Average Daily Range. SMA of `high − low` over
    the trailing `length` (default `14`) completed UTC calendar days.
    Reads `bar.high` / `bar.low` / `bar.time` directly (no `source`
    param). Phase-2 keys "daily" on the UTC midnight boundary
    (`Math.floor(bar.time / 86_400_000)`); Phase 4 lifts this onto
    `syminfo.session`. The in-progress (currently-aggregating) day is
    NEVER included in the average — matches invinite's "completed N
    daily bars" semantics. Tick mode emits the cached SMA (no day-
    boundary advance per the runtime tick invariant).
  - `ta.ulcerIndex(source, length, opts?)` — drawdown-based volatility
    (rolling RMS of percent declines from the rolling-window high).
    Composes `ta.highest` via sub-slot id `${slotId}/highest`. Range
    invariant pinned: `out ≥ 0`. NaN source → NaN output (window
    unchanged).

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (inline-source per Task
  1's extension) + auto-generated `docs/primitives/ta/<id>.md`.

  `STATEFUL_PRIMITIVES` grows by `+3` (`ta.median`, `ta.adr`,
  `ta.ulcerIndex` — all `slot: true`). `TA_REGISTRY` grows by `+3`.
  `TaNamespace` and `RuntimeTaNamespace` extend in lockstep with
  `MedianOpts`, `AdrOpts` (`{ length?: number; offset?: number;
lineStyle?: PlotLineStyle }`), and `UlcerIndexOpts`.

  `ALL_SCENARIOS` (conformance) grows by `+3`. The three new
  scenarios assert `alert-count: 0` + the standard
  `lookback-exceeded` / `malformed-emission` diagnostic-absent gates
  (no `plot-hash` — the rolling primitives' outputs are pinned
  elsewhere via the runtime golden tests).

- 38fb475: Phase-2 Task 16 — trend ports: `ta.adx`, `ta.dmi`, `ta.trix`.

  Ships three new trend `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.adx(length, opts?)` — Wilder's Average Directional Index
    (single Series bounded `[0, 100]`). Reads `bar.high` /
    `bar.low` / `bar.close` directly (mirrors Pine's `ta.adx(length)`
    — no source param). Composes the same Wilder DI recurrence
    `ta.dmi` runs, then folds DX through a second
    Wilder-smoothing window of length `opts.smoothing ?? 14`.
  - `ta.dmi(length, opts?)` — Wilder's Directional Movement Index
    (`{ plusDi, minusDi }`, both ∈ [0, 100]). Reads OHLC directly
    per Pine's `ta.dmi(length)`. Incremental `wilderStep` over
    `+DM` / `−DM` / TR; output validated against the
    full-recompute reference `lib/wilderDirectional`.
  - `ta.trix(source, length, opts?)` — TRIX triple-smoothed EMA
    rate-of-change with an EMA-signal line (`{ trix, signal }`).
    Composes three EMA sub-slots (`${slotId}/ema1` / `/ema2` /
    `/ema3`) for the triple chain + a fourth `${slotId}/signal`
    EMA, mirroring the MACD sub-slot composition pattern.

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA` carries
  y-domain + multi-output hints (`adx: { yDomain: fixed 0-100 }`,
  `dmi: { primarySeriesKey: "plusDi", visibleSeriesKeys: ["plusDi",
"minusDi"], yDomain: fixed 0-100 }`, `trix: { primarySeriesKey:
"trix", visibleSeriesKeys: ["trix", "signal"], yDomain: auto }`).

  ADX / DMI reuse Phase-1 `lib/wilderSmoothing` (`wilderStep`) for
  the per-bar Wilder recurrence and Wave-3 Task-4
  `lib/wilderDirectional` + `lib/adxFromDi` as the property-test
  reference (Float64Array-in / Float64Array-out full-recompute).
  TRIX reuses Phase-1 `lib/emaFloat64` (`computeEmaOfFloat64`) as
  the property-test reference plus the runtime `ta.ema` primitive
  for the four composed sub-slots.

  Core adds `AdxOpts`, `DmiOpts`, `DmiResult`, `TrixOpts`,
  `TrixResult` exports plus three new methods on `TaNamespace`.
  `STATEFUL_PRIMITIVES` grows by 3 (`ta.adx`, `ta.dmi`, `ta.trix`;
  all `slot: true`). `TA_REGISTRY` mirrors with the leading
  `slotId: string` on each method.

- 38fb475: Phase-2 Task 15 — trend ports: `ta.aroon` and `ta.aroonOsc`.

  Ships two new trend `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.aroon(length, opts?)` — Aroon Up / Down (`{ up, down }`,
    both ∈ [0, 100]). Reads `bar.high` / `bar.low` directly per
    Pine's `ta.aroon(length)` signature (no source param). Scans the
    trailing `length + 1` window per close for the argmax / argmin
    using strict `>` / `<` so the most-recent tied bar wins
    (TradingView convention). Tick replay substitutes the head value
    without mutating the closed window.
  - `ta.aroonOsc(length, opts?)` — `aroon.up − aroon.down`, bounded
    in [-100, 100]. Composes `ta.aroon` at sub-slot
    `${slotId}/aroon` so a fix to Aroon flows in for free.

  Each primitive ships the §22.10 set: impl + unit + property + golden

  - bench pair + conformance scenario (using the Phase-2 `inlineSource`
    extension from Task 1) + auto-generated `docs/primitives/ta/<id>.md`.
    `TA_REGISTRY_METADATA` carries the multi-output / y-domain hints
    (`aroon: { primarySeriesKey: "up", visibleSeriesKeys: ["up", "down"],
yDomain: fixed 0-100 }`, `aroonOsc: { yDomain: fixed -100-100 }`).

  Core adds `AroonOpts`, `AroonOscOpts`, `AroonResult` exports + the
  two `TaNamespace` methods. `STATEFUL_PRIMITIVES` grows by 2
  (`ta.aroon`, `ta.aroonOsc`; both `slot: true`). `TA_REGISTRY`
  mirrors with the leading `slotId: string` on each method.

- 38fb475: Phase-2 Task 17 — trend ports: `ta.vortex`, `ta.trendStrengthIndex`,
  `ta.ichimoku`.

  Ships three new trend `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.vortex(length, opts?)` — Botes & Siepman (2010) Vortex
    Indicator. Reads `bar.high` / `bar.low` / `bar.close` directly
    (mirrors Pine's `ta.vortex(length)` — no source param). Returns
    `{ plus, minus }` (the +VI / −VI lines). Maintains rolling
    running-sum windows over per-bar `vmPlus`, `vmMinus`, and TR for
    O(1) per-bar updates. NaN-on-zero-TR semantic per chartlang task
    spec §6 (invinite emits 0 on zero TR; chartlang surfaces the
    degenerate window).
  - `ta.trendStrengthIndex(source, length, opts?)` — TradingView's
    Trend Strength Index: Pearson correlation between `source` and
    bar index over each trailing `length`-bar window. Bounded
    `[-1, +1]`. Default `length = 20` (chartlang task spec; invinite
    default is 14). Distinct from `ta.tsi` (Task 14's True Strength
    Index momentum oscillator) — name collision avoided via the
    longer `trendStrengthIndex` surface.
  - `ta.ichimoku(opts?)` — Ichimoku Cloud (Tenkan / Kijun / Senkou A
    / Senkou B / Chikou). Defaults `(conversionLength=9, baseLength=
26, leadingSpanBLength=52, displacement=26)`. Composes six
    `ta.highest` / `ta.lowest` sub-slots (one pair each for Tenkan /
    Kijun / Senkou B) — the same composition seam `ta.donchian` uses
    — so a fix to either rolling-extreme primitive flows in for free.
    Forward-displaced Senkou A / Senkou B and backward-displaced
    Chikou are produced via per-slot delay ring buffers of capacity
    `displacement + 1`. `chikou.current` returns `close[t −
displacement]` (the backward-shifted close — programmatic
    semantic for script-author conditionals).

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA` carries
  y-domain + multi-output hints:

  - `vortex: { primarySeriesKey: "plus", visibleSeriesKeys:
["plus", "minus"], yDomain: auto }`
  - `trendStrengthIndex: { yDomain: fixed [-1, 1] }`
  - `ichimoku: { primarySeriesKey: "tenkan", visibleSeriesKeys:
["tenkan", "kijun", "senkouA", "senkouB", "chikou"], yDomain:
auto }` (the cloud renders via the Task-1 `filled-band` PlotKind
    between `senkouA` and `senkouB` — script-author drives the
    styling in their `plot()` call).

  Reuse:

  - Vortex's property test uses Phase-1 `lib/trSeries.ts`
    (`computeTrSeries`) as the per-bar TR reference; golden test
    pins the per-output hashes of a 100-bar Mulberry32 fixture.
  - TrendStrengthIndex's property test uses Wave-3 `lib/pearson.ts`
    against a linear bar-index series as the reference.
  - Ichimoku's property test uses Wave-3 `lib/donchianMid.ts` as the
    per-line reference (Tenkan / Kijun / SenkouB raw all share the
    same Donchian-midpoint math).

  Core adds `VortexOpts`, `VortexResult`, `TrendStrengthIndexOpts`,
  `IchimokuOpts`, `IchimokuResult` exports plus three new methods
  on `TaNamespace` + three throwing stubs on the `ta` const.
  `STATEFUL_PRIMITIVES` grows by 3 (`ta.vortex`,
  `ta.trendStrengthIndex`, `ta.ichimoku`; all `slot: true`) — final
  Phase-2 size 93. `TA_REGISTRY` grows by 3 — final size 90.
  Conformance scenarios + `ALL_SCENARIOS` array grow by 3.

- 38fb475: Phase-2 Task 18 — volatility ports: `ta.bbPercentB`, `ta.bbw`, and
  `ta.donchian`.

  Ships three new volatility `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.bbPercentB(source, length, opts?)` — Bollinger %B,
    `(src − lower) / (upper − lower)` over the BB envelope. NaN
    when the band collapses (zero width). Composes `ta.bb` via
    sub-slot `${slotId}/bb` so a fix to the envelope flows in for
    free. Default `multiplier = 2`.
  - `ta.bbw(source, length, opts?)` — Bollinger BandWidth,
    `(upper − lower) / middle` over the BB envelope. Raw ratio
    scale (multiply by 100 in the script for TradingView-parity
    display). NaN on zero middle. Composes `ta.bb` via the same
    sub-slot pattern. Default `multiplier = 2`.
  - `ta.donchian(length, opts?)` — Donchian Channels,
    `{ upper, middle, lower }` over a fixed `length`-bar window.
    `upper = highest(bar.high, length)` and `lower =
lowest(bar.low, length)` via sub-slots `${slotId}/highest` /
    `${slotId}/lowest` — the slot-aware composition of the
    registered Task-5 primitives; equivalent to `lib/donchianMid`
    but routed through the registry so a fix flows in for free.
    Mid = `(upper + lower) / 2`.

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA.donchian`
  records the multi-output hints (`primarySeriesKey: "middle"`,
  `visibleSeriesKeys: ["upper", "middle", "lower"]`,
  `yDomain: { kind: "auto" }`).

  Core adds `BbPercentBOpts`, `BbwOpts`, `DonchianOpts`,
  `DonchianResult` exports + the three `TaNamespace` methods.
  `STATEFUL_PRIMITIVES` grows by 3 (all three `slot: true`).
  `TA_REGISTRY` mirrors with the leading `slotId: string` on each
  method.

- 38fb475: Phase-2 Task 20 — volatility ports: `ta.historicalVolatility`,
  `ta.rvi`, and `ta.massIndex`.

  Ships three new volatility `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.historicalVolatility(source, length, opts?)` — annualised
    stddev of log returns ×100. Default `annualisationFactor = 365`
    (TradingView's "Crypto" convention; use `252` for trading-day
    equity series). NaN through `[0, length − 1]` warmup; non-positive
    or non-finite source short-circuits log returns to NaN.
  - `ta.rvi(source, length, opts?)` — Relative Volatility Index, the
    RSI-style oscillator that uses rolling stddev of the source as
    the magnitude instead of absolute close changes. Bounded `[0, 100]`.
    Composes `ta.ema` via sub-slots `${slotId}/upEma` and
    `${slotId}/downEma` so a fix to EMA's recurrence flows in for
    free. Warmup `2 · length − 1`. NaN on zero-denominator (both EMA
    arms zero).
  - `ta.massIndex(opts?)` — sub-pane volatility line that tracks the
    range-EMA "bulge" ratio to flag trend-reversal setups via the
    canonical 27 threshold. Reads `bar.high − bar.low` directly (no
    source param). Composes two chained `ta.ema` sub-slots
    (`${slotId}/ema1`, `${slotId}/ema2`). Defaults `emaLength = 9`,
    `sumLength = 25`. Warmup `2 · emaLength + sumLength − 3`.

  Adds the §22.10 five-file set per primitive (impl + unit + property

  - golden + bench pair) and a conformance scenario per primitive
    under `packages/conformance/src/scenarios/`.

  Extends core's `TaNamespace` + `STATEFUL_PRIMITIVES` and the
  runtime's `RuntimeTaNamespace` + `TA_REGISTRY` accordingly. Three
  auto-generated docs pages under `docs/primitives/ta/` ship via the
  Task-2 `chartlang docs` generator.

  Provenance: ported from invinite at commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`. The RVI math follows
  invinite's TradingView-reference shape (EMA-smoothed up/down stddev
  arms), not the spec's draft Wilder-smoothing description.

- 38fb475: Phase-2 Task 19 — volatility ports: `ta.keltner`, `ta.envelope`, and
  `ta.chop`.

  Ships three new volatility `ta.*` primitives under
  `packages/runtime/src/ta/`:

  - `ta.keltner(opts?)` — Keltner Channels overlay envelope.
    `middle = MA(close, length, maType)` with `upper / lower =
middle ± multiplier · ATR(length)`. Defaults `length = 20`,
    `multiplier = 2`, `maType = "ema"` (TradingView / Linda Raschke
    canonical form). Composes `ta.atr` via sub-slot `${slotId}/atr`
    and the registered MA primitive (`sma` / `ema` / `wma` / `smma`)
    via sub-slot `${slotId}/<maType>` — fixes to either flow in for
    free.
  - `ta.envelope(source, opts?)` — price-percent envelope overlay.
    `middle = MA(source, length, maType)` with `upper / lower =
middle · (1 ± percent / 100)`. Defaults `length = 20`,
    `percent = 10`, `maType = "sma"`. Composes the registered MA
    primitive via sub-slot `${slotId}/<maType>` so fixes flow in
    for free.
  - `ta.chop(length, opts?)` — Choppiness Index sub-pane regime
    gauge. `chop = 100 · log10(sumTR(length) / (highest(high,
length) − lowest(low, length))) / log10(length)`, clamped to
    `[0, 100]`. High values flag sideways / choppy markets; low
    values flag strong trends. Composes `ta.highest` / `ta.lowest`
    via sub-slots; the TR-sum numerator is a sliding-window sum
    inside the slot (same internal TR math as `ta.atr`, but raw —
    Pine `ta.chop` does NOT use the Wilder-smoothed ATR).

  Each primitive ships the §22.10 set: impl + unit + property +
  golden + bench pair + conformance scenario (using the Phase-2
  `inlineSource` extension from Task 1) + auto-generated
  `docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA.keltner` and
  `.envelope` record the multi-output hints
  (`primarySeriesKey: "middle"`,
  `visibleSeriesKeys: ["upper", "middle", "lower"]`,
  `yDomain: { kind: "auto" }`); `TA_REGISTRY_METADATA.chop` pins
  the bounded `{ yDomain: { kind: "fixed", min: 0, max: 100 } }`
  oscillator range.

  Core adds `KeltnerOpts`, `KeltnerResult`, `EnvelopeOpts`,
  `EnvelopeResult`, `ChopOpts` exports + the three `TaNamespace`
  methods. `STATEFUL_PRIMITIVES` grows by 3 (all three `slot: true`).
  `TA_REGISTRY` mirrors with the leading `slotId: string` on each
  method.

- 38fb475: Phase-2 Task 23 — volume ports `ta.chaikinOsc`, `ta.mfi`,
  `ta.netVolume`, `ta.pvo`.

  Ports four volume primitives from invinite (commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`) onto the chartlang
  runtime — each lands the §22.10 five-file set (impl + unit +
  property + golden + bench pair) alongside an inline conformance
  scenario and an auto-generated docs page:

  - `ta.chaikinOsc(opts?)` — Chaikin Oscillator, `EMA(ADL, fast) −
EMA(ADL, slow)`. Defaults `(3, 10)`. Composes one `ta.adl`
    sub-slot + two `ta.ema` sub-slots; a fix to either flows in for
    free. Warmup `slowLength − 1`.
  - `ta.mfi(length, opts?)` — Money Flow Index, volume-weighted RSI
    over a trailing window of typical-price comparisons. Bounded
    `[0, 100]`; emits 100 on perfect upflow, 0 on perfect downflow,
    NaN on zero total flow (invinite's zero-denominator guard).
    Warmup `length + 1`.
  - `ta.netVolume(opts?)` — cumulative `sign(close − prevClose) ·
volume`. **Math is identical to `ta.obv`** (both primitives
    exist in invinite under their own names; chartlang mirrors the
    public surface for naming parity). Property-tested for
    hash-equality against `ta.obv` over a 100-bar synthetic walk.
    Warmup 1 (bar 0 emits 0).
  - `ta.pvo(opts?)` — Percentage Volume Oscillator, MACD shape on
    `bar.volume`. Defaults `(12, 26, 9)`. Composes three `ta.ema`
    sub-slots over volume. Multi-output `{ pvo, signal, hist }`;
    `TA_REGISTRY_METADATA.pvo` records `primarySeriesKey: "pvo"`,
    `visibleSeriesKeys: ["pvo", "signal", "hist"]`, `yDomain: {
kind: "auto" }`. Warmup `slowLength + signalLength − 2`.

  Surface deltas:

  - `TaNamespace` extends with the four new methods + opts types
    (`ChaikinOscOpts`, `MfiOpts`, `NetVolumeOpts`, `PvoOpts` +
    `PvoResult`).
  - `STATEFUL_PRIMITIVES` grows by four `slot: true` entries.
  - `TA_REGISTRY` + `RuntimeTaNamespace` mirror the same delta;
    `TA_REGISTRY_METADATA.pvo` carries the multi-series metadata;
    `ALL_SCENARIOS` grows by four inline scenarios.

  All four primitives carry the §16.6 100% coverage gate via their
  five-file test set; golden hashes pinned against `syntheticBars(100,
42)` (placeholder pin in the initial commit — repinned on first
  deterministic green). Per-port bench thresholds reuse the
  `THRESHOLD_MS = 300` ceiling from the existing volume primitives.

- 38fb475: Phase-2 Task 22 — volume ports `ta.obv`, `ta.adl`, `ta.bop`, `ta.cmf`.

  Ports four volume primitives from invinite (commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`) onto the chartlang
  runtime — each lands the §22.10 five-file set (impl + unit +
  property + golden + bench pair) alongside an inline conformance
  scenario and an auto-generated docs page:

  - `ta.obv()` — On-Balance Volume, cumulative `sign(close − prevClose) ·
volume`. Warmup 1 (bar 0 emits 0). Slot snapshots
    `prevClosedCumObv` / `prevClosedPrevClose` for tick-mode replay.
    NaN volume carries the accumulator forward without an update.
  - `ta.adl()` — Accumulation / Distribution Line, cumulative
    `((C − L) − (H − C)) / (H − L) · volume`. Warmup 0. Zero-range
    bars (`high === low`) contribute 0 (matches invinite's CLV
    guard); NaN OHLC / volume contributes 0.
  - `ta.bop()` — Balance of Power, raw per-bar `(C − O) / (H − L)`.
    Warmup 0; stateless math, output buffer only.
  - `ta.cmf(length)` — Chaikin Money Flow, trailing-window
    `Σ MFV / Σ volume`. Warmup `length − 1`; bounded `[-1, 1]`.
    Tick-mode substitutes the head slot's contribution without
    mutating the rolling window (matches `ulcerIndex`'s shape).

  Surface deltas:

  - `TaNamespace` extends with the four new methods + opts types
    (`ObvOpts`, `AdlOpts`, `BopOpts`, `CmfOpts` — each `{ offset?;
lineStyle? }`).
  - `STATEFUL_PRIMITIVES` grows by four `slot: true` entries.
  - `TA_REGISTRY` + `RuntimeTaNamespace` mirror the same delta;
    `ALL_SCENARIOS` grows by four inline scenarios.

  All four primitives carry the §16.6 100% coverage gate via their
  five-file test set; golden hashes pinned against `syntheticBars(100,
42)`. Per-port bench thresholds reuse the `THRESHOLD_MS = 300`
  ceiling from the existing volume primitives.

- 38fb475: Phase-2 Task 24 — volume ports `ta.pvt`, `ta.eom`, `ta.nvi`,
  `ta.pvi`. Closes the §9.2 volume list (excluding the 4 volume-
  profile primitives deferred to Phase 5).

  Ports four volume primitives from invinite (commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`) onto the chartlang
  runtime — each lands the §22.10 five-file set (impl + unit +
  property + golden + bench pair) alongside an inline conformance
  scenario and an auto-generated docs page:

  - `ta.pvt(opts?)` — Price Volume Trend, cumulative `volume ·
(close − prevClose) / prevClose`. First bar emits 0;
    zero-prevClose bars emit NaN AND carry the accumulator forward;
    NaN volume contributes 0. Warmup 1.
  - `ta.eom(length, opts?)` — Ease of Movement, `length`-bar SMA of
    per-bar `((midpointMove) / boxRatio)` where `boxRatio = (volume
/ 10000) / (high − low)`. Hard-codes invinite's default divisor
    of 10000. Zero-range / zero-volume / NaN-input bars propagate
    NaN through the trailing window (forces a clean restart after
    any defective bar). Warmup `length`.
  - `ta.nvi(opts?)` — Negative Volume Index, cumulative
    close-pct-change on bars whose volume is strictly LOWER than the
    prior bar's; bars with equal-or-higher volume carry the prior
    value unchanged. Seeded at 1000 (anchor pinned by property
    test). Warmup 1.
  - `ta.pvi(opts?)` — Positive Volume Index, mirror of NVI on bars
    whose volume is strictly HIGHER than the prior bar's. Seeded at 1000. Warmup 1.

  Surface deltas:

  - `TaNamespace` extends with the four new methods + opts types
    (`PvtOpts`, `EomOpts`, `NviOpts`, `PviOpts`). All four opts
    bags share the `{ offset?: number; lineStyle?: PlotLineStyle }`
    shape.
  - `STATEFUL_PRIMITIVES` grows by four `slot: true` entries
    (86 → 90; `slot: true` count 85 → 89).
  - `TA_REGISTRY` + `RuntimeTaNamespace` mirror the same delta
    (83 → 87). No new `TA_REGISTRY_METADATA` rows — all four are
    single-output `Series<number>` with auto y-domain.
  - `ALL_SCENARIOS` grows by four inline scenarios.

  All four primitives carry the §16.6 100% coverage gate via their
  five-file test set; golden hashes pinned against
  `syntheticBars(100, 42)` (placeholder pin in the initial commit —
  repinned on first deterministic green). Per-port bench thresholds
  reuse the `THRESHOLD_MS = 300` ceiling from the existing volume
  primitives.

- 38fb475: Phase-2 Task 21 — port the three foundational volume primitives:

  - **`ta.vol(opts?)`** — passthrough of `bar.volume` as a `Series<number>`.
    Warmup 0; NaN volume propagates to NaN output.
  - **`ta.vwap(opts?)`** — session-anchored VWAP keyed on the UTC
    calendar-day boundary (`floor(bar.time / 86_400_000)`). Phase 4
    lifts the session detection to `syminfo.session.regularStart` per
    invinite; until then `ta.vwap` is a UTC-day-anchored VWAP.
    Source defaults to `"hlc3"` per Pine; accepts `"close"` / `"hl2"` /
    `"ohlc4"` / `"hlcc4"`.
  - **`ta.anchoredVwap(anchorTime, opts?)`** — anchored VWAP that
    starts accumulating at the first bar with `bar.time >= anchorTime`
    and never resets. The anchor is sticky (captured on the first
    call; later anchor args are ignored). Phase 4's `input.time()`
    lifts the anchor to a runtime user input.

  All three carry the §22.10 five-file set + JSDoc with
  `@formula`/`@warmup`/`@since 0.2`/`@experimental`/`@example`; all
  register in `STATEFUL_PRIMITIVES` as `slot: true` and in
  `TA_REGISTRY` / `RuntimeTaNamespace`.

  ### `PlotOpts.style?` widening

  To exercise the Task-1 `histogram` PlotKind end-to-end on
  `ta.vol`, this PR widens the script-facing `PlotOpts` with an
  optional `style?: PlotOptsStyle` discriminated-union field
  (`{ kind: "line" }` | `{ kind: "step-line" }` |
  `{ kind: "histogram"; baseline?: number }`). The runtime's
  `plot()` impl honours the field; the canvas2d reference adapter
  dispatches `kind: "histogram"` through Task-1's `drawHistogram`
  renderer. Backward-compatible — omitting `opts.style` keeps the
  existing `kind: "line"` default.

  Future ports adding their own PlotKind (e.g. MACD-hist in Task 16,
  `bars` / `area` / `filled-band` / `label` / `marker` in their
  consumer ports) extend this same `PlotOptsStyle` union additively
  and add their dispatch arm to `createCanvas2dAdapter.applyPlot`.

  ### Conformance scenarios

  - `taVol.scenario.ts` — `plot(ta.vol(), { style: { kind: "histogram", baseline: 0 } })`.
  - `taVwap.scenario.ts` — `plot(ta.vwap({ source: "hlc3" }))`.
  - `taAnchoredVwap.scenario.ts` — `plot(ta.anchoredVwap(1_700_000_000_000))`.

  ### Provenance

  All three ports trace to `invinite/src/components/trading-chart/
indicators/{vol,vwap,anchored-vwap}.ts` at commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`.

- b0d296b: Phase 3 closeout — `0.3` "Full Drawing Parity".

  61 drawing kinds across 13 categories ship under `draw.*` with the
  full §22.10 set per kind (impl + property + golden + bench + JSDoc

  - conformance scenario + auto-generated docs page). 5-bucket
    `DrawingCounts` budget, per-kind capability gating, `DrawingHandle`
    across-bar stability, real-impl `validateEmission` + `decodeDrawing`,
    `drawing-hash` conformance assertion variant, 13 category + 1
    umbrella capability builders, canvas2d reference adapter renders
    every kind, `defineDrawing` constructor for interactive tools.

  Final cardinalities: `STATEFUL_PRIMITIVES.size === 154` (93 Phase-2

  - 61 Phase-3 `draw.*` entries); `DRAWING_KINDS.length === 61`.

  Per-bucket kind tally pinned by `bucketFor` (6 + 5 + 6 + 25 + 19 = 61):

  - `lines` (6): `line`, `horizontal-line`, `horizontal-ray`,
    `vertical-line`, `cross-line`, `trend-angle`.
  - `boxes` (5): `rectangle`, `rotated-rectangle`, `triangle`,
    `circle`, `ellipse`.
  - `labels` (6): `marker`, `text`, `arrow`, `arrow-marker`,
    `arrow-mark-up`, `arrow-mark-down`.
  - `polylines` (25): `polyline`, `path`, `arc`, `curve`,
    `double-curve`, `pen`, `highlighter`, `brush`,
    `trend-channel`, `flat-top-bottom`, `disjoint-channel`,
    `regression-trend`, `pitchfork`, `pitchfan`, `xabcd-pattern`,
    `cypher-pattern`, `head-and-shoulders`, `abcd-pattern`,
    `triangle-pattern`, `three-drives-pattern`,
    `elliott-impulse-wave`, `elliott-correction-wave`,
    `elliott-triangle-wave`, `elliott-double-combo`,
    `elliott-triple-combo`.
  - `other` (19): 10 `fib-*` + 4 `gann-*` + 3 cycles
    (`cyclic-lines`, `time-cycles`, `sine-line`) + 2 containers
    (`group`, `frame`).

  Conformance scenarios: 61 per-kind + 12 task bundles +
  `drawAll61` + `drawBudgetOverflow` + `drawUnsupportedKind` = **76**.
  Docs: 61 auto-generated `docs/primitives/draw/<kind>.md` pages +
  1 hand-written `index.md`.

  Variant collapses pinned in Task 1 (carried forward unchanged):

  - `pitchfork.variant: "standard" | "schiff" | "modified-schiff" | "inside"`
    collapses the 4 invinite pitchfork tools.
  - `line.{extendLeft, extendRight}` collapses the `ray` /
    `extended-line` tools.
  - `cypherPattern` ships as a `defineDrawing`-only kind (no
    standalone interactive tool).

  Compiler: `callsiteIdInjection` recognises every `draw.*` callable
  via the widened 154-entry `STATEFUL_PRIMITIVES`;
  `statefulCallInLoop` flags `draw.*` in unbounded loops with the
  existing `stateful-call-inside-loop` error.

  Bench thresholds (re-verified post-Phase-3 on Apple-silicon):

  - `pushDrawing.bench.test.ts` — 10 000 line drawings under 2 000ms
    wall-clock (`ceil(median × 3)` per §22.10; no drift across
    Tasks 4–18 — the budget/validate path is independent of
    per-kind canvas renderers). `pnpm bench:ci` median ~180ms.
  - The Phase-2 ta / ringBuffer / seriesView / onBarClose /
    plot / hline bench thresholds were bumped from the
    `200/250/300/400/500/600ms` solo-run pins to a uniform `1500ms`
    (3000ms for plot + hline) to absorb the parallel-worker
    scheduling overhead during workspace `pnpm test` (665 test
    files in parallel). Solo `pnpm bench:ci` medians remain in the
    10–200ms range — well under both old and new thresholds — so
    this is a noise-floor adjustment, not a perf-regression
    accommodation.

  `apiVersion: 1` script header unchanged; Phase 3 is additive at
  runtime.

- b0d296b: Phase 3 Task 10 — Channels (`trendChannel` / `flatTopBottom` /
  `disjointChannel` / `regressionTrend`).

  - **adapter-kit** — 4 new per-kind validators (`validateTrendChannelState`,
    `validateFlatTopBottomState`, `validateDisjointChannelState`,
    `validateRegressionTrendState`) + 1 file-local style helper
    (`validateRegressionTrendOpts` with the
    `close|open|high|low|hl2|hlc3|ohlc4|hlcc4` source whitelist). The
    `regression-trend` validator enforces `anchors[0].time <
anchors[1].time` and `stdevMultiplier >= 0`.
  - **runtime** — 4 new emit functions under
    `packages/runtime/src/emit/draw/channels/` wired into `DRAW_NAMESPACE`.
    `regressionTrend` carries the 4-arg form
    `(slotId, a: WorldPoint, b: WorldPoint, opts?)`. The Phase-2
    `linearRegression` + `LinearRegressionFrame` helper graduates to the
    public runtime surface so consumer adapters can compute the OLS fit
    without duplicating math.
  - **canvas2d-adapter** — 4 new renderers + dispatch wiring. The
    `regression-trend` renderer strokes a placeholder anchor-to-anchor
    line; the actual OLS fit + σ bands require bar-buffer access not
    exposed by the current `Viewport` (see
    `tasks/phase-3-drawing-parity/10-channels.plan.md` §3). `trendChannel`
    / `flatTopBottom` / `disjointChannel` are stroke-only (no fill polygon
    between rails — see plan §5).
  - **conformance** — 5 new scenarios (4 per-kind + 1
    `drawChannelsAll` bundle) with pinned `drawing-hash` assertions.

  See `tasks/phase-3-drawing-parity/10-channels.plan.md` for the full
  audit + divergence flags.

- b0d296b: Phase 3 Task 11 — Fibonacci A (`fibRetracement` / `fibTrendExtension`
  / `fibChannel` / `fibTimeZone` / `fibWedge`).

  - **core** — `DrawNamespace` flattened: the four sub-namespace types
    (`FibSubNamespace`, `GannSubNamespace`, `ElliottSubNamespace`,
    `PatternSubNamespace`) are removed; every kind now lives as a flat
    method directly on `DrawNamespace` matching the canonical
    `STATEFUL_PRIMITIVES` names (`draw.fibRetracement(...)`,
    `draw.gannBox(...)`, `draw.elliottImpulseWave(...)`,
    `draw.xabcdPattern(...)`, etc.). The throwing-stub `draw` Proxy
    drops the sub-namespace branch. Script authors use the flat
    Pine/invinite-parity surface; the compiler resolves callsites
    through its existing 2-segment property-access path. The 30
    not-yet-ported method signatures (Tasks 12–18 fib-B / gann /
    pitchfork / pattern / elliott / cycle / container kinds) are
    declared as flat stubs so Tasks 12–18 only need to extend the
    runtime `KIND_IMPLS` map. **BREAKING** for any consumer that
    referenced `draw.fib.retracement(...)` or one of the four
    sub-namespace types — none currently exist outside Phase-3 work.
  - **adapter-kit** — 5 new per-kind validators
    (`validateFibRetracementState`, `validateFibTrendExtensionState`,
    `validateFibChannelState`, `validateFibTimeZoneState`,
    `validateFibWedgeState`) + 1 file-local style helper
    (`validateFibOpts`) covering FibOpts (`levels` finite-array,
    `showLabels` / `color` / `extendLeft` / `extendRight`).
  - **runtime** — 5 new emit functions under
    `packages/runtime/src/emit/draw/fibA/` wired into `DRAW_NAMESPACE`
    as flat methods. `fibRetracement` / `fibTimeZone` use the 4-arg
    form `(slotId, a, b, opts?)`; the other 3 use the 3-arg
    `(slotId, anchors, opts?)` form. No new sub-namespace wiring.
  - **canvas2d-adapter** — 5 new renderers reusing Task-4's
    `FIB_LEVELS` + `formatLevel` and Task-5's `extendLineSegment` for
    the `fib-retracement` viewport extension. Default colour
    `"#facc15"` (warm yellow) per invinite's fib-tool palette.
  - **conformance** — 6 new scenarios (5 per-kind + 1
    `drawFibA` bundle) with pinned `drawing-hash` assertions.
    Conformance + scenarios test-capability fixtures grow `other`
    bucket from 0 to 100 and add the 5 fib-A kebab kinds.

  Divergences flagged in `tasks/phase-3-drawing-parity/11-fibonacci-a.plan.md`:

  - `fib-time-zone` uses the canonical ratio array (`FIB_LEVELS`),
    NOT the integer Fibonacci sequence; `fibSequence.ts` helper is
    NOT created (Task-1 reshape follow-up).
  - `fib-wedge` rays are drawn with a fixed length
    `max(pxWidth, pxHeight) * 2` rather than via a directional
    `extendLineSegment` variant.
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–10.

  See `tasks/phase-3-drawing-parity/11-fibonacci-a.plan.md` for the
  full audit + divergence list.

- b0d296b: Phase 3 Task 12 — Fibonacci B (`fibSpeedFan` / `fibSpeedArcs` /
  `fibSpiral` / `fibCircles` / `fibTrendTime`).

  - **adapter-kit** — 5 new per-kind validators
    (`validateFibSpeedFanState`, `validateFibSpeedArcsState`,
    `validateFibSpiralState`, `validateFibCirclesState`,
    `validateFibTrendTimeState`), reusing Task-11's `validateFibOpts`
    style helper. The permissive-default test fixture moves from
    `fib-speed-fan` to `gann-box` (Task 13's first kind, still
    unported).
  - **runtime** — 5 new emit functions under
    `packages/runtime/src/emit/draw/fibB/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Four use the
    4-arg form `(slotId, a, b, opts?)`; `fibTrendTime` uses the 3-arg
    `(slotId, anchors, opts?)`. Fall-through-stub fixture in
    `namespace.test.ts` / `primitives.test.ts` /
    `buildComputeContext.test.ts` moves from `fibSpeedFan` to
    `gannBox`.
  - **canvas2d-adapter** — 5 new renderers reusing Task-4's
    `FIB_LEVELS` + `formatLevel`. `fibSpiral` additionally reuses
    `sampleCubic` for the chained quarter-Bezier approximation of the
    golden spiral. Default colour `"#facc15"` per invinite's fib-tool
    palette.
  - **conformance** — 5 new per-kind scenarios + 1 bundle
    (`drawFibAll.scenario.ts` covering all 10 fib kinds, superseding
    Task 11's `drawFibA.scenario.ts` which is deleted). Conformance +
    scenarios test-capability fixtures switch from the explicit
    fib-A kebab list to `capabilities.allFibDrawings()` (covers all
    10 kinds). All 6 hashes pinned against the deterministic-run
    actuals.

  Divergences flagged in `tasks/phase-3-drawing-parity/12-fibonacci-b.plan.md`:

  - `fibSpiral` is clockwise-only — invinite's `counterClockwise`
    flag is deferred (Task-1 reshape follow-up; landed `FibSpiralState`
    - `FibOpts` don't carry the field).
  - `fibSpeedArcs` is full-circle only — invinite's half-disk variant
    is deferred (Phase-3-deferred UX nuance).
  - `fibCircles` + `fibTrendTime` use the ratio array (`FIB_LEVELS`),
    NOT the integer Fibonacci sequence. Same precedent as Task-11's
    `fib-time-zone`.
  - `gen-docs` regeneration for the 5 new kinds deferred to Task 21
    (the existing `chartlang docs` command only walks `ta.*`; the
    `draw.*` walker extension is an explicit Task-21 deliverable).
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–11.

  See `tasks/phase-3-drawing-parity/12-fibonacci-b.plan.md` for the
  full audit + divergence list.

- b0d296b: Phase 3 Task 13 — Gann (`gannBox` / `gannSquareFixed` / `gannSquare` /
  `gannFan`).

  - **adapter-kit** — 4 new per-kind validators
    (`validateGannBoxState`, `validateGannSquareFixedState`,
    `validateGannSquareState`, `validateGannFanState`), reusing
    Task-5's `validateLineDrawStyle` style helper. The
    permissive-default test fixture moves from `gann-box` to
    `pitchfork` (Task 14's first kind, still unported).
  - **runtime** — 4 new emit functions under
    `packages/runtime/src/emit/draw/gann/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Three use the
    4-arg form `(slotId, a, b, opts?)`; `gannSquareFixed` uses the
    3-arg `(slotId, anchor, opts?)`. Fall-through-stub fixture in
    `namespace.test.ts` / `primitives.test.ts` /
    `buildComputeContext.test.ts` moves from `gannBox` to `pitchfork`.
  - **canvas2d-adapter** — 4 new renderers + a shared `gannLevels.ts`
    helper exporting `GANN_LEVELS` (`[0, 0.25, 0.5, 0.75, 1]`),
    `GANN_FAN_RATIOS` (9-entry tuple covering 1×1, 1×2, …, 8×1),
    `GANN_FAN_LABELS`, and `formatGannRatio`. Default colour
    `"#a855f7"` (purple/violet, mirroring invinite's gann-tool
    palette).
  - **conformance** — 4 new per-kind scenarios + 1 bundle
    (`drawGannAll.scenario.ts` covering all 4 gann kinds).
    Conformance + scenarios test-capability fixtures widen
    `drawings` with `capabilities.allGannDrawings()`. All 5 hashes
    pinned against the deterministic-run actuals.

  Divergences flagged in `tasks/phase-3-drawing-parity/13-gann.plan.md`:

  - `gannBox.levels` custom override deferred — landed `GannBoxState`
    carries only `style: LineDrawStyle`. Renderer uses the shared
    `GANN_LEVELS` constant only (Task-1 reshape follow-up).
  - `gannSquareFixed.sizePrice` custom override deferred — landed
    `GannSquareFixedState` carries only `anchor + style`. Renderer
    uses a fixed `80px` side (Task-1 reshape follow-up).
  - `gannSquare.ratio` custom override deferred — landed
    `GannSquareState` carries only `anchors + style`. Renderer uses
    canvas-space `max(|dx|, |dy|)` (1×1 default, Task-1 reshape
    follow-up).
  - `gannFan.showLabels` flag deferred — `LineDrawStyle` has no
    `showLabels` field. Phase-3 pins unlabeled rays (Task-1 reshape
    follow-up).
  - `gen-docs` regeneration for the 4 new kinds deferred to Task 21
    (the existing `chartlang docs` command only walks `ta.*`; the
    `draw.*` walker extension is an explicit Task-21 deliverable).
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–12.

  See `tasks/phase-3-drawing-parity/13-gann.plan.md` for the full
  audit + divergence list.

- b0d296b: Phase 3 Task 14 — Pitchforks (`pitchfork` / `pitchfan`). The
  `pitchfork` kind collapses the four invinite tools (`standard` /
  `schiff` / `modifiedSchiff` / `inside`) into one kind with a
  `variant` discriminator per PLAN.md §3.1.

  - **adapter-kit** — 2 new per-kind validators
    (`validatePitchforkState`, `validatePitchfanState`), reusing
    Task-2's `validateAnchorTriple` + Task-5's `validateLineDrawStyle`
    helpers. `validatePitchforkState` also pins the 4-entry variant
    enum (`standard | schiff | modifiedSchiff | inside`). The
    permissive-default test fixture moves from `pitchfork` to
    `xabcd-pattern` (Task 15's first kind, still unported).
  - **runtime** — 2 new emit functions under
    `packages/runtime/src/emit/draw/pitchforks/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Both use the
    3-arg form `(slotId, anchors, opts?)`. `pitchfork` accepts
    `opts: LineDrawStyle & { variant? }` — the impl destructures
    `variant` (defaulting to `"standard"`), strips it from the
    style payload, and builds the `PitchforkState`. Fall-through-stub
    fixture in `namespace.test.ts` / `primitives.test.ts` /
    `buildComputeContext.test.ts` moves from `pitchfork` to
    `xabcdPattern`.
  - **canvas2d-adapter** — 2 new renderers + a shared
    `pitchforkGeom.ts` helper exporting `medianOriginFor(variant, a,
b, c)` and `medianTargetFor(variant, a, b, c)` (per-variant
    median-rail endpoints in canvas space). Default colour
    `"#ec4899"` (pink/magenta, mirroring invinite's pitchfork-tool
    palette family). The pitchfork renderer emits 3 strokes per
    emission (median + 2 parallel handles through `b` and `c`); the
    pitchfan renderer emits 3 rays from `a` through `b`, `mid(b, c)`,
    `c`.
  - **conformance** — 2 new per-kind scenarios + 1 bundle
    (`drawPitchforksAll.scenario.ts` covering 4 pitchfork variants +
    1 pitchfan = 5 emissions). Conformance + scenarios + index
    test-capability fixtures widen `drawings` with
    `capabilities.allPitchforkDrawings()`. All 3 hashes pinned
    against the deterministic-run actuals.

  Divergences flagged in
  `tasks/phase-3-drawing-parity/14-pitchforks.plan.md`:

  - `extendLeft` / `extendRight` flags from invinite's
    `PitchforkDrawing` not on landed `PitchforkState`. Phase-3 pins
    the default extend-forward behaviour for each rail (Task-1
    reshape follow-up).
  - Per-instance `levels` array not on landed state. Phase-3 renders
    the median + 2 parallel-handle pattern only — no per-level
    offsets (Task-1 reshape follow-up).
  - `medianColor` / `medianLineStyle` / `medianStrokeWidthPx` not on
    landed state. Phase-3 paints the median with the same
    `LineDrawStyle` as the handles (Task-1 reshape follow-up).
  - `gen-docs` regeneration for the 2 new kinds deferred to Task 21
    (the existing `chartlang docs` command only walks `ta.*`; the
    `draw.*` walker extension is an explicit Task-21 deliverable).
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–13.

  See `tasks/phase-3-drawing-parity/14-pitchforks.plan.md` for the
  full audit + divergence list.

- b0d296b: Phase 3 Task 15 — Harmonic Patterns (`xabcdPattern` / `cypherPattern`
  / `headAndShoulders` / `abcdPattern` / `trianglePattern` /
  `threeDrivesPattern`). All 6 kinds map to the `polylines` bucket and
  ship as flat methods (`draw.<kind>(...)`) per the Task-11 Option-C
  decision.

  - **adapter-kit** — 6 new per-kind validators
    (`validateXabcdPatternState`, `validateCypherPatternState`,
    `validateHeadAndShouldersState`, `validateAbcdPatternState`,
    `validateTrianglePatternState`,
    `validateThreeDrivesPatternState`) plus a new
    `validateAnchorHept` helper covering the 7-anchor
    `three-drives-pattern` shape. All 6 validators reuse Task-5's
    `validateLineDrawStyle` and Task-2's per-anchor-arity helpers.
    The permissive-default test fixture moves from `xabcd-pattern`
    → `elliott-impulse-wave` (Task 16's first kind, still unported).
  - **runtime** — 6 new emit functions under
    `packages/runtime/src/emit/draw/patterns/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Each uses the
    3-arg form `(slotId, anchors, opts?)` with the dual-overload
    pattern. Fall-through-stub fixture in `namespace.test.ts` /
    `primitives.test.ts` / `buildComputeContext.test.ts` moves from
    `xabcdPattern` to `elliottImpulseWave`.
  - **canvas2d-adapter** — 6 new renderers plus a shared
    `namedPolyline.ts` helper exporting `renderNamedPolyline(ctx,
points, labels, style)` — strokes an open polyline through the
    pre-projected canvas-space points and fills one text label
    above each anchor (textAlign `center` + textBaseline `bottom`,
    6 px above the anchor). Default colour `#f59e0b` (amber/orange,
    matching invinite's pattern-tool palette family).
    `headAndShoulders` adds a neckline stroke between the two
    trough anchors (`anchors[1]` → `anchors[3]`), totalling 2
    strokes per emission; the other 5 kinds emit 1 polyline stroke - N point labels.
  - **conformance** — 6 new per-kind scenarios + 1 bundle
    (`drawPatternsAll.scenario.ts` covering all 6 kinds = 6
    emissions). Conformance + scenarios + index test-capability
    fixtures widen `drawings` with
    `capabilities.allPatternDrawings()`. All 7 hashes pinned
    against the deterministic-run actuals.

  **Provenance carve-out — `cypherPattern`.** Per the team-lead
  brief + PLAN.md §3.1, `cypher-pattern` has no standalone invinite
  tool — only the y-doc-bridge type. The runtime emit
  (`packages/runtime/src/emit/draw/patterns/cypherPattern.ts`) and
  the canvas2d renderer
  (`examples/canvas2d-adapter/src/render/draw/cypherPattern.ts`)
  both cite **only** `invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts`
  in their relicense headers (no `*-tool.ts` line). The UI surface
  for cypher lives in `defineDrawing` (Task 20).

  Divergences flagged in
  `tasks/phase-3-drawing-parity/15-patterns.plan.md`:

  - **`headAndShoulders` is 5-anchor on the landed state** (Task 1's
    `HeadAndShouldersState.anchors: AnchorQuint`), not the 7-anchor
    invinite shape (`start, leftShoulder, leftTrough, head,
rightTrough, rightShoulder, end`). The renderer treats the 5
    anchors as `[LS, LL, H, RL, RS]` and strokes a neckline between
    the two trough anchors only (no start/end projection). Flagged
    as a Task-1 reshape follow-up.
  - **`trianglePattern` is 3-anchor on the landed state**
    (`TrianglePatternState.anchors: AnchorTriple`), not the 4-anchor
    invinite shape (`a, b, c, d`). The renderer treats the 3 anchors
    as `[apex, baseHigh, baseLow]` matching the landed type's
    `@anchors` annotation. Flagged as a Task-1 reshape follow-up.
    Distinct from `draw.triangle` (Task 6), a solid-shape primitive
    with `ShapeStyle` — `draw.trianglePattern` is a harmonic-pattern
    outline with `LineDrawStyle`. JSDoc cross-references the
    distinction.
  - `gen-docs` regeneration for the 6 new kinds deferred to Task 21
    (the existing `chartlang docs` command only walks `ta.*`; the
    `draw.*` walker extension is an explicit Task-21 deliverable).
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–14.

  See `tasks/phase-3-drawing-parity/15-patterns.plan.md` for the
  full audit + divergence list.

- b0d296b: Phase 3 Task 16 — Elliott Waves (`elliottImpulseWave` /
  `elliottCorrectionWave` / `elliottTriangleWave` / `elliottDoubleCombo`
  / `elliottTripleCombo`). All 5 kinds map to the `polylines` bucket
  and ship as flat methods (`draw.<kind>(...)`) per the Task-11
  Option-C decision.

  - **adapter-kit** — 5 new per-kind validators
    (`validateElliottImpulseWaveState`,
    `validateElliottCorrectionWaveState`,
    `validateElliottTriangleWaveState`,
    `validateElliottDoubleComboState`,
    `validateElliottTripleComboState`) plus a new
    `validateOptionalLabels(v, path, expectedCount)` helper that
    validates the optional script-author `state.labels` override
    (when present: array of strings whose length exactly matches the
    per-kind anchor count). All 5 validators reuse Task-5's
    `validateLineDrawStyle` and Task-2/15's
    `validateAnchorTriple` / `validateAnchorQuint` /
    `validateAnchorHept`. The permissive-default test fixture moves
    from `elliott-impulse-wave` → `cyclic-lines` (Task 17's first
    kind, still unported).
  - **runtime** — 5 new emit functions under
    `packages/runtime/src/emit/draw/elliott/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Each uses the
    3-arg form `(slotId, anchors, opts?)` with the dual-overload
    pattern. The runtime widens `opts` to
    `LineDrawStyle & { labels?: ReadonlyArray<string> }` — the impl
    destructures `labels` from `opts`, strips it from the style
    payload, and stores it on `state.labels` only when present
    (preserving the optional field's `undefined` state when omitted
    so emission hashes stay stable). Fall-through-stub fixture in
    `namespace.test.ts` / `primitives.test.ts` /
    `buildComputeContext.test.ts` moves from `elliottImpulseWave` to
    `cyclicLines`.
  - **canvas2d-adapter** — 5 new renderers reusing Task-15's
    `renderNamedPolyline` helper. Default colour `#14b8a6` (teal —
    free palette slot distinct from blue/yellow/purple/pink/amber).
    Each renderer honours the optional `state.labels` override when
    present and its length matches the anchor count (defensive
    fallback to the per-kind default `LABELS` constant). Per-kind
    default labels: impulse `["1","2","3","4","5"]`, correction
    `["A","B","C"]`, triangle `["a","b","c","d","e"]`, double-combo
    `["S","W","x1","X","x2","Yi","Y"]`, triple-combo
    `["S","W","X1","Y","X2","Zi","Z"]`. Dispatch test's describe
    label bumps from "Task-16+ stubs" to "Task-17+ stubs".
  - **conformance** — 5 new per-kind scenarios + 1 bundle
    (`drawElliottAll.scenario.ts` covering all 5 kinds = 5
    emissions). Conformance + scenarios + index test-capability
    fixtures widen `drawings` with `capabilities.allElliottDrawings()`.
    All 6 hashes pinned against the deterministic-run actuals.

  Divergences flagged in
  `tasks/phase-3-drawing-parity/16-elliott.plan.md`:

  - **`WaveDegree` enum + label-decoration helper NOT on landed state**
    (Task 1's `Elliott*State` shapes carry no `degree` field — they
    carry an optional `labels?: ReadonlyArray<string>` field instead,
    letting the script author override the per-kind default labels
    directly). The 9-level `WaveDegree` enum + the
    `elliottLabels.ts` decoration helper are dropped from Phase 3.
    Flagged as a Task-1 reshape follow-up.
  - **`elliottImpulseWave` is 5-anchor on the landed state** (Task 1's
    `ElliottImpulseWaveState.anchors: AnchorQuint`), not the 6-anchor
    invinite shape. The renderer treats the 5 anchors as the wave1End
    → wave5End pivots and strokes 4 connecting legs. Same precedent
    for `elliottCorrectionWave` (landed 3-anchor vs invinite 4),
    `elliottTriangleWave` (landed 5-anchor vs invinite 6), and
    `elliottTripleCombo` (landed 7-anchor vs invinite 10). All
    flagged as Task-1 reshape follow-ups.
  - `gen-docs` regeneration for the 5 new kinds deferred to Task 21
    (the existing `chartlang docs` command only walks `ta.*`; the
    `draw.*` walker extension is an explicit Task-21 deliverable).
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–15.

  See `tasks/phase-3-drawing-parity/16-elliott.plan.md` for the full
  audit + divergence list.

- b0d296b: Phase 3 Task 17 — Cycles (`cyclicLines` / `timeCycles` / `sineLine`).
  All 3 kinds map to the `other` bucket and ship as flat methods
  (`draw.<kind>(a, b, opts?)`) per the Task-11 Option-C decision.

  - **adapter-kit** — 3 new per-kind validators
    (`validateCyclicLinesState`, `validateTimeCyclesState`,
    `validateSineLineState`). All 3 reuse Task-2's `validateAnchorPair`
    - Task-5's `validateLineDrawStyle`; no new helpers needed (cycle
      states carry no `labels` field, so Task-16's
      `validateOptionalLabels` is not consumed). The permissive-default
      test fixture moves from `cyclic-lines` → `group` (Task 18's first
      kind, still unported).
  - **runtime** — 3 new emit functions under
    `packages/runtime/src/emit/draw/cycles/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Each uses the
    4-arg dual-overload form `(slotId, a, b, opts?)` mirroring `line`
    (the script-author surface is the 3-arg `(a, b, opts?)`; the
    compiler injects the leading slot id). State is assembled as
    `anchors: [a, b]`. Fall-through-stub fixture in
    `namespace.test.ts` / `primitives.test.ts` /
    `buildComputeContext.test.ts` moves from `cyclicLines` to `group`.
  - **canvas2d-adapter** — 3 new renderers reusing Task-4's
    `worldPointToCanvas` + Phase-1 `dashPattern`. Default colour
    `#0ea5e9` (sky blue — free palette slot distinct from
    blue/yellow/purple/pink/amber/teal/green/red used by prior port
    tasks). Per-kind geometry:

    - `cyclicLines` — repeated full-height vertical strokes at
      `fromX + n * periodPx` for n ∈ [0, viewport+overscan/periodPx],
      capped at 256 iterations. Skips silently on degenerate period.
    - `timeCycles` — concentric upper-half arcs centred at the
      midpoint of `(from, to)` on the `from.price` baseline, radius =
      `|toX − fromX| / 2`. Arcs tile across the viewport at multiples
      of the diameter (64 per side). Skips silently on degenerate
      diameter.
    - `sineLine` — sampled sinusoidal polyline. Half-period =
      `|toX − fromX|` (full period doubled). Baseline = midpoint of
      `(fromY, toY)`. Amplitude = `|fromY − toY| / 2`. 32 samples per
      full period; wave starts at the `from` extreme (peak vs trough
      flipped by `fromPx.y < toPx.y` — mirrors invinite's
      `extremeIsPeak` flag). Skips silently on degenerate half-period.

    Dispatch test's describe labels bump from "Tasks 5–15 shipped" to
    "Tasks 5–17 shipped" and "Task-17+ stubs" to "Task-18+ stubs".

  - **conformance** — 3 new per-kind scenarios + 1 bundle
    (`drawCyclesAll.scenario.ts` covering all 3 kinds = 3 emissions).
    Conformance + scenarios + index test-capability fixtures widen
    `drawings` with `capabilities.allCycleDrawings()`. All 4 hashes
    pinned against the deterministic-run actuals:
    `drawCyclicLines` = `975166fe…aae16`,
    `drawTimeCycles` = `1bdaca36…d88c0`,
    `drawSineLine` = `9f88b689…3ba8`,
    `drawCyclesAll` = `ef46754f…cc80b`.

  Divergences flagged in
  `tasks/phase-3-drawing-parity/17-cycles.plan.md`:

  - **`SineLineState.period: number` field NOT on landed state**
    (Task 1's `SineLineState` carries only `anchors` + `style` —
    the renderer derives the half-period from `|to.time − from.time|`,
    matching invinite's tool source). The explicit `period: number`
    field is dropped from Phase 3; flagged as a Task-1 reshape
    follow-up.
  - **`TimeCyclesState.style.fill` / `fillAlpha` NOT on landed state**
    (Task 1's `TimeCyclesState` uses `LineDrawStyle`, not
    `ShapeStyle`). The renderer strokes the arcs only — invinite's
    tool source DOES fill the half-circles. Flagged as a Task-1
    reshape follow-up.
  - **`to.time > from.time` reject NOT enforced** — Phase-3 renderer
    no-ops silently on degenerate input, matching every other Phase-3
    drawing port (gann / fib / elliott all silently no-op on
    collapsed anchors). The validator accepts reversed anchors per
    `validateAnchorPair`'s finite-only contract.
  - `gen-docs` regeneration for the 3 new kinds deferred to Task 21
    (the existing `chartlang docs` command only walks `ta.*`; the
    `draw.*` walker extension is an explicit Task-21 deliverable).
  - Per-kind property / golden test files deferred to the pragmatic
    1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–16.

  See `tasks/phase-3-drawing-parity/17-cycles.plan.md` for the full
  audit + divergence list.

- b0d296b: Phase 3 Task 18 — Containers (`group` / `frame`). The FINAL per-port
  task: after this lands all 61 `DrawingKind`s have real validator /
  emit / renderer / dispatch arms. Both kinds map to the `other`
  bucket and ship as flat methods (`draw.group(childHandleIds)` /
  `draw.frame(a, b, opts?)`) per the Task-11 Option-C decision.

  - **adapter-kit** — 2 new per-kind validators (`validateGroupState`,
    `validateFrameState`) + 2 tiny shared helpers
    (`validateOptionalChildHandleIds`, `validateFrameOpts`). `group`
    pins `childHandleIds.length ≤ 100`; `frame` reuses Task-2's
    `validateAnchorPair`, accepts degenerate anchors (silent no-op at
    the renderer per the rest of Phase-3's degenerate-input
    precedent). The permissive-default test fixture
    (`validateEmission.test.ts:1516`) flips from
    `permissively-accepts` to a rejecting `validateGroupState`
    assertion + a new gate-only test that asserts unknown kinds drop
    with `unsupported-drawing-kind` upstream. After Task 18 every
    `DrawingKind` has a real validator arm — the
    `default: return { ok: true };` arm in `validateStateByKind` is
    removed; TS's exhaustiveness check now catches a future
    `DrawingKind` addition without a validator.
  - **runtime** — 2 new emit functions under
    `packages/runtime/src/emit/draw/containers/` wired into the
    `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. `group` is a
    2-arg dual-overload `(slotId, childHandleIds)`; `frame` is a 4-arg
    dual-overload `(slotId, a, b, opts?)` mirroring `line`. After Task
    18 `IMPL_KIND_NAMES.size === 61`; the Proxy's else-branch
    fall-through to core's throwing-stub is dead code on the
    `DrawNamespace` type surface — kept as defence-in-depth for
    property access outside that type. The pre-Task-18
    "still-stubbed" assertions in `namespace.test.ts` /
    `primitives.test.ts` / `buildComputeContext.test.ts` are replaced
    with a positive cardinality sweep that asserts every
    `DrawingKind` resolves to a real runtime impl that throws the
    in-step-only sentinel (NOT the core stub sentinel).
  - **canvas2d-adapter** — 1 real renderer (`renderFrame`) + 1 pure
    no-op renderer (`renderGroup`). `renderFrame` strokes a closed
    4-corner rectangle defaulting to slate `#64748b`, optionally
    paints a `fillRect` background when `style.bgColor` is set, and
    optionally paints a `fillText` label inset 6 px from the top-left
    when `style.label` is set. Degenerate anchors (zero width or zero
    height in canvas space) silently no-op. `renderGroup` is a pure
    no-op for Phase 3 — the visible bounding-box envelope around
    grouped drawings is a Phase-4 follow-up tied to
    `Viewport.drawingsById` plumbing (Viewport currently exposes only
    `xMin/xMax/yMin/yMax/pxWidth/pxHeight`). `drawingDispatch`'s
    `// Containers (Task 18)` arms flip from `return;` no-ops to
    `return renderGroup(...)` / `return renderFrame(...)`. The
    `drawingDispatch.test.ts` describe labels bump:
    `Task-18+ stubs` → `'group' no-op + exhaustiveness`;
    `Tasks 5–17 shipped` → `Tasks 5–18 shipped`.
  - **conformance** — 2 new per-kind scenarios (`drawGroup`,
    `drawFrame`) + 1 bundle (`drawContainersAll`, 2 emissions).
    Pinned `drawing-hash` assertions for each:
    - `draw-group`:
      `6e32e387543ef421d1e53c1c15612cc32a814c85c2d969ad86d9f47b8d0359a2`
    - `draw-frame`:
      `4b54e0b6e75ad40904e0f70ac5b34067afa6c1237d43060823889f04b86d900b`
    - `draw-containers-all`:
      `e6ba183dfc04145a5126e6ea75a4cb7117694adc13eea84853239c68810e91fe`
      `TEST_CAPABILITIES.drawings` widens with
      `...capBuilders.allContainerDrawings()`; the `ALL_SCENARIOS`
      `toEqual` array (in `scenarios.test.ts` and `index.test.ts`)
      appends the 3 new scenarios under
      `// Phase 3 Task 18 — Containers.`.

  ### Divergences from spec (`tasks/phase-3-drawing-parity/18-containers.md`)

  1. **Spec § Runtime Notes says `draw.group(children:
ReadonlyArray<DrawingHandle>)` accepts handle objects.** Landed
     core surface takes `ReadonlyArray<string>` (handle ids) directly
     — the runtime impl uses the landed shape so the wire payload is
     1:1 with what the script passes. Documented in `draw.group`'s
     JSDoc with the canonical `draw.group([a.id, b.id])` pattern.
  2. **Spec § Renderer Notes says `group` renders a dashed bounding
     box derived from children's `view.drawingsById.get(childId).state`
     extrema.** Landed `Viewport` exposes no `drawingsById` field;
     adding it is a foundation-level Viewport change beyond a per-port
     task. Phase 3 ships `renderGroup` as a pure no-op (children
     render themselves per `GroupState`'s metadata contract);
     bounding-box envelope deferred to Phase 4.
  3. **Spec § Kinds Landed says `group.style: { lineWidth?; color? }`
     for the boundary box.** Landed `GroupState` has no `style` field
     (only `childHandleIds` + optional `meta`). Use the landed shape;
     the boundary-box style lands with the Phase-4 renderer rework.
  4. **Spec § Tests says degenerate `frame` anchors are a warning
     diagnostic.** Landed `validateAnchorPair` only enforces finite
     `time`/`price`; degenerate frames pass validation and the
     renderer silently no-ops on `width === 0 || height === 0`. This
     matches the rest of Phase 3's "no-op on degenerate input"
     precedent (gann/fib/elliott/cycles).
  5. **Per-kind property tests skipped** — same Tasks 5–17 precedent.
     The per-kind validator describe arms cover happy + wrong-shape
     per kind; the `childHandleIds.length ≤ 100` cap is exercised
     directly in the group describe block.

  ### Open / deferred

  - `GroupState` boundary-box style + `view.drawingsById` plumbing for
    the visible group envelope land in Phase 4 (Divergence §2 + §3).
  - `gen-docs` regeneration for `docs/primitives/draw/{group,frame}.md`
    defers to Task 21 (same precedent as Tasks 11–17 — the
    draw-namespace docs walker is Task 21's deliverable).
  - Workspace-wide gates (`pnpm typecheck`, `pnpm test` at the root)
    defer to Task 22's phase closeout. Per-package gates
    (adapter-kit / runtime / canvas2d / conformance) all green and
    100% coverage held.

- b0d296b: Phase-3 Task 3 — runtime `draw.*` emission infrastructure.

  **Runtime** — new `packages/runtime/src/emit/draw/` subtree:

  - `createDrawingHandle(slotId, subId, kind, initialState)` allocates
    a per-handle slot in `ctx.drawingSlots` keyed by `slotId#subId`,
    emits the first `op: "create"`, and returns a `DrawingHandle`
    whose `update(patch)` re-emits the FULL merged state under
    `op: "update"` (PLAN.md §10.3 full-state semantic) and whose
    `remove()` emits one final `op: "remove"` and flags the slot
    `removed: true`. Subsequent `update` / `remove` calls on a removed
    handle no-op. Cross-bar re-entry at the same `slotId#subId`
    resurrects the slot and emits `op: "update"`.
  - `pushDrawing(ctx, e)` enforces capability gating
    (`unsupported-drawing-kind`), wire-shape validation
    (`malformed-emission`), per-bucket budget on
    `op: "create"`/`"remove"` against
    `min(scriptMaxDrawings, adapter.maxDrawingsPerScript)`
    (`drawing-budget-exceeded`, clamped at zero on remove), and
    per-bar `(handleId, bar)` dedup (last-write-wins).
  - `nextSubId(ctx, slotId)` / `resetSubIdCounters(ctx)` —
    per-callsite per-bar counter; reset at the top of every
    `onBarClose` / `onBarTick` so iteration `i` at the same callsite
    yields the same `slotId#i` across bars.
  - `draw` re-exports core's throwing-stub Proxy verbatim. Per-kind
    Tasks 5–18 swap real impls into this seam (mirroring how the
    Phase-2 `ta` re-export switched to `TA_REGISTRY`).

  `RuntimeContext` widens with four new fields: `drawingSlots`,
  `drawingSubIdCounters`, `drawingBucketCounters`, `scriptMaxDrawings`.
  `createScriptRunner` initialises them and reads
  `compiled.manifest.maxDrawings` for the script-side cap. `dispose`
  clears the slots and resets counters.

  `buildComputeContext` now injects `draw` into the `ComputeContext`
  the runner hands the compiled script.

  **Core** — `ComputeContext.draw: DrawNamespace` field added (the
  script-facing surface). Phase-1/-2 scripts that do not consume
  `draw` keep compiling unchanged; new scripts pick up the namespace
  through the same destructure pattern as `ta` / `plot` / `hline` /
  `alert`.

  **Conformance** — `ScenarioAssertion` grows a sixth `drawing-hash`
  variant. `BufferedRun.drawings` carries the per-bar drained
  emissions; `hashDrawingSeries(drawings, handleId?)` hashes
  JSON-stringified `{ handleId, kind, op, state, bar }` tuples in
  emission order. Failure messages mirror `plot-hash`:
  `drawing-hash[<label>]: expected <pinned>, actual <computed>
(<N> emissions)` — copy `actual` to re-pin.

  No behaviour change for Phase-1/-2 scenarios — the runtime still
  emits no drawings until the per-kind ports (Tasks 5–18) land.

- b0d296b: Phase-3 Task 5 — first per-port task. Lands the 6 line-family drawing
  kinds (`line`, `horizontalLine`, `horizontalRay`, `verticalLine`,
  `crossLine`, `trendAngle`) per PLAN.md §10 and §22.10.

  `@invinite-org/chartlang-runtime` ships 6 new `draw.<kind>(...)` emit
  functions under `src/emit/draw/lines/` plus the `DRAW_NAMESPACE` swap
  seam at `src/emit/draw/namespace.ts` — the namespace re-exports core's
  throwing-stub Proxy for the 55 kinds that haven't shipped yet and
  routes the 6 line kinds through their runtime impls. Each impl uses
  the dual-overload pattern (`(a, b, opts?)` script-facing throw +
  `(slotId, a, b, opts?)` compiler-injected) mirroring `plot` / `alert`.
  Returns a `DrawingHandle` per PLAN.md §10.3; subsequent in-bar
  `update(patch)` calls merge into the slot's state and re-emit the
  full payload.

  `@invinite-org/chartlang-compiler` widens the core ambient shim
  (`program.ts`) with `WorldPoint`, `LineDrawStyle`, `DrawingHandle`,
  `DrawNamespace` declarations + `export const draw: DrawNamespace` so
  the callsite-id transformer recognises `draw.<kind>(...)` calls and
  injects the slot id (entries already shipped in `STATEFUL_PRIMITIVES`
  via Task 1).

  `chartlang-example-canvas2d-adapter` ships 6 new renderers under
  `src/render/draw/` — `line.ts`, `horizontalLine.ts`,
  `horizontalRay.ts`, `verticalLine.ts`, `crossLine.ts`,
  `trendAngle.ts` — plus the shared `extendLineSegment` helper that
  projects a segment to the viewport edges (consumed by `line` when its
  `extendLeft`/`extendRight` flags are set, and by `horizontalRay`
  which always extends right). The `drawingDispatch` switch arms for
  the 6 line kinds flip from no-op stubs to real-impl calls; the
  exhaustive `satisfies never` default and `op: "remove"` short-circuit
  are unaffected. The `trendAngle` renderer additionally draws a small
  arc + angle text at the `from` anchor, mirroring the invinite tool's
  `paintTrendAngleArc`.

  `@invinite-org/chartlang-conformance` lands 7 new bundled scenarios:
  6 per-kind (`DRAW_LINE_SCENARIO`, `DRAW_HORIZONTAL_LINE_SCENARIO`,
  `DRAW_HORIZONTAL_RAY_SCENARIO`, `DRAW_VERTICAL_LINE_SCENARIO`,
  `DRAW_CROSS_LINE_SCENARIO`, `DRAW_TREND_ANGLE_SCENARIO`) plus one
  category bundle (`DRAW_LINES_AND_RAYS_SCENARIO`). Each uses
  `inlineSource` and pins one `drawing-hash` assertion + asserts
  `unsupported-drawing-kind` and `drawing-budget-exceeded` are absent.
  The `TEST_CAPABILITIES` bag in the conformance test suite widens
  `drawings` to `capabilities.allLineDrawings()` and lifts the `lines`
  bucket budget from `0` to `100` so the new scenarios reach
  `pushDrawing`'s happy path. All 7 scenarios pass against the
  canvas2d default adapter (which already declared
  `drawings: capabilities.allPhase3Drawings()` via Task 4).

  All Phase-1 / Phase-2 / Tasks-1–4 gates remain green. 100% coverage
  maintained across `runtime`, `canvas2d-adapter`, and `conformance`.

- b0d296b: Phase-3 Task 6 — second per-port task. Lands the 4 straight-edged
  box-family drawing kinds (`rectangle`, `rotatedRectangle`, `triangle`,
  `polyline`) per PLAN.md §10 and §22.10. Behaviour ports from invinite
  commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`:
  `tools/rectangle-tool.ts`, `tools/rotated-rectangle-tool.ts`,
  `tools/triangle-tool.ts`, `tools/polyline-tool.ts`, and the matching
  `y-doc-bridge.ts` `DrawingMetadata` variants.

  `@invinite-org/chartlang-adapter-kit` adds per-kind state validators
  for the 4 box-A kinds — `validateRectangleState`,
  `validateRotatedRectangleState`, `validateTriangleState`,
  `validatePolylineState` — wired into the existing
  `validateStateByKind` dispatch. New file-local helpers
  `validateAnchorTriple` / `validateAnchorQuad` /
  `validateAnchorVariable(min, max)` / `validateShapeStyle` cover the
  anchor cardinalities and the `ShapeStyle` payload bag. `polyline`
  pins `3 ≤ anchors.length ≤ 20` (mirrors invinite's 20-point cap).
  Wire shape is stricter than before — payloads previously passing the
  permissive default arm now reject with `malformed-emission`.

  `@invinite-org/chartlang-runtime` ships 4 new `draw.<kind>(...)` emit
  functions under `src/emit/draw/boxes/` and extends the
  `DRAW_NAMESPACE` swap-seam at `src/emit/draw/namespace.ts`. Each impl
  uses the dual-overload pattern (`(...)` script-facing throw +
  `(slotId, ...)` compiler-injected) mirroring Task 5 / `plot` /
  `alert`. Returns a `DrawingHandle` per PLAN.md §10.3.

  `chartlang-example-canvas2d-adapter` ships 4 new renderers under
  `src/render/draw/` plus a shared `shapeStyle.ts` helper exporting
  `applyShapeStyle(ctx, style): AppliedShapeStyle` — sets stroke /
  lineWidth / dash and returns the resolved fill payload so the
  renderer can wrap `ctx.fill()` in a `globalAlpha` bracket. The
  `drawingDispatch` switch flips the 4 box-A arms from no-op stubs to
  real `renderXxx(ctx, e, view)` calls; exhaustiveness is preserved.
  Fill defaults to no-op, stroke defaults to `"#000000"`, lineWidth
  defaults to `1`. Rectangle is rendered as a closed 4-corner polygon
  (no `strokeRect` in the structural `RenderCtx`); rotatedRectangle
  walks the four world anchors directly (no canvas matrix ops);
  triangle walks 3 vertices; polyline auto-closes via `closePath()`.

  `@invinite-org/chartlang-conformance` ships 5 new scenarios under
  `src/scenarios/` — 4 per-kind (`drawRectangle`, `drawRotatedRectangle`,
  `drawTriangle`, `drawPolyline`) and 1 bundle (`drawBoxesA`). All five
  use `inlineSource` against the bundled 10 000-bar `goldenBars.json`
  fixture with anchor times pulled from `bars[0]` / `bars[500]` /
  `bars[1000]`. The `TEST_CAPABILITIES` bag in
  `runConformanceSuite.test.ts` + `scenarios.test.ts` widens to include
  `allBoxDrawings()` plus `boxes: 100` / `polylines: 100` budgets so
  the new scenarios reach `pushDrawing`'s happy path. The 5 new
  scenarios extend `ALL_SCENARIOS` (now 96 entries) and the public
  re-export surface.

  No core edits — the `DrawingState` variants and `DrawNamespace`
  signatures Task 1 shipped are the canonical shape and Task 6 wires
  real impls to them.

  Deviations from spec, flagged for review:

  - Spec's `rotatedRectangle` "3 anchors (a, b, widthOffset)"
    ergonomics — Task 1's `AnchorQuad` (4 corners) is the persisted
    shape. Callers supply the 4 corners directly; the
    (a, b, widthOffset) reshape belongs to Task 20's `defineDrawing`
    if it remains a hard requirement.
  - Spec's `polyline` `ShapeStyle` + auto-close — Task 1 ships
    `LineDrawStyle` (no fill). Renderer strokes the closed path; fill
    would require widening the variant in a follow-up.
  - Per-kind §22.10 5-file test set deferred to pragmatic 1-file set
    (mirrors Task 5) — Task 3's `pushDrawing.*` and `handle.*` suite
    covers the underlying infra exhaustively.
  - `gen-docs` doc-page generation deferred to Task 21 (mirrors Task 5).

- b0d296b: Phase-3 Task 7 — third per-port task. Lands the 4 curved-edge /
  single-anchor box-family drawing kinds (`circle`, `ellipse`, `path`,
  `marker`) per PLAN.md §10 and §22.10. Behaviour ports from invinite
  commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`:
  `tools/circle-tool.ts`, `tools/ellipse-tool.ts`, `tools/path-tool.ts`,
  `tools/marker-tool.ts`, and the matching `y-doc-bridge.ts` variants.

  `@invinite-org/chartlang-adapter-kit` adds per-kind state validators
  for the 4 box-B kinds — `validateCircleState`, `validateEllipseState`,
  `validatePathState`, `validateMarkerState` — wired into the existing
  `validateStateByKind` dispatch. New file-local helpers
  `validatePathOpts` (LineDrawStyle + optional `closed: boolean`) and
  `validateTextOpts` (color / size / halign / valign / bgColor enums)
  cover the path / marker style bags. `path` pins
  `2 ≤ anchors.length ≤ 20` (mirrors invinite's 20-point cap and is
  narrower than `polyline`'s 3..20 because path supports a 2-point
  segment with optional caps). Wire shape is stricter than before —
  payloads previously passing the permissive default arm now reject
  with `malformed-emission`.

  `@invinite-org/chartlang-runtime` ships 4 new `draw.<kind>(...)` emit
  functions under `src/emit/draw/boxes/` and extends the
  `DRAW_NAMESPACE` swap-seam at `src/emit/draw/namespace.ts`. Each impl
  uses the dual-overload pattern Tasks 5 + 6 pinned. `draw.marker`
  splits its `opts` bag — top-level `text` / `value` land on
  `MarkerState` while the remaining `TextOpts` fields nest under
  `state.style`.

  `chartlang-example-canvas2d-adapter` ships 4 new renderers under
  `src/render/draw/`. `renderCircle` derives the radius in canvas-pixel
  space from `|edge - centre|` (matches invinite's circle-tool) and
  issues a single `ctx.arc(...)`. `renderEllipse` paints a 64-segment
  polyline approximation (Phase-1 `RenderCtx` exposes `arc(...)` but
  not `ellipse(...)` — a polyline keeps the renderer pure on the
  existing structural surface without widening it). `renderPath` paints
  an OPEN polyline (no `closePath` by default; `style.closed === true`
  toggles closure). `renderMarker` projects the anchor + paints
  `text` (when set) via `ctx.fillText` with `TextOpts`-derived font +
  alignment. Empty / undefined text is a pure no-op — icon-glyph
  painting belongs to Task 20's `defineDrawing` follow-up. The
  `drawingDispatch` switch flips the 4 box-B arms from no-op stubs to
  real `renderXxx(ctx, e, view)` calls; exhaustiveness is preserved.

  `@invinite-org/chartlang-conformance` ships 4 new per-kind scenarios
  under `src/scenarios/` (`drawCircle`, `drawEllipse`, `drawPath`,
  `drawMarker`). Per README §22.10 the Task-6 `drawBoxesA.scenario.ts`
  is REPLACED (deleted) by the wider `drawBoxesAll.scenario.ts`
  covering all 8 box kinds across Tasks 6 + 7 (rectangle /
  rotated-rectangle / triangle / polyline / circle / ellipse / path /
  marker). All five new scenarios use `inlineSource` against the
  bundled 10 000-bar `goldenBars.json` fixture with anchor times pulled
  from `bars[0]` / `bars[500]` / `bars[1000]`. The `TEST_CAPABILITIES`
  bag in `runConformanceSuite.test.ts` + `scenarios.test.ts` bumps
  `labels` budget from 0 to 100 to host the marker scenario (marker
  maps to the `labels` bucket). The 4 + 1 new scenarios extend
  `ALL_SCENARIOS` and the public re-export surface; `DRAW_BOXES_A_SCENARIO`
  is removed from the public surface (downstream consumers move to
  `DRAW_BOXES_ALL_SCENARIO`).

  No core edits — the `DrawingState` variants and `DrawNamespace`
  signatures Task 1 shipped are the canonical shape and Task 7 wires
  real impls to them.

  Deviations from spec, flagged for review:

  - `MarkerState` shape divergence — task spec's `markerKind` (`emoji` /
    `icon`) discriminator + `value: string` + `MAX_LENGTH = 32` + icon
    registry NOT implemented. Uses Task 1's landed
    `{ anchor, text?, value?, style: TextOpts }` shape (anchor not
    from/to pair; value is a number; no discriminator). Re-shaping
    belongs to a follow-up that widens core; mid-phase Task-1 reshapes
    cascade through the `DrawingState` union + adapter-kit decoder +
    Task-6 permissive-default tests.
  - `Ellipse` rendered as 64-segment polyline approximation because
    `RenderCtx` exposes `arc(...)` but not `ellipse(...)`. Widening
    the structural type would touch Phase-1's `RenderCtx`; the
    polyline path stays on the existing surface.
  - Per-kind §22.10 5-file test set deferred to pragmatic 1-file set
    (mirrors Tasks 5 + 6) — Task 3's `pushDrawing.*` and `handle.*`
    suite covers the underlying infra exhaustively.
  - `gen-docs` doc-page generation deferred to Task 21 (mirrors Tasks
    5 + 6).

- b0d296b: Phase-3 Task 8 — fourth per-port task. Lands the 6 curve + freehand
  drawing kinds (`arc`, `curve`, `doubleCurve`, `pen`, `highlighter`,
  `brush`) per PLAN.md §10 and §22.10. Behaviour ports from invinite
  commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`:
  `tools/arc-tool.ts`, `tools/curve-tool.ts`,
  `tools/double-curve-tool.ts`, `tools/pen-tool.ts`,
  `tools/highlighter-tool.ts`, `tools/brush-tool.ts`, and the matching
  `y-doc-bridge.ts` variants (`ArcDrawing`, `CurveDrawing`,
  `DoubleCurveDrawing`, `PenDrawing`, `HighlighterDrawing`,
  `BrushDrawing`). All 6 kinds map to the `polylines` bucket.

  `@invinite-org/chartlang-adapter-kit` adds per-kind state validators
  for the 6 curve + freehand kinds — `validateArcState`,
  `validateCurveState`, `validateDoubleCurveState`, `validatePenState`,
  `validateHighlighterState`, `validateBrushState` — wired into the
  existing `validateStateByKind` dispatch. Three new file-local helpers
  land alongside: `validateAnchorQuint` (5-tuple for `double-curve`),
  `validateHighlighterStyle` (required `color: string` + required
  `alpha ∈ [0, 1]`), and `validateBrushStyle` (required `stroke` + `fill`
  colour strings). Freehand kinds pin `2 ≤ anchors.length ≤ 500`
  (matches invinite's stroke cap; broader than the 2..20 path cap).
  Wire shape is stricter than before — payloads previously passing the
  permissive default arm now reject with `malformed-emission`.

  `@invinite-org/chartlang-runtime` ships 6 new `draw.<kind>(...)` emit
  functions under `src/emit/draw/curves/` and extends the
  `DRAW_NAMESPACE` swap-seam at `src/emit/draw/namespace.ts`. Each impl
  uses the dual-overload pattern Tasks 5–7 pinned. `draw.highlighter`
  and `draw.brush` differ from the other emit fns — their `opts`
  parameter is REQUIRED on the script-facing overload (no `?` because
  `HighlighterStyle` / `BrushStyle` carry required fields).

  `chartlang-example-canvas2d-adapter` ships 6 new renderers under
  `src/render/draw/`. The 3 curve renderers (`renderArc`, `renderCurve`,
  `renderDoubleCurve`) sample the curve via Task 4's `sampleQuadratic` /
  `sampleCubic` helpers at `CURVE_SAMPLES = 32` segments and stroke as a
  polyline — the structural `RenderCtx` exposes neither
  `quadraticCurveTo` nor `bezierCurveTo`, so this keeps the renderer
  pure on the Phase-1 surface (mirrors Task 7's `ellipse` 64-segment
  polyline approximation). `renderArc` derives the Bezier control point
  from `apex` via inverse-quadratic interpolation so the curve passes
  through `apex` at `t = 0.5`; `renderCurve` uses `anchors[1]` as the
  Bezier control directly (curve does NOT pass through control);
  `renderDoubleCurve` paints a single cubic from `anchors[0]` to
  `anchors[4]` with off-curve controls `anchors[1]` / `anchors[3]` (the
  middle stitch anchor `anchors[2]` is preserved in state but unused by
  the current render path — flagged for future split-rendering). The 3
  freehand renderers paint polylines: `renderPen` strokes open;
  `renderHighlighter` wraps the stroke in a `globalAlpha` set/reset
  bracket (default 6 px line width); `renderBrush` paints
  fill-then-stroke with `closePath` for a closed filled region. The
  `drawingDispatch` switch flips the 6 arms from no-op stubs to real
  `renderXxx(ctx, e, view)` calls; exhaustiveness is preserved.

  `@invinite-org/chartlang-conformance` ships 6 new per-kind scenarios
  under `src/scenarios/` (`drawArc`, `drawCurve`, `drawDoubleCurve`,
  `drawPen`, `drawHighlighter`, `drawBrush`) plus one bundle scenario
  `drawCurvesAndFreehandAll` that emits one drawing per curve + freehand
  kind on the first bar (per README §22.10 Task 8 collapses both
  categories into ONE bundle). All seven scenarios use `inlineSource`
  against the bundled 10 000-bar `goldenBars.json` fixture with anchor
  times pulled from `bars[0]` / `bars[500]` / `bars[1000]` (plus
  `bars[1500]` for the 4-point freehand strokes). The `TEST_CAPABILITIES`
  bags in `runConformanceSuite.test.ts` + `scenarios/scenarios.test.ts`
  extend the `drawings` set with `allCurveDrawings()` +
  `allFreehandDrawings()`; the existing `polylines: 100` bucket budget
  covers the bundle scenarios with headroom. `ALL_SCENARIOS` extends
  additively.

  No core edits — the `DrawingState` variants and `DrawNamespace`
  signatures Task 1 shipped are the canonical shape and Task 8 wires
  real impls to them.

  Deviations from spec, flagged for review:

  - `PressurePoint` type widening NOT applied — Task 1's `PenState`
    shape (`anchors: ReadonlyArray<WorldPoint>`) preserved per Tasks
    6/7 precedent of not reshaping Task-1 mid-phase. Adapter-level
    pressure-driven stroke-width variance is a follow-up concern.
  - `freehand.ts` smoothing helper NOT created. Per-renderer inline
    polyline loops suffice for Phase-3 deterministic `drawing-hash`
    assertions. If pressure-driven smoothing lands later, the helper
    can ship then.
  - `double-curve` middle anchor (`anchors[2]`, the stitch point) is
    preserved in state but currently unused by the renderer (single
    cubic from `anchors[0]` to `anchors[4]` with controls `[1]` / `[3]`).
    Future split-rendering can stitch two cubics through `mid`.
  - `arc` / `curve` / `doubleCurve` fill-path NOT rendered.
    `LineDrawStyle` has no fill fields; invinite's tools do support
    fill on these kinds. Widening to support fill is a Task-1 reshape
    and out of scope.
  - Bezier rendered as 32-segment polyline approximation because
    `RenderCtx` exposes `arc(...)` but not `quadraticCurveTo` /
    `bezierCurveTo`. Mirrors Task 7's `ellipse` 64-segment approach;
    widening would touch Phase-1 surface.
  - Per-kind §22.10 5-file test set deferred to pragmatic 1-file set
    (mirrors Tasks 5–7) — Task 3's `pushDrawing.*` and `handle.*`
    suite covers the underlying infra exhaustively.
  - `gen-docs` doc-page generation deferred to Task 21 (mirrors Tasks
    5–7).

- b0d296b: Phase-3 Task 9 — fifth per-port task. Lands the 5 annotation drawing
  kinds (`text`, `arrow`, `arrowMarker`, `arrowMarkUp`, `arrowMarkDown`)
  per PLAN.md §10 and §22.10. Behaviour ports from invinite commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`: `tools/text-tool.ts`,
  `tools/arrow-tool.ts`, `tools/arrow-marker-tool.ts`,
  `tools/arrow-mark-up-tool.ts`, `tools/arrow-mark-down-tool.ts`, and the
  matching `y-doc-bridge.ts` variants (`TextDrawing`, `ArrowDrawing`,
  `ArrowMarkerDrawing`, `ArrowMarkUpDrawing`, `ArrowMarkDownDrawing`).
  All 5 kinds map to the `labels` bucket.

  `@invinite-org/chartlang-adapter-kit` adds per-kind state validators
  for the 5 annotation kinds — `validateTextState`, `validateArrowState`,
  `validateArrowMarkerState`, `validateArrowMarkUpState`,
  `validateArrowMarkDownState` — wired into the existing
  `validateStateByKind` dispatch. Two new file-local style helpers land
  alongside: `validateArrowOpts` (`LineDrawStyle` + optional string
  `label`) and `validateArrowMarkerOpts` (optional `color` + optional
  `text`). `text.body` is validated through `walkMeta` (catches
  non-JsonValue payloads like bigint / function / symbol) and then
  pinned as a non-empty string with `TEXT_BODY_MAX_LENGTH = 256` (longer
  than the 128 cap on plot labels — annotation strings carry short
  rationales like "Inverse Head and Shoulders Confirmed"). Wire shape
  is stricter than before — payloads previously passing the permissive
  default arm now reject with `malformed-emission`.

  `@invinite-org/chartlang-runtime` ships 5 new `draw.<kind>(...)` emit
  functions under `src/emit/draw/annotations/` and extends the
  `DRAW_NAMESPACE` swap-seam at `src/emit/draw/namespace.ts`. Each impl
  uses the dual-overload pattern Tasks 5–8 pinned. `draw.text` is the
  first emit fn with three script-facing arguments (`anchor`, `body`,
  `opts?`); the compiler-injected form is `(slotId, anchor, body,
opts?)` and the impl signature carries four arguments.

  `chartlang-example-canvas2d-adapter` ships 5 new renderers under
  `src/render/draw/` plus three new shared helpers: `arrowhead.ts`
  (`drawArrowhead(ctx, from, to, size?)` — filled triangular arrowhead
  at `to` pointing along the shaft direction; used by `arrow` +
  `arrowMarker`), `chevron.ts` (`drawChevron(ctx, at, direction, color,
baseWidth?, height?)` — filled up/down triangle glyph; used by
  `arrowMarkUp` + `arrowMarkDown`), and `textStyle.ts` (`SIZE_TO_PX` /
  `HALIGN_TO_TEXTALIGN` / `VALIGN_TO_TEXTBASELINE` maps +
  `resolveTextOpts(opts)` helper that turns a `TextOpts` bag into the
  four canvas text-state values). The Task-7 `marker.ts` renderer is
  refactored to consume `textStyle.ts` for the same maps — its call
  sequence is preserved exactly so `marker.test.ts` continues to pass
  unchanged. Default colours follow invinite's paint-time defaults:
  `#3b82f6` (toolbar blue) for `arrowMarker`, `#22c55e` (green) for
  `arrowMarkUp`, `#ef4444` (red) for `arrowMarkDown`. The `drawingDispatch`
  switch flips the 5 arms from no-op stubs to real `renderXxx(ctx, e,
view)` calls; exhaustiveness is preserved.

  `@invinite-org/chartlang-conformance` ships 5 new per-kind scenarios
  under `src/scenarios/` (`drawText`, `drawArrow`, `drawArrowMarker`,
  `drawArrowMarkUp`, `drawArrowMarkDown`) plus one bundle scenario
  `drawAnnotationsAll` that emits one drawing per annotation kind on
  the first bar (per README §22.10 Task 9 collapses the category into
  ONE bundle). All six scenarios use `inlineSource` against the bundled
  10 000-bar `goldenBars.json` fixture with anchor times pulled from
  `bars[0]` / `bars[500]` / `bars[1000]`. The `TEST_CAPABILITIES` bags
  in `runConformanceSuite.test.ts` + `scenarios/scenarios.test.ts`
  extend the `drawings` set with `allAnnotationDrawings()`; the existing
  `labels: 100` bucket budget (added when Task 7's `marker` scenario
  landed) covers the bundle scenarios with headroom. `ALL_SCENARIOS`
  extends additively.

  No core edits — the `DrawingState` variants and `DrawNamespace`
  signatures Task 1 shipped are the canonical shape and Task 9 wires
  real impls to them.

  Deviations from spec, flagged for review:

  - `text.bgColor` background-rectangle paint NOT rendered. The
    structural `RenderCtx` exposes neither `measureText` nor a
    background-rect path; widening would touch the Phase-1 structural
    type. The `bgColor` field is preserved on the wire (validator
    accepts string) but the canvas2d renderer does not paint a
    background rect. Mirror Task 7's `marker` precedent.
  - `ArrowOpts.label` rotation NOT rendered. `RenderCtx` has no
    `rotate / translate / save / restore`. Label paints un-rotated at
    the shaft midpoint with `textAlign = "center"` /
    `textBaseline = "bottom"`. Pure on the Phase-1 surface.
  - `ArrowMarkerState` ↔ spec shape delta. Task 1's core landed
    `ArrowMarkerState` with single `anchor: WorldPoint`; the spec
    README §13 says `2 (from, to)`. Per Tasks 6/7's "don't reshape
    Task-1 mid-phase" precedent, Task 9 uses the single-anchor form
    and the renderer paints a self-contained glyph (dot + stub line +
    arrowhead + optional text) at the anchor — a "annotation lives
    here" marker that fits in ~24px. Reshape can ship in a follow-up.
  - `marker.ts` refactor crosses Task 7 boundary by ~5 lines to
    consume the new shared `textStyle.ts` helper. The call sequence is
    preserved exactly; `marker.test.ts` continues to pass without
    modifications.
  - Per-kind §22.10 5-file test set deferred to pragmatic 1-file set
    (mirrors Tasks 5–8) — Task 3's `pushDrawing.*` and `handle.*`
    suite covers the underlying infra exhaustively.
  - `gen-docs` doc-page generation deferred to Task 21 (mirrors Tasks
    5–8).

- Phase 4 - Editor + Inputs + Timeframes + Tier-1 Pine parity.
  Adds: input._ builders, state._ / state.tick.\* slots,
  barstate / syminfo / timeframe views, request.security typed
  surface (NaN fallback), defineIndicator overrides,
  Capabilities triad (intervals / multiTimeframe / subPanes /
  symInfoFields / maxDrawingsPerScript / alertConditions / logs),
  language-service hover registry + LSP-style API, CodeMirror 6
  editor shell + /react sub-export, Inputs UI ViewModel + React
  form. See tasks/phase-4-editor-tier1/README.md.
- Add runtime `state.*` and `state.tick.*` slot storage with committed/tentative lifecycle semantics and StateStore snapshot restore.
- Wire runtime `barstate`, `syminfo`, and `timeframe` views, and add optional adapter symbol metadata for `syminfo` population.
- Wire runtime `request.security` with Phase-4 NaN fallback bars, capability diagnostics, and per-slot caches.
- Resolve runtime `input.*` overrides at mount, add adapter input resolver wiring, and audit universal `ta.*` offset support.

### Patch Changes

- 3f3ce38: Phase-1 walking-skeleton: ship the canvas2d reference adapter
  (`examples/canvas2d-adapter`). The private example package now
  exports `createCanvas2dAdapter`, `runRendererLoop`,
  `CANVAS2D_CAPABILITIES`, `DEFAULT_PALETTE`, plus a
  `./testing` sub-path entry carrying `MockCanvas2DContext` +
  `hashCallLog` for sibling-package conformance tests (Task 12).

  Two cross-package adjustments rode along:

  - `@invinite-org/chartlang-host-worker` adds `createWorkerBoot`
    and `WorkerBootScope` to its public barrel so consumer-repo
    tests (and Task 10's integration test) can pair the worker host
    against a `MessageChannel`-backed scope. The boot factory was
    always testable from within the package; this exposes it as a
    stable surface.
  - `@invinite-org/chartlang-runtime`'s `makeSeriesView` Proxy now
    defines a `has` trap so `"current" in series` (and
    `"length" in series`, `"<n>" in series`) returns `true`. This
    unblocks `runtime/src/emit/plot.ts`'s `isSeriesNumber` check —
    previously the Proxy reported `false` for `in`, so calls like
    `plot(ta.ema(...))` with the real runtime Series threw the
    "outside an active script step" sentinel. Discovered via Task
    10's end-to-end integration test driving an EMA-cross bundle
    through the worker host into the canvas2d renderer.

- 38fb475: Hoist shared `ta.*` primitive helpers to `lib/`: relocate
  `DirectionalState` + the 3 directional-state helpers from `dmi.ts`
  to `lib/directionalState.ts` so `ta.adx` no longer cross-imports
  into a sibling primitive's `src/` file. Relocate
  `ScalarOrSeries` + `readSourceValue` from top-level `sourceValue.ts`
  to `lib/sourceValue.ts` to consolidate the shared helper surface.
  Widen `packages/runtime/src/ta/lib/CLAUDE.md` to document the
  shared-primitive-helper carve-out alongside the Float64-only compute
  cores.

  Reconcile `ALL_SCENARIOS` cardinality with `scripts/run-conformance.ts`
  by renaming the export to `ALL_SCENARIOS` with a `@deprecated since 0.2.1`
  alias retained for one release. Add iteration-parity test so script
  and canonical export can never drift again.

  Investigation note: found 78 scenarios in script (stale local
  `dist/` build), 85 in array, gap is the script's `dist/`-first import
  preference loading a stale snapshot — the runner iterates all 85
  entries with no silent skip (`report.passed + report.failed ===
ALL_SCENARIOS.length`). CI is unaffected because `pnpm build` runs
  before `pnpm conformance`. Resolution: option (a) — rename to
  `ALL_SCENARIOS`, keep `ALL_SCENARIOS` as deprecated alias.

- 38fb475: Phase-2 Task 3 — chained-MA helper family.

  Ports the WMA / SMMA / VWMA cores from invinite (commit
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`) into
  `packages/runtime/src/ta/lib/` and adds the MA-kind dispatcher pair
  (`computeMaOfFloat64` excludes `vwma` at the type level via
  `MaTypeNoVolume`; `computeMa` routes `vwma` through the volume-aware
  `vwmaFloat64` helper and throws a structured `TypeError`
  (`code = "ta-lib-vwma-requires-volume"`) when called with a null
  volume array). The `maTypes.ts` module exports the canonical
  `MaType` union + the `MaTypeNoVolume` excluder.

  NaN propagation matches invinite per-helper: the recurrence-based
  `smmaFloat64` holds the prior value forward on a mid-stream NaN
  (matches `emaFloat64`); the full-recompute window helpers
  `wmaFloat64` and `vwmaFloat64` short-circuit a window to NaN if any
  slot in it is NaN. VWMA also emits NaN when the trailing-window
  volume sum is zero.

  These helpers back ~22 of the §9.2 ports landing in Tasks 6–28:
  every MA primitive (Tasks 6–8), every BB / Keltner / Envelope / Chop
  / Donchian middle override (Tasks 18–19), every MACD / PPO / PVO
  signal line (Tasks 10, 23). No public surface change yet — runtime-
  internal helpers only; the public delta lands per-port in subsequent
  tasks. Each new compute core ships the §16.3 four-file test set
  (`.test.ts`, `.property.test.ts`, `.bench.ts`, `.bench.test.ts`);
  the two dispatchers ship `.test.ts` only (they delegate the entire
  hot loop to the cores).

- 38fb475: Phase 2 quality-pass fixes (cross-cutting).

  - `@invinite-org/chartlang-core`: new `STATEFUL_PRIMITIVES_BY_NAME`
    export — a `ReadonlyMap<string, StatefulPrimitiveEntry>` derived
    from the same canonical entry list as `STATEFUL_PRIMITIVES`. Lets
    the compiler look up entries by callee name in O(1) instead of an
    O(n) scan over the 93-entry set on every visited call site.
  - `@invinite-org/chartlang-compiler`: `callsiteIdInjection` and
    `statefulCallInLoop` now consume `STATEFUL_PRIMITIVES_BY_NAME`
    via a `statefulByName: ReadonlyMap<string, StatefulPrimitiveEntry>`
    parameter (was `statefulSet: ReadonlySet<StatefulPrimitiveEntry>`).
    Internal-only API change — neither pass is publicly exported from
    `packages/compiler/src/index.ts`. The per-pass `hasName` /
    `findEntry` helpers are dropped.
  - `@invinite-org/chartlang-runtime`: `ta/lib/maTypes.ts` re-exports
    `MaTypeNoVolume` from `@invinite-org/chartlang-core` instead of
    re-declaring it locally — keeps the two definitions from drifting
    when a 6th MA kind is added. `MaType` (which adds `"vwma"`) stays
    local since core has no equivalent. `__fixtures__/syntheticBars.ts`
    and `nanTick.test.ts`'s inline `Bar` literals now carry the
    `hl2` / `hlc3` / `ohlc4` / `hlcc4` fields the Phase-2 `Bar`
    extension made required (the per-package tsconfig had been hiding
    the typecheck miss).

  Also: `examples/canvas2d-adapter` — extracted the duplicated
  `dashPattern(LineStyle)` from `render/area.ts` + `render/horizontalLine.ts`
  into `render/lineDash.ts`, re-exported from `render/index.ts`. No
  behaviour change.

- Updated dependencies [3f3ce38]
- Updated dependencies [3f3ce38]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [38fb475]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies [b0d296b]
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @invinite-org/chartlang-adapter-kit@0.4.0
  - @invinite-org/chartlang-core@0.4.0

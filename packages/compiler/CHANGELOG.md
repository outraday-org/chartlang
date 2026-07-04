# @invinite-org/chartlang-compiler

## 1.9.0

### Minor Changes

- f92d131: Allow non-stateful Pine loops bounded by `input.int` to emit runtime loops, and size compiler history lookback from the input `max`.
- 55ca8ff: Add `plotcandle` / `plotbar` author functions for custom OHLC candle-series plotting.
- 5e2be68: Compiled bundles now carry the real manifest on their `default` export (no
  longer a stub), and a shared `buildBundleFromModule` loader merges `__manifest`
  and throws on a stub-shaped manifest instead of silently collapsing series
  capacity to 1.
- f92d131: Expose host-injected wall-clock time through `time.now()` and map Pine `timenow` to it.
- 55ca8ff: Add `ta.rising` / `ta.falling` / `ta.cross` / `ta.cum` core declarations.

### Patch Changes

- Updated dependencies [55ca8ff]
- Updated dependencies [55ca8ff]
- Updated dependencies [f92d131]
- Updated dependencies [55ca8ff]
- Updated dependencies [55ca8ff]
- Updated dependencies [55ca8ff]
- Updated dependencies [5e2be68]
  - @invinite-org/chartlang-core@1.8.0

## 1.8.0

### Minor Changes

- d542f99: Add shared input presentation metadata fields to core descriptors/builders and compiler manifest extraction.

### Patch Changes

- fb6f60a: Size ring-buffer capacity for indicators inside `request.security` expression callbacks. `extractMaxLookback` now counts a `ta.*` indicator's literal length (e.g. `ta.rsi(b.close, 14)`) when the call is inside a `request.security({ interval }, (b) => …)` callback, so the secondary stream retains enough history to warm that indicator. Previously the manifest sized capacity only from the main body, collapsing a no-lookback script to a 1-bar secondary buffer — under the production bulk-warm feed (the secondary stream is warmed before the script's first compute captures the callback) the warmup window was evicted and the cross-timeframe indicator filter read NaN forever, so the alert silently never fired. The contribution is bounded by the same 5000-slot ceiling as the dynamic-index fallback; main-clock indicators (which self-warm via scalar slot state) are unaffected.
- Updated dependencies [d542f99]
- Updated dependencies [fb6f60a]
  - @invinite-org/chartlang-core@1.7.0

## 1.7.0

### Minor Changes

- 7704fbf: Add an in-memory cross-file producer seam so a single-source host can resolve sibling `./X.chart` imports without disk access.

  - `compiler`: new `CompileOptions.inMemoryChartSources` (a `./X.chart` specifier → source map). It feeds both the cross-file producer resolver (`createProducerResolver`'s new `inMemorySources` option) so dependency analysis and bundling inline the producer, and the typecheck program (via the new `TransformAndAnalyseOptions.inMemoryChartImports`) which serves each resolving specifier as a virtual `CompiledScriptObject` stub to suppress a spurious `TS2307`. Both paths are opt-in and lazy — only specifiers actually imported are consulted, so the default (no map / empty map) is byte-identical to the disk path.
  - `language-service`: new `LanguageServiceOptions.inMemoryChartSources`, forwarded to the local Node compiler when `compileToDiagnostics` is not injected, so a host's diagnostics compile does not report `TS2307` for sibling chart imports it holds in memory.

- f89117d: Accept input-bound and chart-timeframe intervals as compile-time security feeds.

  The compiler's `request.security` feed extraction now reads an `interval` bound
  to an `input.interval` default (via the shared `getInputDefault` helper), exactly
  as it already reads an `input.symbol` default for the `symbol` axis — reversing
  the previous "an `input.interval` is never a feed interval" rule. An empty
  default (`""`, Pine's chart timeframe) resolves to the chart interval: a
  chart-symbol + chart-timeframe pair collapses onto the primary stream (no feed,
  no `requestedIntervals` entry), while a present-symbol + chart-timeframe pair
  stays a distinct `{ symbol, interval: "" }` feed. The expression-form descriptor
  anchor mirrors the same `input.interval`-default acceptance. A genuinely-dynamic
  interval still rejects with `request-security-interval-not-literal`.

  `core`: relaxed the `RequestSecurityOpts.interval` literal-only JSDoc to document
  the `input.interval` default + chart-timeframe (`""`) cases.

### Patch Changes

- f89117d: Map input-bound `request.security` symbol/timeframe feeds,
  `input.timeframe`→`input.interval` (incl. chart timeframe), and the `gaps=`
  argument.

  The converter now resolves a `request.security` symbol/timeframe bound to an
  `input.symbol` / `input.timeframe` declaration through that input and emits the
  chartlang `inputs.<name>` reference (so the value stays user-editable), instead
  of rejecting it with `request-security-not-mapped`. `input.timeframe` maps to
  `input.interval`, and an empty `input.timeframe("")` default is the chart
  timeframe (`input.interval("")`) rather than a spurious
  `non-literal-input-default`. The tuple/list output form shares the same
  resolution. A `gaps = barmerge.gaps_off|gaps_on` argument is recognised and
  dropped with one `request-security-gaps-dropped` info (chartlang feeds are
  gap-filled by default) instead of an unmapped-arg error. A computed / wrong-axis
  symbol or timeframe still rejects with `request-security-not-mapped`.

  `compiler`: the `request.security` feed extractor (`getInputDefault` /
  `getInputsEnumOptions`) now unwraps enclosing parentheses + `as` casts, so the
  converter's `inputs.<name> as string` feed emit — the cast is required because a
  script's `compute` `inputs` is typed `Record<string, unknown>` — resolves to the
  input default. A hand-written un-cast `inputs.<name>` is unchanged.

- Updated dependencies [f89117d]
  - @invinite-org/chartlang-core@1.6.0

## 1.6.0

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

## 1.5.0

### Minor Changes

- 382d1f1: Add numeric-reduction method signatures to `MutableArraySlot<number>` and a
  pure frozen `array` namespace (Pine-parity free functions that delegate 1:1 to
  the handle methods). Both reach the compiler ambient shim in lockstep.

  New handle methods (signatures only — runtime bodies land in the
  array-analytics runtime task): `sum`, `avg`, `min`, `max`, `range`,
  `variance(biased?)`, `stdev(biased?)`, `median`, `percentile(p)`,
  `indexOf(value)`, `includes(value)`, `sort(order?)` (returns a fresh sorted
  `ReadonlyArray<number>` — never mutates the ring). Numeric reductions skip NaN
  and return `NaN` for an empty / all-NaN window.

  New exports: `array` (value) and `ArrayNamespace` (type) from
  `@invinite-org/chartlang-core`.

- 810125e: Add the pure, frozen `math` namespace to core (and mirror it in the compiler
  ambient shim) carrying only the chart-aware / Pine-parity scalar helpers bare
  `Math` lacks. Bare `Math.*` (except `Math.random`) stays available in
  `compute`; `math` does **not** re-wrap it.

  New core exports (also available as a frozen `math.*` namespace):

  - `math.roundTo(value, step)` / `math.roundToMintick(value, mintick)` —
    round to the nearest integer multiple of `step` (price-snapping); a
    non-positive / non-finite step is a no-op.
  - `math.na(value)` — `true` when `value` is NaN or `±Infinity` (the scalar
    twin of the series-aware `ta.nz` family).
  - `math.nz(value, replacement?)` — scalar NaN-coalesce → `replacement ?? 0`.
  - `math.fixnan(value, lastGood)` — `na(value) ? lastGood : value`.
  - `math.sign(value)`, `math.clamp(value, lo, hi)`.
  - `math.avg(...values)` / `math.sum(...values)` — variadic skip-NaN scalar
    reducers (NaN on an empty / all-non-finite list).

  `MathNamespace` (`typeof math`) is exported alongside it.

- 382d1f1: Add the `state.map<K, V>(capacity)` keyed-collection primitive (core type + hole

  - registry + compiler ambient shim + literal-capacity guard). The sibling of
    `state.array`: a persistent, bounded key→value store with the same
    committed/tentative slot lifecycle. Task 1 of the `map-collection` feature —
    the runtime store (Task 2) and converter/conformance/docs (Task 3) land
    separately.

  New core exports: `MutableMapSlot<K extends string | number, V>` (type) and the
  `state.map` hole on the frozen `state` namespace. The v1 handle surface is
  `set(k, v)`, `get(k): V | undefined`, `has(k)`, `delete(k): boolean`,
  `clear()`, `readonly size`, and `keyAt(index): K | undefined` — bounded indexing
  (`for (let i = 0; i < m.size; i++)`) rather than iterators, which are deferred.
  Keys are `string | number`; the v1 value type is `number`; the handle is not
  number-coercible. `capacity` is a required compile-time numeric literal.

  `STATEFUL_PRIMITIVES` gains `{ name: "state.map", slot: true }`. The compiler's
  ambient shim mirrors `MutableMapSlot` + `StateNamespace.map`, and the existing
  `state.array` literal-capacity guard now also covers `state.map` (same
  `state-array-capacity-not-literal` / `state-array-capacity-exceeds-max`
  diagnostic codes, with the message naming the matched primitive).

- 810125e: Add the pure, frozen `str` namespace to core (and mirror it in the compiler
  ambient shim) — Pine-parity string + number-format helpers for building the
  dynamic text the already-shipped `draw.text` / `draw.table` / `draw.marker` /
  `alert(...)` holes consume. Like `color` / `math`, it is frozen, deterministic,
  and compute-time, with no slot and no capability.

  Number formatting is host-independent — a hand-rolled fixed/precision formatter
  (no `Intl`, no `toLocaleString`, no locale/date) — so outputs are byte-identical
  across the worker and quickjs hosts.

  New core exports (also available as a frozen `str.*` namespace):

  - `str.tostring(value, format?)` — numbers via a Pine-style mask (`"#.##"`
    trims trailing zeros; `"0.0000"` zero-pads to a fixed width); `NaN` / `±∞`
    render the Pine glyphs; `-0` normalizes to `"0"`. The `"mintick"` keyword
    form is deferred — the author passes a numeric step.
  - `str.format(template, ...args)` — index-placeholder substitution (`{0}` /
    `{1}`) with an optional `{n,number,MASK}` numeric sub-mask and `{{` / `}}`
    literal braces; an out-of-range index is left intact (Pine parity).
  - `str.length` / `str.contains` / `str.startsWith` / `str.endsWith` /
    `str.replace` (first occurrence) / `str.replaceAll` / `str.split` /
    `str.substring` / `str.upper` / `str.lower` / `str.trim` / `str.repeat`
    (negative / fractional counts guarded).

  `StrNamespace` (`typeof str`) is exported alongside it.

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

- Updated dependencies [382d1f1]
- Updated dependencies [48e8ebb]
- Updated dependencies [810125e]
- Updated dependencies [382d1f1]
- Updated dependencies [810125e]
  - @invinite-org/chartlang-core@1.4.0

## 1.4.0

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

- Updated dependencies [e620ba8]
- Updated dependencies [08cba38]
- Updated dependencies [1efb49c]
- Updated dependencies [1efb49c]
  - @invinite-org/chartlang-core@1.3.0

## 1.3.0

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

- 3541445: Size series-index buffers precisely for provably-bounded indices.

  `extractMaxLookback` now resolves a series read at a literal, a
  bounded-`for` induction variable (`for (let i = 0; i < N; i++) src[i]`),
  a `const` numeric literal, or an affine combination of those
  (`src[i + 1]`, `src[K - i]`, `src[2 * i]`) to its exact `maxLookback`
  contribution via a new compile-time interval resolver
  (`resolveIndexUpperBound`) sharing one `parseBoundedForLoop` helper with
  `forbiddenConstructs`. These indices no longer emit the
  `dynamic-series-index` warning or force the 5000-slot `dynamicFallback`
  buffer — they size the ring buffer exactly like a literal lookback. The
  resolver over-approximates (never under-sizes); genuinely dynamic indices
  (unbounded variables, unsupported operators, non-terminating loops,
  reassigned loop variables) keep the warning + fallback. A new
  `loop-sma` conformance scenario pins a `for`-loop SMA as bar-for-bar
  identical to `ta.sma(close, 5)`.

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

## 1.2.1

### Patch Changes

- 71ea0a5: Inline original TypeScript sources into emitted `.js.map` files (`inlineSources: true`). Published sourcemaps no longer reference missing `../src/*.ts` files, fixing "points to missing source files" warnings in downstream bundlers (e.g. Vite).
- Updated dependencies [71ea0a5]
  - @invinite-org/chartlang-core@1.1.1

## 1.2.0

### Minor Changes

- 6aeeb02: Add an `inMemoryModules` option to `compile` (and `bundleModule`): a `{ [bareSpecifier]: selfContainedEsmSource }` map the esbuild bundling step resolves in-memory instead of from disk. This lets a host run the compiler where the workspace `@invinite-org/chartlang-*` packages are not installed as resolvable `node_modules` — e.g. a bundled serverless function, where the packages are inlined into the host bundle rather than shipped to the function filesystem. Each value must be pre-bundled (no remaining bare imports). When omitted, resolution stays on disk exactly as before.

## 1.1.0

### Minor Changes

- f0c8eb8: Add `CompiledScriptObject.output` / `.withInputs` sentinels, `DependencyDeclaration` + `OutputDeclaration` types, optional `dependencies` / `outputs` / `exportName` / `siblings` / `isDrawn` fields on `ScriptManifest`, `CompiledScriptBundle` + `isCompiledScriptBundle` narrowing helper, and six new `dep-*` `DiagnosticCode` entries (`dep-error`, `dep-cycle`, `dep-unknown-output`, `dep-invalid-input-override`, `dep-dynamic`, `dep-output-not-titled`). The compiler ambient shim is widened in lockstep so script source resolves the new surface. Additive within `apiVersion: 1`.
- f0c8eb8: Add `extractDependencyGraph` analysis pass and `rewriteDependencyAccessors`
  transformer for indicator composition. Six new `dep-*` compile diagnostics
  plus three structural diagnostics (`multiple-default-exports`,
  `non-const-define-binding`, `duplicate-output-title`). Multi-binding
  `defineIndicator` per file now accepted; single-file behaviour unchanged.
  Existing `.chart.ts` files compile through with byte-identical output.
- 2123181: Bundle multi-export `.chart.ts` files into one ESM module, inline cross-file
  `.chart.ts` deps recursively via the new `createProducerResolver` walker, emit
  a union-shape manifest sidecar (single object or array depending on
  drawn-export count), and emit per-export `.d.ts` declarations carrying the
  typed `output<K>` / `withInputs` accessors. Single-script files remain
  byte-identical.
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
- 4d77f4d: Emit `ScriptManifest.plots` — one `PlotSlotDescriptor` per `plot()` /
  `hline()` callsite, in source order, carrying the compiler-issued
  `slotId`, the statically-known plot `kind` (derived from the opts
  `style.kind` literal; bare `plot` ⇒ `line`, `hline` ⇒ `horizontal-line`;
  dynamic styles fall back to `line` best-effort), and a literal `title`
  when present. Additive: the field is omitted for scripts with no
  plot/hline callsites, so existing manifests are byte-identical.
- 0427459: Persist `defineIndicator({ overlay })` onto `ScriptManifest.overlay?:
boolean` so the runtime has a script-level default-pane signal. Add
  `HLineOpts.pane?: "overlay" | "new" | string` mirroring `PlotOpts.pane`
  so hlines opt into the same pane router. The compiler's `buildManifest`
  extracts the literal-boolean `overlay` from the `defineIndicator`
  object literal via `extractOverrides` and emits it on the bundled
  `__manifest`; the ambient core shim now carries `ScriptManifest.overlay?`
  and `HLineOpts.pane?` to keep downstream packages type-aligned.

  Step 1 of the `subpane-rendering` feature. Pure additive contract
  change — every new field is optional and absence keeps existing
  manifests / emissions byte-identical. The runtime, adapter, and demos
  land in tasks 2-5.

### Patch Changes

- d6d1a1f: Fix Phase-7 indicator composition where a producer's titled `plot(...)` outputs were never wired to consumers. The compiler computed each binding's `outputs` statically but only wrote them into the manifest sidecar, never onto the producer object's own `manifest.outputs` — so the runtime allocated no dep-output ring buffer and every `<binding>.output("title")` read returned NaN past warmup.

  `defineIndicator` now copies an optional `outputs` opts field into the manifest (omitted ⇒ manifest byte-identical to a script with no titled plots), and the compiler bakes each producer binding's titled `outputs` into its `defineIndicator({...})` opts literal so private deps, named-export siblings, and cross-file producer defaults are self-describing at runtime. Output-free scripts are untouched. Additive within `apiVersion: 1`.

- 3b4952d: Remove the redundant `bars` plot kind. It was never reachable from the script-author API (`PlotOptsStyle` had no `bars` arm and the runtime `buildStyle` had no `case`), no `ta.*` primitive or example emitted it, and the canvas2d reference adapter declared it as a capability but never rendered it. It carried the same `{ baseline: number }` shape as `histogram`, so it was a dead arm of the `PlotKind` / wire-level `PlotStyle` unions.

  `PlotKind`, the adapter-kit `PlotStyle` union, `validateEmission`, the `capabilities.bars()` / `PHASE_5_PLOT_KINDS` surfaces, and the canvas2d adapter's dead `bars.ts` renderer are all dropped. chartlang has no users yet, so this is a hard reset with no deprecation path. Authors who want columns use `histogram`.

- Updated dependencies [d6d1a1f]
- Updated dependencies [f0c8eb8]
- Updated dependencies [2123181]
- Updated dependencies [2123181]
- Updated dependencies [2123181]
- Updated dependencies [4d77f4d]
- Updated dependencies [3b4952d]
- Updated dependencies [0427459]
  - @invinite-org/chartlang-core@1.1.0

## 1.0.1

### Patch Changes

- 4d44a9c: Surface TypeScript semantic type errors from `compile()` and `createLanguageService().compileToDiagnostics()`.

  The compiler was creating a `ts.Program` for symbol resolution but never requesting `program.getSemanticDiagnostics(sourceFile)`, so scripts like `const x: number = "oops"` slipped past the gate and reached the runtime. The pipeline now wires the program's semantic diagnostics into `transformAndAnalyse`, filtered to the user's source file and mapped to a new stable `type-error` diagnostic code (with the original `TS<code>` prefix preserved in the message so editor tooling can route to TypeScript documentation).

  Companion fix: the in-memory `@invinite-org/chartlang-core` ambient shim in `packages/compiler/src/program.ts` was significantly out of lockstep with the real core surface. The shim now ships the full 61-method `DrawNamespace`, every missing `TaNamespace` method (`adx`, `dmi`, `trix`, `ichimoku`, `tsi`, `smi`, `pmo`, `stochRsi`, `ultimateOsc`, `coppock`, `vortex`, `trendStrengthIndex`, `ulcerIndex`, `adr`, `median`), and `ScalarOrSeries`-widened `ta.*` source parameters that match the runtime's `readSourceValue` contract.

- d1de692: Fix end-user-blocking bug where compiled scripts could not load in either sandbox host: `compile()` now emits a self-contained ESM bundle (`esbuild.build` with `bundle: true`) so the bare `@invinite-org/chartlang-core` import is inlined and tree-shaken, matching PLAN §5.2's "~5–50 KB ESM" contract. The host-worker `data:` URL load path now succeeds end-to-end. The host-quickjs `moduleSourceToScript` regex also accepts the `export { name as default };` form produced by `esbuild`'s bundled output (the previous regex only matched literal `export default <expr>;`, so every real compile output threw "compiled module did not declare an export default").
- d1de692: Fix end-user-blocking Node-ESM packaging bug. Every published `dist/index.js` previously failed to load under Node's strict ESM resolver because `tsc` had been configured with `moduleResolution: "Bundler"` and emitted relative specifiers verbatim, so `dist/index.js` carried `from "./api"` (extensionless) and Node rejected the resolution. Workspace consumers never saw this because tsx / vitest / Vite resolve loosely, but `npm install @invinite-org/chartlang-compiler` followed by `import` failed immediately for any Node consumer, and `examples/react-demo/vite.config.ts`'s server-side compile plugin broke at dev-config-load time.

  This release switches `tsconfig.base.json` to `module: "NodeNext"` / `moduleResolution: "NodeNext"`, and rewrites every relative import / export / dynamic-import / `typeof import("…")` specifier across all packages' source to carry an explicit `.js` (or `/index.js`) suffix. The new resolution mode also surfaces this bug class as a compile error rather than runtime breakage, so it cannot regress.

  No behavioural change for runtime consumers — the rewritten specifiers resolve to the same TypeScript sources at build time and the same `dist/<path>.js` files at consumer-load time.

- Updated dependencies [d1de692]
- Updated dependencies [98599b2]
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
- 3cfff10: Phase 6 closeout for Tier-3 ergonomics and lower-timeframe support.
- 3cfff10: Add `request.lowerTf({ interval })` and compiler diagnostics for invalid lower-timeframe intervals.

### Patch Changes

- Freeze `apiVersion: 1`: release-grade compiler diagnostics for version
  mismatches, an exact name-set lock on the 172-entry `STATEFUL_PRIMITIVES`
  registry, and freeze-contract documentation on pinned surfaces. No behavioural
  change: the structural check already enforced `apiVersion: 1`.
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
  - @invinite-org/chartlang-core@1.0.0

## 0.5.0

### Phase 5

#### Minor Changes

- Ship Phase 5 color helpers from PLAN §11.4: `color.fromGradient`, `color.withAlpha`, `color.rgb`, and `color.hsl`.
- Add canonical StateSnapshot, StreamSnapshot, and StateStoreKey type declarations for PLAN.md §6.1 and §6.9 persistence.
- Ship Phase 5 `defineAlertCondition`, compiler manifest extraction, runtime `signal()` emissions, adapter validation, and conformance coverage per PLAN §11.2.
- Add `draw.table` with `TableCell`/`TablePosition` types, runtime emission,
  viewport-anchored canvas2d rendering, and conformance coverage per PLAN §10.2.
- Add Phase 5 plot kinds, runtime emission dispatch, validation, conformance scenarios, and canvas2d reference renderers.
- Add `ta.fixedRangeVolumeProfile`, completing the Phase 5 volume-profile set
  from PLAN §9.2 and §10.1.1 with fixed `[from, to]` anchors, frozen post-range
  histograms, and `fixed-range-inverted` diagnostics. Ported from invinite
  commit `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4`.
- Port `ta.sessionVolumeProfile` from invinite commit 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4, adding the PLAN §9.2 horizontal-histogram session volume-profile primitive, PLAN §4.8 syminfo-session fallback diagnostics, and compiler/runtime registration.

#### Patch Changes

- Add `ta.visibleRangeVolumeProfile` per PLAN §9.2, ported from invinite commit `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4`, with runtime histogram emission, compiler/core type surfaces, conformance coverage, and generated docs.
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

## 0.4.0

### Minor Changes

- 3f3ce38: Phase-1 AST surface: `transformAndAnalyse(source, opts)` driver that runs the
  TS program builder, the structural / forbidden-construct / stateful-call-in-loop
  checks, the §5.5 callsite-id injection transformer, and the capability /
  maxLookback / input extractors, then assembles a deeply-immutable
  `ScriptManifest`. Public `CompileDiagnostic` + `CompileDiagnosticCode` types
  cover all nine Phase-1 codes (`unbounded-loop`, `recursion-not-allowed`,
  `hostile-global`, `stateful-call-inside-loop`, `dynamic-series-index`,
  `callsite-id-conflict`, `missing-default-export`, `api-version-mismatch`, plus
  the reserved `request-security-interval-not-literal`). Bundling and the public
  `compile` / `compileFile` / `compileProject` API land in Task 3.
- 3f3ce38: Phase-1 public compile API: `compile(source, opts)`, `compileFile(path, opts)`,
  `compileProject(rootDir, opts)` wrap the Task-2 transformer + analysis driver
  and feed the printed AST through esbuild to produce the `.chart.js` +
  `manifest.json` + `.d.ts` triple per §5.2 / §5.3. Adds `CompileError` carrying
  the full diagnostic array, `bundleModule` + `formatManifestAssignment` (esbuild
  driver), `emitTypes` (minimal `.d.ts` generator), and `writeAtomic` +
  `walkChartFiles` helpers. `compileFile` writes the triple atomically via
  tmp + rename; sourcemaps support `false` / `"inline"` / `"external"`. The
  sibling docs-check gate now compiles every qualifying `@example` block through
  the compiler — `EXEMPT_EXPORTS` is empty, and placeholder packages keep a
  JSDoc'd `PACKAGE_VERSION` shim until their Phase-1 tasks land.
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

- b0d296b: Phase 3 Task 20 — `defineDrawing` constructor + interactive-tool
  conformance scenarios.

  - **core** — new `defineDrawing(opts)` constructor + `DefineDrawingOpts`
    type. Mirrors `defineIndicator` structurally; the only differences are
    `manifest.kind === "drawing"` and `manifest.capabilities ===
["drawings"]`. The runtime treats indicator and drawing scripts
    identically at the per-bar level — the discriminator is a host-side
    hint the editor uses to distinguish drawing scripts in the
    script-picker UI (PLAN.md §4.1). The constructor accepts the same
    Phase-3 `maxDrawings?: DrawingCounts` per-bucket cap propagation as
    `defineIndicator`.
  - **compiler** — `analysis/structuralChecks.ts` widens its recognised
    constructor set to include `defineDrawing` and maps it to
    `manifest.kind === "drawing"`. `StructuralCheckResult.kind` widens
    to `"indicator" | "drawing" | "alert"` (matches `buildManifest`'s
    existing type). The in-memory ambient `.d.ts` shim in `program.ts`
    declares `DefineDrawingOpts` + `defineDrawing` so a `defineDrawing`
    script type-checks under the host-machine-independent program.
    `extractCapabilities` now takes a `kind` parameter and seeds with
    `"drawings"` (or `"alerts"`) when the script is a `defineDrawing`
    (or `defineAlert`) — previously every script unconditionally
    declared `"indicators"`. Error messages on
    `missing-default-export` / `api-version-mismatch` now mention all
    three constructor names.
  - **conformance** — three new bundled scenarios, all default-exporting
    through `defineDrawing`:

    - `DEFINE_DRAWING_BASIC_SCENARIO` — single `draw.fibRetracement(...)`
      emission on bar 0 through the new constructor. Verifies the
      constructor + compiler structural-check + capability extraction
      - runtime emit path end-to-end. Pinned `drawing-hash`:
        `eae59a6d44c41ef3b08b20728a9ee723bf0a0cd62e1107c9ab19aa4efa27b488`.
    - `DRAW_INTERACTIVE_UPDATE_SCENARIO` — captures the
      `draw.horizontalLine(bar.close)` handle in module-level state
      on bar 0, then calls `handle.update({ price: bar.close })` on
      every subsequent bar across the 10 000-bar goldenBars stream.
      Pins handle-id stability + the full emission sequence (1
      `create` + 9 999 `update`s). Pinned `drawing-hash`:
      `797d159809da91f43fc32149998da9e5d71b011134564d42c3e5da2027c22e6f`.
    - `DRAW_HANDLE_REMOVE_SCENARIO` — creates a `draw.text(...)` on
      bar 0, calls `handle.remove()` on bar 100 (= time
      `1_708_640_000_000`; goldenBars are 1-day intervals). Pinned
      `drawing-hash` captures both the `op: "create"` and
      `op: "remove"` emissions; `drawing-budget-exceeded` absent.
      Pinned `drawing-hash`:
      `b742d39fe5d03cb211b57bc26f0d24a89f9db966c481279368cc083932394a09`.

    Scenario cardinality after Task 20: \*\*61 per-kind + 12 task-bundles

    - 3 (smoke + budget + capability) + 3 (Task-20 constructor) = 79\*\*,
      of which 78 are in `ALL_SCENARIOS` (the Task-19
      `DRAW_UNSUPPORTED_KIND_SCENARIO` remains opt-in only).

  ### Divergences from spec (`tasks/phase-3-drawing-parity/20-define-drawing.md`)

  1. **Spec § Requirements §1 sketches a `compute` shape and a separate
     `onCreate(ctx, anchors)` / `onUpdate(handle, ctx, anchors)`
     callback pair.** Per the team-lead brief + the spec's own example
     (lines 53–58, which uses `compute`), Phase 3 ships the
     `compute`-based shape only. The `onCreate`/`onUpdate` interactive-
     editor callbacks are Phase 4 sugar layered on top of the
     constructor (PLAN.md §10.1.1).
  2. **Spec § Requirements §4.2 asks for a new `manifest-kind`
     `ScenarioAssertion` variant.** Deferred — adding a new assertion
     variant is a runner-API change out of scope here. The
     `manifest.kind === "drawing"` contract is covered by unit tests:
     `defineDrawing.test.ts` (constructor side), `manifest.test.ts`
     (compiler-builder side), `structuralChecks.test.ts` (AST-walk
     side), and `compile.test.ts` (end-to-end compile of a
     `defineDrawing` script). Flag as a Phase-4 follow-up if
     downstream adapter authors accumulate similar capability/manifest
     assertions.
  3. **Spec § Files lists `defineDrawing.types.test.ts`.** Not created.
     The sibling `defineIndicator.ts` / `defineAlert.ts` don't have
     `.types.test.ts` files; the typings are covered through the
     runtime tests' `script.manifest.kind` access.
  4. **Spec § Requirements §6 mentions a "manifest extractor test in
     compiler package".** Covered by widening
     `structuralChecks.test.ts` (which captures `kind` from the
     AST) + extending `manifest.test.ts` + adding the `compile.test.ts`
     end-to-end row. No new file needed.
  5. **`extractCapabilities` widening was not in the original task
     list** — but is required so a `defineDrawing` script emits
     `capabilities: ["drawings"]` instead of `["indicators"]`. The
     change is backwards-compatible (the new `kind` parameter
     defaults to `"indicator"`) and pinned with new test rows.

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

- Phase 4 - Editor + Inputs + Timeframes + Tier-1 Pine parity.
  Adds: input._ builders, state._ / state.tick.\* slots,
  barstate / syminfo / timeframe views, request.security typed
  surface (NaN fallback), defineIndicator overrides,
  Capabilities triad (intervals / multiTimeframe / subPanes /
  symInfoFields / maxDrawingsPerScript / alertConditions / logs),
  language-service hover registry + LSP-style API, CodeMirror 6
  editor shell + /react sub-export, Inputs UI ViewModel + React
  form. See tasks/phase-4-editor-tier1/README.md.
- Extract `input.*` descriptors into compiled script manifests and add input declaration diagnostics.
- Add compiler extraction for static `request.security` intervals and `requiresIntervals`, and register `request.security` for callsite slot ids.

### Patch Changes

- 3f3ce38: Phase-1 walking-skeleton: ship the conformance suite
  (`@invinite-org/chartlang-conformance`). The package now exports
  `runConformanceSuite(adapter, opts?)`, three pinned Phase-1
  scenarios (`EMA_CROSS_SCENARIO`, `BOLLINGER_BANDS_SCENARIO`,
  `RSI_DIVERGENCE_SCENARIO` + the `ALL_SCENARIOS` aggregate), the
  deterministic 10 000-bar `goldenBars.json` fixture (Mulberry32 seed
  `0xC0DE`, four 2 500-bar regimes), and the
  `generateGoldenBars` / `serialiseGoldenBars` / `writeGoldenBars` /
  `GOLDEN_BARS_PATH` helpers. Closes the Phase-0
  `scripts/run-conformance.ts` short-circuit: `pnpm conformance` now
  runs the three scenarios end-to-end through the compiler + runtime
  against `examples/canvas2d-adapter`'s default export and prints
  `conformance: 3 scenarios passed, 0 failures.`.

  The `RSI_DIVERGENCE_SCENARIO` re-pins `alert-count` from `0` to
  `433` and adds two `alert-message-contains` assertions
  (`"RSI dropped below 70"`, `"RSI rose above 30"`). The original
  scenario codified a dead-code path in
  `examples/scripts/rsi-divergence-alert.chart.ts` — the `rsi.current
&gt; 70 && ta.crossunder(rsi, 70).current` guard was a
  contradiction (crossunder requires the current value to be below
  the threshold) so the overbought / oversold exit alerts could
  never fire. The script now uses `ta.crossunder(rsi, 70).current`
  and `ta.crossover(rsi, 30).current` directly.

  `@invinite-org/chartlang-compiler` rides along with a one-line patch
  to `transformers/resolveCallee.ts`: the callsite-id transformer now
  also rewrites stateful calls on parameters destructured from
  `compute({ ta, plot, alert, hline })` (the previous code only
  matched top-level imports, so the example scripts under
  `examples/scripts/` would have thrown the "outside an active script
  step" sentinel at runtime). Discovered while wiring the conformance
  runner against the on-disk example scripts; covered by new
  `resolveCallee.test.ts` cases.

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

- Add Phase 4 script override fields to core define options and compiler manifests.
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
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @invinite-org/chartlang-core@0.4.0

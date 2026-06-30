# packages/core/

`@invinite-org/chartlang-core` — types + script-facing primitive holes
(`defineIndicator`/`defineAlert`/`defineDrawing`, `input.*`, `state.*`,
`ta.*`, `draw.*`, `plot`/`hline`/`bgcolor`/`barcolor`/`alert`, `request.*`, views) plus the
`STATEFUL_PRIMITIVES` registry the compiler and runtime share.

## Invariants

- **Primitive callables are sentinel holes, not implementations.** Every
  script-facing call (`ta.*`, `draw.*`, `request.*`, `plot`, `state.*`, …)
  throws `"<name> called outside an active script step"` when invoked
  directly; the runtime installs the real behavior on `ComputeContext`.
  Tests assert the throw, which is also what gives core its 100% line
  coverage on these files. Keep new holes on this pattern.

- **`request.security` is overloaded; the namespace is a frozen object of
  named function declarations.** Because you cannot attach call-signature
  overloads to a method-shorthand inside an object literal, `security` and
  `lowerTf` are top-level `function` declarations and the namespace is
  `Object.freeze({ security, lowerTf })`. `RequestNamespace = typeof request`
  surfaces both `security` overloads automatically — do not hand-write the
  namespace type. The two forms:
  - **Data**: `request.security({ interval })` → `SecurityBar` (OHLCV series
    aligned no-lookahead to the *main* timeline).
  - **Expression**: `request.security({ interval }, (bar) => …)` →
    `Series<number>`. The callback (`SecurityExpr`) runs on the *HTF* clock,
    so `ta.*` inside it accumulate over HTF bars. v1 returns a single
    numeric series.
  Both forms route through the single `{ name: "request.security", slot: true }`
  registry entry — the slot id is injected as the first argument regardless
  of the optional second (callback) argument. The full primitive JSDoc block
  (both `@example`s) lives on the `security` declaration so the generated
  `docs/primitives/request/security.md` page (via `genDocs`) and the
  `hover:check` registry capture both forms. (`pnpm skills:generate` does NOT
  emit `request.*` — the skills `primitives.md` covers `ta.*` / `draw.*` /
  plot-family / `math.*` / `str.*` (still NOT `request.*`); `request.security`
  is taught in the hand-authored `SKILL.md`.)

- **`SecurityExpr` is exported from three places in lockstep.**
  `request/request.ts` (source), `request/index.ts` (request barrel), and
  the package root `src/index.ts` — alongside `RequestSecurityOpts` /
  `SecurityBar`. Adding a request type means touching all three. `feedKey`
  (value) + `RequestedFeed` (type) join this lockstep: `feedKey` lives in
  `request/feedKey.ts` and is re-exported from `request/index.ts` and
  `src/index.ts`; `RequestedFeed` is declared in `types.ts` and re-exported
  through the request barrel + the root `types.js` block.

- **`feedKey(symbol, interval)` is the single source of the secondary-feed
  composite-key format.** `request/feedKey.ts` is the one place the
  `(symbol, interval)` stream key is built. It is load-bearing like a slot id:
  the runtime keys every secondary map/cache on it AND the host wire
  (`CandleEvent.streamKey`) carries the same string, so producer and consumer
  must agree byte-for-byte — never re-derive it inline. An omitted/empty
  symbol collapses to the bare interval (`feedKey(undefined, "1D") === "1D"`)
  so the chart-symbol path stays byte-identical to the pre-multi-symbol
  baseline; a present symbol encodes as `"<symbol>@<interval>"` (the `@` cannot
  appear in an interval literal, so the two key spaces never collide).

- **`requestedFeeds` is the superset; `requestedIntervals` is its main-symbol
  projection.** `ScriptManifest.requestedFeeds?: RequestedFeed[]` lists every
  distinct `(symbol?, interval)` feed; `requestedIntervals` keeps its exact
  existing meaning — the symbol-omitted (main-symbol) HTF intervals — for
  back-compat. Adding `requestedFeeds` is additive within `apiVersion: 1`;
  reshaping `requestedIntervals` would not be (that would force
  `apiVersion: 2`). The two are NOT mutually exclusive: a symbol-omitted
  interval appears in both. Both `requestedFeeds` and `requestedIntervals` are
  omitted on scripts with no `request.security` so existing manifest snapshots
  stay byte-identical. `RequestSecurityOpts.symbol` and
  `SecurityExpressionDescriptor.symbol` are likewise optional (omitted ⇒ chart
  symbol). The compiler's `program.ts` shim mirrors all of this in lockstep.
  **Chart timeframe = empty interval (Task 3).** An `interval` of `""` is the
  chart's own timeframe (Pine's empty `request.security` tf; the compiler
  accepts a literal `""`, an `input.interval("")` default, and an
  `input.interval("1D")`-style non-empty default). A chart-symbol + chart-tf
  pair is the **primary stream** — `feedKey(undefined, "") === ""` collapses it,
  so the compiler emits NO feed and NO `requestedIntervals` entry for it. A
  present-symbol + chart-tf pair stays a distinct feed `{ symbol, interval: "" }`
  (keyed `"<symbol>@"`); its **runtime** resolution against an adapter is
  deferred (README → Deferred/Follow-Up "truly runtime-arbitrary feeds"), the
  manifest entry exists for compile-time correctness.

- **`state.series` is the one `state.*` slot that is both writable AND
  indexable.** `state.float`/`int`/`bool`/`string` return a scalar
  `MutableSlot<T>` (no indexing); `state.series(init)` returns
  `NumberSeriesSlot = MutableSlot<number> & Series<number>` — a writable
  scalar head (`s.value = x`) that also reads back as a number-coercible
  indexable series (`s[1]`, `s.current`, `+s`), mirroring the `PriceSeries`
  intersection. The `series` hole is a sentinel like every sibling, and its
  registry entry rides the same additive rule below. `state.tick.series` is
  deliberately NOT defined (deferred). The compiler's `program.ts` shim
  mirrors `NumberSeriesSlot` + the `StateNamespace.series` signature in
  lockstep.

- **Non-numeric persistent state uses TYPED SIBLINGS, not a generic
  `state.series<T>`.** `state.color(init: Color): MutableSlot<Color>` is a
  persistent color *scalar* (no indexing); `state.boolSeries(init: boolean):
  BoolSeriesSlot` and `state.stringSeries(init: string): StringSeriesSlot` are
  the non-numeric analogues of the numeric `state.series` —
  `BoolSeriesSlot = MutableSlot<boolean> & Series<boolean>` /
  `StringSeriesSlot = MutableSlot<string> & Series<string>` (a writable
  `.value` head + integer-indexed `[n]` history), declared in `types.ts` next
  to `NumberSeriesSlot` and barrel-exported. The typed-sibling shape (vs. a
  generic `series<T>`) is deliberate: it keeps the numeric `series` /
  `NumberSeriesSlot` signature and every numeric snapshot **byte-identical**
  (lowest blast radius), and mirrors the proven `Mutable* & Series<*>` pattern.
  `Color` is the `Color = string` alias from `types.ts` (NOT `color/`, which
  exports only helpers + the palette) — `state.ts` imports it as a **type**
  from `../types.js`, so `state.color` stores the CSS string directly with no
  new value type. **Deterministic first-bar / out-of-range defaults (no host
  variance):** `boolSeries` ⇒ `false` (Pine v6 — bool `[]` no longer returns
  `na`), `stringSeries` ⇒ `""`, `color` scalar ⇒ the caller's `init`. All
  three are sentinel holes like every sibling; their `STATEFUL_PRIMITIVES`
  entries (`slot: true`, appended after `state.series`) AND the runtime ring/
  persistence plumbing landed in T12 Task 2 — `state.color` rides the scalar
  `StateSlot` (`:state`) path (a persistent CSS string), while `boolSeries` /
  `stringSeries` ride a shared non-numeric history ring (`:objseries`); see
  `packages/runtime/CLAUDE.md`. The `program.ts` shim mirrors the two slot
  types + the three `StateNamespace` members in lockstep. `@since 1.5`.

- **`state.array` is a plain collection handle, NOT a slot/series
  intersection.** `state.array<T>(capacity)` returns `MutableArraySlot<T>`
  (`arraySlot.ts`) — a bounded FIFO collection surface
  (`push`/`get`/`last`/`clear` + readonly `size`/`capacity`). Unlike
  `state.series` (number-coercible `MutableSlot<number> & Series<number>`),
  it is deliberately **not** a `MutableSlot` and **not** number-coercible
  (no `.value`, no `+a`): a collection is a different shape from a value.
  `get(n)` is **element**-indexed (`0` = newest), not bar-indexed; out-of-range
  returns the element's empty value (`NaN` for `number`). The hole is a
  sentinel like every sibling; its registry entry rides the additive rule
  below; `state.tick.array` is deliberately NOT defined (deferred). The
  compiler's `program.ts` shim mirrors `MutableArraySlot` + the
  `StateNamespace.array` signature in lockstep. v1 element type is `number`.

- **`state.map` is the keyed-collection sibling of `state.array` — a plain
  handle, NOT a slot/series intersection.** `state.map<K extends string |
  number, V>(capacity)` returns `MutableMapSlot<K, V>` (`mapSlot.ts`) — a
  bounded key→value surface (`set`/`get`/`has`/`delete`/`clear` + readonly
  `size` + `keyAt(index)`). Like `state.array` it is deliberately **not** a
  `MutableSlot` and **not** number-coercible. `get(k)` returns `V | undefined`
  (absent ≠ a stored `0`). v1 keys are `string | number` (the only
  deterministically-hashable, snapshot-cloneable keys — enforced in the type)
  and v1 value type is `number`. **v1 ships option-a bounded indexing**
  (`keyAt(i)` + `size`, walked by a `for (let i = 0; i < m.size; i++)` loop —
  the same accepted bounded-loop shape as `state.array`); `keys()`/`values()`/
  `entries()` iterators are **deferred** (a `for...of` iterator would trip the
  compiler's `unbounded-loop` ban). The hole is a sentinel like every sibling;
  its registry entry rides the additive rule below; `state.tick.map` is
  deliberately NOT defined. The compiler's `program.ts` shim mirrors
  `MutableMapSlot` + `StateNamespace.map` in lockstep, and the `state.array`
  literal-capacity guard covers `state.map` too (shared diagnostic codes).

- **`MutableArraySlot<number>` carries numeric-reduction methods, and the
  frozen `array` namespace (`src/array/index.ts`) is a thin 1:1 delegate.**
  `sum`/`avg`/`min`/`max`/`range`/`variance(biased?)`/`stdev(biased?)`/
  `median`/`percentile(p)`/`indexOf`/`includes`/`sort(order?)` are declared on
  the `arraySlot.ts` interface (the runtime installs the real bodies). The
  `array.*` free-function namespace exists ONLY for Pine parity — every member
  is `(a) => a.<name>()`, so there is **no second implementation** to drift; do
  not give `array.*` its own math. Reductions skip NaN and return `NaN` (never
  `0`) on an empty / all-NaN window; `sort()` returns a fresh sorted COPY and
  never mutates the ring. The `array` namespace follows the `color`/`str`
  frozen-namespace template; its bodies live in `index.ts` (coverage-excluded
  like every barrel), so the delegation test is parity, not a coverage gate.
  The `program.ts` shim mirrors BOTH the extended `MutableArraySlot` and an
  `export const array: Readonly<{ … }>` block in lockstep.

- **`time.*` / `session.*` are stateless `slot: false` accessor namespaces
  installed on `ComputeContext` (like `ta`), NOT per-bar views.** They live in
  `src/time-accessors/` (deliberately separate from the host-only `Intl` folder
  `src/time/`, which stays unexported). Each accessor is a pure function of an
  explicit `Time` + optional `tz` (default `syminfo.timezone`, fallback
  `"UTC"`); `time.dayofweek` follows Pine's `1=Sun..7=Sat` (not ISO). The
  one exception is `time.now()`: it returns the host-injected wall clock and
  is intentionally excluded from snapshots/goldens unless a test injects a
  fixed clock. Their registry entries are `slot: false` like `ta.nz` — no
  callsite-id injection, but still flagged by `stateful-call-inside-loop`.
  `time.timeClose(t, tz?)` (Pine's no-arg `time_close()`) closes over
  per-bar mount data: it returns `t + timeframe.inSeconds` (the runtime reads
  the current bar's interval internally). The `program.ts` shim mirrors both
  namespaces in lockstep.

- **`STATEFUL_PRIMITIVES` is additive within `apiVersion: 1`.** Appending an
  entry is additive (new callsites only). Removing/renaming an entry or
  flipping its `slot` is an `apiVersion: 2` language change — see
  `docs/spec/versioning.md`. `STATEFUL_PRIMITIVES_BY_NAME` derives from the
  same canonical list, so a new entry shows up in both automatically.

- **`Bar` (candle contract) is scalar; `BarSeries` (compute bar) is
  indexable.** `Bar` is the adapter-supplied / `request.lowerTf` candle —
  its OHLCV + derived fields stay scalar `Price`/`Volume` so adapters keep
  emitting plain numbers. `BarSeries` (what `ComputeContext.bar` is typed
  as) widens those fields to `PriceSeries` / `VolumeSeries`
  (`number & Series<number>`): both a scalar (arithmetic / `plot` / `ta.*`
  source) and an indexable series (`bar.close[1]`). `time` / `symbol` /
  `interval` stay scalar on both. `request.security`'s HTF bar is the
  separate `SecurityBar`. The compiler's `program.ts` ambient shim mirrors
  all four types in lockstep, and `ComputeContext.bar` is `BarSeries`
  there too.

- **`z` (render-order key) is a presentation-only option declared once on
  the `ZOrdered` mixin.** `ZOrdered { readonly z?: number }`
  (`draw/drawingStyle.ts`) is intersected into every world-space `draw.*`
  option bag (the style types there; `ArrowOpts` / `PathOpts` inherit it
  transitively via `LineDrawStyle`), and `PlotOpts` (`plot/plot.ts`)
  carries its own `z?: number` field with the parallel JSDoc. `TableOpts`
  is **excluded**: `draw.table` is a viewport-HUD overlay (corner-anchored
  status panel), not part of the world-space `(z, band, seq)` render sort,
  so it carries no `z` in v1 (matches `docs/spec/emissions.md` —
  "`draw.table` and `draw.group` do not carry `z`"). `z` is **never** on the `ta.*` series opts (it is a property of
  the render call, not the series) and **never** part of `DrawingState`
  (it is a top-level emission field added downstream, not per-handle
  state). Author the draw `z` JSDoc once on `ZOrdered.z` — do not
  copy-paste it onto each style type. The option is purely a type/contract
  addition in core; validation, omit-when-`0` emission, and the global
  render sort live in `adapter-kit` / `runtime` / the reference adapter.

- **`PlotOpts.visible` is the AUTHORING opt that feeds the PRE-EXISTING
  `PlotEmission.visible` wire field — it is NOT a new wire field.** `visible?:
  boolean` (`plot/plot.ts`) is the script-facing toggle (`plot(x, { visible:
  showRsi })`, mapping Pine `display = display.all | display.none`). The wire
  field `PlotEmission.visible` already exists in `adapter-kit` (`@since 0.8`,
  populated by the host-override path), so T8 adds **no** adapter-kit wire
  change — it only adds the authoring opt + the `program.ts` shim mirror.
  **Omitted / `true` ⇒ visible** (the runtime drops the field, Task 3), so
  `apiVersion: 1` emissions stay byte-identical when unused; only `false` is
  carried. **`false` SUPPRESSES the mark — it is NOT a `NaN` series hole** (a
  `NaN` value breaks line continuity / fills; `visible: false` removes the
  mark while keeping the slot listed). v1 is a constant boolean; a per-bar
  `Series<boolean>` channel is deferred. Like `z`, it is a type/contract
  addition in core; the runtime resolve (omit-when-`true`), the
  already-present `validateEmission` check, and the adapter render-skip live
  downstream. `HLineOpts` deliberately carries NO `visible` (hlines are
  constant guides). The `program.ts` shim mirrors `PlotOpts.visible` in
  lockstep.

- **`input.enum` / `EnumDescriptor` admit `T extends string | number`.** A
  numeric enum (`input.enum(21, [8, 21, 30])`) is a fixed-options dropdown over
  numbers, the string enum is unchanged. The widened bound is mirrored in three
  lockstep places: the `enum` builder (`input/input.ts`), `EnumDescriptor`
  itself, AND the `InputDescriptor<T>` union member (`EnumDescriptor<string |
  number>` — without this a numeric enum is not assignable to
  `InputSchema = Record<string, InputDescriptor<unknown>>`, so a script's
  `inputs: { len: input.enum(21, […]) }` would not type-check). The compiler's
  `program.ts` shim mirrors all three. Additive within `apiVersion: 1`; the
  runtime default path round-trips a numeric default unchanged (it is a plain
  number). The execution side is complete (T4 Task 4):
  `runtime/resolveInputs.matchesDescriptor`'s `enum` arm accepts a numeric
  adapter *override* (not just the default), and `compiler/extractInputs`
  serialises a uniform numeric options list into the manifest. String-enum
  behaviour is byte-stable.

- **All `input.*` descriptors carry the shared presentation metadata mixin.**
  `CommonInputOpts` (`group?`, `inline?`, `tooltip?`, `display?`,
  `confirm?`) is intersected into the common descriptor base AND
  `ExternalSeriesDescriptor<T>` (which does not use that base), and every
  builder opts surface accepts it. These fields are presentation-only:
  adapters may use them to lay out settings panels, but runtime input
  resolution ignores them. Omitted fields must remain omitted (no
  `undefined` keys), so `input.externalSeries` forwards each metadata key only
  when defined. The compiler's `program.ts` shim mirrors the mixin and builder
  opts in lockstep.

- **Coverage excludes `index.ts` (barrel) and any `types.ts` (declarations).**
  Real exported logic lives in dedicated files with co-located `*.test.ts`
  (unit) and `*.types.test.ts` (`expect-type`) layers. The two type-test
  files for the request surface are `request/request.types.test.ts`
  (in-package) and `types.types.test.ts` (root-export resolution).

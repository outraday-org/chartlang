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
  (both `@example`s) lives on the `security` declaration so
  `pnpm skills:generate` captures both forms.

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

- **Coverage excludes `index.ts` (barrel) and any `types.ts` (declarations).**
  Real exported logic lives in dedicated files with co-located `*.test.ts`
  (unit) and `*.types.test.ts` (`expect-type`) layers. The two type-test
  files for the request surface are `request/request.types.test.ts`
  (in-package) and `types.types.test.ts` (root-export resolution).

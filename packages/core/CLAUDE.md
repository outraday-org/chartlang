# packages/core/

`@invinite-org/chartlang-core` — types + script-facing primitive holes
(`defineIndicator`/`defineAlert`/`defineDrawing`, `input.*`, `state.*`,
`ta.*`, `draw.*`, `plot`/`hline`/`alert`, `request.*`, views) plus the
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
  `SecurityBar`. Adding a request type means touching all three.

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

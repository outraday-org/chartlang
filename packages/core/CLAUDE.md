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

- **Coverage excludes `index.ts` (barrel) and any `types.ts` (declarations).**
  Real exported logic lives in dedicated files with co-located `*.test.ts`
  (unit) and `*.types.test.ts` (`expect-type`) layers. The two type-test
  files for the request surface are `request/request.types.test.ts`
  (in-package) and `types.types.test.ts` (root-export resolution).

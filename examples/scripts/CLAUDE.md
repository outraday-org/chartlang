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

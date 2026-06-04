# examples/scripts/

Phase-1 example `.chart.ts` scripts compiled by `packages/cli/src/e2e.test.ts`.

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
  list in `packages/cli/src/e2e.test.ts`. The conformance suite (Task
  12) also references these names.

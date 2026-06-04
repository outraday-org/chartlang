---
"@invinite-org/chartlang-host-worker": minor
"@invinite-org/chartlang-runtime": patch
---

Phase-1 walking-skeleton: ship the canvas2d reference adapter
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

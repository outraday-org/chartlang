# @invinite-org/chartlang-host-worker

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

### Patch Changes

- Pre-1.0 surface cleanup: remove the deprecated `PHASE_1_SCENARIOS`
  alias (use `ALL_SCENARIOS`) and promote every shipping export from
  `@experimental` to `@stable` ahead of the `apiVersion: 1` freeze.
- Updated dependencies [d14a034]
- Updated dependencies [3cfff10]
- Updated dependencies [3cfff10]
- Updated dependencies [3cfff10]
- Updated dependencies [3cfff10]
- Updated dependencies [3cfff10]
- Updated dependencies [3cfff10]
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @invinite-org/chartlang-adapter-kit@1.0.0
  - @invinite-org/chartlang-core@1.0.0
  - @invinite-org/chartlang-runtime@1.0.0

## 0.5.0

### Phase 5

#### Minor Changes

- Add the `@invinite-org/chartlang-host-worker/idb` subpath with an
  IndexedDB-backed `PersistentStateStore` for browser warm starts, per PLAN.md
  §6.9 and §8.2.
- Replace the Phase 4 `request.security` NaN-only path with real
  multi-timeframe secondary stream alignment per PLAN.md §6.8 and §7.2.
  Adapters can route tagged `CandleEvent.streamKey` candles, the worker
  host dispatches them through `ScriptRunner.push`, conformance includes
  MTF scenarios, and the private canvas2d reference adapter now declares
  `multiTimeframe: true`.

#### Patch Changes

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
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @invinite-org/chartlang-core@0.5.0
  - @invinite-org/chartlang-adapter-kit@0.5.0
  - @invinite-org/chartlang-runtime@0.5.0

## 0.4.0

### Minor Changes

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

- 3f3ce38: Land the Phase-1 browser-default `ScriptHost`. `createWorkerHost`
  boots a Web Worker, loads a compiled chartlang bundle via a
  `data:` URL dynamic import, and round-trips `CandleEvent` /
  `RunnerEmissions` over a structured-clone-safe postMessage
  protocol (`HostToWorker` / `WorkerToHost`). The `load` frame
  carries the adapter's `Capabilities` bag and the host's
  `HostLimits`; the worker boot is stateless about both. A
  measurement-only watchdog times every `candleEvent` dispatch
  against `maxCpuMsPerStep` and posts `step-overshoot` (no
  preemption — real interrupt-based caps land with the QuickJS
  host in Phase 5). Drains validate every plot / alert through
  `adapter-kit`'s `validateEmission` before posting; malformed
  emissions become `malformed-emission` diagnostics. Replaces the
  Phase-0 `PACKAGE_VERSION` placeholder.
- Resolve runtime `input.*` overrides at mount, add adapter input resolver wiring, and audit universal `ta.*` offset support.

### Patch Changes

- Updated dependencies [3f3ce38]
- Updated dependencies [3f3ce38]
- Updated dependencies [3f3ce38]
- Updated dependencies [3f3ce38]
- Updated dependencies [3f3ce38]
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
- Updated dependencies
- Updated dependencies
  - @invinite-org/chartlang-adapter-kit@0.4.0
  - @invinite-org/chartlang-runtime@0.4.0
  - @invinite-org/chartlang-core@0.4.0

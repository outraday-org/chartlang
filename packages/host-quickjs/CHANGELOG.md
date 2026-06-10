# @invinite-org/chartlang-host-quickjs

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
  - @invinite-org/chartlang-host-worker@1.0.0
  - @invinite-org/chartlang-runtime@1.0.0

## 0.5.0

### Phase 5

#### Minor Changes

- Implement the Phase 5 QuickJS-backed ScriptHost membrane with JSON-frame
  dispatch, hard QuickJS memory/interrupt configuration per PLAN §8.3, focused
  cross-host parity tests, and package invariants for the real implementation.
- Stand up the Phase 5 QuickJS host scaffold from PLAN §8.3 with the pinned
  `quickjs-emscripten` dependency, QuickJS-flavoured protocol/types, default
  limits, and the Task 7 membrane stub.

#### Patch Changes

- Add the Phase 5 QuickJS sandbox-escape regression suite and per-bar compute
  benchmarks for the untrusted/server host posture documented in PLAN §8.3 and
  §8.4.
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
- Updated dependencies
  - @invinite-org/chartlang-core@0.5.0
  - @invinite-org/chartlang-adapter-kit@0.5.0
  - @invinite-org/chartlang-runtime@0.5.0
  - @invinite-org/chartlang-host-worker@0.5.0

# @invinite-org/chartlang-language-service

## 1.1.0

### Minor Changes

- 4d44a9c: Add a `ChartlangLanguageService` interface (exported from `@invinite-org/chartlang-language-service` and re-exported from `@invinite-org/chartlang-editor`) and let `createChartlangEditor({ service })` (and the React `<ChartlangEditor service={...}>` prop) inject a consumer-provided implementation. When a service is injected, `setCapabilities(...)` becomes a no-op because the injected service owns its own capability surface. Editor extension type signatures now reference the named interface instead of `ReturnType<typeof createLanguageService>`, so consumers can build the surface from scratch (e.g. a hybrid local hover / remote `compileToDiagnostics`) without abandoning the editor factory.

### Patch Changes

- 4d44a9c: Surface TypeScript semantic type errors from `compile()` and `createLanguageService().compileToDiagnostics()`.

  The compiler was creating a `ts.Program` for symbol resolution but never requesting `program.getSemanticDiagnostics(sourceFile)`, so scripts like `const x: number = "oops"` slipped past the gate and reached the runtime. The pipeline now wires the program's semantic diagnostics into `transformAndAnalyse`, filtered to the user's source file and mapped to a new stable `type-error` diagnostic code (with the original `TS<code>` prefix preserved in the message so editor tooling can route to TypeScript documentation).

  Companion fix: the in-memory `@invinite-org/chartlang-core` ambient shim in `packages/compiler/src/program.ts` was significantly out of lockstep with the real core surface. The shim now ships the full 61-method `DrawNamespace`, every missing `TaNamespace` method (`adx`, `dmi`, `trix`, `ichimoku`, `tsi`, `smi`, `pmo`, `stochRsi`, `ultimateOsc`, `coppock`, `vortex`, `trendStrengthIndex`, `ulcerIndex`, `adr`, `median`), and `ScalarOrSeries`-widened `ta.*` source parameters that match the runtime's `readSourceValue` contract.

- d1de692: Fix end-user-blocking Node-ESM packaging bug. Every published `dist/index.js` previously failed to load under Node's strict ESM resolver because `tsc` had been configured with `moduleResolution: "Bundler"` and emitted relative specifiers verbatim, so `dist/index.js` carried `from "./api"` (extensionless) and Node rejected the resolution. Workspace consumers never saw this because tsx / vitest / Vite resolve loosely, but `npm install @invinite-org/chartlang-compiler` followed by `import` failed immediately for any Node consumer, and `examples/react-demo/vite.config.ts`'s server-side compile plugin broke at dev-config-load time.

  This release switches `tsconfig.base.json` to `module: "NodeNext"` / `moduleResolution: "NodeNext"`, and rewrites every relative import / export / dynamic-import / `typeof import("…")` specifier across all packages' source to carry an explicit `.js` (or `/index.js`) suffix. The new resolution mode also surfaces this bug class as a compile error rather than runtime breakage, so it cannot regress.

  No behavioural change for runtime consumers — the rewritten specifiers resolve to the same TypeScript sources at build time and the same `dist/<path>.js` files at consumer-load time.

- Updated dependencies [4d44a9c]
- Updated dependencies [4d44a9c]
- Updated dependencies [d1de692]
- Updated dependencies [d1de692]
- Updated dependencies [98599b2]
  - @invinite-org/chartlang-adapter-kit@1.1.0
  - @invinite-org/chartlang-compiler@1.0.1
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

### Patch Changes

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
  - @invinite-org/chartlang-adapter-kit@1.0.0
  - @invinite-org/chartlang-compiler@1.0.0
  - @invinite-org/chartlang-core@1.0.0

## 0.5.0

### Phase 5

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
  - @invinite-org/chartlang-core@0.5.0
  - @invinite-org/chartlang-compiler@0.5.0
  - @invinite-org/chartlang-adapter-kit@0.5.0

## 0.4.0

### Minor Changes

- Phase 4 - Editor + Inputs + Timeframes + Tier-1 Pine parity.
  Adds: input._ builders, state._ / state.tick.\* slots,
  barstate / syminfo / timeframe views, request.security typed
  surface (NaN fallback), defineIndicator overrides,
  Capabilities triad (intervals / multiTimeframe / subPanes /
  symInfoFields / maxDrawingsPerScript / alertConditions / logs),
  language-service hover registry + LSP-style API, CodeMirror 6
  editor shell + /react sub-export, Inputs UI ViewModel + React
  form. See tasks/phase-4-editor-tier1/README.md.
- Ship the Phase 4 headless language service with generated hover registry,
  diagnostics, hovers, completions, signature help, definitions, and interval
  capability helpers.

### Patch Changes

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
  - @invinite-org/chartlang-adapter-kit@0.4.0
  - @invinite-org/chartlang-compiler@0.4.0
  - @invinite-org/chartlang-core@0.4.0

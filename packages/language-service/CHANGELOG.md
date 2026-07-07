# @invinite-org/chartlang-language-service

## 1.5.4

### Patch Changes

- Updated dependencies [89cac8e]
  - @invinite-org/chartlang-core@1.10.0
  - @invinite-org/chartlang-compiler@1.11.0

## 1.5.3

### Patch Changes

- Updated dependencies [1039309]
- Updated dependencies [df3f5b2]
  - @invinite-org/chartlang-compiler@1.10.0
  - @invinite-org/chartlang-core@1.9.0

## 1.5.2

### Patch Changes

- 55ca8ff: Add value-carrying `candle` / `ohlc-bar` plot styles + validation for custom OHLC candle-series rendering.
- 55ca8ff: Add `plotcandle` / `plotbar` author functions for custom OHLC candle-series plotting.
- 55ca8ff: Add `ta.rising` / `ta.falling` / `ta.cross` / `ta.cum` core declarations.
- Updated dependencies [55ca8ff]
- Updated dependencies [f92d131]
- Updated dependencies [55ca8ff]
- Updated dependencies [5e2be68]
- Updated dependencies [f92d131]
- Updated dependencies [55ca8ff]
- Updated dependencies [55ca8ff]
- Updated dependencies [55ca8ff]
- Updated dependencies [5e2be68]
  - @invinite-org/chartlang-adapter-kit@1.9.0
  - @invinite-org/chartlang-core@1.8.0
  - @invinite-org/chartlang-compiler@1.9.0

## 1.5.1

### Patch Changes

- Updated dependencies [d542f99]
- Updated dependencies [d542f99]
- Updated dependencies [fb6f60a]
- Updated dependencies [fb6f60a]
  - @invinite-org/chartlang-adapter-kit@1.8.0
  - @invinite-org/chartlang-core@1.7.0
  - @invinite-org/chartlang-compiler@1.8.0

## 1.5.0

### Minor Changes

- 7704fbf: Add an in-memory cross-file producer seam so a single-source host can resolve sibling `./X.chart` imports without disk access.

  - `compiler`: new `CompileOptions.inMemoryChartSources` (a `./X.chart` specifier → source map). It feeds both the cross-file producer resolver (`createProducerResolver`'s new `inMemorySources` option) so dependency analysis and bundling inline the producer, and the typecheck program (via the new `TransformAndAnalyseOptions.inMemoryChartImports`) which serves each resolving specifier as a virtual `CompiledScriptObject` stub to suppress a spurious `TS2307`. Both paths are opt-in and lazy — only specifiers actually imported are consulted, so the default (no map / empty map) is byte-identical to the disk path.
  - `language-service`: new `LanguageServiceOptions.inMemoryChartSources`, forwarded to the local Node compiler when `compileToDiagnostics` is not injected, so a host's diagnostics compile does not report `TS2307` for sibling chart imports it holds in memory.

### Patch Changes

- Updated dependencies [f89117d]
- Updated dependencies [7704fbf]
- Updated dependencies [f89117d]
  - @invinite-org/chartlang-compiler@1.7.0
  - @invinite-org/chartlang-core@1.6.0

## 1.4.7

### Patch Changes

- Updated dependencies [70cb92f]
- Updated dependencies [70cb92f]
  - @invinite-org/chartlang-core@1.5.0
  - @invinite-org/chartlang-compiler@1.6.0

## 1.4.6

### Patch Changes

- 810125e: Map the chart-aware Pine `math.*` / `nz` subset onto the chartlang `math`
  namespace in the converter, and prove the namespace is byte-stable across every
  adapter.

  Pine-converter changes:

  - `math.round_to_mintick(x)` → `math.roundToMintick(x, syminfo.mintick)` (the
    emitter injects the explicit tick step; the namespace is pure with no ambient
    `syminfo`).
  - `math.avg(a, b, …)` / `math.sum(a, b, …)` → the variadic **scalar**
    `math.avg` / `math.sum`. This also fixes a latent bug where these mapped to
    the non-existent `Math.avg` / `Math.sum`. Pine's 2-arg **rolling**
    `math.sum(source, length)` / `math.avg(source, length)` has no chartlang
    scalar analogue, so it is left for a manual rewrite with a new advisory
    `math-rolling-window-unmapped` warning rather than being collapsed onto the
    scalar form.
  - `nz(x)` / `nz(x, r)` → the scalar `math.nz(...)` with a new advisory
    `nz-scalar-assumed` info (switch to `ta.nz` by hand for a series argument).
  - Bare numeric `math.abs`/`pow`/`sqrt`/`sign`/… stay on `Math.*` (the
    no-rewrap decision); `na(x)` keeps its existing context-aware inline
    predicate lowering.
  - Codegen now wires the module-scope `math` import and the `syminfo` compute
    destructure when the converted source references them.

  The `math` namespace emits **no new wire primitive** — its outputs are plain
  `number`s that flow into the existing `plot`/`draw` holes — so **no adapter code
  change is required**. The new `math-round-to-mintick` conformance scenario
  (snapped levels → `draw.horizontalLine`) is replayed through every adapter by
  `pnpm conformance`, which is the all-adapter byte-stability proof. The
  language-service hover registry is regenerated to include the new `math.*`
  helper entries.

- 810125e: Publish the author-facing surface for the `str` string namespace: extend the
  Pine `str.*` converter mapping, prove the namespace is byte-stable across every
  adapter, and ship the docs / skill / example surfaces.

  Pine-converter changes:

  - `str.replace_all(s, t, r)` → `s.replaceAll(t, r)` and `str.split(s, sep)` →
    `s.split(sep)` (the snake_case Pine names lower to the native JS method).
    This rounds out the existing `str.tostring` / `str.format` / `str.length` /
    `str.contains` / `str.upper` / `str.lower` lowerings — the same
    native-where-native-exists shape `math.*` uses for bare `Math.*`.
  - A non-mask `str.tostring` format (grouping / `format.mintick`) or a styled
    `{n,number}` `str.format` placeholder continues to emit the existing
    `str-format-not-mapped` diagnostic and pass the call through, never a hard
    failure.

  The `str` namespace emits **no new wire primitive** — its outputs are plain
  `string`s that flow into the already-shipped `draw.text` / `draw.table` /
  `draw.marker` / `alert(...)` holes — so **no adapter code change is required**.
  The new `str-formatted-table` conformance scenario (a `draw.table` HUD built
  from `str.format` / `str.tostring("#.##")` / `str.upper`) is replayed through
  every adapter by `pnpm conformance`, which is the all-adapter byte-stability
  proof (the emitted text payload hash is byte-identical across canvas2d, echarts,
  konva, lightweight-charts, uplot, and webgl). The CLI primitive-docs generator
  gains a `str` page entry (`docs/primitives/str.md`) and the language-service
  hover registry is regenerated to include the deterministic `str` formatter
  helper entries.

- Updated dependencies [3770236]
- Updated dependencies [382d1f1]
- Updated dependencies [48e8ebb]
- Updated dependencies [810125e]
- Updated dependencies [382d1f1]
- Updated dependencies [810125e]
- Updated dependencies [48e8ebb]
- Updated dependencies [810125e]
  - @invinite-org/chartlang-adapter-kit@1.7.0
  - @invinite-org/chartlang-core@1.4.0
  - @invinite-org/chartlang-compiler@1.5.0

## 1.4.5

### Patch Changes

- 08cba38: Add `time.*` calendar accessors (`time.year/month/dayofmonth/dayofweek/hour/
minute/second/timestamp`), a `time.timeClose(t, tz?)` bar-close accessor
  (Pine's `time_close()` = bar start + interval), a `session.isOpen(t, spec, tz?)`
  helper, and an `input.session` kind. Calendar fields are derived from a `Time`
  epoch via the host (authors stay sandboxed — `Date`/`Intl` remain banned). v1
  is UTC + fixed-offset only; exchange-tz/DST is a scoped follow-up. The Pine
  converter lowers `dayofweek` / `time()` / `time_close()` / `input.session`.
- 1efb49c: Add `state.array<T>(capacity)` — a persistent, bounded FIFO collection. Push
  many values across bars (`a.push(v)`) into a fixed-capacity ring and read
  them back by element (`a.get(0)` = newest, `a.last()`, `a.size`,
  `a.capacity`, `a.clear()`). Bounded literal capacity keeps it
  serialization-clean. The Pine converter lowers a bounded numeric
  `var array<…>` Camp B ring to it.

  The compiler guards the capacity: it must be a compile-time numeric literal
  (a `const` numeric binding is accepted) that is a positive integer within
  `MAX_STATE_ARRAY_CAPACITY` (100_000). A non-literal capacity errors
  `state-array-capacity-not-literal`; an out-of-range / non-integer literal
  errors `state-array-capacity-exceeds-max`.

- Updated dependencies [189493a]
- Updated dependencies [8bc628e]
- Updated dependencies [ab8b218]
- Updated dependencies [8bc628e]
- Updated dependencies [ab8b218]
- Updated dependencies [189493a]
- Updated dependencies [e620ba8]
- Updated dependencies [08cba38]
- Updated dependencies [1efb49c]
- Updated dependencies [1efb49c]
  - @invinite-org/chartlang-adapter-kit@1.6.0
  - @invinite-org/chartlang-core@1.3.0
  - @invinite-org/chartlang-compiler@1.4.0

## 1.4.4

### Patch Changes

- Updated dependencies [24946e4]
  - @invinite-org/chartlang-adapter-kit@1.5.0

## 1.4.3

### Patch Changes

- Updated dependencies [03f59bf]
- Updated dependencies [03f59bf]
- Updated dependencies [03f59bf]
  - @invinite-org/chartlang-adapter-kit@1.4.0

## 1.4.2

### Patch Changes

- 08c536c: Add the `ta.highestbars` / `ta.lowestbars` primitives plus the cross-package
  wiring that makes them usable as drawing anchors and Pine-converter targets.

  - **core / runtime:** `ta.highestbars(source, length, opts?)` and
    `ta.lowestbars(source, length, opts?)` return the bar OFFSET (≤ 0) to the
    highest / lowest `source` value over the trailing `length` bars (window
    INCLUDES the current bar). `0` → current bar is the extreme; `-k` → the
    extreme occurred `k` bars ago. Ties resolve to the most recent bar; NaN
    inputs are skipped; warmup is `length − 1` bars; tick-mode replays the
    in-progress head as the offset-0 candidate. Registered in
    `STATEFUL_PRIMITIVES` (now 174 entries) and `TA_REGISTRY` (now 96 entries).
  - **compiler:** a literal-length `ta.highestbars` / `ta.lowestbars` call
    contributes `length − 1` toward `maxLookback`, so the runtime sizes the time
    ring buffer deep enough for a `bar.point(<that offset>, …)` anchor to resolve.
    A non-literal length contributes 0.
  - **pine-converter:** `ta.highestbars` / `ta.lowestbars` now map to the real
    chartlang primitives (previously lossy passthroughs to `ta.highest` /
    `ta.lowest`). **Behavior change:** a DYNAMIC `bar_index + <non-literal>`
    drawing-x anchor no longer raises the hard `requires-bar-interval` error —
    the offset is resolved by `bar.point` at runtime sign-agnostically (a
    negative runtime offset, e.g. what `ta.highestbars` returns, resolves to the
    historical timestamp via the time buffer). Only the literal `bar_index + N`
    future case still requires a bar interval.
  - **conformance:** new `TA_HIGHEST_LOWEST_BARS_SCENARIO` export pins both
    primitives end-to-end through the compiler + runtime over the bundled
    `goldenBars.json` fixture, and is added to `ALL_SCENARIOS`.

- Updated dependencies [850ae21]
- Updated dependencies [ca19e20]
- Updated dependencies [3541445]
- Updated dependencies [6235ad7]
- Updated dependencies [3bf391a]
- Updated dependencies [8086003]
- Updated dependencies [850ae21]
- Updated dependencies [073f41b]
- Updated dependencies [5a9c24d]
- Updated dependencies [08c536c]
  - @invinite-org/chartlang-core@1.2.0
  - @invinite-org/chartlang-compiler@1.3.0
  - @invinite-org/chartlang-adapter-kit@1.3.0

## 1.4.1

### Patch Changes

- 71ea0a5: Inline original TypeScript sources into emitted `.js.map` files (`inlineSources: true`). Published sourcemaps no longer reference missing `../src/*.ts` files, fixing "points to missing source files" warnings in downstream bundlers (e.g. Vite).
- Updated dependencies [71ea0a5]
  - @invinite-org/chartlang-adapter-kit@1.2.1
  - @invinite-org/chartlang-compiler@1.2.1
  - @invinite-org/chartlang-core@1.1.1

## 1.4.0

### Minor Changes

- 134a0bf: Add an `inMemoryModules` option to `createLanguageService`. When `compileToDiagnostics` is NOT injected, the service runs the Node compiler locally for diagnostics; this option is forwarded to that `compile` call so a host where the workspace `@invinite-org/chartlang-*` packages are not resolvable on disk (e.g. a bundled serverless function) can supply pre-bundled package sources and avoid an esbuild "Could not resolve" failure. Ignored when `compileToDiagnostics` is provided.

### Patch Changes

- Updated dependencies [6aeeb02]
  - @invinite-org/chartlang-compiler@1.2.0

## 1.3.0

### Minor Changes

- ba6a75d: Add a `compileToDiagnostics` injection seam so browser hosts can route compilation through their own server / worker boundary. `createLanguageService({ compileToDiagnostics })` now accepts a host callback; when supplied, diagnostics come from it and capability hints are appended locally. When omitted, Node runtimes keep the existing local compiler path and browser runtimes skip loading the Node-only compiler graph.

  The editor also gains an explicit `previewPanel` option (and matching React prop). The preview-panel extension now mounts only when `previewPanel` or `previewRunner` is supplied, instead of always mounting the Phase 4 placeholder.

## 1.2.1

### Patch Changes

- d7f8fad: Make the editor package browser-safe to import by default. The editor no longer imports or constructs the language service at module load or default mount time; hover, completions, and linting are enabled only when a service is injected, while preview wiring stays independent.

  **Breaking (editor):** `createChartlangEditor({ targetCapabilities })` and the returned `setCapabilities(...)` method (and the React `<ChartlangEditor targetCapabilities>` prop) are now no-ops. Create a language service with capabilities and inject it via `service`:

  ```ts
  import { createChartlangEditor } from "@invinite-org/chartlang-editor";
  import { createLanguageService } from "@invinite-org/chartlang-editor/language-service";

  const editor = createChartlangEditor({
    parent,
    doc,
    service: createLanguageService({ targetCapabilities }),
  });
  ```

  The editor package also exposes explicit `./theme` and `./language-service` entry points so browser consumers can pick the surfaces they want without pulling the compiler into the main bundle.

  The language-service change is purely internal: the compiler is now loaded via a dynamic `import("@invinite-org/chartlang-compiler")` inside `compileToDiagnostics`, so `createLanguageService(...)` no longer pulls the compiler graph at module load. Public signatures and behavior are unchanged.

## 1.2.0

### Minor Changes

- 2123181: Language service understands indicator-composition hovers, output-name
  - override-key completions, and surfaces the new `dep-*` diagnostics
    inline. Hover on `<binding>.output(...)` lists the producer's titled
    outputs; hover on `<binding>.withInputs({...})` lists the producer's
    input schema with kinds + defaults. Completion fires for output titles
    inside `<binding>.output("|")` and for override keys inside
    `<binding>.withInputs({ |})`. Best-effort go-to-definition for
    `.output("title")` navigates to the producer's matching `plot(value,
{ title })` call when the producer is a same-file `defineIndicator`;
    cross-file and unresolvable cases fall back to `null`. Editor: no
    public API change — new behaviour flows through the existing
    `completionExtension` / `hoverExtension` / `linterExtension` wiring.
- 2123181: Indicator composition (Phase 7 closeout): one chartlang indicator can
  read another indicator's titled plot output as a typed `Series<number>`.

  - Compose via local `const` binding plus `<binding>.output("title")` —
    no new public API beyond the chainable `.output` / `.withInputs`
    accessors on `CompiledScriptObject`.
  - A single `.chart.ts` MAY declare a default export plus any number of
    named exports plus any number of private `const` deps. Export form
    determines render policy: drawn exports render with the
    `export:<exportName>/` slot-id prefix; private `const` deps are data
    feeds only and their visuals are dropped.
  - Cross-file `import baseTrend from "./base-trend.chart"` resolves
    recursively; shared producers inline exactly once per consumer.
  - Additive within `apiVersion: 1.x`. The 172-entry
    `STATEFUL_PRIMITIVES` set is unchanged. `DiagnosticCode` widens to 32
    with the new `dep-*` codes (`dep-error`, `dep-cycle`,
    `dep-unknown-output`, `dep-invalid-input-override`, `dep-dynamic`,
    `dep-output-not-titled`).
  - Five conformance scenarios in `@invinite-org/chartlang-conformance`
    pin the runtime contract end-to-end (`dep-private-single-file`,
    `dep-multi-export`, `dep-cross-file`, `dep-diamond`,
    `dep-error-halts-parent`). `Scenario.additionalSources` lets
    cross-file scenarios ship producer + consumer side-by-side.
  - Two new example scripts in `examples/scripts/`:
    `base-trend.chart.ts` (producer) + `trend-confirmation.chart.ts`
    (multi-export consumer). React-demo gains a fifth catalogue entry
    exercising the feature end-to-end in the browser.
  - Docs: `docs/language/indicator-composition.md` narrative guide,
    `docs/spec/manifest.md` + `docs/spec/semantics.md` +
    `docs/spec/versioning.md` updates, five new glossary entries.

### Patch Changes

- Updated dependencies [d6d1a1f]
- Updated dependencies [f0c8eb8]
- Updated dependencies [f0c8eb8]
- Updated dependencies [2123181]
- Updated dependencies [2123181]
- Updated dependencies [2123181]
- Updated dependencies [2123181]
- Updated dependencies [2123181]
- Updated dependencies [4d77f4d]
- Updated dependencies [4d77f4d]
- Updated dependencies [3b4952d]
- Updated dependencies [0427459]
  - @invinite-org/chartlang-core@1.1.0
  - @invinite-org/chartlang-compiler@1.1.0
  - @invinite-org/chartlang-adapter-kit@1.2.0

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

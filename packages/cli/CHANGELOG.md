# @invinite-org/chartlang-cli

## 1.3.6

### Patch Changes

- Updated dependencies [55ca8ff]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [f92d131]
- Updated dependencies [55ca8ff]
- Updated dependencies [5e2be68]
- Updated dependencies [f92d131]
- Updated dependencies [55ca8ff]
- Updated dependencies [55ca8ff]
- Updated dependencies [55ca8ff]
- Updated dependencies [5e2be68]
  - @invinite-org/chartlang-core@1.8.0
  - @invinite-org/chartlang-compiler@1.9.0
  - @invinite-org/chartlang-pine-converter@0.7.0

## 1.3.5

### Patch Changes

- Updated dependencies [d542f99]
- Updated dependencies [d542f99]
- Updated dependencies [d542f99]
- Updated dependencies [d542f99]
- Updated dependencies [fb6f60a]
- Updated dependencies [fb6f60a]
  - @invinite-org/chartlang-pine-converter@0.6.0
  - @invinite-org/chartlang-core@1.7.0
  - @invinite-org/chartlang-compiler@1.8.0

## 1.3.4

### Patch Changes

- Updated dependencies [f89117d]
- Updated dependencies [a47c2fe]
- Updated dependencies [c44c0d5]
- Updated dependencies [f89117d]
- Updated dependencies [903f14a]
- Updated dependencies [f89117d]
- Updated dependencies [7704fbf]
- Updated dependencies [f89117d]
- Updated dependencies [f89117d]
- Updated dependencies [f89117d]
  - @invinite-org/chartlang-pine-converter@0.5.0
  - @invinite-org/chartlang-compiler@1.7.0
  - @invinite-org/chartlang-core@1.6.0

## 1.3.3

### Patch Changes

- Updated dependencies [70cb92f]
- Updated dependencies [70cb92f]
- Updated dependencies [70cb92f]
- Updated dependencies [70cb92f]
- Updated dependencies [70cb92f]
  - @invinite-org/chartlang-pine-converter@0.4.0
  - @invinite-org/chartlang-core@1.5.0
  - @invinite-org/chartlang-compiler@1.6.0

## 1.3.2

### Patch Changes

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

- Updated dependencies [382d1f1]
- Updated dependencies [382d1f1]
- Updated dependencies [48e8ebb]
- Updated dependencies [810125e]
- Updated dependencies [810125e]
- Updated dependencies [382d1f1]
- Updated dependencies [382d1f1]
- Updated dependencies [382d1f1]
- Updated dependencies [810125e]
- Updated dependencies [382d1f1]
- Updated dependencies [382d1f1]
- Updated dependencies [382d1f1]
- Updated dependencies [382d1f1]
- Updated dependencies [382d1f1]
- Updated dependencies [382d1f1]
- Updated dependencies [382d1f1]
- Updated dependencies [810125e]
- Updated dependencies [810125e]
- Updated dependencies [48e8ebb]
- Updated dependencies [48e8ebb]
- Updated dependencies [48e8ebb]
- Updated dependencies [48e8ebb]
  - @invinite-org/chartlang-pine-converter@0.3.0
  - @invinite-org/chartlang-core@1.4.0
  - @invinite-org/chartlang-compiler@1.5.0

## 1.3.1

### Patch Changes

- 08cba38: Add `time.*` calendar accessors (`time.year/month/dayofmonth/dayofweek/hour/
minute/second/timestamp`), a `time.timeClose(t, tz?)` bar-close accessor
  (Pine's `time_close()` = bar start + interval), a `session.isOpen(t, spec, tz?)`
  helper, and an `input.session` kind. Calendar fields are derived from a `Time`
  epoch via the host (authors stay sandboxed — `Date`/`Intl` remain banned). v1
  is UTC + fixed-offset only; exchange-tz/DST is a scoped follow-up. The Pine
  converter lowers `dayofweek` / `time()` / `time_close()` / `input.session`.
- 1efb49c: Add multi-symbol support to `request.security`. `request.security({ symbol,
interval })` now reads a **different instrument** (not just a higher
  timeframe), e.g. `request.security({ symbol: "AMEX:SPY", interval: "1D" })`.
  `symbol` is optional (defaults to the chart symbol) and must be a compile-time
  literal (`input.symbol` / `input.enum` resolved). A new `multiSymbol` adapter
  capability gates non-chart-symbol requests: a different-symbol request against
  an adapter declaring `multiSymbol: false` degrades to an all-NaN
  bar/series with a single deduped `multi-symbol-not-supported` diagnostic,
  mirroring `multi-timeframe-not-supported` (the symbol gate precedes the
  timeframe gate, so a both-different request emits only the symbol diagnostic).
  The Pine converter now lowers `request.security("OTHER", tf, expr)`, and the
  `chartlang scaffold-adapter` template advertises `multiSymbol`.
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

- Updated dependencies [e620ba8]
- Updated dependencies [08cba38]
- Updated dependencies [1efb49c]
- Updated dependencies [1efb49c]
  - @invinite-org/chartlang-core@1.3.0
  - @invinite-org/chartlang-compiler@1.4.0
  - @invinite-org/chartlang-pine-converter@0.2.0

## 1.3.0

### Minor Changes

- a165b3b: Add `chartlang add-adapter [id] [dir]` — drop a complete, runnable library
  adapter (canvas2d, echarts, konva, lightweight-charts, uplot) into your repo
  from an offline, version-pinned bundle baked into the CLI. Supports `--list`
  (comparison matrix), `--name <pkg>`, `--pm <npm|pnpm|yarn|bun>`, and `--force`.
  Unlike `scaffold-adapter` (a blank starter), `add-adapter` writes a full,
  conformance-green adapter with its chartlang dependencies pinned to the
  matching published versions. Zero new runtime dependencies.
- c7fd749: Re-export `BUNDLED_ADAPTERS`, `ADAPTER_REGISTRY`, and the
  `GeneratedAdapterBundle` / `GeneratedAdapterMeta` types from the package's
  public entry point. This lets downstream installers (e.g. `create-chartlang`)
  vendor the offline, version-pinned adapter bundles from a single source of
  truth instead of deep-importing `src/generated/**` or depending on the
  unpublished example adapters. Additive — no existing export changes.

## 1.2.0

### Minor Changes

- 656390d: Ship the converter CLI surface and finalize the programmatic API. Add
  `convertFile(path, opts?)` to `@invinite-org/chartlang-pine-converter`: an async
  file-system wrapper around `convert` that reads the input as UTF-8, threads
  `ConvertOpts` through, and — when `opts.outPath` is set and the conversion
  yields a non-null `output` — writes the converted `.chart.ts` to disk. File I/O
  failures reject the promise (host-environment errors, distinct from converter
  diagnostics). Adds the `ConvertFileOpts` type (`ConvertOpts & { outPath? }`).

  Add the `chartlang pine-convert <input.pine>` subcommand to
  `@invinite-org/chartlang-cli`, a thin in-process layer over `convertFile` + the
  `@invinite-org/chartlang-pine-converter/diagnostics` formatters. Flags:
  `--out <path>` (write to file, else stream to stdout), `--report` /
  `--diagnostics-json` (human report to stderr vs JSON to stdout), `--strict`,
  `--bar-interval <ms>`, `--bar-index-origin <ms>`. Exit codes: `0` success,
  `1` error-severity diagnostics, `2` file I/O failure, `3` invalid CLI args.

### Patch Changes

- b1bf0b8: Remove the `AUTO_GENERATED_HEADER` sentinel from generated primitive docs
  pages. The docs site renders with `markdown.html: false`, so the leading
  `<!-- AUTO-GENERATED ... -->` HTML comment surfaced as visible text at the
  top of every page. Generated pages now open directly with their `# ` title
  heading. The `AUTO_GENERATED_HEADER` export is removed from
  `@invinite-org/chartlang-cli` — it was a human marker only, never a
  functional overwrite guard, so the `docs:gate` byte-diff still protects
  against drift.
- 850ae21: Expand the `request.security` / `request.lowerTf` JSDoc into narrative
  descriptions with realistic examples (higher-timeframe `SecurityBar` reads
  and lower-timeframe contained-bar arrays), and cross-link both generated
  primitive pages to the multi-timeframe guide via their `seeAlso` entry in
  `genPhase4Docs.ts`. The auto-generated `docs/primitives/request/*.md` pages
  and the hover registry were regenerated from the new JSDoc — no runtime
  behaviour change.
- 5a9c24d: Add `state.series(init)` — a writable, indexable user series. Store an
  arbitrary value each bar (`s.value = expr`) and read its history N bars
  back (`s[1]`). Number-coercible (`+s`, `s.current`) and usable as a `ta.*`
  source. The Pine converter lowers a history-indexed `var` to it.
- Updated dependencies [850ae21]
- Updated dependencies [ca19e20]
- Updated dependencies [3541445]
- Updated dependencies [6235ad7]
- Updated dependencies [3bf391a]
- Updated dependencies [656390d]
- Updated dependencies [656390d]
- Updated dependencies [850ae21]
- Updated dependencies [656390d]
- Updated dependencies [b55d4c8]
- Updated dependencies [656390d]
- Updated dependencies [656390d]
- Updated dependencies [48c1b76]
- Updated dependencies [48c1b76]
- Updated dependencies [b55d4c8]
- Updated dependencies [48c1b76]
- Updated dependencies [850ae21]
- Updated dependencies [850ae21]
- Updated dependencies [48c1b76]
- Updated dependencies [b55d4c8]
- Updated dependencies [656390d]
- Updated dependencies [656390d]
- Updated dependencies [656390d]
- Updated dependencies [656390d]
- Updated dependencies [b55d4c8]
- Updated dependencies [656390d]
- Updated dependencies [656390d]
- Updated dependencies [656390d]
- Updated dependencies [8086003]
- Updated dependencies [850ae21]
- Updated dependencies [850ae21]
- Updated dependencies [073f41b]
- Updated dependencies [5a9c24d]
- Updated dependencies [5a9c24d]
- Updated dependencies [08c536c]
  - @invinite-org/chartlang-core@1.2.0
  - @invinite-org/chartlang-compiler@1.3.0
  - @invinite-org/chartlang-pine-converter@0.1.0

## 1.1.1

### Patch Changes

- 71ea0a5: Inline original TypeScript sources into emitted `.js.map` files (`inlineSources: true`). Published sourcemaps no longer reference missing `../src/*.ts` files, fixing "points to missing source files" warnings in downstream bundlers (e.g. Vite).
- Updated dependencies [71ea0a5]
  - @invinite-org/chartlang-compiler@1.2.1
  - @invinite-org/chartlang-core@1.1.1

## 1.1.0

### Minor Changes

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
- Updated dependencies [4d77f4d]
- Updated dependencies [4d77f4d]
- Updated dependencies [3b4952d]
- Updated dependencies [0427459]
  - @invinite-org/chartlang-core@1.1.0
  - @invinite-org/chartlang-compiler@1.1.0

## 1.0.1

### Patch Changes

- d1de692: Fix end-user-blocking Node-ESM packaging bug. Every published `dist/index.js` previously failed to load under Node's strict ESM resolver because `tsc` had been configured with `moduleResolution: "Bundler"` and emitted relative specifiers verbatim, so `dist/index.js` carried `from "./api"` (extensionless) and Node rejected the resolution. Workspace consumers never saw this because tsx / vitest / Vite resolve loosely, but `npm install @invinite-org/chartlang-compiler` followed by `import` failed immediately for any Node consumer, and `examples/react-demo/vite.config.ts`'s server-side compile plugin broke at dev-config-load time.

  This release switches `tsconfig.base.json` to `module: "NodeNext"` / `moduleResolution: "NodeNext"`, and rewrites every relative import / export / dynamic-import / `typeof import("…")` specifier across all packages' source to carry an explicit `.js` (or `/index.js`) suffix. The new resolution mode also surfaces this bug class as a compile error rather than runtime breakage, so it cannot regress.

  No behavioural change for runtime consumers — the rewritten specifiers resolve to the same TypeScript sources at build time and the same `dist/<path>.js` files at consumer-load time.

- 98599b2: Generate primitive reference pages for `plot`, `hline`, `alert`, and `request.lowerTf`: extended the Phase 4 docs generator with entries that source JSDoc from `packages/core/src/{plot,alert,request}/`, and added `@stable` markers to the top-level `plot` / `hline` / `alert` callable holes so the generator emits a stability label. The new pages are wired into the VitePress sidebar under Plot, Alert, and Request.
- Updated dependencies [4d44a9c]
- Updated dependencies [d1de692]
- Updated dependencies [d1de692]
- Updated dependencies [98599b2]
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
- `chartlang scaffold-adapter` output now ships a wired conformance test
  (`src/conformance.test.ts`) and a `conformance:report` script that writes
  the public `CONFORMANCE.md` + `conformance-report.json` pair, making the
  scaffold-to-conformant-adapter path runnable out of the box.

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
  - @invinite-org/chartlang-compiler@1.0.0
  - @invinite-org/chartlang-core@1.0.0

## 0.5.0

### Phase 5

#### Patch Changes

- Add `ta.visibleRangeVolumeProfile` per PLAN §9.2, ported from invinite commit `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4`, with runtime histogram emission, compiler/core type surfaces, conformance coverage, and generated docs.
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

## 0.4.0

### Minor Changes

- 3f3ce38: Phase-1 CLI: `chartlang compile` and `chartlang scaffold-adapter`.
  `compile` writes the `.chart.js` + `.chart.manifest.json` + `.chart.d.ts`
  triple per source via the compiler API, with `--sourcemap[=mode]` /
  `--minify` / `--out <dir>` flags. Continues compiling on a per-file
  `CompileError` so a single bad file does not mask successes.
  `scaffold-adapter` generates a starter adapter package outside the
  OSS repo from string templates (kebab-case name validation, refuses
  to overwrite a non-empty target, mints `package.json` /
  `tsconfig.json` / `src/index.ts` / `src/index.test.ts` / `README.md`
  / `.gitignore`). Adds three Phase-1 example scripts under
  `examples/scripts/` (ema-cross, bollinger-bands,
  rsi-divergence-alert), each compiled end-to-end by the CLI package's
  `e2e.test.ts`. Removes the Phase-0 `PACKAGE_VERSION` placeholder.
- 38fb475: Phase 2 — `0.2` full indicator parity.

  - 81 new `ta.*` primitives (6 cross-functional + 75 §9.2 ports);
    `TA_REGISTRY` cardinality 9 -> 90; `STATEFUL_PRIMITIVES`
    cardinality 12 -> 93.
  - 5 new chained-MA helpers + 5 new stats/volatility helpers in
    `packages/runtime/src/ta/lib/`.
  - 6 new `PlotKind`s (histogram, bars, area, filled-band, label,
    marker) + canvas2d renderers + `validateEmission` arms.
  - `Bar` extended with `hl2` / `hlc3` / `ohlc4` / `hlcc4` derived
    source fields — runtime already pre-computes on `BarView`.
  - `Scenario` extended with `inlineSource?: string` so Phase-2
    scenarios stay self-contained without bloating
    `examples/scripts/`.
  - `STATEFUL_PRIMITIVES` shape widened from `ReadonlySet<string>`
    to `ReadonlySet<{ name: string; slot: boolean }>` to support
    `ta.nz` (the only stateless `ta.*`).
  - Universal `opts.offset` honoured on every `ta.*` primitive
    (Phase-1 backfill in Task 29).
  - `chartlang docs` subcommand generates
    `docs/primitives/ta/<id>.md` per primitive.
  - `PHASE_2_INDICATORS` + `PHASE_5_DEFERRED` inventories exported
    from `@invinite-org/chartlang-conformance` and pinned by
    `phase2Coverage.test.ts` (Task 30).
  - 100% coverage maintained across every published package.
  - `apiVersion: 1` script header unchanged; Phase 2 is additive
    at runtime.

- 38fb475: Phase-2 Task 2 — `chartlang docs` subcommand + `gen-docs` generator.

  Adds the `chartlang docs [--source <dir>] [--out <dir>]` subcommand
  that walks every `ta.*` primitive source under
  `packages/runtime/src/ta/`, parses each export's JSDoc (`@formula`,
  `@warmup`, `@anchors`, `@since`, `@example`, stability marker) via
  the TypeScript compiler API, and emits one
  `docs/primitives/ta/<id>.md` per primitive following the §17.2
  template. Pages open with the `<!-- AUTO-GENERATED -->` sentinel
  so the `pnpm docs:gate` byte-equality check is robust.

  The CLI's `runCli` dispatcher learns a `docs` case and re-exports
  the new `runDocsCommand`, `runGenDocs`, `generateDocsPage`,
  `parsePrimitiveSource`, `GenDocsError`, `AUTO_GENERATED_HEADER`,
  and `findRepoRoot` programmatic surfaces.

  Root scripts `pnpm docs:generate` (alias for `pnpm chartlang docs`)
  and `pnpm docs:gate` (regenerates into a tmp dir, byte-diffs against
  the committed tree) land alongside; CI runs `docs:gate` after
  `docs:check`. The Phase-1 primitive pages (sma, ema, stdev, bb,
  rsi, macd, atr, crossover, crossunder) ship in this changeset
  together with a hand-written `docs/primitives/ta/index.md`.

  `typescript` added as a runtime dependency of the CLI package
  (previously a workspace-root devDep; the generator ships in the
  published `dist/`).

- b0d296b: Phase 3 closeout — `0.3` "Full Drawing Parity".

  61 drawing kinds across 13 categories ship under `draw.*` with the
  full §22.10 set per kind (impl + property + golden + bench + JSDoc

  - conformance scenario + auto-generated docs page). 5-bucket
    `DrawingCounts` budget, per-kind capability gating, `DrawingHandle`
    across-bar stability, real-impl `validateEmission` + `decodeDrawing`,
    `drawing-hash` conformance assertion variant, 13 category + 1
    umbrella capability builders, canvas2d reference adapter renders
    every kind, `defineDrawing` constructor for interactive tools.

  Final cardinalities: `STATEFUL_PRIMITIVES.size === 154` (93 Phase-2

  - 61 Phase-3 `draw.*` entries); `DRAWING_KINDS.length === 61`.

  Per-bucket kind tally pinned by `bucketFor` (6 + 5 + 6 + 25 + 19 = 61):

  - `lines` (6): `line`, `horizontal-line`, `horizontal-ray`,
    `vertical-line`, `cross-line`, `trend-angle`.
  - `boxes` (5): `rectangle`, `rotated-rectangle`, `triangle`,
    `circle`, `ellipse`.
  - `labels` (6): `marker`, `text`, `arrow`, `arrow-marker`,
    `arrow-mark-up`, `arrow-mark-down`.
  - `polylines` (25): `polyline`, `path`, `arc`, `curve`,
    `double-curve`, `pen`, `highlighter`, `brush`,
    `trend-channel`, `flat-top-bottom`, `disjoint-channel`,
    `regression-trend`, `pitchfork`, `pitchfan`, `xabcd-pattern`,
    `cypher-pattern`, `head-and-shoulders`, `abcd-pattern`,
    `triangle-pattern`, `three-drives-pattern`,
    `elliott-impulse-wave`, `elliott-correction-wave`,
    `elliott-triangle-wave`, `elliott-double-combo`,
    `elliott-triple-combo`.
  - `other` (19): 10 `fib-*` + 4 `gann-*` + 3 cycles
    (`cyclic-lines`, `time-cycles`, `sine-line`) + 2 containers
    (`group`, `frame`).

  Conformance scenarios: 61 per-kind + 12 task bundles +
  `drawAll61` + `drawBudgetOverflow` + `drawUnsupportedKind` = **76**.
  Docs: 61 auto-generated `docs/primitives/draw/<kind>.md` pages +
  1 hand-written `index.md`.

  Variant collapses pinned in Task 1 (carried forward unchanged):

  - `pitchfork.variant: "standard" | "schiff" | "modified-schiff" | "inside"`
    collapses the 4 invinite pitchfork tools.
  - `line.{extendLeft, extendRight}` collapses the `ray` /
    `extended-line` tools.
  - `cypherPattern` ships as a `defineDrawing`-only kind (no
    standalone interactive tool).

  Compiler: `callsiteIdInjection` recognises every `draw.*` callable
  via the widened 154-entry `STATEFUL_PRIMITIVES`;
  `statefulCallInLoop` flags `draw.*` in unbounded loops with the
  existing `stateful-call-inside-loop` error.

  Bench thresholds (re-verified post-Phase-3 on Apple-silicon):

  - `pushDrawing.bench.test.ts` — 10 000 line drawings under 2 000ms
    wall-clock (`ceil(median × 3)` per §22.10; no drift across
    Tasks 4–18 — the budget/validate path is independent of
    per-kind canvas renderers). `pnpm bench:ci` median ~180ms.
  - The Phase-2 ta / ringBuffer / seriesView / onBarClose /
    plot / hline bench thresholds were bumped from the
    `200/250/300/400/500/600ms` solo-run pins to a uniform `1500ms`
    (3000ms for plot + hline) to absorb the parallel-worker
    scheduling overhead during workspace `pnpm test` (665 test
    files in parallel). Solo `pnpm bench:ci` medians remain in the
    10–200ms range — well under both old and new thresholds — so
    this is a noise-floor adjustment, not a perf-regression
    accommodation.

  `apiVersion: 1` script header unchanged; Phase 3 is additive at
  runtime.

- b0d296b: Phase-3 Task 21 — `gen-docs` extension for `draw.*` primitives + 61
  auto-generated `docs/primitives/draw/<kebab-kind>.md` pages + the
  hand-written `docs/primitives/draw/index.md` index.

  Adds a sibling `packages/cli/src/commands/extractDrawingPages.ts`
  extractor that walks `packages/runtime/src/emit/draw/` recursively
  (one level — into the 13 category subdirs), reads each per-kind
  script-facing overload's JSDoc (`@anchors`, `@anchorCount`,
  `@bucket`, `@since`, `@example`, stability marker), and writes one
  `docs/primitives/draw/<kebab-kind>.md` per kind using the
  draw-specific template (Anchors / Signature / Example / See also).
  Cross-checks `@bucket` against the canonical `KIND_BUCKET` table in
  `@invinite-org/chartlang-core` and rejects drift with a structured
  `GenDocsError("bucket-mismatch", …)`.

  `runDocsCommand` extended to invoke both extractors in sequence —
  `pnpm docs:generate` now refreshes the `ta/` and `draw/` trees in a
  single call. New `--draw-source` / `--draw-out` flags supplement
  the existing `--source` / `--out` (which retain their Phase-2
  meaning of `ta.*` aliases); explicit `--ta-source` / `--ta-out`
  aliases are also accepted.

  `scripts/docs-gate.ts` extended to regenerate both trees into
  sibling tmp dirs and byte-diff each against the committed tree;
  `docs/primitives/draw/index.md` is the only hand-written exception
  (mirroring `docs/primitives/ta/index.md`).

  New programmatic surface re-exported from `@invinite-org/chartlang-cli`:
  `generateDrawingDocsPage`, `parseDrawingSource`, `runGenDrawingDocs`,
  `DrawingDocInput`, `RunGenDrawingDocsOptions`.

### Patch Changes

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
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @invinite-org/chartlang-compiler@0.4.0
  - @invinite-org/chartlang-core@0.4.0

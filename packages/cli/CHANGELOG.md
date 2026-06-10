# @invinite-org/chartlang-cli

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

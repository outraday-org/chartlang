# @invinite-org/chartlang-host-quickjs

## 1.3.3

### Patch Changes

- Updated dependencies [70cb92f]
- Updated dependencies [70cb92f]
  - @invinite-org/chartlang-core@1.5.0
  - @invinite-org/chartlang-runtime@1.5.0

## 1.3.2

### Patch Changes

- 770e973: Make `createQuickJsHost` importable inside a Cloudflare Worker / Durable Object.
  The host no longer `readFileSync`s `dist/dispatcher.js` at module scope — the
  dispatcher bundle is inlined as a build-time `DISPATCHER_SOURCE` string constant
  (generated into `src/dispatcherSource.generated.ts` by `scripts/buildDispatcher.ts`,
  the same `bundleDispatcher()` source of truth as `dist/dispatcher.js`), so the
  runtime path has zero `node:fs` / `node:path` / `node:url` imports and loads in
  any runtime (DO, browser, Node). No public API change: `getQuickJS` stays the
  default `quickJsLike`, and the dispatcher contents are unchanged (byte-identical
  `dist/dispatcher.js`). The `dispatcherFreshness` gate now also asserts the
  generated constant matches `bundleDispatcher()`, and a new no-filesystem
  regression test locks in the DO-compat guarantee.

## 1.3.1

### Patch Changes

- Updated dependencies [3770236]
- Updated dependencies [382d1f1]
- Updated dependencies [382d1f1]
- Updated dependencies [48e8ebb]
- Updated dependencies [810125e]
- Updated dependencies [382d1f1]
- Updated dependencies [382d1f1]
- Updated dependencies [810125e]
- Updated dependencies [48e8ebb]
- Updated dependencies [810125e]
  - @invinite-org/chartlang-adapter-kit@1.7.0
  - @invinite-org/chartlang-core@1.4.0
  - @invinite-org/chartlang-runtime@1.4.0

## 1.3.0

### Minor Changes

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

### Patch Changes

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
  - @invinite-org/chartlang-runtime@1.3.0
  - @invinite-org/chartlang-host-worker@1.3.0

## 1.2.2

### Patch Changes

- Updated dependencies [24946e4]
  - @invinite-org/chartlang-adapter-kit@1.5.0

## 1.2.1

### Patch Changes

- Updated dependencies [03f59bf]
- Updated dependencies [03f59bf]
- Updated dependencies [03f59bf]
  - @invinite-org/chartlang-adapter-kit@1.4.0

## 1.2.0

### Minor Changes

- 073f41b: Add the higher-timeframe expression/callback overload to `request.security`.
  Alongside the existing data form `request.security({ interval })` →
  `SecurityBar`, scripts can now write `request.security({ interval }, (bar) =>
…)` → `Series<number>`, where the callback runs on the **higher-timeframe
  clock** — `request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20))`
  is a true weekly EMA(20) (20 weekly bars), not 20 main bars of a weekly-stepped
  series. The result is aligned no-lookahead down to the main timeline.

  - **core** — the `SecurityExpr` callback type (re-exported from the package
    root), the second `security` overload, and the shared `statefulPrimitives`
    entry annotated as covering both arities.
  - **compiler** — records one `SecurityExpressionDescriptor { slotId, interval,
paramName }` per expression callsite in `manifest.securityExpressions`
    (sorted by `slotId`, omitted for the data-only form), and validates each
    callback against the allowed subset — its `bar` parameter and body locals,
    the ambient `ta` / `inputs`, safe `Math.*` globals, and literals — rejecting
    any captured outer binding with the new
    `request-security-expr-captures-local` diagnostic.
  - **runtime** — mounts one `SecurityExprRunner` per manifest entry: the
    callback is captured lazily on the first main compute, driven once per HTF bar
    close through a dedicated fold `StreamState` so `ta.*` accumulate on the HTF
    clock, and one sampled value per HTF bar feeds a per-slot output buffer that
    `request.security(opts, expr)` returns aligned no-lookahead to the main
    timeline. Capability / interval / stream fallbacks return an all-NaN series
    with a deduped diagnostic.
  - **host-worker / host-quickjs** — boot the expression form unchanged; the
    `__manifest` sidecar already carries `securityExpressions`.
  - **pine-converter** — Pine's `request.security(sym, "D", ta.ema(close, 9))`
    now lowers to the chartlang callback form
    `request.security({ interval: "1d" }, (bar) => ta.ema(bar.close, 9))` (a bare
    OHLCV third arg keeps lowering to the data form).
  - **conformance** — new scenarios prove the weekly expression value differs
    from a same-length main-timeframe EMA, plus the `multiTimeframe: false` NaN
    fallback.

### Patch Changes

- 850ae21: Fix single-script multi-timeframe loads dropping their secondary streams.
  Both host boots now adopt the compiler's object-form `__manifest` sidecar
  as the authoritative manifest for a single-script module
  (`buildBundleFromModule` in host-worker, the bundle builder in
  host-quickjs's `dispatcherCore`). The runtime `defineIndicator` stub zeroes
  compiler-derived fields (`requestedIntervals`, `outputs`, `plots`,
  `maxLookback`), so using `mod.default.manifest` left `requestedIntervals`
  empty — a `request.security` script never registered its secondary streams
  and every secondary candle was dropped with an `unknown-secondary-stream`
  warning. Single-object detection goes through a dedicated `isSingleManifest`
  guard (TS #17002: `Array.isArray` does not subtract a `ReadonlyArray` union
  member). Cross-host parity is preserved.
- Updated dependencies [850ae21]
- Updated dependencies [ca19e20]
- Updated dependencies [6235ad7]
- Updated dependencies [3bf391a]
- Updated dependencies [850ae21]
- Updated dependencies [8086003]
- Updated dependencies [850ae21]
- Updated dependencies [850ae21]
- Updated dependencies [073f41b]
- Updated dependencies [5a9c24d]
- Updated dependencies [08c536c]
  - @invinite-org/chartlang-core@1.2.0
  - @invinite-org/chartlang-runtime@1.2.0
  - @invinite-org/chartlang-adapter-kit@1.3.0
  - @invinite-org/chartlang-host-worker@1.2.0

## 1.1.1

### Patch Changes

- 71ea0a5: Inline original TypeScript sources into emitted `.js.map` files (`inlineSources: true`). Published sourcemaps no longer reference missing `../src/*.ts` files, fixing "points to missing source files" warnings in downstream bundlers (e.g. Vite).
- Updated dependencies [71ea0a5]
  - @invinite-org/chartlang-adapter-kit@1.2.1
  - @invinite-org/chartlang-core@1.1.1
  - @invinite-org/chartlang-host-worker@1.1.1
  - @invinite-org/chartlang-runtime@1.1.1

## 1.1.0

### Minor Changes

- 2123181: Hosts (`host-worker`, `host-quickjs`) detect the array-shape `__manifest`
  sidecar plus the new `__dependencies` export, mount the compiled
  `CompiledScriptBundle`, and round-trip the six `dep-*` diagnostic codes
  across both the postMessage wire and the QuickJS JSON membrane.
  `host-worker`'s `CompiledModuleExport` type widens to carry the optional
  `__manifest` / `__dependencies` sidecars; `host-quickjs`'s
  `moduleSourceToScript` rewrites every drawn named export onto a
  host-visible `globalThis.__chartlang_compiled_named` map and lowers
  `__dependencies` onto its own global slot. `adapter-kit`'s
  `validateEmission` confirmed (with explicit coverage) to accept every
  new code. canvas2d-adapter integration test renders sibling-prefixed
  plots, drops private-dep plots, and surfaces `dep-error` diagnostics
  through `Adapter.onEmissions`. The compiler now appends
  `export const __dependencies = [...]` to multi-export bundle output so
  the runtime can mount each private dep as a `DepRunner`; single-script
  bundles stay byte-identical (no `__dependencies` line).
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

- 2123181: Light up the end-to-end cross-file dep path for indicator composition. The
  compiler's `rewriteDependencyAccessors` transformer now collapses
  `const <alias> = <root>.withInputs({...})...` chains to the bare root
  identifier so the runtime sentinel never fires at module load; the merged
  effective inputs flow through the `__dependencies[i].inputOverrides` slot
  into the runtime's `DepRunner`. Cross-file producers' `@invinite-org/chartlang-core`
  imports are hoisted above the inlined IIFE so esbuild dedupes them against
  the consumer's imports and pulls in every symbol the producer uses
  (`input.int`, `ta.ema`, …). The `__dependencies` export is now prepended
  pre-bundle so esbuild's tree-shaker keeps each alias binding alive. The
  `dep-cross-file` conformance scenario joins `ALL_SCENARIOS` and the suite
  runs 225 scenarios green.
- 4d77f4d: Apply host-supplied plot overrides at emit time and add a live `setPlotOverrides` channel. The runtime resolves an initial `plotOverrides` map at mount (`args.plotOverrides ?? args.resolvePlotOverrides?.(...)`), applies the matching `PlotOverride` to every `PlotEmission` by `slotId` via the new pure `applyPlotOverride` helper (visibility / color / line width / line style for line-family kinds; silent no-op otherwise), and exposes `ScriptRunner.setPlotOverrides(next)` for a recompute-free live swap. Both `host-worker` and `host-quickjs` forward an initial `plotOverrides` on the `load` frame (mirroring `inputOverrides`) and relay a new `setPlotOverrides` host→guest frame; `ScriptHost.setPlotOverrides(...)` is added for cross-host parity. Fully additive: with no overrides supplied, every emission is byte-identical to before (the `visible` field is omitted unless a slot is explicitly hidden).

### Patch Changes

- Updated dependencies [d6d1a1f]
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
- Updated dependencies [0427459]
  - @invinite-org/chartlang-core@1.1.0
  - @invinite-org/chartlang-adapter-kit@1.2.0
  - @invinite-org/chartlang-runtime@1.1.0
  - @invinite-org/chartlang-host-worker@1.1.0

## 1.0.2

### Patch Changes

- Updated dependencies [9f5d7cb]
  - @invinite-org/chartlang-runtime@1.0.2

## 1.0.1

### Patch Changes

- 98599b2: Extract the QuickJS dispatcher's pure logic into `dispatcherCore.ts` so the host-realm tests can exercise it directly while `dispatcher.ts` remains the thin guest-realm entry that hardens guest globals and wires `globalThis.__chartlang_*`. No observable behaviour change — the bundled `dist/dispatcher.js` still installs the same handlers and the integration / sandbox / conformance tests are unchanged.
- d1de692: Fix end-user-blocking bug where compiled scripts could not load in either sandbox host: `compile()` now emits a self-contained ESM bundle (`esbuild.build` with `bundle: true`) so the bare `@invinite-org/chartlang-core` import is inlined and tree-shaken, matching PLAN §5.2's "~5–50 KB ESM" contract. The host-worker `data:` URL load path now succeeds end-to-end. The host-quickjs `moduleSourceToScript` regex also accepts the `export { name as default };` form produced by `esbuild`'s bundled output (the previous regex only matched literal `export default <expr>;`, so every real compile output threw "compiled module did not declare an export default").
- d1de692: Fix end-user-blocking Node-ESM packaging bug. Every published `dist/index.js` previously failed to load under Node's strict ESM resolver because `tsc` had been configured with `moduleResolution: "Bundler"` and emitted relative specifiers verbatim, so `dist/index.js` carried `from "./api"` (extensionless) and Node rejected the resolution. Workspace consumers never saw this because tsx / vitest / Vite resolve loosely, but `npm install @invinite-org/chartlang-compiler` followed by `import` failed immediately for any Node consumer, and `examples/react-demo/vite.config.ts`'s server-side compile plugin broke at dev-config-load time.

  This release switches `tsconfig.base.json` to `module: "NodeNext"` / `moduleResolution: "NodeNext"`, and rewrites every relative import / export / dynamic-import / `typeof import("…")` specifier across all packages' source to carry an explicit `.js` (or `/index.js`) suffix. The new resolution mode also surfaces this bug class as a compile error rather than runtime breakage, so it cannot regress.

  No behavioural change for runtime consumers — the rewritten specifiers resolve to the same TypeScript sources at build time and the same `dist/<path>.js` files at consumer-load time.

- 4d44a9c: Three host-robustness fixes discovered during real end-user testing:

  - **`host-worker`**: `createWorkerHost().load(...)` no longer hangs forever when the underlying `Worker` fails to boot (module fetch fails, exception during construction, OS-level crash). The host now subscribes to the worker's `error` event and rejects any in-flight (or subsequent) `load()` call with `worker failed to boot: <message>`. A new `HostLimits.maxLoadTimeoutMs` (default `30_000`) bounds the wait independently — a silently-dead worker that never fires `error` also can't hang a consumer. `MessagePort`-backed `WorkerLike` test seams remain compatible: the `error` subscription is silently ignored by ports that don't deliver that event.
  - **`host-worker`**: Added a `./worker-boot` subpath export so Vite consumers can write `new Worker(new URL("@invinite-org/chartlang-host-worker/worker-boot", import.meta.url), { type: "module" })` instead of digging into `dist/`. The bundle is regenerated by `pnpm build` and now ships a minimal `.d.ts` next to it so NodeNext type-checking does not error on the bare specifier.
  - **`host-quickjs`**: Added an in-process freshness gate (`dispatcherFreshness.test.ts`) that rebundles `src/dispatcher.ts` in memory via the same `bundleDispatcher()` function `pnpm build:dispatcher` uses, hashes both sides, and fails with a "run `pnpm build`" hint when the committed `dist/dispatcher.js` is stale. Prevents the "source fix landed but tests still pass against the old dispatcher" failure mode.

- Updated dependencies [4d44a9c]
- Updated dependencies [98599b2]
- Updated dependencies [d1de692]
- Updated dependencies [4d44a9c]
- Updated dependencies [98599b2]
  - @invinite-org/chartlang-adapter-kit@1.1.0
  - @invinite-org/chartlang-runtime@1.0.1
  - @invinite-org/chartlang-core@1.0.1
  - @invinite-org/chartlang-host-worker@1.0.1

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

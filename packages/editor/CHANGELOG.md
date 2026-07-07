# @invinite-org/chartlang-editor

## 2.4.0

### Minor Changes

- 32eb444: Add editor font-size control (`opts.fontSize`, `editor.setFontSize()`, the
  reactive `<ChartlangEditor fontSize>` prop, `editorFontSizeTheme`, and the
  `DEFAULT_/MIN_/MAX_EDITOR_FONT_SIZE` + `EDITOR_FONT_SIZE_PRESETS` +
  `clampEditorFontSize` helpers) and bake in the chartlang Tab/auto-indent
  keymap (`indentationExtension`, on by default, opt out with
  `opts.indentation: false`).

## 2.3.6

### Patch Changes

- Updated dependencies [89cac8e]
  - @invinite-org/chartlang-core@1.10.0
  - @invinite-org/chartlang-language-service@1.5.4

## 2.3.5

### Patch Changes

- Updated dependencies [df3f5b2]
  - @invinite-org/chartlang-core@1.9.0
  - @invinite-org/chartlang-language-service@1.5.3

## 2.3.4

### Patch Changes

- Updated dependencies [55ca8ff]
- Updated dependencies [55ca8ff]
- Updated dependencies [f92d131]
- Updated dependencies [55ca8ff]
- Updated dependencies [55ca8ff]
- Updated dependencies [55ca8ff]
- Updated dependencies [5e2be68]
  - @invinite-org/chartlang-adapter-kit@1.9.0
  - @invinite-org/chartlang-core@1.8.0
  - @invinite-org/chartlang-language-service@1.5.2

## 2.3.3

### Patch Changes

- Updated dependencies [d542f99]
- Updated dependencies [d542f99]
- Updated dependencies [fb6f60a]
  - @invinite-org/chartlang-adapter-kit@1.8.0
  - @invinite-org/chartlang-core@1.7.0
  - @invinite-org/chartlang-language-service@1.5.1

## 2.3.2

### Patch Changes

- Updated dependencies [7704fbf]
- Updated dependencies [f89117d]
  - @invinite-org/chartlang-language-service@1.5.0
  - @invinite-org/chartlang-core@1.6.0

## 2.3.1

### Patch Changes

- Updated dependencies [70cb92f]
- Updated dependencies [70cb92f]
  - @invinite-org/chartlang-core@1.5.0
  - @invinite-org/chartlang-language-service@1.4.7

## 2.3.0

### Minor Changes

- 48e8ebb: Make numeric `input.enum` execution complete (T4 Task 4 counterpart to Task 1's
  core widening).

  - **Runtime — `resolveInputs.matchesDescriptor`'s `enum` arm accepts a numeric
    override.** It previously type-gated an adapter override to `string`, so a
    numeric-enum override (`input.enum(21, [8, 21, 30])` overridden to `30`) was
    wrongly rejected with `input-coercion-failed` and fell back to the default.
    The arm now accepts a `string` OR `number` value that names a valid option.
    String-enum behaviour is byte-stable (a string value still checks string
    membership).
  - **Compiler — `extractInputs` serialises numeric enum options.** The manifest
    extractor previously required `input.enum` options to be string literals, so
    a numeric dropdown emitted `input-default-not-literal` and failed to compile.
    A uniform numeric or uniform string options list now serialises; a mixed
    string/number list is still rejected (it cannot type-check). The numeric
    default already round-tripped.
  - **Editor — the inputs form renders numeric enums and preserves their type.**
    `InputsFormOption.value` widens to `string | number`, the `<select>` value
    stringifies numeric current values so the control matches an option, and the
    change handler coerces the DOM string back to a number for numeric-enum
    options. Without this, a numeric override picked in the form was emitted as a
    string and silently discarded by the runtime's typed membership check.

### Patch Changes

- Updated dependencies [3770236]
- Updated dependencies [382d1f1]
- Updated dependencies [48e8ebb]
- Updated dependencies [810125e]
- Updated dependencies [810125e]
- Updated dependencies [382d1f1]
- Updated dependencies [810125e]
- Updated dependencies [810125e]
- Updated dependencies [810125e]
  - @invinite-org/chartlang-adapter-kit@1.7.0
  - @invinite-org/chartlang-core@1.4.0
  - @invinite-org/chartlang-language-service@1.4.6

## 2.2.0

### Minor Changes

- 08cba38: Add `time.*` calendar accessors (`time.year/month/dayofmonth/dayofweek/hour/
minute/second/timestamp`), a `time.timeClose(t, tz?)` bar-close accessor
  (Pine's `time_close()` = bar start + interval), a `session.isOpen(t, spec, tz?)`
  helper, and an `input.session` kind. Calendar fields are derived from a `Time`
  epoch via the host (authors stay sandboxed — `Date`/`Intl` remain banned). v1
  is UTC + fixed-offset only; exchange-tz/DST is a scoped follow-up. The Pine
  converter lowers `dayofweek` / `time()` / `time_close()` / `input.session`.

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
  - @invinite-org/chartlang-language-service@1.4.5

## 2.1.5

### Patch Changes

- Updated dependencies [24946e4]
  - @invinite-org/chartlang-adapter-kit@1.5.0
  - @invinite-org/chartlang-language-service@1.4.4

## 2.1.4

### Patch Changes

- Updated dependencies [03f59bf]
- Updated dependencies [03f59bf]
- Updated dependencies [03f59bf]
  - @invinite-org/chartlang-adapter-kit@1.4.0
  - @invinite-org/chartlang-language-service@1.4.3

## 2.1.3

### Patch Changes

- Updated dependencies [850ae21]
- Updated dependencies [ca19e20]
- Updated dependencies [6235ad7]
- Updated dependencies [3bf391a]
- Updated dependencies [8086003]
- Updated dependencies [850ae21]
- Updated dependencies [073f41b]
- Updated dependencies [5a9c24d]
- Updated dependencies [08c536c]
  - @invinite-org/chartlang-core@1.2.0
  - @invinite-org/chartlang-adapter-kit@1.3.0
  - @invinite-org/chartlang-language-service@1.4.2

## 2.1.2

### Patch Changes

- 71ea0a5: Inline original TypeScript sources into emitted `.js.map` files (`inlineSources: true`). Published sourcemaps no longer reference missing `../src/*.ts` files, fixing "points to missing source files" warnings in downstream bundlers (e.g. Vite).
- Updated dependencies [71ea0a5]
  - @invinite-org/chartlang-adapter-kit@1.2.1
  - @invinite-org/chartlang-core@1.1.1
  - @invinite-org/chartlang-language-service@1.4.1

## 2.1.1

### Patch Changes

- Updated dependencies [134a0bf]
  - @invinite-org/chartlang-language-service@1.4.0

## 2.1.0

### Minor Changes

- ba6a75d: Add a `compileToDiagnostics` injection seam so browser hosts can route compilation through their own server / worker boundary. `createLanguageService({ compileToDiagnostics })` now accepts a host callback; when supplied, diagnostics come from it and capability hints are appended locally. When omitted, Node runtimes keep the existing local compiler path and browser runtimes skip loading the Node-only compiler graph.

  The editor also gains an explicit `previewPanel` option (and matching React prop). The preview-panel extension now mounts only when `previewPanel` or `previewRunner` is supplied, instead of always mounting the Phase 4 placeholder.

### Patch Changes

- Updated dependencies [ba6a75d]
  - @invinite-org/chartlang-language-service@1.3.0

## 2.0.0

### Major Changes

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

### Patch Changes

- Updated dependencies [d7f8fad]
  - @invinite-org/chartlang-language-service@1.2.1

## 1.2.1

### Patch Changes

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

- Updated dependencies [d6d1a1f]
- Updated dependencies [f0c8eb8]
- Updated dependencies [2123181]
- Updated dependencies [2123181]
- Updated dependencies [2123181]
- Updated dependencies [2123181]
- Updated dependencies [2123181]
- Updated dependencies [4d77f4d]
- Updated dependencies [3b4952d]
- Updated dependencies [0427459]
  - @invinite-org/chartlang-core@1.1.0
  - @invinite-org/chartlang-adapter-kit@1.2.0
  - @invinite-org/chartlang-language-service@1.2.0

## 1.2.0

### Minor Changes

- 9f5d7cb: Add a `chartlangDark` CodeMirror theme + syntax highlight extension tuned for dark UIs (One-Dark-inspired palette, harmonised with the react-demo chrome), and an `extensions` passthrough on `ChartlangEditorOpts` and the React `<ChartlangEditor>` wrapper. Consumer extensions are appended after the built-in editor extensions, so themes / read-only flags / custom keymaps override the `basicSetup` defaults. The React prop is read at mount time only (mirrors `service` semantics).

## 1.1.0

### Minor Changes

- 4d44a9c: Add a `ChartlangLanguageService` interface (exported from `@invinite-org/chartlang-language-service` and re-exported from `@invinite-org/chartlang-editor`) and let `createChartlangEditor({ service })` (and the React `<ChartlangEditor service={...}>` prop) inject a consumer-provided implementation. When a service is injected, `setCapabilities(...)` becomes a no-op because the injected service owns its own capability surface. Editor extension type signatures now reference the named interface instead of `ReturnType<typeof createLanguageService>`, so consumers can build the surface from scratch (e.g. a hybrid local hover / remote `compileToDiagnostics`) without abandoning the editor factory.

### Patch Changes

- d1de692: Fix end-user-blocking Node-ESM packaging bug. Every published `dist/index.js` previously failed to load under Node's strict ESM resolver because `tsc` had been configured with `moduleResolution: "Bundler"` and emitted relative specifiers verbatim, so `dist/index.js` carried `from "./api"` (extensionless) and Node rejected the resolution. Workspace consumers never saw this because tsx / vitest / Vite resolve loosely, but `npm install @invinite-org/chartlang-compiler` followed by `import` failed immediately for any Node consumer, and `examples/react-demo/vite.config.ts`'s server-side compile plugin broke at dev-config-load time.

  This release switches `tsconfig.base.json` to `module: "NodeNext"` / `moduleResolution: "NodeNext"`, and rewrites every relative import / export / dynamic-import / `typeof import("…")` specifier across all packages' source to carry an explicit `.js` (or `/index.js`) suffix. The new resolution mode also surfaces this bug class as a compile error rather than runtime breakage, so it cannot regress.

  No behavioural change for runtime consumers — the rewritten specifiers resolve to the same TypeScript sources at build time and the same `dist/<path>.js` files at consumer-load time.

- Updated dependencies [4d44a9c]
- Updated dependencies [4d44a9c]
- Updated dependencies [4d44a9c]
- Updated dependencies [d1de692]
- Updated dependencies [98599b2]
  - @invinite-org/chartlang-adapter-kit@1.1.0
  - @invinite-org/chartlang-language-service@1.1.0
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
  - @invinite-org/chartlang-core@1.0.0
  - @invinite-org/chartlang-language-service@1.0.0

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
  - @invinite-org/chartlang-adapter-kit@0.5.0
  - @invinite-org/chartlang-language-service@0.4.1

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
- Ship the framework-agnostic CodeMirror 6 editor shell with language-service
  hover, completion, lint, and preview-panel extensions.
- Add the optional React editor sub-export and manifest-driven inputs UI helpers.

### Patch Changes

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
  - @invinite-org/chartlang-core@0.4.0
  - @invinite-org/chartlang-language-service@0.1.0

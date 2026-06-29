# apps/

Top-level workspace folder for **private, unpublished applications**
that consume `@invinite-org/chartlang-*` packages and live in this
repo. Distinct from `packages/*` (published `@invinite-org/chartlang-*`
libraries with the §22.4 scaffold) and `examples/*` (reference / demo
artefacts that ship alongside the published packages).

## Layout

- `apps/site/` — `chartlang-site`. The TanStack Start + shadcn
  (Base UI preset, `b0`) landing site deployed to
  `chartlang.invinite.com` by Netlify. Private (`"private": true`).
  Scaffolded by
  `pnpm dlx shadcn@latest init --preset b0 --base base --template start`
  (see `tasks/old/landing-site-netlify-deploy/`). Deploy mechanics live
  in `DEPLOYMENT.md`.
- `apps/react-starter/` — `chartlang-react-starter`. A private,
  clonable TanStack Start starter (the tree `@invinite-org/create-chartlang`
  clones for `npm create @invinite-org/chartlang@latest`). Scaffolded with the **stock
  shadcn Base UI _default_ (neutral) theme** —
  `pnpm dlx shadcn@latest init --base base --template start --preset nova`
  (NOT the site's `--preset b0`). Dev on port **3100** so it can run
  alongside the site (3200).
  **Brand-relaxation exception:** this is the one tree where the repo
  `brand/` single-source-of-truth contract is deliberately relaxed — it
  must **NOT** `@import "../../../brand/brand.css"`, must **NOT** use the
  `b0` preset, and must carry no chartlang brand tokens. Its
  `src/styles.css` ships the plain shadcn neutral `:root` / `.dark`
  token block so the user re-themes the clone themselves. See
  `apps/react-starter/README.md`.

## Conventions

- **MIT header on every committed `.ts` / `.tsx`** — same repo-wide
  rule as `packages/*` and `examples/*`. The one documented exception
  is `apps/site/src/routeTree.gen.ts`: the TanStack Router plugin
  regenerates it on every dev/build run, so any header we wrote would
  be overwritten. The file carries `// @ts-nocheck` and is
  auto-generated — leave it alone.
- **DOM globals are allowed here.** The compiler package's `lib`
  pin deliberately bans DOM types; `apps/site/` is a browser app and
  inherits the workspace base config's
  `lib: ["ES2022", "DOM", "DOM.Iterable"]`. This is the documented
  contrast.
- **No §22.4 scaffold.** `scripts/scaffold.ts`'s `PACKAGE_DIRS` is for
  `@invinite-org/chartlang-*` packages with the six-file template.
  Apps under `apps/*` use whatever shape their framework's scaffold
  emits (TanStack Start's `vite.config.ts` + `src/routes/`,
  components.json, etc.).
- **No coverage gate.** `scripts/coverage-merge.ts` walks
  `packages/*` + `examples/canvas2d-adapter` explicitly. Apps are
  not part of the 100% coverage gate — their functional tests are
  e2e (Playwright under `apps/site/tests/`, landed by
  `tasks/landing-site-netlify-deploy/4-...`).
- **No README gate.** `scripts/readme-check.ts` walks the same set as
  the coverage gate; it does not pick up `apps/*`. We still aim for
  the §17.1 shape and the ≤100-line cap on `apps/site/README.md` so a
  future gate expansion can include the directory cheaply.
- **No changeset.** `apps/site/` is `"private": true`; the §22
  changeset gate is package-scoped. PRs touching only `apps/*` do
  not need a changeset.
- **Biome ignores `apps/**`.** The shadcn-generated source uses
  2-space indent + no semicolons, which clashes with the repo-wide
  Biome config (4-space + semicolons). The root `biome.json` ignore
  list covers the whole `apps/**` tree.
- **Vitest excludes `apps/**`.** Set in the root `vitest.config.ts`
  to keep the apps' own test runners (Playwright in Task 4) from
  being discovered by the workspace coverage run.

## `apps/site/` demo + compiler invariants

The embedded demo runs the real chartlang compiler in the
`/api/compile` server route while keeping a browser-importable language
service. These build-config invariants make that coexist — break one
and the demo 500s, the client bundle fails to load, or the whole site
404s:

- **The SSR adapter is required.** `vite.config.ts` runs
  `@netlify/vite-plugin-tanstack-start` **after** `tanstackStart()`. It
  emits `.netlify/v1/functions/server.mjs` (config `path: "/*"`,
  `preferStatic: true`) wrapping `dist/server/server.js`. Without it
  `vite build` produces only a plain Node server Netlify cannot run, and
  publishing `dist/client` alone 404s every route (an SSR app has no
  `index.html`). The plugin requires **Node 22+**, so `engines.node` is
  `>=22` and Netlify pins `NODE_VERSION=22`.
- **Stub aliases are CLIENT-ONLY.** `esbuild` + the `node:*` builtins
  the language service touches are redirected to
  `src/lib/browser-stubs/` via a Vite plugin gated on
  `applyToEnvironment(env => env.name === "client")`. A plain
  top-level `resolve.alias` rewrites BOTH the client and the `ssr`
  graph, which would neuter the real compiler the server route needs.
- **`esbuild` is external in the `ssr` build.** esbuild's JS API
  cannot be bundled (it finds its native binary relative to its own
  package, throwing "`__filename` is not defined" once bundled into an
  ESM server file). It is `environments.ssr.build.rollupOptions.external`
  and an explicit `apps/site` devDependency so the function runtime
  resolves it from `node_modules`. `netlify/site.toml` records the
  matching `external_node_modules = ["esbuild"]`, but that file is not
  currently read by Netlify (see `DEPLOYMENT.md` → "Open: consolidate
  config"); verify `/api/compile` after each deploy.
- **TypeScript default libs are bundled, not read from disk.** The
  compiler's in-memory `ts.Program` loads `lib.es2022.d.ts` (+ the ES
  closure) from disk via `ts.sys.getExecutingFilePath()` →
  `node_modules/typescript/lib`. The Netlify function bundler ships
  `typescript.js` but NOT those `.d.ts` data files, so on the deployed
  site the lib read fails; with `skipLibCheck` it fails silently and the
  ambient core shim's `Readonly`/`Record` collapse to `any`, making every
  valid `compute({ bar, ta, … })` destructure emit a spurious TS7031
  (dev, with lib on disk, is fine). Fix: `vite.config.ts`'s
  `tsDefaultLibs()` plugin embeds the ES libs as `virtual:ts-default-libs`
  and `src/lib/server/tsDefaultLibs.ts` patches the shared `ts.sys` to
  serve them from memory (called by `handleCompile` before each compile).
  See `DEPLOYMENT.md` → "TypeScript default libs". Confirm `?script=
  ema-cross#demo` has a clean gutter after each deploy.
- **The compiler's `@invinite-org/chartlang-core` import is bundled in, not
  read from disk.** `compile()`'s esbuild `bundle: true` step inlines core
  by resolving the bare import against `node_modules`. The Netlify function
  inlines the workspace package into the server bundle but does NOT install
  it as a resolvable module, so esbuild fails with "Could not resolve
  @invinite-org/chartlang-core" and `/api/compile` 500s — a **blank chart
  with no gutter error**. Fix: `vite.config.ts`'s `chartlangCoreBundles()`
  plugin pre-bundles core (+ `/time`) into `virtual:chartlang-core-bundles`,
  and `src/lib/server/compile.ts` passes them via the compiler's
  `inMemoryModules` option. Verify `/api/compile` returns `ok:true` after
  each deploy (see `DEPLOYMENT.md` → "core import").
- **`ChartPane.tsx` feeds synthetic higher-timeframe streams for MTF
  scripts.** It reads `(artifact.manifest as ScriptManifest)
  .requestedIntervals`; when non-empty it wraps the main candle source in
  `createResamplingCandlePump` (`src/components/demo/secondaryStreams.ts`),
  which buckets the main bars **live** into each requested interval and
  weaves the secondary `close` events into the stream, so `request.security`
  scripts (e.g. `htf-trend-filter`) render real values instead of all-NaN.
  Resampling on the live source (not a one-shot resample of the static
  history) is what keeps the higher-timeframe series advancing once `Play`
  pushes fresh bars — a static resample froze the weekly line at the last
  historical bucket. The pump splits a `history` batch the same way the
  adapter's `createMultiStreamCandlePump` does (interleaving each secondary
  close at its rollover point) so the cap-1 secondary ring buffer never
  collapses the replay to its final bar; the in-progress bucket is not
  flushed (a week's close is only known once the next week opens). **Demo
  input bars carry NO `point` method** — `aggregateBucket` /
  `nextRandomBar` build plain serialisable bars cast to `Bar`, because the
  worker host streams every candle event through `postMessage` and a
  function is not structured-cloneable (it throws `DataCloneError`, which
  killed the renderer loop after the first secondary close — the
  "only one bar / flat weekly line" symptom); the runtime injects the real
  `point` on its own `BarView`, exactly as it does for the `point`-less
  `bars.json` history. When `requestedIntervals` is empty the pane keeps the
  plain single-source path byte-for-byte. The adapter is created with
  `interval: bars[0].interval` (`"1D"` for the demo data, the same as the
  adapter's `DEFAULT_INTERVAL`, so the non-MTF path is unchanged). NOTE: this only
  works because the host boot (`host-worker` `buildBundleFromModule` /
  `host-quickjs` `dispatcherCore`) adopts the compiler's `__manifest`
  sidecar for single-script modules — the runtime `defineIndicator` stub
  zeroes `requestedIntervals`, so without that fix the secondary streams
  would never register. The `htf-trend-filter` demo uses the
  `request.security` **expression form**
  (`request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20))`); the
  demo wiring keys off `requestedIntervals` (still `["1W"]`), and the new
  `manifest.securityExpressions` rides the SAME `__manifest` sidecar the host
  boot already spreads through — the SecurityExprRunner mounts off it
  automatically. The weekly line is a stair-step that lags the daily EMA (the
  EMA runs on the weekly clock) and keeps stepping live during `Play`.
- The server compile helper lives at `src/lib/server/compile.ts`;
  importing it from any `src/components/*` file would drag the compiler
  into the client graph. The route file is its only importer.
- **`compile.ts` feeds every catalogue example's source to the compiler as
  `inMemoryChartSources` so sibling cross-file/composition imports resolve.**
  The composition examples (`idiom-cross-file-import`, `idiom-with-inputs`,
  `trend-confirmation`) do `import baseTrend from "./base-trend.chart"`, which
  the single-source `/api/compile` route cannot read from disk — without the
  map they fail with `TS2307` + `dep-dynamic` and the chart pane stays blank.
  `handleCompile` builds `{ "./<id>.chart": DEMO_SCRIPTS[i].source }` from the
  generated `DEMO_SCRIPTS` and passes it to BOTH `createLanguageService` (so
  the editor gutter stays clean) and `compile` (so the producer inlines). This
  is the one place `compile.ts` imports `scripts.ts` — it stays pure data
  (re-exports the catalogue only), so it drags no esbuild/node into the graph.
  See `packages/compiler/CLAUDE.md` → `inMemoryChartSources`.
- **`src/components/demo/scripts.ts` (`DEMO_SCRIPTS`) is GENERATED — do not
  hand-edit it.** It carries the `AUTO-GENERATED by pnpm examples:generate`
  sentinel; the source of truth is `examples/catalogue.ts` (metadata) + each
  `examples/scripts/<id>.chart.ts` (the inlined `source`). `DemoScript` gained
  a `category` field, and `scripts.ts` re-exports `ExampleCategory` /
  `CATEGORY_LABELS` / `CATEGORY_ORDER` from the catalogue so consumers import
  one module. `scripts/gen-demo-scripts.ts` (folded into
  `pnpm examples:generate`) emits it; `docs/.vitepress/config.ts` imports the
  generated `DEMO_SCRIPTS` to build the Examples nav tab + sidebar live, and
  the same run renders `docs/examples/<id>.md` per entry — all gated by
  `pnpm examples:gate`. To add/rename an example or change a label /
  description, edit `examples/catalogue.ts` (+ the `.chart.ts` source), then
  re-run `pnpm examples:generate` and commit. `DemoBody.tsx` reads a
  `?script=<id>` query param to preselect a catalogue entry (the docs' "Try it
  live" deep-link, anchored `#demo`).
- **The converter route `/converter` (`ConverterBody.tsx`) reads AND writes
  `?script=<id>` so converter deep-links round-trip.** It reads the param on
  load (`initialScriptId`, falling back to the first `PINE_SCRIPTS` entry) and
  writes the resolved selection back via a module-private `syncConverterParam`
  (a local mirror of the demo's `syncDemoParam` — `history.replaceState`, no
  router nav, preserves pathname/hash/other params), called on each sample
  select and once on mount (seeding the URL so a bare/unknown `?script=`
  self-heals). The helper is a deliberate local copy — the two bodies stay
  self-contained and do NOT cross-import (`syncDemoParam` is module-private to
  `DemoBody`).
- **`tests/e2e/converter-examples.spec.ts` sweeps EVERY `PINE_SCRIPTS`
  entry** — the converter analogue of the demo e2e specs. It imports the
  catalogue (`src/components/converter/pineScripts.ts`, pure string data) and
  generates one test per sample via `for (const sample of PINE_SCRIPTS)`, so a
  new sample auto-covers with no spec edit. Each test deep-links
  `/converter?script=<id>`: non-`rejects` samples must convert (output shows
  a `define(Indicator|Drawing|Library)` entrypoint — `ta`/`plot` scripts
  lower to `defineIndicator`, the `drawings` category to `defineDrawing`),
  enable + click `button.compile-button`, render a
  non-empty `canvas.chart-canvas`, and end with `.compile-status.is-error`
  count `0`; `rejects` samples are asserted as refusals (a visible
  `.diagnostic.is-error` + a disabled `button.compile-button`, no click). No
  sample may fire a `pageerror` / `console.error` (the `trackErrors` guard,
  copied from `demo-adapters.spec.ts`).
- **Each `DEMO_SCRIPTS` `source` is inlined VERBATIM from its
  `examples/scripts/<id>.chart.ts` file** by the generator (the browser bundle
  can't read files), so the two homes are byte-exact by construction.
  `pnpm examples:sync` (`scripts/examples-sync-check.ts`, in CI + `pnpm check`)
  still token-compares each pair as a guardrail. To change a script's code,
  edit the `.chart.ts` file (NOT the inlined string), then re-run
  `pnpm examples:generate`. There are no longer any demo-only entries — every
  `DEMO_SCRIPTS` id has an on-disk `.chart.ts` and a catalogue entry.
- **The demo adapter driver layer dynamic-imports EVERY heavy lib —
  never statically.** `src/components/demo/adapters/` normalises the six
  example adapters behind one `DemoAdapterDriver` (`{ host, run(signal),
  dispose() }`) contract (`adapters/types.ts`); `adapters/registry.ts`'s
  `DEMO_ADAPTERS` lazily `import()`s each driver module, and each driver
  `import()`s its adapter package (and, for **echarts** + **konva**, the
  peer lib itself, because those adapters take an injected
  `echartsFactory` / `konva` surface rather than importing the lib —
  lightweight-charts / uplot import their lib internally and canvas2d /
  webgl are zero-dep raw renderers). A STATIC `import` of
  `echarts` / `konva` / `lightweight-charts` / `uplot` or any
  `chartlang-example-*-adapter` package anywhere in `src/` would bloat the
  client chunk AND pull DOM-only lib code into the `ssr` build (the demo
  is reached only through the client-only, lazy `DemoBody`→`ChartPane`
  path). Verified: a static heavy-lib import makes the lib appear as a
  large chunk under `dist/server/assets/`; with the dynamic imports the
  SSR side carries only the ~1KB driver wrappers and the real lib lands in
  client chunks. The only permitted static references are `import type`
  (`EChartsSurface` / `KonvaNamespace`, erased by `verbatimModuleSyntax`).
  Do **not** add these libs to `optimizeDeps.exclude`.
- **`echarts.init(...)` / `konva.default` are narrowed `as unknown as
  <seam>` at exactly one point each.** The real `EChartsType`
  `convertToPixel` overload (value incl. `Date`) and Konva's
  `StageConfig.container` (`string | HTMLDivElement`) are not structurally
  assignable to the adapters' narrower `EChartsSurface` / `KonvaNamespace`
  seams under `exactOptionalPropertyTypes`; the narrowing lives in the
  echarts / konva driver factory bodies with a `why` comment. Keep it to
  that one seam — do not widen the adapter seams to absorb the lib types.
- **canvas2d's driver builds its inner `<canvas class="chart-canvas">`.**
  `landing.spec.ts` targets `canvas.chart-canvas` and reads its bitmap, so
  the canvas2d driver must keep that class on the canvas it creates inside
  the mount element. Because `DEFAULT_ADAPTER_ID` is now `webgl` (whose
  `toDataURL()` returns a constant blank image without
  `preserveDrawingBuffer`, making the recompile bitmap-change assertion
  unreadable), `landing.spec.ts` **pins canvas2d via the `?adapter=canvas2d`
  deep-link** — the bitmap readback only works on a 2D canvas. Every
  adapter's render is still covered by `demo-adapters.spec.ts`.
- **`DEMO_ADAPTERS` ids mirror `scripts/adapters/registry.ts`
  `ADAPTERS[].id`** (`canvas2d`, `echarts`, `konva`, `lightweight-charts`,
  `uplot`, `webgl`). The list is deliberately NOT imported from `scripts/` (avoids
  an app→`scripts` bundling dependency); a maintenance comment in
  `adapters/registry.ts` records that adding/removing an adapter means
  updating BOTH lists.
- **Every driver `dispose()` is idempotent and empties `mountEl`**
  (`mountEl.replaceChildren()`) after one `handle.dispose()`, so switching
  adapters leaves no orphan canvas/svg/stage behind.

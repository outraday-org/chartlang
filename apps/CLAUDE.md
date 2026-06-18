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
  .requestedIntervals`; when non-empty it resamples the main `bars` into
  each requested interval via `buildSecondaryStreams`
  (`src/components/demo/secondaryStreams.ts`) and routes both through
  `createMultiStreamCandlePump`, so `request.security` scripts (e.g.
  `htf-trend-filter`) render real values instead of all-NaN. When
  `requestedIntervals` is empty the pane keeps the plain single-source
  path byte-for-byte. The adapter is created with `interval:
  bars[0].interval` (`"1D"` for the demo data, the same as the adapter's
  `DEFAULT_INTERVAL`, so the non-MTF path is unchanged). NOTE: this only
  works because the host boot (`host-worker` `buildBundleFromModule` /
  `host-quickjs` `dispatcherCore`) adopts the compiler's `__manifest`
  sidecar for single-script modules — the runtime `defineIndicator` stub
  zeroes `requestedIntervals`, so without that fix the secondary streams
  would never register.
- The server compile helper lives at `src/lib/server/compile.ts`;
  importing it from any `src/components/*` file would drag the compiler
  into the client graph. The route file is its only importer.
- **`src/components/demo/scripts.ts` (`DEMO_SCRIPTS`) is also the source
  of truth for the docs Examples section.** `docs/.vitepress/config.ts`
  imports it to build the Examples nav tab + sidebar live, and
  `scripts/gen-examples-docs.ts` (`pnpm examples:generate`) renders one
  `docs/examples/<id>.md` per entry — gated by `pnpm examples:gate`. After
  editing `DEMO_SCRIPTS` (adding/renaming an example, changing a `label`,
  `description`, or `source`), re-run `pnpm examples:generate` and commit
  the regenerated pages, or the gate fails. `DemoBody.tsx` reads a
  `?script=<id>` query param to preselect a catalogue entry, which is how
  the docs' "Try it live" links deep-link into the demo (anchored `#demo`).

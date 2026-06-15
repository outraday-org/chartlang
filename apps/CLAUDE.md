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
- **`esbuild` and `typescript` are external in the `ssr` build.**
  esbuild's JS API cannot be bundled (it finds its native binary relative
  to its own package, throwing "`__filename` is not defined" once bundled
  into an ESM server file). `typescript` must stay external too: the
  language service's `compileToDiagnostics` builds an in-memory
  `ts.Program` whose default lib (`lib.es2022.d.ts`) is read from disk at
  runtime via `ts.sys.getExecutingFilePath()` → `node_modules/typescript/
  lib`. If the function bundler inlines `typescript`, that path misses the
  lib dir; with `skipLibCheck` the failure is silent and the ambient core
  shim's `Readonly`/`Record` collapse to `any`, so every valid
  `compute({ bar, ta, … })` destructure trips noImplicitAny (TS7031) on
  the deployed site (dev, with lib on disk, is fine). Both are listed in
  `environments.ssr.build.rollupOptions.external` and are explicit
  `apps/site` devDependencies so the function runtime resolves them from
  `node_modules`. `netlify/site.toml` records the matching
  `external_node_modules = ["esbuild", "typescript"]`, but that file is
  not currently read by Netlify (see `DEPLOYMENT.md` → "Open: consolidate
  config"); verify `/api/compile` after each deploy.
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

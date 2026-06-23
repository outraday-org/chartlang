# apps/react-starter/

`chartlang-react-starter` — the private, clonable TanStack Start starter
that `@invinite-org/create-chartlang` clones for `npm create @invinite-org/chartlang@latest`. Stock
shadcn Base UI **default (neutral)** theme; dev on port **3100**.

See `apps/CLAUDE.md` for the apps-wide rules (Biome/coverage/changeset/
readme exemptions, DOM globals allowed, MIT header on committed `.ts`/
`.tsx`, e2e via Playwright). The brand-relaxation exception (no
`brand/brand.css`, no `b0` preset, neutral tokens only) is documented
there and in `README.md`.

## Compiler-coexistence invariants (ported from `apps/site/`)

The starter runs the **real chartlang compiler** in the `/api/compile`
server route while keeping the language service browser-importable. These
build-config invariants make that coexist — break one and `/api/compile`
500s, the client bundle fails to load, or compiles "succeed" with empty
emissions. They are ported byte-faithfully from `apps/site/vite.config.ts`
(the Netlify-specific config is dropped; the starter targets local Node
dev/preview):

1. **Client-only stub aliases.** `esbuild` + the touched `node:*`
   builtins are redirected to `src/lib/browser-stubs/` by the
   `clientBrowserStubs()` Vite plugin, gated on
   `applyToEnvironment(env => env.name === "client")`. It must **not** be
   a plain top-level `resolve.alias` — that would also neuter the `ssr`
   graph the real compiler needs, so `/api/compile` would return stub
   output and every compile would "succeed" with empty emissions.
2. **`esbuild` external in the `ssr` build.**
   `environments.ssr.build.rollupOptions.external: ["esbuild"]` +
   `optimizeDeps.exclude: ["esbuild"]`, and `esbuild` is an explicit
   devDependency so the Node dev/preview server resolves it from
   `node_modules`. esbuild's native-binary launcher cannot be bundled.
3. **`tsDefaultLibs()` plugin** embeds the ES `lib.*.d.ts` closure as
   `virtual:ts-default-libs`; `src/lib/server/tsDefaultLibs.ts` patches
   `ts.sys` to serve them from memory before each compile.
4. **`chartlangCoreBundles()` plugin** pre-bundles
   `@invinite-org/chartlang-core` (+ `/time`) into
   `virtual:chartlang-core-bundles`, consumed by `compile.ts`'s
   `inMemoryModules`. Without it the compiler's esbuild step cannot
   resolve core and `/api/compile` 500s (blank chart, no gutter error).

## Server-only compile path

- `src/lib/server/compile.ts` (`handleCompile`) imports the compiler +
  language service, which pull in `esbuild`/`node:*`. Its **only** importer
  is `src/routes/api/compile.ts`; importing it from any `src/components/*`
  file would drag the compiler into the client graph.
- `/api/compile` POST contract:
  `{ source: string }` → `{ ok: true, moduleSource, manifest, diagnostics }`
  for a valid script, `{ ok: false, diagnostics }` for a compile error,
  400 on a malformed body, 500 if the compiler throws a non-`CompileError`.
  Sources over **64 KiB** return `ok:false` with empty diagnostics (not a
  500). Tasks 5 and 6 consume this triple.
- **Origin allow-list is intentionally local-only:** same-origin (match
  the request `host`) + missing-Origin (curl) are allowed; no chartlang
  production host is hardcoded. A deployer behind a fixed domain should
  tighten `isAllowedOrigin` in `src/routes/api/compile.ts`.

## SQLite persistence (Drizzle + better-sqlite3)

A single-file SQLite DB (`data/starter.db`, git-ignored) stores saved
scripts. Drizzle gives the typed schema + migrations.

- **`data/` MUST be excluded from Vite's dev watcher.**
  `vite.config.ts` sets `server.watch.ignored` to ignore `**/data/**` +
  `**/*.db*`. The DB is written on boot (seed), symbol load (daily-bar
  cache), and save; `data/` sits inside the project, so without
  this every write trips Vite's watcher and triggers a **full page reload** —
  which, mid-search, closes the symbol dialog and reads as the page refreshing
  on every keystroke. Do not remove it.
- **The DB layer is server-only by import boundary, not by a stub.**
  `src/lib/server/db/{index,schema,scripts,seed}.ts` import
  `better-sqlite3` (a native addon). They are reached **only** through the
  `src/routes/api/scripts.ts` (`server.handlers`) route, which TanStack
  Start keeps in the server bundle — that is what keeps the native module
  out of the client graph. This task does **not** rely on Task 2's
  client-only `esbuild`/`node:*` stub aliases. **Never** import
  `src/lib/server/db/*` from a component; the UI uses
  `src/lib/scriptsClient.ts` (browser-safe typed `fetch` wrappers + the
  `ScriptMeta` / `ScriptRecord` DTOs).
- **The client is a lazy singleton with auto-migrate-on-first-open.**
  `getDb()` (`src/lib/server/db/index.ts`) `mkdir -p`s the DB dir, opens
  one `better-sqlite3` handle, sets `pragma journal_mode = WAL` (so dev +
  e2e read concurrently), runs `migrate()` against
  `src/lib/server/db/migrations` (resolved relative to the module via
  `import.meta.url`, so the built bundle finds it), then seeds one starter
  script if `scripts` is empty. A fresh clone needs **no** manual
  `db:migrate`. `db:generate` / `db:migrate` (drizzle-kit, `drizzle.config.ts`)
  are only for authoring/applying migrations out-of-band.
- **`DATABASE_URL`** (`.env`, default `file:./data/starter.db`) accepts a
  bare path or a `file:`-prefixed URL; the `file:` prefix is stripped for
  better-sqlite3.
- **Schema (`src/lib/server/db/schema.ts`) is whole-app.** `scripts` and
  `eod_cache` (pk `[symbol, range_key]`) are the live tables — one
  migration set covers the saved scripts plus the daily-bar read-through
  cache. The baseline migration also created a legacy `api_usage` table
  for an earlier metered data source; the Yahoo source is unmetered, so the
  app no longer reads or writes it and it is intentionally absent from the
  schema (harmlessly left in any existing DB).
- **Source cap mirrors the compile cap.** `saveScript` rejects sources
  over **64 KiB** (`InvalidScriptError` → 400 at the route), matching
  `src/lib/server/compile.ts`'s `MAX_SOURCE_LENGTH`.
- **`/api/scripts` contract.** `GET` → `{ scripts: ScriptMeta[] }` (no
  `source`). `POST { op, ... }`: `op:"get"` → `{ script | null }`,
  `op:"save"` (omit `id` to create) → `{ script }`, `op:"rename"` →
  `{ script | null }`, `op:"delete"` → `{ deleted: boolean }`. Validation
  failures are 400, unexpected errors 500. `Date` columns serialize as ISO
  strings; `scriptsClient.ts` revives them.

## Daily-bar source (server-only Yahoo Finance fetch + cache)

The market-data layer (`src/lib/server/eod/{types,nasdaq,yahoo,stooq,cache}.ts`,
exposed via `/api/eod`) loads daily US bars from a **chain of free, key-less
sources**: **Nasdaq's public quote API** (primary) → **Yahoo Finance** → **Stooq**
CSV. No API key, no per-day quota, so a fresh clone loads real data with zero
setup. Nasdaq leads because Yahoo and Stooq now aggressively WAF / bot-wall many
data-centre AND residential IPs (HTTP 429 / JS challenge), whereas Nasdaq still
answers a plain server fetch; Yahoo + Stooq remain as fallbacks for the cases
Nasdaq can't serve. Each source returns ~5 years of daily OHLCV. (The previous
EODData free tier returned only ~20 daily bars and paywalled deeper history,
which starved long-warmup indicators.)
Like the db layer it is **server-only by import boundary**: only
`src/routes/api/eod.ts` imports `src/lib/server/eod/*`, which keeps the native
db driver out of the client bundle. Components use `src/lib/eodClient.ts`
(browser-safe typed `fetch`: `loadSymbol` + the `LoadedSymbol` DTO) —
**never** `src/lib/server/*`.

- **`/api/eod` POST contract:** one op, `{ op:"load", symbol }` →
  `{ bars, source }` where `source` is `"cache" | "network"`. There is no
  "search" or "usage" op (no quota to report). A bad/unknown symbol →
  `InvalidSymbolError` → **400**; an upstream network/non-2xx/malformed-body
  failure → `MarketDataError` → **502**.
- **The Nasdaq fetch (`nasdaq.ts`, PRIMARY).** `GET {NASDAQ_BASE_URL}/api/quote/
  {ticker}/historical?assetclass={stocks|etf}&fromdate=&todate=&limit=9999`
  (5-year window), default host `https://api.nasdaq.com`; `NASDAQ_BASE_URL` is a
  test-only override. Nasdaq keys history by `assetclass`, so we try `stocks`
  then `etf` before declaring a symbol unknown (`data:null` + a "Symbol not
  exists." status on BOTH classes → `InvalidSymbolError`). Sends a browser-shaped
  request (UA + `accept`/`accept-language`/`referer`). Rows arrive newest-first
  with `$`/comma-formatted numbers and `MM/DD/YYYY` dates; the layer strips the
  formatting, pins each bar to **00:00 UTC**, and returns ascending. Any
  network / non-2xx / malformed / empty result → `MarketDataError` (the chain
  then advances to Yahoo).
- **The Yahoo fetch (`yahoo.ts`).** `GET {YAHOO_BASE_URL}/v8/finance/chart/{ticker}
  ?range=5y&interval=1d`, default host `https://query1.finance.yahoo.com`.
  `YAHOO_BASE_URL` is an env override used **only** by the e2e mock — do NOT
  document it for users. Yahoo 403s/429s a non-browser User-Agent, so the
  fetch sends a desktop UA; it retries 429s a few times with **escalating**
  backoff (1.5s/3s/4.5s, `retry-after` honoured). A 404 (or a `Not Found` chart
  error) → `InvalidSymbolError`. The ticker is validated against a US-ticker
  regex **before** any fetch, so a bad symbol never hits the network. Yahoo
  stamps are epoch **seconds** (the layer ×1000 to ms); `null` OHLC rows (holiday
  / halted) are skipped; bars are returned ascending by time.
- **Cookie + crumb session (`yahoo.ts`, best-effort).** Yahoo increasingly
  WAF-throttles cookie-less callers with 429, so the fetch first builds a
  per-process session: seed a cookie from `https://fc.yahoo.com`, exchange it for
  a crumb at `{DEFAULT host}/v1/test/getcrumb`, then send the `Cookie` header +
  `&crumb=`. It is **best-effort** — any handshake failure falls through to a
  plain request (never worse than before) — and **skipped when `YAHOO_BASE_URL`
  is set** (the mock implements only the chart endpoint). A 401 rebuilds the
  session once and retries. NOTE: a *hard* IP ban (data-centre / VPN ranges)
  429s even the crumb endpoint, which no handshake can bypass — that is why
  Nasdaq leads the chain and Stooq trails it.
- **The Stooq fallback (`stooq.ts`, LAST resort).** Reached only when BOTH Nasdaq
  and Yahoo fail with `MarketDataError`. `GET {STOOQ_BASE_URL}/q/d/l/?s=
  {ticker}.us&i=d&d1=&d2=` (5-year window), default host `https://stooq.com`;
  `STOOQ_BASE_URL` is a test-only override. chartlang ticker → Stooq symbol
  lower-cases and hyphenates dots (BRK.B → `brk-b.us`). It parses the
  `Date,Open,High,Low,Close,Volume` CSV; daily rows have no intra-day stamp so
  `time` is the date at **00:00 UTC**. A bot-wall HTML page (Stooq serves one to
  some data-centre IPs) or an empty/`N/D` result → `MarketDataError`. Stooq never
  emits `InvalidSymbolError`. All real-network sources are **dropped when
  `YAHOO_BASE_URL` is set** so the mocked-Yahoo e2e stays hermetic; the Nasdaq +
  Stooq sources therefore have no e2e coverage — both emit the same
  serialisable-`Bar` shape as `yahoo.ts`.
- **Cache key (one `eod_cache` row each):** `(SYMBOL, "daily:max")` holds the
  symbol's full daily `Bar[]` (TTL 24h). A fresh-cache hit returns
  `source:"cache"` with no network call; whichever source (Nasdaq, Yahoo, or
  Stooq) succeeds is stored as `source:"network"`. If **all** sources fail the
  layer falls back to a **stale** cache if one exists; only when there is no cache
  at all does it throw a `MarketDataError` whose message **aggregates every source's
  failure** (e.g. `No market data for AAPL — Yahoo responded 429 …; Stooq …`) and
  logs the same line via `console.warn`, so a multi-source outage is diagnosable
  from the toast alone. There is no synthetic symbol-index row (no search op) and
  no `api_usage` table.
- **Cached bars carry NO `point` method.** They round-trip through SQLite JSON
  AND stream to the worker host via `postMessage` (a function is not
  structured-cloneable → `DataCloneError`); the runtime injects the real
  `point` on its own `BarView`. Both `fetchDailyBars` (Yahoo) and
  `fetchDailyBarsStooq` compute the four derived fields
  (`hl2`/`hlc3`/`ohlc4`/`hlcc4`) inline and cast `as Bar`, exactly like the
  apps/site `aggregateBucket` invariant.

## Chart adapter seam (the single swappable module)

The chart renders through ONE swappable module — `src/lib/chart/activeAdapter.ts`,
default **canvas2d**. It is the **only** file in the app that names a concrete
`chartlang-example-*-adapter` (plus the npm chart lib). Everything else —
`ChartPane` especially — drives charts through the abstract surface it exports:
`createActiveAdapter({ container, candleSource, interval?, onAlert? })`,
`runActiveLoop(handle, { signal })`, `ActiveAdapterHandle`, `ACTIVE_ADAPTER_ID`.

- **`ChartPane` (and any component) MUST NEVER import a concrete adapter.**
  It imports only `@/lib/chart/activeAdapter`. The per-library factory
  differences are normalised behind `CreateAdapterOpts` (a generic
  `container: HTMLElement`) so the pane is adapter-agnostic. The render loop
  is per-library (echarts `runEChartsLoop`, canvas2d/lwc `runRendererLoop`,
  uplot `runUplotLoop`, konva has none — a local loop over `feedCandleEvent`),
  so the seam wraps it as `runActiveLoop`; the pane never names a loop.
- **The stream plumbing is local + seam-clean.**
  `src/components/workspace/streamPump.ts` (`createPushCandleSource`) and
  `secondaryStreams.ts` (`createResamplingCandlePump`, the MTF resample) are
  ported LOCAL helpers — they import only adapter-kit/core types, never a
  concrete adapter. MTF scripts (`manifest.requestedIntervals` non-empty)
  route the push source through `createResamplingCandlePump`. The Yahoo
  source is daily-only, so daily is the resample floor — sub-daily requested
  intervals yield NaN.
- **`src/lib/chart/seamVariants.ts` is the seam SSOT.** `SEAM_VARIANTS` holds
  one entry per bundled id (`canvas2d`, `lightweight-charts`, `uplot`,
  `echarts`, `konva`), each carrying the FULL `activeAdapter.ts` body for that
  library. The committed `activeAdapter.ts` **equals `SEAM_VARIANTS.canvas2d`'s
  `seamSource` verbatim** — `tests/adapter-matrix.spec.ts` asserts the
  byte-identity. The `create-chartlang` installer (Task 7) rewrites ONLY
  `activeAdapter.ts` (to the chosen variant) + the one runtime dep in
  `package.json`; its `seamTemplates.ts` must emit bodies byte-identical to
  these (after the `workspace:*` → published-version substitution). Edit a
  library's seam **here**, never by forking a copy.
- **Deps:** runtime dep is canvas2d-only (`chartlang-example-canvas2d-adapter`,
  which needs no npm chart lib); the other four adapters + their npm libs
  (`echarts`, `lightweight-charts`, `uplot`, `konva`) are **devDependencies** so
  the matrix runs in-monorepo with zero network. Adapters resolve to their built
  `dist/`, so the five example adapters (and the workspace packages they depend
  on) must be built before the app typechecks/builds/e2e-tests against them.
- **echarts mount quirk:** echarts takes `echartsFactory: () => echarts.init(
  container)`, NOT a raw container, so this seam owns the `echarts.init` call.
  The real instance's `convertToPixel` THROWS before its first laid-out
  `setOption` (the adapter's `buildViewport` expects it to return `undefined`
  pre-layout), so the seam wraps the instance to swallow that throw — without
  it the first render-loop drain kills the chart with a blank container.

## Workspace page (editor ↔ compile ↔ chart ↔ eod ↔ scripts)

`src/routes/index.tsx` is the assembled workspace; the panes live under
`src/components/workspace/`. The wiring has a few non-obvious invariants:

- **Compile is driven by the editor's linter, not a hand-rolled debounce.**
  `EditorPane` injects the hybrid service (`hybridLanguageService.ts`); the
  editor's built-in `linterExtension` calls `service.compileToDiagnostics`
  on its own debounce, which POSTs `/api/compile` and — via the observer
  side-channel — hands the fresh `{ moduleSource, manifest }` to the page.
  So **editing → debounced compile → artifact → chart** needs no extra
  debounce. The React `<ChartlangEditor>` wrapper does **not** expose
  `lintDebounceMs`, so the debounce stays at the editor default.
- **The editor FOLLOWS the app's shadcn light/dark mode.** `EditorPane.tsx`
  composes `chartlangDark` (from the editor package) in dark mode and the
  starter-local `chartlangLight` (`src/components/workspace/editorTheme.ts`) in
  light mode. The editor package ships only the dark theme, so the light
  variant lives in the starter — built from the same CodeMirror primitives
  (`@codemirror/{language,state,view}` + `@lezer/highlight`, pinned `^6`/`^1`
  so they dedupe to the editor's single `@codemirror/state` instance; a second
  copy makes CodeMirror reject the extension at mount). The React
  `<ChartlangEditor>` reads `extensions` only at MOUNT, so `index.tsx` folds
  the resolved theme into the editor `key` (`${editorKey}-${editorTheme}`) to
  remount on a toggle; since `index.tsx` passes the live buffer as
  `initialSource`, the remount preserves the user's edits. The `.cm-editor
  { height: 100% }` rule in `src/styles.css` fills the flex pane.
- **Theme switch is next-themes, wired in `__root.tsx`.** A `<ThemeProvider
  attribute="class" storageKey="theme">` wraps the body; the header's
  `ThemeToggle` (`src/components/theme/ThemeToggle.tsx`, top-right) drives it,
  and `sonner` + the editor read the same `useTheme()`. The `THEME_INIT` head
  script is a no-flash bootstrap that mirrors next-themes' class resolution
  ("dark"/"light" explicit, "system"/absent → OS preference). The toggle
  renders a neutral placeholder until mounted to avoid a hydration mismatch.
- **Typing must never re-fetch market data.** `bars` changes only on a
  symbol pick (`loadSymbol`); `artifact` changes only on a compile. They are
  separate state, and `ChartPane`'s effect keys on `[artifact, bars]`. Keep
  them decoupled — coupling them would re-hit Yahoo (or the cache) on every
  keystroke.
- **Last-good artifact is retained on a failing compile.** The observer
  calls `setArtifact(next)` ONLY when `next !== null`, so a compile error
  updates the status line + gutter but leaves the chart rendered.
- **The seed script has `symbol: null`** (`server/db/seed.ts`), so boot
  loads the seed source + compiles it but shows "Pick a symbol" until the
  user picks one. Loading a *saved* script with a non-null symbol
  auto-`loadSymbol`s it.
- **No concrete adapter is named anywhere in `components/workspace/`** — the
  pane drives the `@/lib/chart/activeAdapter` seam. Task 7's installer
  clones this tree, so the seam must stay the single point of adapter
  coupling.

## e2e

Playwright (`tests/`, `playwright.config.ts`) builds + previews on port
**3101** (so it can run alongside `dev` on 3100). `tests/compile.spec.ts`
POSTs directly to `/api/compile` (good / broken / oversized) — Task 2 ships
only the route; the editor/chart UI lands in later tasks.
`tests/scripts.spec.ts` POSTs to `/api/scripts` (seed exists, save/list/get
round-trip, rename, delete, oversized-400) — Task 3's persistence layer.
`tests/eod.spec.ts` POSTs to `/api/eod` — the market-data layer. Because the
app's Yahoo fetch is **server-side** (Playwright browser route-mocking can't
intercept it), the suite runs a mock Yahoo Finance chart server
(`tests/eodMockServer.ts`, via `tsx`) as a **second** `webServer` and points
the app at it with `env: { YAHOO_BASE_URL, DATABASE_URL: "file:./data/e2e.db" }`.
The mock implements the one endpoint the layer calls —
`GET /v8/finance/chart/{ticker}?range=5y&interval=1d` — returning Yahoo's
documented JSON shape with deterministic fixtures, and 404s unknown tickers
(so the layer throws `InvalidSymbolError` → 400). `globalSetup`
(`tests/eodGlobalSetup.ts`) wipes the dedicated e2e DB so the cache starts
clean, making the `source:"network"`→`"cache"` sequence deterministic. There
is no quota to budget against — Yahoo is unmetered.
`tests/chart.spec.ts` drives the test-only `/test/chart` harness route
(`src/routes/test.chart.tsx`, which mounts `ChartPane` standalone until Task 6
wires it into `/`): it compiles a seed script through `/api/compile` and
asserts the canvas2d chart paints a `<canvas>` + an alert surfaces as a toast.
`tests/adapter-matrix.spec.ts` proves the seam is interchangeable — for each
`SEAM_VARIANTS` entry it swaps `activeAdapter.ts` and runs `vite build` into a
throwaway out dir (so the served `dist` is untouched), asserting every library
bundles through the seam; it runs **serially** and restores canvas2d in
`afterAll` (it mutates a shared source file, so it must not run in parallel
with anything reading `activeAdapter.ts`).
`tests/workspace.spec.ts` (Task 6) drives the real `/` workspace: seed visible
+ compiled, symbol pick → chart `<canvas>`, edit re-compiles with **no**
market-data fetch, save round-trips into the sidebar. It **mocks `/api/eod` at
the BROWSER level** (`page.route`) — the symbol picker calls `/api/eod` from
the browser via `eodClient`, so the route IS interceptable, which keeps this
spec OFF the shared `data/e2e.db` cache that the serial `eod.spec.ts` asserts
against while running in parallel. The saved script uses a unique name and is
deleted at the end so the shared `scripts` table is left as found (don't assert
global script counts from this spec).

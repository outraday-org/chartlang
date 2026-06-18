# react-starter — clonable chartlang app + `create-chartlang` installer

## 1. Overview

This feature ships **`apps/react-starter/`** — a private, TanStack Start
application that is the "write your own chartlang scripts" starter: a
CodeMirror editor on the left, a live chart on the right, a symbol
picker fed by **EODData** (free tier, daily EOD, US symbols), and a
**SQLite** (Drizzle + better-sqlite3) store for saving/loading scripts.
It mirrors `apps/site/`'s embedded-demo architecture (real compiler in a
`/api/compile` server route, the chosen library adapter + its worker
host on the client) but is a standalone product the user clones and
extends — **not** the chartlang landing site.

A second deliverable, **`packages/create-chartlang/`** (published as
`create-chartlang`), is the `npm create chartlang@latest` installer. It
`giget`-clones `apps/react-starter/` from GitHub, prompts the user to
choose a chart library (default **echarts**), vendors the chosen
adapter into the project via the **`add-adapter` bundle machinery from
the multi-library-adapters feature** (Task 14 there), rewrites the
single swappable adapter module + `package.json`, and writes a `.env`
with the EODData key.

**Hard constraints, per the user brief:**

- **shadcn Base UI _default_ theme** — the plain shadcn/Base UI palette
  and primitives, **NOT** the chartlang `brand/` tokens or the site's
  `b0` brand preset. The starter must look like a neutral shadcn app so
  the user re-themes it themselves.
- **No chartlang CI / gates inside the cloned output.** `apps/*` is
  already exempt from the coverage / readme / changeset / Biome gates
  (`apps/CLAUDE.md`); the starter carries no `.changeset`, no repo CI
  workflow, no `CLAUDE.md` maintenance contract in its shipped tree.
- **Daily EOD only, US symbols only, 100 calls/day.** The EODData layer
  must cache aggressively in SQLite and count daily usage so a casual
  user never blows the free quota on a refresh.

This tasklist **assumes `tasks/multi-library-adapters/` is already
implemented** — all five example adapters (canvas2d, lightweight-charts,
uplot, echarts, konva) exist and conformance-green, the
`@invinite-org/chartlang-adapter-kit` geometry layer is in place, and
the CLI `add-adapter` bundle generator (`pnpm adapters:generate`,
`BUNDLED_ADAPTERS`, `packages/cli/src/generated/adapters/**`) exists.

> **⚠ Execution blocker (as of validation 2026-06-18):**
> `tasks/multi-library-adapters/` is **0/15 implemented** — all 15 tasks
> are TODO. Today only `examples/canvas2d-adapter` exists; there is **no**
> `chartlang-example-echarts-adapter`, no adapter-kit geometry layer, no
> `add-adapter` command, no `BUNDLED_ADAPTERS`, and no
> `packages/cli/src/generated/adapters/**`. Tasks 5 and 7 here cannot run
> until that feature lands. This is intentional sequencing (react-starter
> is designed to come **after** multi-library-adapters), not a defect in
> these task files — but do not start execution until the prerequisite is
> green. The naming/contracts referenced in Tasks 5/7
> (`createEChartsAdapter`, `EChartsAdapterHandle`,
> `chartlang-example-echarts-adapter`, `BUNDLED_ADAPTERS`,
> `chartlang add-adapter <id> [dir]`) are matched to that feature's
> current task specs and must be re-verified against its real output once
> it is built.

## 2. Current State

- **`apps/site/`** (`chartlang-site`, private, TanStack Start + shadcn
  `b0` brand preset) is the only app. Its embedded demo
  (`src/components/demo/`) is the architecture to mirror:
  - `routes/api/compile.ts` + `src/lib/server/compile.ts` — the real
    compiler behind a server route returning
    `{ ok, moduleSource, manifest, diagnostics }`.
  - `vite.config.ts` — the four compiler-coexistence invariants
    documented in `apps/CLAUDE.md`: SSR adapter required, **client-only**
    stub aliases (`esbuild` + `node:*` → `src/lib/browser-stubs/`),
    `esbuild` external in the `ssr` build, `tsDefaultLibs()` +
    `chartlangCoreBundles()` virtual-module plugins.
  - `EditorPane.tsx` — `<ChartlangEditor>` from
    `@invinite-org/chartlang-editor/react` with a hybrid language
    service (`compileToDiagnostics` proxied to `/api/compile`).
  - `ChartPane.tsx` — `createCanvas2dAdapter({ canvas, candleSource, … })`,
    `await adapter.host.load(compiled)`, `runRendererLoop`, the
    push-candle source + MTF `createMultiStreamCandlePump` path.
- **`packages/editor/`** (`@invinite-org/chartlang-editor`, public)
  exports `ChartlangEditor` (`./react`) and the `chartlangDark` theme.
  `createLanguageService` lives in
  `@invinite-org/chartlang-language-service` (the editor re-uses it; the
  hybrid service is built from the language-service package).
- **Adapters** — every `examples/*-adapter/` exposes
  `createXAdapter({ … }): Adapter & { host: ScriptHost }`; the host's
  `load(compiled)` + the candle source drive emission → render.
- **`packages/cli/`** — `add-adapter <id> <dir>` writes a complete,
  workspace-dep-rewritten adapter from `BUNDLED_ADAPTERS`
  (`packages/cli/src/generated/adapters/**`), offline.
- **No SQLite, no EODData, no installer** anywhere in the repo.
- `apps/CLAUDE.md` records: apps are exempt from coverage / readme /
  changeset / Biome / vitest-workspace gates; DOM globals allowed;
  no §22.4 scaffold; e2e via Playwright under `apps/<app>/tests/`.

## 3. Target State

### `apps/react-starter/` (new, private)

```
apps/react-starter/
  components.json            # shadcn — base preset, default neutral palette
  vite.config.ts             # the 4 compiler invariants, ported from site
  drizzle.config.ts
  .env.example               # EODDATA_API_KEY=, DATABASE_URL=file:./data/starter.db
  src/
    routes/
      __root.tsx             # neutral shadcn shell (no brand assets)
      index.tsx              # the editor + chart workspace
      api/compile.ts         # real compiler server route (ported)
      api/scripts.ts         # (or server fns) saved-script CRUD
      api/eod.ts             # symbol search + daily EOD fetch (server-only)
    lib/
      server/compile.ts      # ported handleCompile
      server/db/             # drizzle client + schema + migrations
      server/eod/            # EODData client + cache + quota
      browser-stubs/         # esbuild + node:* client stubs (ported)
      chart/activeAdapter.ts # THE swappable adapter module (default echarts)
    components/
      workspace/             # EditorPane, ChartPane, SymbolPicker, ScriptsSidebar
      ui/                    # shadcn base-ui primitives (default theme)
```

### `packages/create-chartlang/` (new, published `create-chartlang`)

`npm create chartlang@latest my-app` → clone starter → choose library →
vendor adapter → write `.env` → print next steps.

### Capability / gate deltas

- No new chartlang capability keys (rendering/runtime unchanged).
- New published package `create-chartlang` ⇒ a **changeset** + JSDoc
  gate + 100% coverage on `packages/create-chartlang/` only.
- `apps/react-starter/` adds **no** coverage/readme/changeset gate (it is
  `apps/*`); it adds Playwright e2e under `apps/react-starter/tests/`.
- Root `README.md` + `docs/` + the `skills/chartlang-setup` reference
  gain the starter (repo-root skill-mirroring rule).

## 4. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Lives in `apps/`, not `examples/`** | It is a private, framework-scaffolded application that consumes `@invinite-org/chartlang-*`, exactly the `apps/` definition. `examples/*` are headless, conformance-gated adapters — a full Vite app does not fit that net. (`apps/CLAUDE.md`) |
| **shadcn Base UI _default_ palette, not chartlang brand** | The user explicitly wants a neutral starter they re-theme. The starter must NOT `@import` `brand/brand.css` nor use the site's `b0` preset — that is the one visual rule the `brand/` SSOT contract is relaxed for, because this tree is the user's, not "the product". |
| **Drizzle + better-sqlite3** | Type-safe schema + migrations; the synchronous driver runs cleanly inside TanStack Start server functions / route handlers. One file DB (`file:./data/starter.db`) — zero infra for a local starter. |
| **SQLite stores scripts AND caches EOD + counts quota** | The free tier is 100 calls/day. Caching every fetched `(symbol, range)` and incrementing a per-UTC-day counter makes a re-open / re-compile cost zero API calls and protects the user from accidentally exhausting the quota. |
| **Compile via a server route, never in the browser** | Identical to `apps/site`: the compiler pulls `esbuild` + `node:*`. The client keeps the browser stubs; the only real-compiler path is `/api/compile`. The four `vite.config.ts` invariants are ported verbatim. |
| **One swappable adapter module (`src/lib/chart/activeAdapter.ts`)** | The committed starter defaults to `chartlang-example-echarts-adapter`. The installer rewrites this single re-export module (+ the matching `package.json` dep) to the chosen library, so the chart code never names a concrete adapter. |
| **Installer = `giget` clone + reuse of `add-adapter` bundles** | This tasklist comes after multi-library-adapters precisely so `create-chartlang` can vendor the chosen adapter from the CLI's offline `BUNDLED_ADAPTERS` rather than re-implementing adapter copying. Clone is network (normal for `create-*`); the adapter bundle is offline-baked. |
| **`create-chartlang` is a published package; starter is private** | The installer must be `npm create`-able; the starter is cloned by ref, not installed from npm (its `workspace:*` deps would not resolve). The installer rewrites those deps on clone. |
| **Default echarts** | Per the brief — biggest install base, native candlesticks, Apache-2.0. The in-repo `apps/react-starter` depends on the echarts adapter (`workspace:*`) so it runs + e2e-tests inside the monorepo. |

## 5. Dependency Graph

```
Task 1 (scaffold apps/react-starter: TanStack Start + shadcn base-ui default + layout/routing)
  |
  v
Task 2 (compile server route + vite build-config invariants, ported from site)
  |
  +---------------------------+
  v                           |
Task 3 (SQLite: drizzle       |
  schema + client + CRUD)     |
  |                           |
  v                           |
Task 4 (EODData source:       |
  client + cache + quota)     |
  |                           |
  +-----------+---------------+
              v
Task 5 (configurable adapter slot + ChartPane, echarts default)
              |
              v
Task 6 (editor pane + workspace page: compile flow + symbol picker + saved-scripts)
              |
              v
Task 7 (create-chartlang installer package: giget clone + add-adapter vendoring + .env)
              |
              v
Task 8 (docs + skills-setup mirror + root README + changeset)
```

## 6. Task Summary

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Scaffold apps/react-starter (TanStack Start + shadcn base-ui default)](./1-scaffold-react-starter.md) | apps/react-starter | None | Medium |
| 2 | [Compile server route + vite build-config invariants](./2-compile-route-build-config.md) | apps/react-starter | 1 | High |
| 3 | [SQLite persistence (Drizzle + better-sqlite3)](./3-sqlite-persistence.md) | apps/react-starter | 1 | Medium |
| 4 | [EODData data source (client + cache + quota)](./4-eoddata-source.md) | apps/react-starter | 3 | High |
| 5 | [Configurable chart adapter slot + ChartPane](./5-adapter-slot-chartpane.md) | apps/react-starter | 2 | Medium |
| 6 | [Editor pane + workspace page](./6-editor-workspace-page.md) | apps/react-starter | 4, 5 | High |
| 7 | [`create-chartlang` installer package](./7-create-chartlang-installer.md) | create-chartlang | 6 | High |
| 8 | [Docs + skills-setup mirror + root README + changeset](./8-docs-skills-readme.md) | docs / skills / create-chartlang | 7 | Medium |

## 7. Code Reuse

| Existing code | Import path / location | Used by |
|---------------|------------------------|---------|
| `handleCompile`, compile-then-diagnose flow | `apps/site/src/lib/server/compile.ts` | Task 2 (ported, not re-derived) |
| The 4 vite plugins (`tsDefaultLibs`, `chartlangCoreBundles`, client-only stub alias, SSR `esbuild` external) | `apps/site/vite.config.ts` | Task 2 |
| Browser stubs (`esbuild` + `node:*`) | `apps/site/src/lib/browser-stubs/` | Task 2 |
| `<ChartlangEditor>`, `chartlangDark` | `@invinite-org/chartlang-editor/react`, `@invinite-org/chartlang-editor` | Task 6 |
| Hybrid language service pattern (`compileToDiagnostics` → `/api/compile`) | `apps/site/src/components/demo/hybridLanguageService.ts` | Task 6 |
| `createActiveAdapter` (wraps `createEChartsAdapter`) + `adapter.host.load(compiled)` | `chartlang-example-echarts-adapter` (via the `activeAdapter` seam) | Task 5 |
| `createMultiStreamCandlePump` + push-candle source + render driving | `apps/site/src/components/demo/ChartPane.tsx` (which imports them from `chartlang-example-canvas2d-adapter`) | Task 5 (**port into a local `streamPump.ts`** — must NOT import from a concrete adapter, to keep the seam clean) |
| `buildSecondaryStreams` (MTF resample) | `apps/site/src/components/demo/secondaryStreams.ts` | Task 5 (port) |
| `Bar`, `ScriptManifest` types | `@invinite-org/chartlang-core` | Tasks 4, 5 |
| `BUNDLED_ADAPTERS`, `add-adapter` bundle (offline, dep-rewritten) | `packages/cli/src/generated/adapters/**` (multi-library-adapters Task 14) | Task 7 |
| `parseArgs` dispatcher + offline-template shape | `packages/cli/src/` | Task 7 (pattern only — installer is its own package) |
| `apps/site` shadcn setup (`components.json`, Base UI primitives) | `apps/site/` | Task 1 (shape only; **default** palette, not `b0`) |

**Never** cross-import between sibling package `src/` folders. The starter
consumes chartlang only through published package surfaces; the installer
consumes adapter bundles through the CLI's generated surface.

## 8. Provenance

No `../invinite/` ports. Tasks 2 and 5 **port** code from `apps/site/`
(server compile + vite plugins + ChartPane/EditorPane patterns) into
`apps/react-starter/` — "translate, not transcribe": strip the
brand/`b0` theming and the site-specific demo catalogue, keep the
compiler-coexistence invariants byte-faithful.

## 9. Deferred / Follow-Up Work

- **Bundle-all-adapters + in-app live switcher.** The chosen design is
  "installer picks one (default echarts)"; a runtime dropdown across all
  five renderers is a follow-up if users want to compare renderers live.
- **Intraday / non-US data.** EODData free tier is daily-EOD + US only;
  paid tiers (intraday, FOREX, indices) are out of scope.
- **Auth / multi-user persistence.** SQLite is single-user/local; a
  hosted, authed deployment (Turso/Postgres) is deferred.
- **Deploy recipe.** The starter runs locally; a Netlify/Vercel deploy
  guide (the site already has `DEPLOYMENT.md`) is a docs follow-up.
- **Publishing example adapters to npm.** Would let the installer add a
  dep instead of vendoring; tracked in multi-library-adapters deferrals.
</content>
</invoke>

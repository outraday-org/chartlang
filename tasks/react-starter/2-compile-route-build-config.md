# Compile server route + vite build-config invariants

> **Status: TODO**

## Goal

Give `apps/react-starter` a working **real-compiler** path: port
`apps/site`'s `/api/compile` server route, the `handleCompile` helper,
the browser stubs, and the four `vite.config.ts` compiler-coexistence
invariants. After this task, POSTing a `.chart.ts` source to
`/api/compile` returns `{ ok, moduleSource, manifest, diagnostics }`,
and the client bundle loads without dragging the compiler / `esbuild` /
`node:*` into the browser graph.

## Prerequisites

- Task 1 (the app exists and boots).

## Current Behavior

`apps/react-starter` has no compile path. `apps/site` already solves
this exact problem; its mechanics are documented in `apps/CLAUDE.md`
("`apps/site/` demo + compiler invariants").

## Desired Behavior

A server route compiles chartlang source server-side; the client keeps
stubs so it never imports the compiler. The starter is run locally (Node
dev/preview), so the **Netlify-specific** parts of the site's config are
dropped, but the four coexistence invariants are kept.

## Requirements

### 1. Port the server compile helper

`src/lib/server/compile.ts` — port `apps/site/src/lib/server/compile.ts`
verbatim in behavior:

- `handleCompile(source): Promise<CompileSuccess | CompileFailure>`
  using `compile()` from `@invinite-org/chartlang-compiler` +
  `createLanguageService().compileToDiagnostics` for mapped LSP
  diagnostics.
- Keep `MAX_SOURCE_LENGTH` (64 KiB) guard.
- Keep `inMemoryModules: IN_MEMORY_MODULES` fed by the
  `virtual:chartlang-core-bundles` module (see §4.4).
- Add the package deps: `@invinite-org/chartlang-compiler` (dev),
  `@invinite-org/chartlang-language-service`,
  `@invinite-org/chartlang-core`, `esbuild` (dev, external in ssr).
- **Server-only:** the file's only importer is the route. Document this
  with the same comment block the site uses.

### 2. Port the server route

`src/routes/api/compile.ts` — port
`apps/site/src/routes/api/compile.ts`:

- `createFileRoute("/api/compile")` with `server.handlers.POST`.
- Keep the JSON body validation (`{ source: string }`), 400 on bad
  body, 500 on compiler throw.
- **Drop / simplify the origin allow-list:** the site locks POSTs to
  `chartlang.invinite.com` + `*.netlify.app`. The starter is a local app
  with no fixed production origin — restrict to same-origin (match the
  request `host`) + missing-origin (curl), and document that a deployer
  should tighten this. Do not hardcode the chartlang production origin.

### 3. Browser stubs

`src/lib/browser-stubs/` — port the site's `esbuild` + `node:*` stub
modules. These are what the **client-only** alias plugin (next section)
redirects the language service's Node touch-points to, so the editor's
local language-service surface (hover/completions) loads in the browser
without the real `esbuild`/`node:*`.

### 4. The four `vite.config.ts` invariants (ported, Netlify dropped)

Port these from `apps/site/vite.config.ts`. They are the difference
between a working demo and a 500/blank chart (`apps/CLAUDE.md`):

1. **Client-only stub aliases.** Redirect `esbuild` + the touched
   `node:*` builtins to `src/lib/browser-stubs/` via a Vite plugin gated
   on `applyToEnvironment(env => env.name === "client")`. **Must not**
   be a plain top-level `resolve.alias` — that would also neuter the
   `ssr` graph the real compiler needs.
2. **`esbuild` external in the `ssr` build.** Add `esbuild` to
   `environments.ssr.build.rollupOptions.external` and keep it an
   explicit devDependency so the dev/preview Node server resolves it
   from `node_modules`. (The site needs this because esbuild's native
   binary can't be bundled; same applies under any SSR bundling.)
3. **`tsDefaultLibs()` plugin** — embed the ES `lib.*.d.ts` closure as
   `virtual:ts-default-libs`; `src/lib/server/tsDefaultLibs.ts` patches
   `ts.sys` to serve them from memory before each compile. Port both.
4. **`chartlangCoreBundles()` plugin** — pre-bundle
   `@invinite-org/chartlang-core` (+ `/time`) into
   `virtual:chartlang-core-bundles`, consumed by `compile.ts`'s
   `inMemoryModules`. Port it.

> **Drop:** `@netlify/vite-plugin-tanstack-start`, the
> `engines.node` Netlify pin rationale, `netlify/site.toml`, and the
> deploy-specific notes. The starter targets local Node dev/preview.
> (3) and (4) are still required even locally if the dev SSR server
> bundles — keep them; they are cheap and make a future deploy work.

### 5. Smoke test (e2e)

`tests/compile.spec.ts` (Playwright) — boot the app, POST a known-good
script (e.g. a 2-line SMA cross) to `/api/compile`, assert `ok:true`
with a non-empty `moduleSource`; POST a syntactically broken script,
assert `ok:false` with at least one error diagnostic. (apps use e2e, not
the coverage gate.)

### Edge cases

- **Stub leak into SSR:** a regression test / assertion that the alias
  plugin only fires for `env.name === "client"` (mirror the site's
  guard). If it leaks, `/api/compile` returns stub output and every
  compile "succeeds" with empty emissions.
- **Oversized source:** >64 KiB returns a clean `ok:false` (no
  diagnostics), not a 500.
- **Core import resolution:** without the `chartlangCoreBundles` plugin,
  `compile()`'s esbuild step fails to resolve
  `@invinite-org/chartlang-core` and `/api/compile` 500s with a blank
  chart — the e2e good-path POST guards this.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/react-starter/src/lib/server/compile.ts` | Create | ported `handleCompile` |
| `apps/react-starter/src/lib/server/tsDefaultLibs.ts` | Create | ported ts.sys patch |
| `apps/react-starter/src/routes/api/compile.ts` | Create | compile server route |
| `apps/react-starter/src/lib/browser-stubs/**` | Create | esbuild + node:* client stubs |
| `apps/react-starter/vite.config.ts` | Modify | 4 compiler invariants (Netlify dropped) |
| `apps/react-starter/package.json` | Modify | compiler/ls/core/esbuild deps |
| `apps/react-starter/tests/compile.spec.ts` | Create | compile e2e smoke |

## Gates

- `pnpm typecheck`
- `pnpm --filter chartlang-react-starter build` (client + ssr)
- `pnpm --filter chartlang-react-starter e2e` (compile smoke)
- Biome ignores `apps/**`; no coverage/changeset gate.

## Changeset

None — `apps/*` is changeset-exempt.

## Acceptance Criteria

- `POST /api/compile { source }` returns the compiled triple for a valid
  script and `ok:false` + diagnostics for an invalid one.
- The client bundle builds and loads with **no** compiler/`esbuild`/
  `node:*` in the client graph (stub alias is client-only).
- All four invariants present; Netlify-specific config absent.
- Compile e2e smoke passes both good and bad paths.
</content>

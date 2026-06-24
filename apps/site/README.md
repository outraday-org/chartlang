# chartlang-site

> **Stability: experimental.**

The chartlang landing site — a single-page marketing surface with the
live editor + chart demo embedded directly below the marketing copy.
Built with **TanStack Start + shadcn (Base UI preset)** and deployed
to Netlify as `chartlang.invinite.com`. Private workspace package
(`"private": true`); not published to npm.

## Public surface

N/A — an app, not a library (`"private": true`, unpublished). The
landing route composes three sections under `src/components/landing/`
(`Hero`, `Features`, `Quickstart`, all rendering through the shared
Shiki `CodeBlock`) plus the embedded editor + chart demo under
`src/components/demo/`, anchored at `#demo`.

## Embedded demo + `/api/compile`

`src/components/demo/` ports the editor + chart playground (CodeMirror
+ the canvas2d adapter), lazy-loaded and **client-only** —
`EmbeddedDemo` renders a placeholder during SSR and mounts the live
body (with its `fetch("/api/compile")` loop and canvas) in `useEffect`.

`src/routes/api/compile.ts` is a TanStack Start server route
(`createFileRoute(...).server.handlers.POST`) that runs the real
compiler in Node and returns `{ ok, moduleSource, manifest,
diagnostics }`. Two non-obvious build invariants make this work:

- **Stub aliases are CLIENT-ONLY.** `esbuild` and the `node:*` builtins
  the language service touches are aliased to browser stubs in
  `vite.config.ts` via a plugin gated on `applyToEnvironment(env =>
  env.name === "client")`. A plain `resolve.alias` would also rewrite
  the server graph and break the real compiler.
- **`esbuild` is external in the SSR build.** esbuild's JS API cannot be
  bundled (it locates a native binary relative to its own package). It
  is `environments.ssr.build.rollupOptions.external` and added as an
  `apps/site` devDependency so the function runtime resolves it from
  `node_modules`. Mirrors Netlify's `external_node_modules = ["esbuild"]`.

Type-aware compile diagnostics are intentionally NOT surfaced (the
playground's known gap is ported as-is).

## Local dev

```bash
pnpm install
pnpm site:dev
```

Then open `http://localhost:3200`.

## Build

```bash
pnpm site:build
```

Produces a Vite client + SSR build under `apps/site/dist/`
(`dist/client` + `dist/server`). The installed TanStack Start exposes no
build-time Netlify preset; Netlify adapts the build at deploy time via
`netlify/site.toml`.

## End-to-end test

```bash
pnpm --filter chartlang-site e2e:install   # once: chromium
pnpm --filter chartlang-site e2e
```

Playwright builds the app and serves it via `vite preview` (which runs
the SSR + server-route stack), then drives the full
edit→compile→render→recompile loop.

## Typecheck + lint

```bash
pnpm site:typecheck
pnpm site:lint
```

The root `biome.json` ignores `apps/site/**` (the shadcn-generated
source uses 2-space indent + no semicolons, clashing with the repo-wide
4-space + semicolons style). Typecheck uses the workspace base tsconfig
with per-app overrides for `jsx`, `moduleResolution: "Bundler"`, and the
`@/*` path alias.

## Brand

Palette: **indigo** + **slate** + **emerald** as OKLCH CSS variables.
Fonts: **Inter Variable** (UI) + **JetBrains Mono Variable** (code) via
`@fontsource-variable/*`. Dark-mode-first (`<html class="dark">`).
Repo-root `brand/brand.css` is the single source of truth for the
palette (shared with the VitePress docs theme); `src/styles.css` bridges
it into Tailwind v4's `@theme`.

## License

MIT.

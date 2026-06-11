# Landing Site + Netlify Deploy

> **Status: TODO.** Establishes the public web surface for chartlang
> as an OSS project: a marketing+demo single-page site
> (`chartlang.invinite.com`) and the VitePress docs
> (`docs.chartlang.invinite.com`), both hosted on Netlify, both wearing
> the same brand identity. Retires the existing
> `examples/react-demo/` Vite app and the GitHub Pages docs workflow.
>
> **Plan reference:** none — PLAN.md scopes the language, runtime,
> and adapter contract, not the public marketing surface. This work is
> repo infrastructure, not product surface.
>
> **Version target:** none — no published package changes. Pure
> tooling / repo / hosting changes. No changeset required (the
> changeset gate is package-scoped).

## Overview

Today the chartlang web presence is two things, hosted on one
platform:

- `outraday-org.github.io/chartlang/` — VitePress docs, deployed by
  `.github/workflows/docs.yml`.
- A localhost-only React playground in `examples/react-demo/` —
  never deployed; only runs via `pnpm dev` because `/api/compile` is a
  Vite dev-server middleware.

This task folder replaces that with two production-deployed sites
sharing one brand:

- `chartlang.invinite.com` — a single-page marketing site (`apps/site/`)
  built with **TanStack Start + shadcn (Base UI preset)** containing a
  hero, what-is-chartlang explanation with live code snippets, a
  quickstart, and the **live editor+chart demo embedded directly below
  the marketing copy** (one scroll surface — no `/demo` route split).
- `docs.chartlang.invinite.com` — the existing VitePress site,
  re-themed to match the marketing brand (indigo + slate + emerald,
  Inter + JetBrains Mono, shared logo / header treatment).

Both sites deploy to **Netlify** from the monorepo. DNS for
`invinite.com` is on Cloudflare — `CNAME` records point each
subdomain at Netlify's load balancer. The brand identity is
**indigo + slate + emerald** (cool/technical, dev-tool register).

## Current State

```
.github/workflows/
├── ci.yml          # full test/lint/typecheck/conformance gate
└── docs.yml        # VitePress build + GitHub Pages deploy

docs/                       # VitePress site, default theme
├── .vitepress/config.ts    # nav + sidebar; base: DOCS_BASE ?? "/"
├── index.md
├── getting-started/...
├── language/...
└── ...

examples/
├── canvas2d-adapter/       # private reference adapter
├── react-demo/             # Vite + React + CodeMirror playground
│   ├── server/compilePlugin.ts          # `/api/compile` middleware (DEV ONLY)
│   ├── src/App.tsx                       # marketing-free editor UI
│   ├── src/ChartPane.tsx                 # canvas2d-driven preview
│   ├── src/EditorPane.tsx                # CodeMirror + chartlang LSP
│   ├── src/hybridLanguageService.ts      # local LSP + fetch('/api/compile')
│   ├── src/scripts.ts                    # bundled demo scripts
│   └── ...
└── scripts/                # Phase-1 conformance .chart.ts seed
```

- `pnpm-workspace.yaml` lists `packages/*`,
  `examples/canvas2d-adapter`, `examples/react-demo`.
- The compiler depends on `esbuild` (Node-native, ships native
  binaries). The react-demo aliases `esbuild` + `node:*` builtins to
  browser stubs and runs the real compiler in Node via the Vite
  middleware. Same trick works inside a Netlify Function.
- VitePress builds to `docs/.vitepress/dist`. `DOCS_BASE` is set by
  CI so the site can live at `/chartlang/` on GitHub Pages. Under a
  custom domain the base resets to `/`.
- The root README's "Try it" section links to the localhost-only
  `examples/react-demo/`. After this work, it links to the
  Netlify-hosted site.

## Target State

```
.github/workflows/
├── ci.yml                  # extended: typechecks apps/site/, builds both Netlify projects in PR preview
└── netlify-preview.yml     # NEW: per-PR Netlify preview deploys (both projects)
                            # docs.yml DELETED — Netlify handles deploys

netlify/
├── site.toml               # NEW: build config for chartlang.invinite.com
└── docs.toml               # NEW: build config for docs.chartlang.invinite.com

apps/                       # NEW top-level workspace folder
└── site/                   # NEW: chartlang-site (private, unpublished)
    ├── app/                # TanStack Start app dir
    │   ├── routes/
    │   │   ├── __root.tsx              # shared shell + nav + footer
    │   │   ├── index.tsx               # single-page landing + embedded demo
    │   │   └── api/compile.ts          # server route → Netlify Function
    │   ├── components/                 # shadcn (Base UI preset) components
    │   │   ├── ui/                     # shadcn primitives
    │   │   ├── brand/Logo.tsx
    │   │   ├── landing/Hero.tsx
    │   │   ├── landing/Features.tsx
    │   │   ├── landing/Quickstart.tsx
    │   │   ├── landing/CodeBlock.tsx   # Shiki-rendered, same theme as docs
    │   │   └── demo/                   # ported from examples/react-demo/src/
    │   │       ├── EmbeddedDemo.tsx
    │   │       ├── EditorPane.tsx
    │   │       ├── ChartPane.tsx
    │   │       └── hybridLanguageService.ts
    │   ├── lib/
    │   │   └── compile.ts              # server-only chartlang compile helper
    │   └── styles/
    │       ├── globals.css             # Tailwind v4 + shadcn vars
    │       └── brand.css               # indigo/slate/emerald tokens, fonts
    ├── public/
    │   ├── bars.json                   # copied from react-demo
    │   ├── og.png                      # social card
    │   ├── favicon.svg
    │   └── logo.svg
    ├── app.config.ts                   # TanStack Start + Netlify preset
    ├── package.json                    # private, workspace
    ├── tsconfig.json
    └── README.md

docs/
└── .vitepress/
    ├── config.ts                       # base reset to "/" (custom domain)
    └── theme/                          # NEW: custom theme matching apps/site
        ├── index.ts
        ├── style.css                   # indigo/slate/emerald tokens
        └── components/
            └── BrandHeader.vue         # shared logo + nav treatment

examples/
├── canvas2d-adapter/                   # unchanged
└── scripts/                            # unchanged
# examples/react-demo/                  # DELETED — absorbed into apps/site/
```

- `chartlang.invinite.com` serves the single-page marketing+demo
  from `apps/site/`. `/api/compile` runs as a Netlify Function (the
  real chartlang compiler in Node, identical logic to today's Vite
  middleware).
- `docs.chartlang.invinite.com` serves the VitePress docs, re-themed
  to match the marketing brand.
- Every PR opens **two Netlify preview URLs** (one per site) via the
  Netlify GitHub integration; CI gates them by also running
  `pnpm --filter chartlang-site build` + `pnpm docs:build` in
  `.github/workflows/ci.yml`.
- Root README's "Try it" section now points to
  `https://chartlang.invinite.com` first; the localhost dev path
  becomes a secondary "run the site locally" line.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **One single-page site, not a `/demo` route split** | User chose embedded demo on the home page. Single scroll surface = simpler narrative, fewer routes, no route-skeleton flicker. Anchor links in the nav (`#features`, `#quickstart`, `#demo`) replace the tab UI. |
| **`apps/site/` as a new top-level workspace folder** | `packages/` is for published `@invinite-org/chartlang-*` packages and `examples/` is for "reference artefacts that ship alongside published packages" (see `examples/CLAUDE.md`). The site is neither — it's the public web surface. `apps/` follows the convention used by TanStack, Next, and most monorepo OSS projects. Append `apps/*` to `pnpm-workspace.yaml`. |
| **TanStack Start (not Next.js, not pure Vite)** | User-requested. TanStack Start gives type-safe routing, server functions that deploy as Netlify Functions cleanly, and a single Vite-based dev server that already plays well with the chartlang compiler's `esbuild` + `node:*` stubs. The `shadcn init --template start --preset b0 --base base` invocation scaffolds the whole stack. |
| **shadcn on the Base UI preset (b0)** | User-requested. Base UI primitives are accessibility-first and unstyled — shadcn composes them with Tailwind tokens. Lower bundle weight than Radix-based shadcn, future-proof per shadcn's own roadmap. |
| **Replace `examples/react-demo/`, do not keep both** | User chose "replace". Two demo surfaces means two implementations of the editor + chart pane to keep in sync; the conformance test surface lives in `packages/conformance/`, not in either demo, so dropping `react-demo/` removes nothing covered by gates. The new `apps/site/embedded-demo` is the canonical "how do I embed chartlang" reference. |
| **`/api/compile` as TanStack Start server route → Netlify Function** | TanStack Start's Netlify preset compiles each server route into a function with no extra config. The real chartlang compiler runs in Node (esbuild + `node:*` builtins available in Lambda Node 20). The browser bundle keeps the existing esbuild + `node:*` stubs from `react-demo/`. Same architecture as today, just moved from Vite dev middleware to a function. |
| **Two Netlify Sites, one repo** | Each Netlify Site has its own custom domain, build command, base directory, and deploy log. `chartlang.invinite.com` → build command `pnpm --filter chartlang-site build`, publish `apps/site/.netlify/`. `docs.chartlang.invinite.com` → build command `pnpm docs:build`, publish `docs/.vitepress/dist/`. Cleaner ops than a single site with redirects. Both configs live in repo at `netlify/site.toml` + `netlify/docs.toml`. |
| **Cloudflare DNS — `CNAME` only, no Cloudflare proxy** | Netlify's load balancer handles TLS via Let's Encrypt at the apex of each subdomain. Cloudflare orange-cloud proxying would break Netlify's automatic cert provisioning unless we add Cloudflare-side certs. DNS-only ("grey cloud") keeps the setup boring. |
| **Brand identity: indigo + slate + emerald, Inter + JetBrains Mono** | User-chosen direction. Shared CSS-variable tokens live in `apps/site/app/styles/brand.css` and are mirrored 1:1 in `docs/.vitepress/theme/style.css`. The two sites are visually one product. |
| **Retire `.github/workflows/docs.yml` entirely** | Netlify deploys docs on every commit to `main` via its own GitHub integration. Keeping the GitHub Pages workflow means two deploy paths to debug. CI still runs `pnpm docs:build` for type-safety; the actual publish is Netlify's job. |
| **No changeset** | No published package changes. The §22 changeset gate is package-scoped (`@invinite-org/chartlang-*`). `apps/site/` is `"private": true`. |

## Dependency Graph

```
Task 1 (scaffold apps/site/ with TanStack Start + shadcn + workspace wiring)
   |
   |  - append `apps/*` to pnpm-workspace.yaml
   |  - run `pnpm dlx shadcn@latest init --preset b0 --base base --template start`
   |  - private package.json, tsconfig.json, app.config.ts, hello-world route
   |  - root scripts wired: `pnpm --filter chartlang-site dev|build|typecheck`
   v
Task 2 (brand system + shared layout shell)
   |
   |  - indigo/slate/emerald palette, Inter + JetBrains Mono
   |  - styles/brand.css + Tailwind v4 token bridge
   |  - Logo component, favicon, og.png placeholder
   |  - __root.tsx layout: nav (anchor links) + footer + dark-mode-first
   v
Task 3 (landing-page sections: Hero, Features, Quickstart)
   |
   |  - index.tsx assembles Hero + Features + Quickstart components
   |  - CodeBlock.tsx renders Shiki snippets in the brand theme
   |  - copy: "what chartlang is", per-role install snippets, run snippet
   v
Task 4 (embedded demo + /api/compile server route)
   |
   |  - port EditorPane, ChartPane, hybridLanguageService from react-demo
   |  - EmbeddedDemo.tsx mounts below Quickstart on the home route
   |  - routes/api/compile.ts: TanStack server route running the real compiler
   |  - esbuild + node:* browser stubs replicated in Vite config
   |  - playwright smoke test: compile + render + edit + recompile
   v
Task 5 (VitePress docs re-themed + Netlify config)
   |
   |  - docs/.vitepress/theme/ created, palette + fonts shared with apps/site
   |  - BrandHeader.vue replaces default theme header
   |  - config.ts: base resets to "/", nav/sidebar unchanged
   |  - netlify/docs.toml + netlify/site.toml committed
   v
Task 6 (CI pipeline updates + Netlify deploy automation)
   |
   |  - .github/workflows/ci.yml: add `pnpm --filter chartlang-site build`,
   |    add `pnpm --filter chartlang-site typecheck`,
   |    keep `pnpm docs:build`
   |  - .github/workflows/netlify-preview.yml: per-PR preview comment
   |  - .github/workflows/docs.yml DELETED
   |  - root readme:check still green; apps/site/README.md ≤ 100 lines
   v
Task 7 (custom domains, DNS docs, retire examples/react-demo/)
   |
   |  - docs/getting-started/run-the-site-locally.md (NEW)
   |  - DEPLOYMENT.md (NEW, root): Cloudflare CNAME records,
   |    Netlify site setup, env-var checklist
   |  - delete examples/react-demo/, drop from pnpm-workspace.yaml
   |  - root README.md "Try it" section repointed to chartlang.invinite.com
   |  - changesets/ unchanged (no published package touched)
```

Every task depends only on lower-numbered tasks. Tasks 1 → 4 build
the marketing site bottom-up; Task 5 brings docs into alignment;
Task 6 gates everything in CI; Task 7 flips DNS, removes the old
playground, and updates the public README.

## Task Summary

| # | Title | Surface | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Scaffold apps/site/ — TanStack Start + shadcn](./1-scaffold-tanstack-start.md) | new app | None | Medium |
| 2 | [Brand system + shared layout shell](./2-brand-system-and-layout.md) | apps/site/ | 1 | Medium |
| 3 | [Landing-page sections (Hero, Features, Quickstart)](./3-landing-page-content.md) | apps/site/ | 2 | Medium |
| 4 | [Embedded demo + /api/compile server route](./4-embedded-demo-and-compile-route.md) | apps/site/ | 3 | High |
| 5 | [Re-theme VitePress docs + Netlify configs](./5-docs-rebrand-and-netlify-configs.md) | docs/ + netlify/ | 2 | Medium |
| 6 | [CI updates + Netlify deploy automation](./6-ci-and-netlify-deploy.md) | .github/workflows/ | 4, 5 | Medium |
| 7 | [Custom domains, DNS docs, retire react-demo](./7-domains-and-react-demo-removal.md) | repo root + examples/ | 6 | Low |

## Code Reuse

| Existing artefact | New consumer | Action |
|---|---|---|
| `examples/react-demo/server/compilePlugin.ts` | `apps/site/app/routes/api/compile.ts` (Task 4) | Port logic — same `handleCompile(source)` body; replace Connect middleware shell with TanStack Start `createServerFileRoute` handler. |
| `examples/react-demo/src/hybridLanguageService.ts` | `apps/site/app/components/demo/hybridLanguageService.ts` (Task 4) | Copy verbatim — `fetch("/api/compile")` continues to work because the server route lives at the same path. |
| `examples/react-demo/src/EditorPane.tsx` | `apps/site/app/components/demo/EditorPane.tsx` (Task 4) | Copy verbatim — pure React + CodeMirror + chartlang language service. No TanStack-specific hooks. |
| `examples/react-demo/src/ChartPane.tsx` | `apps/site/app/components/demo/ChartPane.tsx` (Task 4) | Copy verbatim — pure React + canvas2d adapter. |
| `examples/react-demo/src/esbuildStub.ts` + `nodeBuiltinStub.ts` | `apps/site/app/lib/browser-stubs/` (Task 4) | Copy verbatim — same browser-side alias trick needed to keep the language service importable. |
| `examples/react-demo/src/scripts.ts` | `apps/site/app/components/demo/scripts.ts` (Task 4) | Copy verbatim — three demo `.chart.ts` strings shown in the editor switcher. |
| `examples/react-demo/public/bars.json` | `apps/site/public/bars.json` (Task 4) | Copy verbatim — 1000-bar deterministic fixture the chart preview reads. |
| `examples/react-demo/vite.config.ts` (esbuild + `node:*` aliases) | `apps/site/app.config.ts` Vite section (Task 4) | Port the two `alias` entries into the TanStack Start vite config — same browser-side trick, same justification. |
| Root `README.md` example snippet (EMA Cross) | `apps/site/app/components/landing/Hero.tsx` (Task 3) | Reuse the EMA Cross block as the hero code snippet so the marketing copy and the README stay in lockstep. |
| `docs/.vitepress/config.ts` markdown plugin | unchanged | Keep as-is; the rebrand is theme-level, not config-level (Task 5). |

Never duplicate `compile`, `createLanguageService`, or
`createScriptRunner` logic — `apps/site/` consumes the workspace
packages via `workspace:*` deps. The single new piece of cross-cutting
code is `apps/site/app/styles/brand.css`, mirrored into
`docs/.vitepress/theme/style.css` (Task 5) so the two sites share one
set of design tokens.

## Provenance

No `../invinite/` ports in this task folder. All ported source comes
from `examples/react-demo/` inside this repo; standard `git mv`-style
moves do not need a provenance header.

## Deferred / Follow-Up Work

Out of scope for this folder, called out so the boundary is clear:

- **`apps/blog/`** or any other site beyond the landing + docs.
- **Search on docs** — Algolia DocSearch / Pagefind. VitePress
  default search stays for now.
- **`og.png` finished art** — Task 2 ships a placeholder; the final
  social card can land in a follow-up PR. (The brand tokens are
  enough to render a respectable placeholder.)
- **Sentry / analytics wiring on `apps/site/`** — no telemetry in
  this folder; opt-in if the project later wants it.
- **TanStack Start API routes beyond `/api/compile`** — e.g. a
  `/api/share` endpoint that persists a script for sharing. Future
  work.
- **Type-aware compile diagnostics in the embedded demo** —
  `examples/react-demo/`'s known gap (see
  `memory/project_e2e_findings.md`). Port the gap; do not pretend to
  fix it here.
- **Dark/light theme toggle** — sites ship dark-mode-first. A
  user-controlled toggle can land later; not required for parity with
  the existing playground.
- **Cloudflare-proxied (orange-cloud) setup** — DNS-only suffices.
  If the project later wants WAF / DDoS / cache rules, that's a
  separate task to wire Cloudflare-side certificates.
- **Removing `DOCS_BASE` from the codebase** — Task 5 resets the
  base to `/`; the env-var fallback stays in `config.ts` for local
  flexibility and is harmless.

# Deployment

Operational reference for the two chartlang public sites. Both are
hosted on Netlify, deployed from `main`, with DNS pointed at Netlify
from the Cloudflare-managed `invinite.com` zone.

> **Config note.** Netlify only auto-loads a file literally named
> `netlify.toml` from the project's base/package directory. The
> `netlify/site.toml` / `netlify/docs.toml` files in this repo are
> **not** picked up by that mechanism — the live build settings are
> entered in the Netlify dashboard (Site config → Build & deploy). The
> `netlify/*.toml` files are kept as the documented reference for those
> settings and as the basis for a future migration to a Netlify-read
> `netlify.toml` (see "Open: consolidate config" below).

## Sites

| Site | Domain | Netlify Site name | Config | Source |
|---|---|---|---|---|
| Marketing + demo | chartlang.invinite.com | chartlang-site | `netlify/site.toml` | `apps/site/` |
| Docs | docs.chartlang.invinite.com | chartlang-docs | `netlify/docs.toml` | `docs/` |

The Netlify Site IDs are assigned when each Site is created. Record
them here once known (they back the deploy-status badges):

- `chartlang-site` → `<chartlang-site-id>`
- `chartlang-docs` → `<chartlang-docs-id>`

## Build config (set in the Netlify dashboard)

| Site | Build command | Publish dir | Node |
|---|---|---|---|
| chartlang-site | `pnpm install --frozen-lockfile && pnpm --filter chartlang-site build` | `apps/site/dist/client` | 22 |
| chartlang-docs | `pnpm install --frozen-lockfile && pnpm docs:build` | `docs/.vitepress/dist` | 22 |

Set `base = "."` (the monorepo root) so the workspace install resolves
`@invinite-org/chartlang-*` from `workspace:*`; for `chartlang-site` the
Netlify "Project to deploy" / package directory is `apps/site`. Pin
`NODE_VERSION = "22"` in the dashboard env vars — the SSR adapter
(`@netlify/vite-plugin-tanstack-start`) requires Node 22+.

### SSR adapter — how `chartlang-site` serves pages

`apps/site/vite.config.ts` runs `@netlify/vite-plugin-tanstack-start`
(after `tanstackStart()`). `vite build` emits:

- `dist/client` — static assets (published).
- `dist/server/server.js` — the SSR + server-route bundle.
- `.netlify/v1/functions/server.mjs` — the SSR Function the adapter
  generates. It is configured `path: "/*"`, `preferStatic: true`, so
  static assets serve first and every other route (including
  `/api/compile`) is handled by SSR. This supersedes the manual
  `/api/*` redirect that `netlify/site.toml` once declared.

Without this plugin `vite build` produces only a plain Node server that
Netlify cannot run, and publishing `dist/client` alone 404s every route
(there is no `index.html` for an SSR app).

### esbuild and typescript must stay external

`apps/site/vite.config.ts` keeps both `esbuild` and `typescript` external
in the `ssr` build (`environments.ssr.build.rollupOptions.external`).

- **esbuild** ships native binaries and locates them relative to its own
  package — bundling it into the ESM Function breaks it (`__filename is
  not defined`), so the Function runtime must load it from `node_modules`.
- **typescript** is read by the compiler's semantic-typecheck path
  (`languageService.compileToDiagnostics` → in-memory `ts.Program`). Its
  default lib (`lib.es2022.d.ts`) is loaded from disk at runtime via
  `ts.sys.getExecutingFilePath()` → `node_modules/typescript/lib`. If the
  Function bundler inlines `typescript`, that path resolves to the bundle
  and the lib `.d.ts` files are missing; with `skipLibCheck` the failure
  is silent, the ambient core shim's `Readonly`/`Record` collapse to
  `any`, and every valid `compute({ bar, ta, … })` destructure trips
  `noImplicitAny` (TS7031) on the deployed site — while dev (lib on disk)
  is fine. Vite already auto-externals it from the SSR bundle, but it must
  be named in `rollupOptions.external` so the Netlify adapter keeps the
  whole package (lib files included) installed in the Function.

`netlify/site.toml` records the equivalent
`[functions] external_node_modules = ["esbuild", "typescript"]` directive;
once config is consolidated into a Netlify-read `netlify.toml` (below),
that directive becomes live again. Verify `/api/compile` after each
deploy — a broken esbuild or typescript resolution shows up there first
(esbuild as a 500 / missing-binary error, typescript as spurious TS7031
diagnostics on a known-good script).

## DNS — Cloudflare

Both records are CNAMEs, **DNS-only** (grey cloud, not proxied).
Cloudflare proxying would conflict with Netlify's automatic Let's
Encrypt TLS provisioning. Proxy can be re-enabled later only after
wiring Cloudflare-side certificates.

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | chartlang | apex-loadbalancer.netlify.com | DNS-only |
| CNAME | docs.chartlang | apex-loadbalancer.netlify.com | DNS-only |

The exact target (`apex-loadbalancer.netlify.com` or a site-specific
record) is shown by Netlify in each Site's "Domain management" panel
after the custom domain is added.

## Netlify — initial setup (one-time, per site)

1. New Site → Import from Git → `outraday-org/chartlang`.
2. Production branch: `main`.
3. Branch deploys: **disabled** (only `main` deploys to prod).
4. Deploy Previews: **enabled** (per-PR preview URLs; the Netlify
   GitHub App comments the URL on each PR).
5. For `chartlang-site`, set "Project to deploy" / package directory to
   `apps/site` with base = repo root. Enter the build command, publish
   dir, and `NODE_VERSION = 22` from the "Build config" table above
   (Netlify does not auto-load `netlify/site.toml` — see the config
   note at the top).
6. Domain → Add custom domain → the value from the table above.
7. Wait for the Let's Encrypt cert (typically < 5 min).
8. Copy the assigned Site ID into the table above.

## Environment variables

Neither site requires secrets to build. The compile Function runs the
in-repo compiler with no external service. The only build-time variable
is `DOCS_BASE` for the docs site, which defaults to `/` and should be
left unset under the custom domain (see `docs/CLAUDE.md`).

| Variable | Site | Default | Set in prod? |
|---|---|---|---|
| `NODE_VERSION` | both | `22` | yes — set in dashboard env vars (adapter needs Node 22+) |
| `PNPM_VERSION` | both | `9.12.0` | yes — set in dashboard env vars |
| `DOCS_BASE` | docs | `/` | no — custom domain serves at root |

## Deploy lifecycle

| Trigger | Result |
|---|---|
| Push to `main` | Both sites build + deploy to production. |
| Open PR | Both sites build + publish a preview URL; the Netlify GitHub App comments the URLs on the PR. |
| Close PR | Preview deploys are deleted by Netlify after retention. |

## Roll back

In the Netlify dashboard, navigate to the Site → Deploys, locate the
last known-good deploy, click "Publish deploy". Takes < 30s.

## Add a new subdomain (e.g. `blog.chartlang.invinite.com`)

1. Add a config file in `netlify/` for the new app (mirror
   `site.toml` / `docs.toml`).
2. Create a Netlify Site pointing at it; add the custom domain in the
   Netlify panel — Netlify gives a CNAME target.
3. Cloudflare DNS → Add CNAME, DNS-only.
4. Update this `DEPLOYMENT.md` with the new row.

## Compile Function — operational notes

`/api/compile` runs the chartlang compiler in a Netlify Function.

- Memory: default 1024 MB. esbuild is mem-light; ~80 MB peak.
- Time: < 500 ms on the playground scripts. 10 s Function timeout on
  the free tier.
- Cold start: ~600–900 ms (esbuild binary load).
- Routing: served by the SSR Function's catch-all (`path: "/*"`), not a
  standalone redirect.
- Origin allowlist: enforced in
  `apps/site/src/routes/api/compile.ts`. The production origin,
  `*.netlify.app` previews, and same-origin requests are accepted;
  anything else returns 403. This runtime check is the active CORS
  enforcement; the static CORS headers in `netlify/site.toml` are not
  applied while that file is unread (see "Open: consolidate config").
- Source size limit: 64 KB in
  `apps/site/src/lib/server/compile.ts`. Above-limit requests return
  `{ ok: false, diagnostics: [] }`.

## Disabling GitHub Pages

The old docs workflow (`.github/workflows/docs.yml`) is deleted.
GitHub Pages must also be disabled at the repo level:

1. Go to <https://github.com/outraday-org/chartlang/settings/pages>.
2. Set the source to "None".
3. Save.

This stops the orphan deploy from re-firing on rebased branches.

## Open: consolidate config

Today the live build settings live in the Netlify dashboard and the
`netlify/*.toml` files are unread reference. To make the in-repo config
authoritative again — and re-activate the security/CORS `[[headers]]`
and the `external_node_modules = ["esbuild"]` directive — migrate each
site to a Netlify-read `netlify.toml`:

- Netlify auto-loads `netlify.toml` from the **package directory**. With
  `chartlang-site` set to package directory `apps/site`, place the
  config at `apps/site/netlify.toml` (paths inside stay relative to the
  base directory, the repo root).
- The docs site would get `docs/netlify.toml` the same way.
- Note this conflicts with the `CLAUDE.md` rule that keeps Netlify
  config under `netlify/`; updating that rule is part of the migration.

Until then: header/CORS directives are enforced at runtime in the route
(`apps/site/src/routes/api/compile.ts`), and `esbuild` stays external
via `apps/site/vite.config.ts` only.

# Deployment

Operational reference for the two chartlang public sites. Both are
hosted on Netlify, deployed from `main`, with DNS pointed at Netlify
from the Cloudflare-managed `invinite.com` zone. The in-repo build
config is authoritative — `netlify/site.toml` and `netlify/docs.toml`.

## Sites

| Site | Domain | Netlify Site name | Config | Source |
|---|---|---|---|---|
| Marketing + demo | chartlang.invinite.com | chartlang-site | `netlify/site.toml` | `apps/site/` |
| Docs | docs.chartlang.invinite.com | chartlang-docs | `netlify/docs.toml` | `docs/` |

The Netlify Site IDs are assigned when each Site is created. Record
them here once known (they back the deploy-status badges):

- `chartlang-site` → `<chartlang-site-id>`
- `chartlang-docs` → `<chartlang-docs-id>`

## Build config (verified — matches the in-repo TOML)

| Site | Build command | Publish dir | Node |
|---|---|---|---|
| chartlang-site | `pnpm install --frozen-lockfile && pnpm --filter chartlang-site build` | `apps/site/dist/client` | 20 |
| chartlang-docs | `pnpm install --frozen-lockfile && pnpm docs:build` | `docs/.vitepress/dist` | 20 |

Both pin `PNPM_VERSION = "9.12.0"` and `base = "."` (the monorepo root)
so the workspace install resolves `@invinite-org/chartlang-*` from
`workspace:*`.

`@tanstack/react-start` emits `dist/client` (static assets) +
`dist/server` (the SSR + server-route bundle). Netlify's TanStack Start
adapter turns `dist/server` into Functions at deploy time, so `publish`
points at the static client output, and the `/api/*` redirect routes
requests to the generated Functions.

### esbuild must stay external

`netlify/site.toml` sets `[functions] external_node_modules =
["esbuild"]`. esbuild ships native binaries and locates them relative to
its own package — bundling it into the ESM Function breaks it
(`__filename is not defined`). Keep it external so the Lambda runtime
loads it from `node_modules`. This mirrors the `ssr` external in
`apps/site/vite.config.ts`.

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
5. Config file: `netlify/site.toml` or `netlify/docs.toml`.
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
| `NODE_VERSION` | both | `20` (in TOML) | no — pinned in TOML |
| `PNPM_VERSION` | both | `9.12.0` (in TOML) | no — pinned in TOML |
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
- Origin allowlist: enforced in
  `apps/site/src/routes/api/compile.ts`. The production origin,
  `*.netlify.app` previews, and same-origin requests are accepted;
  anything else returns 403. `netlify/site.toml` pins the production
  domain in static CORS headers (Netlify can't echo a dynamic preview
  origin — the route's runtime check covers previews).
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

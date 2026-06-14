# Task 7 — Custom domains, DNS docs, retire `examples/react-demo/`

> **Status: TODO**

## Goal

Document the custom-domain wiring at Cloudflare in a new
`DEPLOYMENT.md`, delete the now-superseded `examples/react-demo/`
package, and rewrite the root `README.md`'s "Try it" section to
point at `https://chartlang.invinite.com`. The end-state is a
single, public-facing entry point for trying chartlang and a clean
`examples/` directory with no duplicate playground.

## Prerequisites

- Task 6 complete — both Netlify Sites are live, CI is on the new
  pipeline, GitHub Pages docs workflow is gone.

## Current Behavior

- `examples/react-demo/` exists as a fully working local
  playground; all of its source has been ported to `apps/site/` in
  Task 4 but the old folder is still in the workspace.
- `pnpm-workspace.yaml` includes `examples/react-demo`.
- Root `README.md`'s "Try it" section says: `cd examples/react-demo
  && pnpm dev` — localhost-only.
- No `DEPLOYMENT.md` exists. Cloudflare CNAME values, Netlify Site
  IDs, and the manual setup checklist live only in the Task 6 PR
  description.

## Desired Behavior

After this task:

- `DEPLOYMENT.md` (root) carries the canonical operational
  reference for the two sites: domain → Netlify Site → DNS record
  values → manual setup steps → "how to roll back" → "how to add a
  new subdomain".
- `examples/react-demo/` is **deleted**. `pnpm-workspace.yaml` no
  longer lists it.
- Root `README.md`'s "Try it" section is rewritten:
    - First entry: "Try it in your browser:
      [chartlang.invinite.com](https://chartlang.invinite.com)".
    - Second entry: "Run the site locally: `pnpm site:dev`, open
      `http://localhost:5173`."
    - Third entry kept: the vanilla canvas2d playground line, if
      still useful — if not, drop it.
- `docs/getting-started/run-the-site-locally.md` is a new page (or
  the existing
  `docs/getting-started/embed-in-our-chart.md` is updated) so docs
  readers find the local-dev story.
- `docs/getting-started/embed-in-our-chart.md` no longer references
  `examples/react-demo/server/compilePlugin.ts`; it points at the
  TanStack server route + helper inside `apps/site/` instead.
- `skills/chartlang-setup/SKILL.md` and
  `skills/chartlang-setup/references/embed.md` are updated so the
  integrator skill's reference embed is `apps/site/`, not the
  deleted `examples/react-demo/`. (Required by CLAUDE.md: "When you
  change anything a skill in `skills/` describes, update that skill
  in the same PR.")
- Root `README.md`'s "Links" section names
  `docs.chartlang.invinite.com` (Netlify-deployed) and
  `chartlang.invinite.com` (live marketing + demo); no
  `outraday-org.github.io/chartlang` or `chartlang.dev` references
  remain.
- `chartlang.invinite.com` and `docs.chartlang.invinite.com` both
  resolve and serve the right site.

## Requirements

### 1. `DEPLOYMENT.md` (root)

Create `DEPLOYMENT.md` at the repo root. Cap at 200 lines. Sections:

```markdown
# Deployment

Operational reference for the two chartlang public sites. Both are
hosted on Netlify, deployed from `main`, DNS pointed at Netlify
from Cloudflare-managed `invinite.com`.

## Sites

| Site | Domain | Netlify Site name | Build config | Source |
|---|---|---|---|---|
| Marketing + demo | chartlang.invinite.com | chartlang-site | netlify/site.toml | apps/site/ |
| Docs | docs.chartlang.invinite.com | chartlang-docs | netlify/docs.toml | docs/ |

## DNS — Cloudflare

Both records are CNAMEs, **DNS-only** (grey cloud, not proxied).
Cloudflare proxying would conflict with Netlify's automatic TLS
provisioning. Proxy can be re-enabled later only after wiring
Cloudflare-side certificates.

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | chartlang.invinite.com | apex-loadbalancer.netlify.com | DNS-only |
| CNAME | docs.chartlang.invinite.com | apex-loadbalancer.netlify.com | DNS-only |

The exact target value (`apex-loadbalancer.netlify.com` or a
site-specific record) is shown by Netlify in each Site's "Domain
management" panel after the custom domain is added.

## Netlify — initial setup (one-time, per site)

1. New Site → Import from Git → outraday-org/chartlang.
2. Production branch: `main`.
3. Branch deploys: **disabled** (only `main` deploys to prod).
4. Deploy Previews: **enabled** (per-PR preview URLs).
5. Config file: `netlify/site.toml` or `netlify/docs.toml`.
6. Domain → Add custom domain → the value from the table above.
7. Wait for the Let's Encrypt cert (typically < 5 min).

## Deploy lifecycle

| Trigger | Result |
|---|---|
| Push to `main` | Both sites build + deploy to production. |
| Open PR | Both sites build + publish a preview URL. The Netlify GitHub App comments the URL on the PR. |
| Close PR | Preview deploys are deleted by Netlify after retention. |

## Roll back

In the Netlify dashboard, navigate to the Site → Deploys, locate
the last known-good deploy, click "Publish deploy". Takes < 30s.

## Add a new subdomain (e.g. `blog.chartlang.invinite.com`)

1. Create a Netlify Site for the new app (or `docs.toml`-style
   config in this repo).
2. Add the custom domain in the Netlify panel — Netlify gives a
   CNAME target.
3. Cloudflare DNS → Add CNAME, DNS-only.
4. Update this `DEPLOYMENT.md` with the new row.

## Compile function — operational notes

`/api/compile` runs the chartlang compiler in a Netlify Function.

- Memory: default 1024 MB. esbuild is mem-light; ~80 MB peak.
- Time: < 500 ms on the playground scripts. 10 s function timeout
  on the free tier.
- Cold start: ~600–900 ms (esbuild binary load).
- Origin allowlist: enforced in
  `apps/site/app/routes/api/compile.ts`. Production +
  `*.netlify.app` previews are accepted; anything else returns 403.
- Source size limit: 64 KB in
  `apps/site/app/lib/server/compile.ts`. Above-limit requests
  return `{ ok: false, diagnostics: [] }`.

## Disabling GitHub Pages

The old docs workflow (`.github/workflows/docs.yml`) is deleted.
GitHub Pages must also be disabled at the repo level:

1. Go to https://github.com/outraday-org/chartlang/settings/pages.
2. Set the source to "None".
3. Save.

This stops the orphan deploy from re-firing on rebased branches.
```

### 2. Delete `examples/react-demo/`

```bash
git rm -r examples/react-demo
```

Edit `pnpm-workspace.yaml`:

```yaml
packages:
    - "packages/*"
    - "apps/*"
    - "examples/canvas2d-adapter"
    # examples/react-demo removed — see tasks/landing-site-netlify-deploy/
```

Re-run `pnpm install` to refresh the lockfile.

### 3. Rewrite the "Try it" section in root `README.md`

Open `README.md`, locate the "## Try it" section, replace with:

```markdown
## Try it

Three ways to exercise the full stack end-to-end:

- **Live demo** — open
  [chartlang.invinite.com](https://chartlang.invinite.com) in any
  browser. The marketing page embeds a live editor + chart
  playground that compiles your script in a Netlify Function and
  renders it through the reference canvas2d adapter.
- **Run the site locally** — clone this repo and run the
  marketing+demo site against the workspace packages:
  ```bash
  pnpm install && pnpm site:dev
  # then open http://localhost:5173
  ```
- **CLI compile** — emit the compiled triple from a `.chart.ts`
  file without any UI:
  ```bash
  pnpm dlx @invinite-org/chartlang-cli compile my-script.chart.ts
  ```
```

Keep root `README.md` under 300 lines (the existing cap).

### 4. Examples directory documentation

Update `examples/CLAUDE.md` so the layout section reflects the
removal:

```markdown
## Layout

- `examples/canvas2d-adapter/` — `chartlang-example-canvas2d-adapter`,
  the Phase-1 reference adapter. Private package
  (`"private": true`); intended to be copied as the starting point
  for a consumer-repo adapter. …
- `examples/scripts/` — three Phase-1 example `.chart.ts` files …
```

Remove the `examples/react-demo/` paragraph.

### 5. Docs cross-link

Either:

- **(a)** Add a new page
  `docs/getting-started/run-the-site-locally.md` that walks through
  `pnpm install && pnpm site:dev` and mentions the public URL. Link
  it from the docs sidebar in `docs/.vitepress/config.ts`.
- **(b)** Append a paragraph to
  `docs/getting-started/embed-in-our-chart.md` pointing at the
  marketing site as the canonical "see it work" surface.

Choose (a) if the docs sidebar can fit one more entry without
visual clutter; (b) if not. Either way `pnpm docs:check` and
`pnpm docs:gate` must stay green — both gates require every linked
page to exist, so verify the link target lands first.

### 5a. Sweep orphan `examples/react-demo/` references

Deleting the folder leaves orphaned, broken pointers across `docs/`
and `skills/`. Update each:

- **`docs/getting-started/embed-in-our-chart.md` (~ line 45)** —
  rewrite the paragraph that begins
  `examples/react-demo/server/compilePlugin.ts shows the same pattern…`
  to point at `apps/site/app/routes/api/compile.ts` and
  `apps/site/app/lib/server/compile.ts` instead. The pattern is
  the same; only the file paths move.
- **`skills/chartlang-setup/SKILL.md` (~ line 96)** — replace
  `examples/react-demo/` with `apps/site/` in the "reference embed"
  sentence. Also rewrite the surrounding context: the reference
  embed runs `compile` behind a `POST /api/compile` **Netlify
  Function** (TanStack server route), not a Vite dev middleware.
- **`skills/chartlang-setup/references/embed.md` (~ lines 39, 120)**
  — same substitutions: the "Full wiring" bullet must point at
  `apps/site/` and call out `apps/site/app/components/demo/ChartPane.tsx`
  + `app.config.ts` aliases as the equivalents of the old
  `vite.config.ts` + `ChartPane.tsx`.

Per the repo's CLAUDE.md ("When you change anything a skill in
`skills/` describes, update that skill in the same PR"), these
edits are **non-negotiable** for the same PR that deletes
`examples/react-demo/`. The `skills:gate` does not regenerate
`chartlang-setup/references/embed.md` (it is hand-authored — only
`chartlang-coding/references/primitives.md` is generated), so the
edits land directly.

### 5b. Root README "Links" section

The current `README.md`'s "Links" section ends with:

```markdown
- **Docs site:** [outraday-org.github.io/chartlang](https://outraday-org.github.io/chartlang/)
  (deployed from `main` by the Docs workflow; `chartlang.dev` once DNS is wired).
```

Replace with:

```markdown
- **Docs site:** [docs.chartlang.invinite.com](https://docs.chartlang.invinite.com/)
  (deployed from `main` by Netlify; see `DEPLOYMENT.md`).
- **Marketing site & live demo:** [chartlang.invinite.com](https://chartlang.invinite.com/).
```

Keep the surrounding "Links" entries (language overview, spec,
primitives, …) untouched. Verify the new "Links" markup keeps the
root README under the 300-line cap (`pnpm readme:check`).

### 6. CI badge cleanup

If Task 6 didn't already do it, remove the Codecov-paired-with-Pages
badge in the root `README.md`. Keep:

- npm badge — `@invinite-org/chartlang-core`.
- build badge — `ci.yml`.
- coverage badge — Codecov (still valid; coverage is unchanged).
- license badge — MIT.

Optionally add a Netlify status badge:

```markdown
[![netlify](https://api.netlify.com/api/v1/badges/<chartlang-site-id>/deploy-status)](https://app.netlify.com/sites/chartlang-site/deploys)
```

Replace `<chartlang-site-id>` with the value from `DEPLOYMENT.md`.

### 7. Final smoke list (post-merge, manual)

Add a "Post-merge checklist" section to the PR description:

- [ ] `chartlang.invinite.com` loads, demo compiles a script.
- [ ] `docs.chartlang.invinite.com` loads, sidebar nav works.
- [ ] Cross-link from docs nav → `https://chartlang.invinite.com`
      works.
- [ ] Cross-link from site nav → `https://docs.chartlang.invinite.com`
      works.
- [ ] GitHub Pages disabled at the repo level.
- [ ] `pnpm site:dev` still runs locally (no Netlify needed).
- [ ] Both sites' favicons match.
- [ ] `pnpm site:build` succeeds on a fresh clone.
- [ ] No references to `examples/react-demo/` remain in
      committed files (`rg react-demo` returns nothing).

### 8. Final repo sweep

```bash
rg --files-with-matches "react-demo" .
```

Expected: empty result after this task. Anything that returns is
either an orphan reference (fix it) or a deliberate historical
reference in a task file (acceptable inside `tasks/` only).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `DEPLOYMENT.md` | Create | Canonical operational reference for both sites. |
| `examples/react-demo/` | Delete | Folder removed; its source lives in `apps/site/`. |
| `pnpm-workspace.yaml` | Modify | Drop `examples/react-demo`. |
| `pnpm-lock.yaml` | Modify (regenerated) | Lockfile refreshed by `pnpm install`. |
| `README.md` (root) | Modify | "Try it" rewritten; badges aligned with Netlify deploy. |
| `examples/CLAUDE.md` | Modify | Layout list pruned. |
| `docs/getting-started/run-the-site-locally.md` | Create (option a) | Docs walkthrough for local dev. |
| `docs/.vitepress/config.ts` | Modify (option a) | Add sidebar entry. |
| `docs/getting-started/embed-in-our-chart.md` | Modify | Re-point compilePlugin reference at `apps/site/app/routes/api/compile.ts`. |
| `skills/chartlang-setup/SKILL.md` | Modify | "Reference embed" now `apps/site/`, not `examples/react-demo/`. |
| `skills/chartlang-setup/references/embed.md` | Modify | Same substitution + new file paths in the Full wiring bullet. |

## Gates

- `pnpm install` — clean; lockfile updates committed.
- `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm conformance`, `pnpm bench:ci`, `pnpm docs:check`,
  `pnpm docs:gate`, `pnpm docs:snippets`, `pnpm docs:build`,
  `pnpm hover:check`, `pnpm readme:check` — all green.
- `pnpm --filter chartlang-site build`, `…typecheck`, `…e2e` —
  all green.
- `rg react-demo` returns no committed-file matches outside
  `tasks/`.
- Manual: both production sites load over HTTPS with valid certs;
  both link to each other.

## Changeset

None.

## Acceptance Criteria

- [ ] `DEPLOYMENT.md` exists, ≤ 200 lines, names both Netlify Site
      IDs and the Cloudflare CNAME targets.
- [ ] `examples/react-demo/` is removed; `pnpm-workspace.yaml`
      reflects this.
- [ ] Root `README.md`'s "Try it" section points at
      `chartlang.invinite.com` first.
- [ ] `examples/CLAUDE.md` layout no longer lists `react-demo/`.
- [ ] Docs has a runnable-locally page (option a) or paragraph
      (option b); the docs sidebar gates remain green.
- [ ] `docs/getting-started/embed-in-our-chart.md` no longer
      references `examples/react-demo/`; it points at
      `apps/site/app/routes/api/compile.ts` /
      `apps/site/app/lib/server/compile.ts` instead.
- [ ] `skills/chartlang-setup/SKILL.md` and
      `skills/chartlang-setup/references/embed.md` describe
      `apps/site/` as the reference embed (per CLAUDE.md's
      "update the skill in the same PR" rule).
- [ ] Root `README.md` "Links" section names
      `docs.chartlang.invinite.com` and `chartlang.invinite.com`;
      no `outraday-org.github.io/chartlang` or `chartlang.dev`
      references remain.
- [ ] Post-merge manual checklist completed and ticked off in
      the PR description before merge.
- [ ] No references to `examples/react-demo/` remain anywhere
      under `apps/`, `packages/`, `scripts/`, `docs/`, `skills/`,
      or the root README.
- [ ] PR description includes screenshots of both production sites
      loading at their custom domains with valid TLS.

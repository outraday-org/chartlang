# Task 6 — CI pipeline updates + Netlify deploy automation

> **Status: TODO**

## Goal

Extend `.github/workflows/ci.yml` to typecheck, lint, build, and
end-to-end test `apps/site/` on every PR; wire two Netlify Sites
(marketing + docs) to deploy from `main` and to publish preview URLs
on every PR; and delete `.github/workflows/docs.yml` so GitHub Pages
is no longer a deploy target. The end-state is one consolidated CI
pipeline gating both sites and one deploy platform (Netlify) hosting
both.

## Prerequisites

- Task 4 complete — `apps/site/` builds for Netlify and ships a
  Playwright e2e suite.
- Task 5 complete — docs are re-themed and `netlify/{site,docs}.toml`
  are committed.

## Current Behavior

`.github/workflows/ci.yml` runs the standard chartlang gate set —
`build`, `typecheck`, `lint`, `format:check`, `test`,
`coverage:report`, `conformance`, `bench:ci`, `docs:check`,
`docs:gate`, `docs:build`, `hover:check`, `readme:check`. It does
**not** know about `apps/site/`. There is no Playwright job.

`.github/workflows/docs.yml` builds the VitePress site and deploys
to GitHub Pages on every push to `main`. Pages is enabled at the
repo level.

No Netlify integration exists.

## Desired Behavior

After this task:

- `apps/site/` is in the CI gate: typecheck, lint, build run on
  every PR.
- The Playwright e2e suite runs on Ubuntu CI; failures block the
  PR.
- Two Netlify Sites are configured (manual, one-time per-site
  setup):
    - `chartlang-site` — base `.`, builds from `netlify/site.toml`,
      custom domain `chartlang.invinite.com`.
    - `chartlang-docs` — base `.`, builds from `netlify/docs.toml`,
      custom domain `docs.chartlang.invinite.com`.
- The Netlify GitHub App is installed on `outraday-org/chartlang`
  and authorised for both sites. Pushes to `main` trigger a deploy
  on both. Pull requests trigger **preview deploys** on both, with
  the URLs commented back on the PR by the Netlify GitHub App.
- `.github/workflows/docs.yml` is **deleted**.
- GitHub Pages is **disabled** at the repo level (manual step;
  noted in the PR).
- The root `README.md`'s status badges are updated to remove the
  Pages link.

## Requirements

### 1. Extend `ci.yml` — site participation

Add **after** the existing `pnpm test` / `pnpm conformance` block,
before the docs steps:

```yaml
            - run: pnpm --filter chartlang-site typecheck
            - run: pnpm --filter chartlang-site build
```

The site build also implicitly validates the Netlify preset output.
Failure here means the site won't deploy — fail fast in CI.

### 2. Add a Playwright job

Append to `.github/workflows/ci.yml` as a separate job (matrix
parity not needed — Playwright + Chromium on Ubuntu Node 20 only):

```yaml
    e2e-site:
        name: E2E (apps/site/)
        runs-on: ubuntu-latest
        needs: test
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: 20
                  cache: pnpm
            - run: pnpm install --frozen-lockfile
            - run: pnpm --filter chartlang-site e2e:install
            - run: pnpm --filter chartlang-site build
            - run: pnpm --filter chartlang-site e2e
            - if: failure()
              uses: actions/upload-artifact@v4
              with:
                  name: playwright-report
                  path: apps/site/playwright-report/
                  retention-days: 7
```

The `needs: test` keeps the e2e gate behind the cheaper static
gates — no Playwright spin-up if typecheck failed.

### 3. Delete the GitHub Pages docs workflow

`git rm .github/workflows/docs.yml`.

The Netlify GitHub App handles all deploys from here on. Document
the removal in the PR description with the manual follow-up:

- After merge: disable GitHub Pages at
  `https://github.com/outraday-org/chartlang/settings/pages`
  (set source to "None"). This stops the orphan deploy from
  re-firing.

The disable step is **manual** because GitHub doesn't expose a
public API to flip Pages off cleanly. Mark it in the PR checklist.

### 4. Netlify Site setup (manual, one-time)

These steps run in the Netlify dashboard once, not in code. List
them in the PR description so the merging maintainer can complete
the setup before merging.

**Site A — `chartlang-site`:**

1. New Site → Import from Git → outraday-org/chartlang.
2. Production branch: `main`. Branch deploys: disabled (only `main`
   deploys to production; PR previews handle the rest).
3. Build settings → Config file location: `netlify/site.toml`.
   Netlify uses the `[build]` block; the `base = "."` value tells
   it to run from the repo root.
4. Domain → Add custom domain → `chartlang.invinite.com`. Netlify
   provisions a Let's Encrypt cert.
5. Build hooks: none required (Git triggers all deploys).
6. Environment variables: none required. The compile function reads
   no secrets.
7. Deploy contexts → Deploy Previews: **Enabled**. Branch deploys:
   **Disabled**.

**Site B — `chartlang-docs`:**

1. Same flow.
2. Config file location: `netlify/docs.toml`.
3. Custom domain: `docs.chartlang.invinite.com`.

Document both site IDs in `DEPLOYMENT.md` (created by Task 7).

### 5. Cloudflare DNS — manual (also Task 7's concern)

Task 7 owns the DNS write-up. For Task 6, include in the PR a
checklist line:

- [ ] DNS records for `chartlang.invinite.com` and
  `docs.chartlang.invinite.com` added at Cloudflare (CNAME →
  Netlify load balancer host, DNS-only / grey cloud).

The actual record values come from Netlify after Step 4 above
("Verify DNS configuration" step in the Netlify domain panel).

### 6. Don't expose the `/api/compile` function publicly without
limits

The compile function does CPU work (esbuild) and could be abused
for general-purpose TypeScript compilation. Mitigations to land in
this task:

**a)** Add a request-body size limit in
`apps/site/app/lib/server/compile.ts`:

```ts
const MAX_SOURCE_LENGTH = 64 * 1024; // 64 KB, far above any realistic .chart.ts
// inside handleCompile, before any compile call:
if (source.length > MAX_SOURCE_LENGTH) {
    return { ok: false, diagnostics: [] };
}
```

**b)** Add a `User-Agent`-style origin check or a CORS allowlist via
`netlify/site.toml` headers — restrict POST to same-origin only:

```toml
[[headers]]
    for = "/api/compile"
    [headers.values]
        Access-Control-Allow-Origin = "https://chartlang.invinite.com"
        Access-Control-Allow-Methods = "POST, OPTIONS"
        Access-Control-Allow-Headers = "Content-Type"
```

For PR previews the Origin header carries the deploy URL — accept it
in the server route by widening the check to `*.netlify.app`
suffixes. Keep this simple: a one-liner string check in
`apps/site/app/routes/api/compile.ts` returning 403 on
non-allowlisted origins. Do **not** install a third-party CORS
library — the rule is small.

**c)** Netlify enforces per-site function execution limits (10s on
the free tier; 26s on Pro). The compiler runs in under 500 ms on
the playground scripts — adequate headroom.

### 7. Codecov participation

`apps/site/` does **not** contribute to coverage. The existing
`coverage:report` step only walks `packages/`, so no change needed.
Verify by reading the script and confirming the glob does not
catch `apps/`.

### 8. Update the root README badges

Keep all four existing badges (npm, build, coverage, license) — none
of them are Pages-coupled. Add a line under the badges advertising
the two custom domains:

```markdown
> Live at [chartlang.invinite.com](https://chartlang.invinite.com).
> Docs at [docs.chartlang.invinite.com](https://docs.chartlang.invinite.com).
```

(This is a soft pre-flight for Task 7's broader README rewrite.)

### 9. Verify CI gate parity

After the changes, walk through every gate command and confirm none
broke:

| Gate | Status after Task 6 |
|---|---|
| `pnpm build` | unchanged |
| `pnpm typecheck` | unchanged |
| `pnpm lint` | unchanged |
| `pnpm format:check` | unchanged |
| `pnpm test` | unchanged |
| `pnpm coverage:report` | unchanged (packages/ only) |
| `pnpm conformance` | unchanged |
| `pnpm bench:ci` | unchanged |
| `pnpm docs:check` | unchanged |
| `pnpm docs:gate` | unchanged |
| `pnpm docs:build` | unchanged |
| `pnpm hover:check` | unchanged |
| `pnpm skills:gate` | unchanged |
| `pnpm readme:check` | unchanged |
| `pnpm --filter chartlang-site typecheck` | **NEW**, runs |
| `pnpm --filter chartlang-site build` | **NEW**, runs |
| `pnpm --filter chartlang-site e2e` | **NEW**, runs (separate job) |
| GitHub Pages docs deploy | **REMOVED** |

### 10. PR preview comments

Once both Netlify Sites are connected, the Netlify GitHub App
automatically comments on PRs with preview URLs. No additional GH
Action required. Verify after first preview that the comment names
both sites distinctly (`chartlang-site` vs `chartlang-docs`) — if
Netlify defaults to one comment per repo, configure each site's
"Deploy preview notifications" to use a distinct prefix.

### 11. Concurrency hygiene

The existing `concurrency: ci-${{ github.ref }}` group cancels
in-progress runs on rebase. Add a parallel group for the e2e job:

```yaml
    e2e-site:
        ...
        concurrency:
            group: e2e-site-${{ github.ref }}
            cancel-in-progress: true
```

(Inheriting the parent `concurrency:` block also works; pick one
approach and stay consistent with the file's existing style.)

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `.github/workflows/ci.yml` | Modify | Add site typecheck/build steps + Playwright job. |
| `.github/workflows/docs.yml` | Delete | Retired in favour of Netlify deploy. |
| `apps/site/app/lib/server/compile.ts` | Modify | Add 64 KB source-size guard + origin allowlist. |
| `apps/site/app/routes/api/compile.ts` | Modify | Return 403 for non-allowlisted Origin headers. |
| `netlify/site.toml` | Modify | Add CORS headers for `/api/compile`. |
| `README.md` (root) | Modify | Add chartlang.invinite.com + docs.chartlang.invinite.com lines under the badges. |

## Gates

- `pnpm install` — clean.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` —
  green.
- `pnpm --filter chartlang-site build`, `…typecheck`, `…e2e` —
  green.
- `pnpm docs:check`, `pnpm docs:gate`, `pnpm docs:build`,
  `pnpm docs:snippets`, `pnpm hover:check`, `pnpm readme:check`,
  `pnpm conformance`, `pnpm bench:ci` — green.
- Manual: open a PR with a no-op change; verify both Netlify preview
  URLs appear and load correctly.
- Manual: merge to `main`; verify both production deploys succeed
  on the two custom domains.
- Manual: GitHub Pages disabled at the repo level after merge.

## Changeset

None.

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` runs `pnpm --filter chartlang-site
      typecheck` and `pnpm --filter chartlang-site build`.
- [ ] `.github/workflows/ci.yml` has an `e2e-site` job running the
      Playwright suite on Ubuntu Node 20, with report artifact
      upload on failure.
- [ ] `.github/workflows/docs.yml` is deleted; no other workflow
      references it.
- [ ] `apps/site/app/lib/server/compile.ts` rejects sources > 64 KB
      with `{ ok: false, diagnostics: [] }`.
- [ ] `apps/site/app/routes/api/compile.ts` enforces an Origin
      allowlist (production domain + Netlify preview suffix).
- [ ] `netlify/site.toml` carries the CORS headers for
      `/api/compile`.
- [ ] Both Netlify Sites set up manually; site IDs recorded in
      the PR description (Task 7 enshrines them in
      `DEPLOYMENT.md`).
- [ ] Cloudflare CNAME records added; first production deploy
      succeeds on both custom domains.
- [ ] GitHub Pages disabled at the repo level (post-merge step
      checked).
- [ ] Root `README.md` mentions the two custom domains under the
      badges.
- [ ] PR description includes screenshots of the preview comments
      from both Netlify Sites.

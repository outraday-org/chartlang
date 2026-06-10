# Release plumbing: CI publish + CHANGELOG + announce

> **Status: TODO**

## Goal

Wire the single-button release path (user-confirmed: CI-driven
publish via changesets/action): uncomment and finish the release job
in `.github/workflows/ci.yml`, enable npm provenance, add the
`publish:release` script the phase done-criteria name, create the
root `CHANGELOG.md`, and add the 1.0 announce section to the root
README. After this task, merging the changesets "Version Packages" PR
publishes every `@invinite-org/chartlang-*` package to npm.

## Prerequisites

- Task 9 — release lands after all surface + docs work so the first
  CI-published release is `1.0.0` at closeout (Task 11).

## Current Behavior

- `.github/workflows/ci.yml` contains a fully-drafted but
  commented-out `release` job (changesets/action@v1, publish:
  `pnpm release`, NPM_TOKEN env) with a comment block explaining the
  §22.11 manual policy.
- Root `package.json`: `"release": "pnpm build && changeset publish"`.
  No `publish:release` script (the phase done-criteria's name).
- `.changeset/config.json` is correct (`access: "public"`,
  `baseBranch: "main"`, changelog: `@changesets/cli/changelog`).
- Per-package `CHANGELOG.md`s exist (changesets-generated). No root
  `CHANGELOG.md`.
- Per-package `package.json`s have `publishConfig.access: "public"`
  but no `provenance` flag; `examples/canvas2d-adapter` is
  `private: true` (stays unpublished).
- PLAN §18 requires `provenance` enabled for npm publish.

## Desired Behavior

- The `release` job in `ci.yml` is live: runs on push to `main` after
  the test job, uses `changesets/action@v1` — which opens/updates the
  "Version Packages" PR while changesets are pending and publishes to
  npm when that PR merges. GitHub release creation enabled
  (`createGithubReleases: true`, the action default).
- npm provenance enabled: `permissions: id-token: write` on the
  release job and `"publishConfig": { "access": "public",
  "provenance": true }` in every publishable package (`core`,
  `compiler`, `runtime`, `adapter-kit`, `host-worker`,
  `host-quickjs`, `language-service`, `editor`, `cli`,
  `conformance`).
- Root scripts: `"publish:release": "pnpm release"` (alias keeping
  the done-criteria name; `release` remains the canonical
  implementation).
- Root `CHANGELOG.md`: a short hand-written index — release
  philosophy (changesets, per-package changelogs), links to each
  package's `CHANGELOG.md`, and a "1.0.0 — Standardisation" heading
  stub the closeout fills in.
- Root `README.md` gains a short **Releases** section: how versions
  are cut (changesets), where changelogs live, link to GitHub
  releases. README stays ≤ 300 lines (currently 174 — headroom is
  fine).
- The §22.11 manual-release path stays documented in the ci.yml
  comment (one line: "manual fallback: `pnpm publish:release` from a
  maintainer machine") and in CONTRIBUTING.md if it describes
  releasing.

## Requirements

### 1. `ci.yml` release job

Uncomment the drafted block and finish it:

```yaml
    release:
        name: Release
        needs: test
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        runs-on: ubuntu-latest
        permissions:
            contents: write
            pull-requests: write
            id-token: write
        steps:
            - uses: actions/checkout@v4
              with: { fetch-depth: 0 }
            - uses: pnpm/action-setup@v4
              with: { version: 9 }
            - uses: actions/setup-node@v4
              with: { node-version: 20, cache: pnpm, registry-url: "https://registry.npmjs.org" }
            - run: pnpm install --frozen-lockfile
            - run: pnpm build
            - uses: changesets/action@v1
              with:
                  publish: pnpm release
                  title: "chore(release): version packages"
              env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
                  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Note the job-level `permissions` override (the workflow-level block
currently grants `contents: read` — the release job needs `write`
for the Version-Packages PR + tags). Document the `NPM_TOKEN` secret
requirement in the comment above the job (the secret itself is
created manually by a maintainer — record that as a follow-up
instruction in the PR description, not a code change).

### 2. Provenance in package manifests

Add `"provenance": true` to `publishConfig` in all ten publishable
packages. Provenance requires publishing from CI with OIDC
(`id-token: write` — wired above); local `pnpm publish:release` runs
will warn — acceptable, documented in the manual-fallback note.

### 3. Root scripts + CHANGELOG

- `package.json`: add `"publish:release": "pnpm release"`.
- Create root `CHANGELOG.md` (~30 lines): release model paragraph,
  per-package changelog link list, empty `## 1.0.0` heading with
  `<!-- filled by phase closeout -->`.

### 4. README announce section

Add a `## Releases` section to root `README.md` (≤ 15 lines):
changesets model, link to root `CHANGELOG.md`, link to GitHub
releases page. Verify `pnpm readme:check` still passes (the script
regex-matches required sections — confirm adding a section doesn't
break its ordering assumptions; adjust placement if it does).

### 5. Dry-run validation

No real publish in this task. Validate:

- `pnpm changeset status` exits cleanly with the pending phase-7
  changesets listed.
- `pnpm build && pnpm changeset publish --dry-run`-equivalent: run
  `pnpm changeset version` on a throwaway branch to confirm version
  math, then discard the branch (do not commit version bumps — that
  is Task 11's job). Record the observed bumps in the PR description.
- `actionlint` (if available) or careful YAML review of the release
  job; the workflow must stay green on the PR itself (the release job
  is `push`-to-`main`-gated and won't run on the PR — note this).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `.github/workflows/ci.yml` | Modify | Live release job + permissions. |
| `packages/{core,compiler,runtime,adapter-kit,host-worker,host-quickjs,language-service,editor,cli,conformance}/package.json` | Modify | `publishConfig.provenance: true`. |
| Root `package.json` | Modify | `publish:release` alias. |
| `CHANGELOG.md` (root) | Create | Release index + 1.0.0 stub heading. |
| `README.md` (root) | Modify | Releases section. |
| `CONTRIBUTING.md` | Modify (if it documents releasing) | Reference the CI path + manual fallback. |

## Gates

- `pnpm readme:check` — root README sections + ≤ 300 lines.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (unchanged — config-only
  task, but the suite must stay green).
- CI workflow YAML valid (PR's own CI run is the proof).

## Changeset

None — release-infrastructure changes (workflow, publishConfig,
scripts) don't alter any package's published API. The `provenance`
publishConfig flag affects publish mechanics, not consumers.

## Acceptance Criteria

- [ ] Release job live in `ci.yml` with correct job-level
      permissions; `NPM_TOKEN` requirement documented.
- [ ] All ten publishable packages carry
      `publishConfig.provenance: true`; canvas2d example stays
      private.
- [ ] `pnpm publish:release` script exists and aliases the canonical
      release flow.
- [ ] Root `CHANGELOG.md` created; README Releases section added;
      `pnpm readme:check` green.
- [ ] `pnpm changeset version` dry-run observed and recorded
      (branch discarded, no bumps committed).
- [ ] CI green on the PR.

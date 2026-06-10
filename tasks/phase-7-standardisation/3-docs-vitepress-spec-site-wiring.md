# VitePress spec-site wiring + CI `docs:build` gate

> **Status: TODO**

## Goal

Make `pnpm docs:build` actually work and gate it in CI. Today the
script runs `vitepress build docs` against a tree with **no
`docs/.vitepress/` config** — this task adds the config (title, nav,
sidebar mirroring PLAN §17.1's tree), fixes whatever dead links the
first real build surfaces, and adds the `docs:build` job step to
`.github/workflows/ci.yml`. The spec-content tasks (4–6) then validate
against a real site build instead of discovering link rot at closeout.

## Prerequisites

- Task 2 (freeze) — the sidebar labels the spec section "the frozen
  `apiVersion: 1` contract"; landing it after the freeze avoids
  re-labelling.

## Current Behavior

- Root `package.json` has `"docs:build": "vitepress build docs"` and
  `vitepress ^1.4.0` in devDependencies, but `docs/.vitepress/` does
  not exist — the build runs with zero config (default theme, no nav,
  no sidebar, default dead-link handling).
- CI (`.github/workflows/ci.yml`) runs `docs:check`, `docs:gate`,
  `hover:check`, `readme:check` — but **not** `docs:build`.
- `docs/` contains: `index.md` (46 lines), `spec/` (5 stubs +
  `pine-migration.md`), `language/` (6 stubs), `adapters/` (4 stubs +
  `reference/`), `hosts/` (3 stubs), `getting-started/` (3 stubs),
  `reference/` (2 stubs), `primitives/` (auto-generated, large).

## Desired Behavior

- `docs/.vitepress/config.ts` ships with:
  - `title: "chartlang"`, `description` from the README elevator
    pitch.
  - `themeConfig.nav`: Guide (getting-started), Language, Spec,
    Primitives, Adapters, Hosts, Reference.
  - `themeConfig.sidebar`: one section per §17.1 directory, every
    existing page linked. `docs/primitives/` gets *index-level* links
    only (`/primitives/ta/`, `/primitives/draw/`, …) — per-primitive
    pages are reachable from their index pages, keeping the sidebar
    maintainable as primitives grow.
  - `ignoreDeadLinks: false` (default — dead links fail the build;
    that IS the gate).
  - `srcExclude` for `CLAUDE.md` files inside `docs/`.
- `pnpm docs:build` exits 0 locally. Every dead link the first build
  surfaces is fixed in this task (expected: a handful of
  repo-relative links like `./LICENSE` or `tasks/...` references that
  need `https://github.com/...` absolute forms or removal).
- CI runs `pnpm docs:build` after `docs:gate`.
- `docs/.vitepress/cache/` + `docs/.vitepress/dist/` are
  git-ignored.

## Requirements

### 1. `docs/.vitepress/config.ts`

```ts
import { defineConfig } from "vitepress";

export default defineConfig({
    title: "chartlang",
    description:
        "Open TypeScript eDSL for indicator, drawing, and alert scripts that run on any conforming chart adapter.",
    srcExclude: ["**/CLAUDE.md"],
    themeConfig: {
        nav: [
            { text: "Getting Started", link: "/getting-started/write-your-first-script" },
            { text: "Language", link: "/language/overview" },
            { text: "Spec", link: "/spec/grammar" },
            { text: "Primitives", link: "/primitives/ta/" },
            { text: "Adapters", link: "/adapters/contract" },
        ],
        sidebar: {
            // One block per top-level dir; enumerate every page that
            // exists at authoring time. Spec section ordered:
            // grammar, semantics, manifest, emissions, versioning,
            // pine-migration.
        },
        socialLinks: [
            { icon: "github", link: "https://github.com/outraday-org/chartlang" },
        ],
    },
});
```

The sidebar literal enumerates the actual files found at
implementation time (`ls docs/**/*.md`) — do not invent pages. The
spec section title is **"Spec — the frozen `apiVersion: 1`
contract"**.

### 2. Dead-link fixes

Run `pnpm docs:build`; for every dead-link error:

- Links between docs pages: fix the relative path.
- Links out of `docs/` into the repo (`../LICENSE`,
  `../packages/...`): rewrite as absolute GitHub URLs
  (`https://github.com/outraday-org/chartlang/blob/main/...`).
- Links to pages that genuinely don't exist yet: remove or point at
  the closest existing page. Do **not** create placeholder pages
  beyond what exists — content lands in Tasks 4–6.

`docs/index.md` becomes the VitePress home page; verify its links and
add `hero`-style front matter only if the default layout renders the
existing content poorly (smallest change that produces a sane landing
page).

### 3. CI wiring

In `.github/workflows/ci.yml`, after the `pnpm docs:gate` step:

```yaml
            - run: pnpm docs:build
```

(Repository-wide formatting uses 4-space YAML indentation — match the
existing steps.)

### 4. Ignore build artefacts

Append to the root `.gitignore`:

```
docs/.vitepress/cache/
docs/.vitepress/dist/
```

### 5. No README / package changes

This task touches `docs/`, `.gitignore`, and CI only. The
`docs:build` script already exists. Workspace TypeScript config does
not need to include `docs/.vitepress/config.ts` (VitePress compiles
it itself) — verify `pnpm typecheck` doesn't pick it up; if the root
tsconfig glob catches it, add the directory to that config's
`exclude`.

### 6. Validation that the gate actually gates

Temporarily introduce a bogus link locally, confirm `docs:build`
fails, remove it. Record in the PR description (no committed test —
the gate is VitePress's own link checker).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/.vitepress/config.ts` | Create | Site config: nav, sidebar, dead-link gate. |
| `docs/index.md` | Modify (if needed) | Home-page front matter / link fixes. |
| `docs/**/*.md` | Modify (link fixes only) | Whatever the first real build flags. |
| `.github/workflows/ci.yml` | Modify | Add `pnpm docs:build` step. |
| `.gitignore` | Modify | Ignore VitePress cache/dist. |

## Gates

- `pnpm docs:build` — new; must exit 0.
- `pnpm docs:check`
- `pnpm docs:gate`
- `pnpm readme:check`
- `pnpm typecheck` (confirm the config file doesn't leak into the
  workspace build)
- `pnpm lint`

## Changeset

None — docs/CI-only changes do not take a changeset in this workspace
(per the Phase 6 convention).

## Acceptance Criteria

- [ ] `docs/.vitepress/config.ts` exists with nav + sidebar covering
      every existing docs page; spec section ordered grammar →
      semantics → manifest → emissions → versioning → pine-migration.
- [ ] `pnpm docs:build` exits 0 locally with `ignoreDeadLinks` left
      at the failing default.
- [ ] CI runs `docs:build`; the job is green.
- [ ] VitePress cache/dist git-ignored.
- [ ] Bogus-link experiment recorded in the PR description proving
      the gate fails on dead links.
- [ ] All existing gates stay green.

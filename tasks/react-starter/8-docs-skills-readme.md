# Docs + skills-setup mirror + root README + changeset

> **Status: TODO**

## Goal

Make the starter discoverable and keep the repo's maintenance contracts
green: a docs page for the starter + installer, the
`skills/chartlang-setup` reference update required by the repo-root
skill-mirroring rule, root `README.md` + `apps/CLAUDE.md` mentions, and
the final changeset bookkeeping.

## Prerequisites

- Task 7 (`create-chartlang` exists and works end-to-end).

## Current Behavior

Nothing documents the starter or the `create-chartlang` installer.
`skills/chartlang-setup/` describes the integrate-chartlang contract
(compile/host/adapter) but knows nothing about a clonable starter app.
Root `README.md` lists packages/examples but not the starter.

## Desired Behavior

A user can discover the starter from the docs site and the root README,
run `npm create chartlang@latest`, and the setup skill points integrators
at the starter as the fastest "real app" path.

## Requirements

### 1. Docs page — `docs/guide/react-starter.md` (or `docs/starter/`)

- What the starter is: editor + chart + SQLite saved scripts + EODData
  daily US data, shadcn default theme, choose-your-adapter.
- **Quickstart:** `npm create chartlang@latest my-app`, get a free
  EODData key (link), set `EODDATA_API_KEY`, `pnpm dev`.
- The **free-tier limits** called out plainly: 100 calls/day, daily EOD
  only, US symbols only — and how the SQLite cache + quota badge protect
  the user.
- How to **switch chart libraries** after install (`add-adapter` + the
  `activeAdapter` seam), linking the adapters gallery from
  multi-library-adapters Task 15.
- Wire the page into the VitePress nav/sidebar (`docs/.vitepress/config.ts`).
- Follow `docs/CLAUDE.md` conventions (no invented APIs; link real
  package surfaces).

### 2. Skill mirror — `skills/chartlang-setup/`

Per the repo-root rule ("when you change anything a skill describes,
update that skill in the same PR"): add a section/reference to the setup
skill presenting `create-chartlang` as the recommended starting point
for integrators who want a working app (editor + host + adapter wired),
distinct from hand-integrating the packages. Mirror the
`activeAdapter` seam + the compile-server-route pattern at a high level.
Run `pnpm skills:generate` if the generated reference is affected and
commit the result (the `skills:gate` will fail CI otherwise).

### 3. Root README + apps/CLAUDE.md

- Root `README.md` — add the starter + `create-chartlang` to the
  "getting started"/apps section with the one-line `npm create` command.
  Keep the root README ≤300 lines (root readme gate).
- `apps/CLAUDE.md` — confirm the Task 1 entry for `apps/react-starter`
  is complete (default theme, cloned by `create-chartlang`, brand
  relaxation, no Netlify deploy plugin) now that the full app exists.

### 4. Final changeset bookkeeping

- Ensure `create-chartlang`'s changeset (Task 7) is present.
- Docs/skills/README/apps changes need **no** changeset (docs + apps +
  skills are not published packages).

### Edge cases

- **Skill drift:** if `pnpm skills:generate` output changes, commit it or
  `skills:gate` fails — verify the gate is green.
- **Docs example links** must point at real, shipped surfaces (the
  starter routes, the CLI `add-adapter`, the adapters gallery), not
  placeholders.
- **README length gates:** root ≤300, package READMEs ≤100 — re-check
  after edits (`pnpm readme:check`).

### Test / verification

- `pnpm docs:build` succeeds with the new page linked.
- `pnpm skills:gate` green.
- `pnpm readme:check` green.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/guide/react-starter.md` | Create | starter + installer guide |
| `docs/.vitepress/config.ts` | Modify | nav/sidebar entry |
| `skills/chartlang-setup/**` | Modify | starter as recommended path |
| `skills/chartlang-coding/references/primitives.md` | Regenerate (if affected) | `pnpm skills:generate` output |
| `README.md` (root) | Modify | starter + `npm create` mention |
| `apps/CLAUDE.md` | Modify | finalize `apps/react-starter` entry |

## Gates

- `pnpm docs:build` / `pnpm docs:check`
- `pnpm skills:gate`
- `pnpm readme:check`
- `pnpm typecheck` (docs config)

## Changeset

None new here (docs/skills/apps are unpublished). The
`create-chartlang` changeset from Task 7 covers the only published
surface in this feature.

## Acceptance Criteria

- A docs page documents the starter, the `npm create chartlang` flow, the
  EODData free-tier limits, and how to switch chart libraries.
- `skills/chartlang-setup` presents the starter as the recommended
  integrator on-ramp; `skills:gate` green.
- Root README + `apps/CLAUDE.md` mention the starter; all README gates
  green.
- `docs:build` succeeds; no broken links.
</content>

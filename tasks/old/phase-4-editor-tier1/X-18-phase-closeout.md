# Task 18 — Phase closeout — docs:generate sweep, version bumps, changeset bundle

> **Status: TODO**

## Goal

Land the Phase-4 closeout: re-run `pnpm docs:generate` to refresh
the auto-generated `docs/primitives/` pages for every new Phase-4
surface, refresh every package README under the 100-line cap,
bump every affected package's `package.json` version to `0.4.x`
via a bundled changeset, and tick the Phase-4 README's "done
criteria" checklist. After this task, the repo is at the `0.4`
release tag.

## Prerequisites

- Task 17 (every Phase-4 surface is shipped + tested).

## Current Behavior

- Tasks 1–17 ship Phase-4 surfaces. Each task lands its own
  changeset.
- `docs/primitives/` reflects Phase 3 state — new directories for
  `state/`, `barstate/`, `syminfo/`, `timeframe/`, `input/`,
  `request/` don't exist yet.
- Every package README reflects Phase 3 state.
- Every package `package.json` version is `0.3.x` (or the
  per-package Phase-3 close version).

## Desired Behavior

- `pnpm docs:generate` (which runs `pnpm chartlang docs` — the
  CLI's `docs` subcommand) walks every JSDoc'd export in
  `packages/core/src/` and writes:
  - `docs/primitives/input/<kind>.md` × 12
  - `docs/primitives/state/<flavour>.md` × 8 (or 1 combined page
    if the gen script prefers per-namespace)
  - `docs/primitives/barstate.md` (1 page)
  - `docs/primitives/syminfo.md` (1 page)
  - `docs/primitives/timeframe.md` (1 page)
  - `docs/primitives/request/security.md` (1 page)
  - `docs/primitives/define/<override>.md` for the 6 override
    fields (or fold into a single `defineIndicator.md` enhancement
    page — match Phase 3's pattern).
- `pnpm docs:check` re-executes every `@example` block in the
  generated pages and passes.
- Every package README is refreshed:
  - `@invinite-org/chartlang-core` — add the 5 new namespace
    bullets (`input`, `state`, `barstate`, `syminfo`,
    `timeframe`, `request`).
  - `@invinite-org/chartlang-compiler` — add the 4 new diagnostic
    codes; add `extractInputs` / `extractRequestedIntervals` /
    `extractRequiresIntervals` to the public-surface list.
  - `@invinite-org/chartlang-runtime` — add `state.*` lifecycle
    summary; add `request.security` NaN-fallback note.
  - `@invinite-org/chartlang-adapter-kit` — add the 7 new
    capability-builder bullets.
  - `@invinite-org/chartlang-language-service` — promote from the
    placeholder README to the real public-surface table.
  - `@invinite-org/chartlang-editor` — promote from the
    placeholder; document the `/react` sub-export.
  - Every README ≤ 100 lines (`pnpm readme:check` enforces).
- Every affected package's `package.json` version is bumped to
  `0.4.x` (start at `0.4.0`). The bundle changeset records the
  Phase-4 surface deltas per package.
- The Phase-4 README's done criteria checklist is ticked.

## Requirements

### 1. `pnpm docs:generate` run + commit

Run the generator. Inspect the diff. Commit the generated
markdown verbatim. If the generator misses any new surface,
either:

- Extend the CLI docs generator behind `pnpm chartlang docs` to
  cover the new namespace pattern (preferred — keeps the
  generator authoritative).
- File a follow-up task and document the gap.

The Phase-2/3 pattern is one page per primitive; for the
read-only views (`barstate`, `syminfo`, `timeframe`) a single
page per namespace is fine.

### 2. README refreshes

For each affected package, walk the existing README + insert
the Phase-4 deltas. Keep under 100 lines.

The `core/README.md` will need the heaviest edits — 5 new
namespaces. Trim Phase-2/3 bullets if needed to keep the cap.

The `language-service/README.md` and `editor/README.md` were
placeholders (Phase 1 scaffold). Replace with the real
public-surface tables.

### 3. `package.json` version bumps

The bundled changeset (`.changeset/phase-4-close.md`) declares
the bump:

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-language-service": minor
"@invinite-org/chartlang-editor": minor
"@invinite-org/chartlang-conformance": minor
---

Phase 4 — Editor + Inputs + Timeframes + Tier-1 Pine parity.
Adds: input.* builders, state.* / state.tick.* slots,
barstate / syminfo / timeframe views, request.security typed
surface (NaN fallback), defineIndicator overrides,
Capabilities triad (intervals / multiTimeframe / subPanes /
symInfoFields / maxDrawingsPerScript / alertConditions / logs),
language-service hover registry + LSP-style API, CodeMirror 6
editor shell + /react sub-export, Inputs UI ViewModel + React
form. See tasks/phase-4-editor-tier1/README.md.
```

Running `pnpm changeset version` bumps every affected
`package.json` to its next minor version (`0.4.0`).
`pnpm install` updates `pnpm-lock.yaml`.

### 4. Phase-4 README closeout

Tick the Phase-4 README's "done criteria" checklist (the
bulleted list at the top of `tasks/phase-4-editor-tier1/
README.md`):

- [x] All 17 prior tasks merged.
- [x] `pnpm -r test` 100% coverage across affected packages.
- [x] `pnpm conformance` green.
- [x] `pnpm docs:check` green.
- [x] `pnpm readme:check` green.
- [x] `package.json` versions at `0.4.0`.
- [x] 3 Pine-port example scripts compile + render through
       canvas2d.

### 5. Tests

- **`scripts/docs-gate.ts`** (root-level gate, invoked via
  `pnpm docs:gate`) — already runs every PR. Verify it covers
  the new pages (it walks the generated tree recursively).
- **`scripts/readme-check.ts`** — verify every README ≤ 100
  lines (existing check, no change).
- **`packages/conformance/`** — re-run the full suite; verify
  green.
- **`packages/cli/src/e2e.test.ts`** — re-run; verify all 7
  example scripts compile.

### 6. JSDoc gate

`pnpm docs:check` is the gate. No new JSDoc lands in this task
— it's a closeout.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/primitives/input/*.md` × 12 | Create (generated) | Per-builder pages |
| `docs/primitives/state/*.md` × 8 | Create (generated) | Per-flavour pages |
| `docs/primitives/barstate.md` | Create (generated) | Namespace page |
| `docs/primitives/syminfo.md` | Create (generated) | Namespace page |
| `docs/primitives/timeframe.md` | Create (generated) | Namespace page |
| `docs/primitives/request/security.md` | Create (generated) | Method page |
| `docs/primitives/define/*.md` (×6 overrides) | Create (generated) | Per-override pages |
| `packages/core/README.md` | Modify | Add 5 namespace bullets |
| `packages/compiler/README.md` | Modify | Add diagnostic codes + new extractors |
| `packages/runtime/README.md` | Modify | Add state + request.security notes |
| `packages/adapter-kit/README.md` | Modify | Add 7 capability bullets |
| `packages/language-service/README.md` | Replace | Real public-surface table |
| `packages/editor/README.md` | Replace | Real public-surface + `/react` |
| `packages/conformance/README.md` | Modify | Add 8 new scenario bullets |
| Every affected `package.json` | Modify | `version: 0.4.0` |
| `pnpm-lock.yaml` | Modify | Refresh via `pnpm install` |
| `.changeset/phase-4-close.md` | Create | Bundled changeset |
| `tasks/phase-4-editor-tier1/README.md` | Modify | Tick done criteria |

## Edge Cases

- **`packages/cli/src/commands/docs.ts` may miss new namespace
  patterns** — the Phase-2 / Phase-3 docs generator (invoked via
  `pnpm chartlang docs`) walks the `ta.*` and `draw.*`
  namespaces explicitly. The new namespaces (`input.*`,
  `state.*`, `state.tick.*`, `request.*`, plus the const views
  `barstate` / `syminfo` / `timeframe`) may need generator
  extension. Do it inside this task — keep the generator
  authoritative. (`scripts/gen-docs.ts` does NOT exist; the
  docs generator lives in the `chartlang` CLI.)
- **`docs/primitives/state/state.tick.float.md`** — filename
  encoding for the dotted name. Match the existing camelCase
  approach (`stateTickFloat.md`?) and document the decision in
  the README under a "Generated filename convention" header.
- **READMEs ≤ 100 lines** — trimming Phase-2/3 bullets is fine;
  the historical context lives in the changeset history + PR
  archive.
- **Version bumps are minor (`0.4.0`)** — no breaking surface in
  Phase 4. `apiVersion: 1` unchanged.
- **`examples/canvas2d-adapter`** is `private: true` —
  changeset skips it; no version bump needed.
- **`examples/scripts/*.chart.ts`** — not packages; no version.
- **Determinism check** — run `pnpm docs:generate` twice + diff;
  the second run must produce no diff. Same for `pnpm
  hover:check` (Task 13's gate).
- **CHANGELOG.md** — if `pnpm changeset version` regenerates
  per-package CHANGELOGs, commit them. The Phase-4 bundle entry
  appears at the top.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage on
  every affected package), `pnpm docs:check`,
  `pnpm readme:check`, `pnpm conformance`, `pnpm bench:ci`,
  `pnpm hover:check` (Task 13 gate).
- `pnpm changeset version` succeeds and updates every affected
  `package.json`.
- `pnpm install` runs cleanly + `pnpm-lock.yaml` is
  reproducible.

## Changeset

`.changeset/phase-4-close.md` — bundled minor bumps for the 7
affected packages. The per-task changesets from Tasks 1–17 are
**not** removed; `pnpm changeset version` merges them all into
the per-package CHANGELOG history.

## Acceptance Criteria

- Every new Phase-4 core export has an auto-generated
  `docs/primitives/` page.
- Every affected package README is refreshed + ≤ 100 lines.
- Every affected `package.json` is at `0.4.0`.
- The Phase-4 README's done criteria checklist is ticked.
- `pnpm docs:check`, `pnpm readme:check`, `pnpm conformance`,
  `pnpm hover:check`, `pnpm test`, `pnpm bench:ci` all green.
- `pnpm-lock.yaml` is checked in + reproducible.
- Phase 4 ships as `0.4` per the per-package versions.

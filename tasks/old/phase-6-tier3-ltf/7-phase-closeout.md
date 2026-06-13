# Phase 6 closeout — docs sweep, version bumps, changeset bundle

> **Status: TODO**

## Goal

Finalise Phase 6: bundle every per-task changeset into the `0.6.x`
release, regenerate the auto-generated docs, verify every gate is
green, trim READMEs, tick every done-criterion bullet in
`tasks/phase-6-tier3-ltf/README.md`, and commit the closeout
changeset.

## Prerequisites

- Tasks 1–6 completed and merged.

## Current Behavior

Tasks 1–6 each committed their own per-package changeset (minor
bumps on the affected packages, patch on consumers). Auto-generated
docs are partially regenerated from per-task `pnpm chartlang docs`
runs, but a final sweep ensures every new surface has a page and
every page resolves.

## Desired Behavior

After this task:

- `pnpm changeset version` consumes every Phase-6 changeset and
  bumps the affected packages to `0.6.x`.
- `pnpm chartlang docs` regenerates every auto-generated
  `docs/primitives/...` page. `pnpm docs:check` is green.
- Every package's `README.md` is ≤ 100 lines; root README ≤ 300
  lines. `pnpm readme:check` is green.
- `pnpm conformance` is green against the canvas2d adapter,
  including the three new LTF scenarios.
- `pnpm bench:ci` is green (no regressions on Phase-5 bench pairs;
  new LTF bench pair holds under `THRESHOLD_MS`).
- Every bullet under "Phase 6 closes when" in
  `tasks/phase-6-tier3-ltf/README.md` is checked off.
- A single closeout changeset records the phase summary for the
  release notes.

## Requirements

### 1. Aggregate per-task changesets

Verify every Phase-6 task landed its changeset:

| Task | Changeset file |
|------|----------------|
| 1 | `.changeset/phase6-interval-seconds.md` |
| 2 | `.changeset/phase6-time-subpath.md` |
| 3 | `.changeset/phase6-bucket-ltf-kernel.md` |
| 4 | `.changeset/phase6-request-lower-tf-surface.md` |
| 5 | `.changeset/phase6-runtime-lower-tf.md` |
| 6 | _none — docs-only changes do not take a changeset in this workspace_ |

If any per-task changeset is missing, re-open the task — do not paper
over with a bundled changeset.

### 2. Run `pnpm changeset version`

This consumes every `.changeset/*.md` and bumps `package.json`
versions across the workspace. Verify the resulting bumps:

- `@invinite-org/chartlang-core` → `0.6.0` (minor — surface additions)
- `@invinite-org/chartlang-runtime` → `0.6.0` (minor)
- `@invinite-org/chartlang-compiler` → `0.6.0` (minor)
- `@invinite-org/chartlang-canvas2d-adapter` → `0.6.0` (minor — Task 5
  widens declared `intervals`)
- `@invinite-org/chartlang-conformance` → `0.6.0` (minor — Task 5
  adds three LTF scenarios)
- `@invinite-org/chartlang-adapter-kit` → **no bump** — Task 4 moved
  the diagnostic add from adapter-kit's runtime `DiagnosticCode` union
  to the compiler's `CompileDiagnosticCode` union; adapter-kit is
  untouched this phase.
- Other consumer packages → patch bumps if any per-task changeset
  declared them.

Cross-check each `PACKAGE_VERSION` constant export matches the new
`package.json` version (the `pnpm scaffold` template enforces this
constant; the closeout sweep verifies no drift).

### 3. Regenerate docs

```bash
pnpm chartlang docs
pnpm docs:check
```

Every new public surface from Tasks 1–5 must have a generated page:

- `docs/primitives/interval/intervalToSeconds.md` (Task 1)
- `docs/primitives/time/session.md`,
  `docs/primitives/time/nyDayKey.md`,
  `docs/primitives/time/nySessionBounds.md`,
  `docs/primitives/time/weekday.md`,
  `docs/primitives/time/weekKey.md` (Task 2)
- `docs/primitives/request/bucketLtfBarsByMainContainment.md` (Task 3)
- `docs/primitives/request/lowerTf.md` (Tasks 4 + 5)

Verify the migration guide (`docs/spec/pine-migration.md`) is
recognised by `docs:check` and every internal link resolves.

### 4. README trims

For every package whose surface changed in Phase 6, audit its README:

- `packages/core/README.md` ≤ 100 lines.
- `packages/runtime/README.md` ≤ 100 lines.
- `packages/compiler/README.md` ≤ 100 lines.
- `packages/adapter-kit/README.md` ≤ 100 lines.
- `examples/canvas2d-adapter/README.md` ≤ 100 lines.
- `packages/conformance/README.md` ≤ 100 lines.
- Root `README.md` ≤ 300 lines.

If any README is over budget, trim by moving prose to the
auto-generated docs (`docs/primitives/...`) and keep the README as a
table-of-contents.

### 5. Run every gate

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm -r test --coverage   # 100% on every affected package
pnpm conformance          # canvas2d reference
pnpm bench:ci             # no regressions; new LTF bench passes
pnpm docs:check
pnpm readme:check
```

Every command must exit zero. If any fails, do not proceed — fix the
underlying issue in a follow-up task before closing the phase.

### 6. Tick the README done-criteria bullets

In `tasks/phase-6-tier3-ltf/README.md` "Phase 6 closes when"
section, change every `[ ]` to `[x]` once the criterion is genuinely
met. Do not tick speculatively — the closeout commit is the wall
between "in progress" and "shipped".

### 7. Closeout changeset

`.changeset/phase6-closeout.md`:

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-canvas2d-adapter": minor
"@invinite-org/chartlang-conformance": minor
---

Phase 6 (`0.6`) closeout — Tier-3 ergonomics + Lower-Timeframe.

- `IntervalDescriptor.intervalSeconds?` + `intervalToSeconds` helper
  (PLAN §4.9).
- `@invinite-org/chartlang-core/time` subpath: session/timezone
  helpers ported from invinite (PLAN §4.4).
- `request.lowerTf({ interval })` returning
  `Series<ReadonlyArray<Bar>>` of contained LTF bars, gated by
  `Capabilities.multiTimeframe` (PLAN §4.5). Compile-time
  `lower-tf-not-lower` diagnostic enforces ordering.
- Canvas2d adapter widens declared `intervals` with sub-minute
  entries; three new LTF conformance scenarios.
- `docs/spec/pine-migration.md` curated migration guide with
  worked examples and feature matrix.
```

(Pure documentation-style changeset — the actual version bumps
happen via the per-task changesets. This closeout entry is for the
CHANGELOG narrative.)

### 8. Plan the Phase 7 handoff

Verify `tasks/phase-7-standardisation/README.md` exists with a "Phase
6 prerequisites" section that correctly references the new Phase-6
surfaces (`request.lowerTf`, `time` subpath, `intervalToSeconds`). If
it doesn't, add the section so the next-phase work starts cleanly.

This is a **review-only** check — Phase 7 task content is not
authored in this closeout.

### 9. Tag the release commit

Once every gate is green and changesets have been merged:

- Commit message: `chore(release): phase 6 — Tier-3 ergonomics + LTF (0.6.0)`.
- Tag (optional, follows the workspace convention): `v0.6.0`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| Per-package `package.json` | Modify (via changesets) | Version bumps to `0.6.x`. |
| Per-package `src/version.ts` (if `PACKAGE_VERSION` is hand-exported) | Modify | Sync constants to new versions. |
| Per-package `CHANGELOG.md` | Modify (via changesets) | Phase 6 release notes. |
| Auto-generated `docs/primitives/**` | Modify (via `pnpm chartlang docs`) | Regenerated pages. |
| `tasks/phase-6-tier3-ltf/README.md` | Modify | Tick done-criteria bullets. |
| `tasks/phase-7-standardisation/README.md` | Modify (if missing) | Phase 6 prerequisites section. |
| `.changeset/phase6-closeout.md` | Create | Closeout narrative changeset. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test --coverage` — 100% on every affected package
- `pnpm conformance` — canvas2d adapter
- `pnpm bench:ci` — no regressions
- `pnpm docs:check`
- `pnpm readme:check`

All seven must exit zero before the closeout commit lands.

## Changeset

`.changeset/phase6-closeout.md` (shown above).

## Acceptance Criteria

- [ ] Every per-task changeset from Tasks 1–6 is present in
      `.changeset/`.
- [ ] `pnpm changeset version` ran successfully; every Phase-6-affected
      package is at `0.6.0`.
- [ ] `PACKAGE_VERSION` constants match `package.json` versions in
      every package.
- [ ] `pnpm chartlang docs` regenerated; every new surface has a
      `docs/primitives/...` page.
- [ ] `docs/spec/pine-migration.md` validates under `pnpm docs:check`.
- [ ] Every package README ≤ 100 lines; root README ≤ 300 lines.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm conformance`,
      `pnpm bench:ci`, `pnpm docs:check`, `pnpm readme:check` all
      exit zero.
- [ ] Every `[ ]` in `tasks/phase-6-tier3-ltf/README.md` "Phase 6
      closes when" section flipped to `[x]`.
- [ ] Closeout changeset committed.
- [ ] Phase 7 README references Phase-6 surfaces in its
      prerequisites section.
- [ ] Release commit message follows the workspace convention.

# Phase 7 closeout — 1.0.0 major, tag, release

> **Status: TODO**

## Goal

Close Phase 7 and ship `1.0.0`: land the phase-wide major changeset,
consume every pending changeset so all published packages reach
`1.0.0`, fill the root CHANGELOG's 1.0.0 entry, run every gate, tick
the phase done-criteria, and cut the `v1.0.0` tag — which is, by the
Task-3/4 decision, the frozen snapshot of the `apiVersion: 1` spec.

## Prerequisites

- Tasks 1–10 completed and merged.

## Current Behavior

Tasks 1–10 each landed their changeset (or were docs/infra-only):

| Task | Changeset |
|------|-----------|
| 1 | `.changeset/phase7-pre-freeze-sweep.md` (major on conformance, patch elsewhere) |
| 2 | `.changeset/phase7-api-version-freeze.md` (patch) |
| 3–6 | none — docs/CI-only |
| 7 | `.changeset/phase7-conformance-reports.md` (minor) |
| 8 | `.changeset/phase7-scaffold-conformance.md` (minor) |
| 9 | none — docs-only |
| 10 | none — release-infra-only |

Packages sit at `0.6.x` (post Phase-6 closeout). The CI release job
(Task 10) is live and will publish whatever `changeset version`
produces on merge to main.

## Desired Behavior

Every published `@invinite-org/chartlang-*` package is at `1.0.0`,
npm-published with provenance via the CI release flow, `v1.0.0`
tagged, GitHub release notes carrying the coverage report, and every
done-criterion in `tasks/phase-7-standardisation/README.md` ticked.

## Requirements

### 1. Verify per-task changesets

Confirm the four phase-7 changesets above exist in `.changeset/`. If
any is missing, re-open the owning task — do not paper over with the
closeout changeset.

### 2. The 1.0.0 major changeset

`.changeset/phase7-one-point-zero.md` declaring **major** on all ten
publishable packages:

```md
---
"@invinite-org/chartlang-core": major
"@invinite-org/chartlang-compiler": major
"@invinite-org/chartlang-runtime": major
"@invinite-org/chartlang-adapter-kit": major
"@invinite-org/chartlang-host-worker": major
"@invinite-org/chartlang-host-quickjs": major
"@invinite-org/chartlang-language-service": major
"@invinite-org/chartlang-editor": major
"@invinite-org/chartlang-cli": major
"@invinite-org/chartlang-conformance": major
---

chartlang `1.0.0` — the `apiVersion: 1` standard.

- `apiVersion: 1` frozen: compiler accepts only the frozen language
  version; `STATEFUL_PRIMITIVES` locked at 172 entries by exact
  name-set; every shipping export `@stable`; pre-1.0 deprecations
  removed (`PHASE_1_SCENARIOS`).
- Canonical language spec published (`docs/spec/`): grammar,
  semantics, manifest, emissions, versioning — self-contained for
  alternate implementations. The `v1.0.0` tag is the frozen spec
  snapshot.
- Public conformance reports: `pnpm conformance --report` emits
  `CONFORMANCE.md` + `conformance-report.json`; canvas2d reference
  report published and drift-gated.
- Adapter-author path proven end-to-end: scaffolded adapters ship a
  wired conformance test; full writing-an-adapter tutorial +
  Lightweight Charts porting walkthrough.
- Pine migration guide finalised with a pattern-coverage matrix
  audited against the top ~50 Pine scripts.
```

### 3. Version + verify

On the closeout branch run `pnpm changeset version` and verify:

- Every publishable package's `package.json` is exactly `1.0.0`
  (major from 0.x → 1.0.0; the pending minor/patch changesets fold
  in).
- `examples/canvas2d-adapter` (private): bump its version field to
  `1.0.0` manually for consistency if changesets skipped it.
- Workspace-internal dependency ranges resolved correctly.
- Per-package `CHANGELOG.md`s carry the 1.0.0 narrative.

(No `PACKAGE_VERSION` constant sweep — the Phase-0 placeholder
constant was removed from every `src/index.ts` once each package
shipped real exports; `packages/CLAUDE.md`'s "until the package ships
real exports" clause covers this. The only PACKAGE_VERSION reference
that remains is `packages/host-quickjs/src/index.test.ts`'s assertion
that the symbol is **not** in the public surface — leave it.)

### 4. Root CHANGELOG + README

- Fill the `## 1.0.0` heading in root `CHANGELOG.md` (Task 10's stub)
  with the changeset narrative summary + date.
- Root README: verify badges (npm badge now resolves to `1.0.0`
  post-publish), and the Releases section links work. README ≤ 300
  lines; every package README ≤ 100 lines.

### 5. Docs sweep

```bash
pnpm chartlang docs
pnpm docs:gate
pnpm gen-hover-registry && pnpm hover:check
pnpm docs:check
pnpm docs:build
```

Any `@since` / version string in generated pages reflecting the new
versions is regenerated and committed.

### 6. Conformance report refresh

`pnpm conformance:report` — regenerate the canvas2d
`CONFORMANCE.md` + `conformance-report.json` (the `generatedBy`
suite version string changes to `@1.0.0`). Commit; the
`--report --check` CI gate must be green.

### 7. Run every gate

```bash
pnpm check        # the aggregate: format, lint, build, typecheck,
                  # test, docs:check, docs:gate, readme:check, conformance
pnpm bench:ci
pnpm hover:check
pnpm test:scripts
pnpm docs:build
pnpm tsx scripts/run-conformance.ts --report --check
```

All must exit zero. A failure re-opens the owning task; the closeout
does not fix substantive issues inline.

### 8. Tick the done-criteria

Flip every `[ ]` to `[x]` in `tasks/phase-7-standardisation/README.md`
"Done criteria" — only once genuinely met.

### 9. Ship

- Merge the closeout PR. The Task-10 release job opens the "Version
  Packages" PR (or, if the closeout branch already ran
  `changeset version`, publishes directly on merge — follow the
  changesets/action flow as configured).
- After npm publish succeeds: verify the `v1.0.0` tag exists (the
  action tags per-package; additionally push the repo-level `v1.0.0`
  tag if absent — it is the spec snapshot per the Phase decision).
- GitHub release: confirm release notes generated; attach/link the
  coverage report per PLAN §18 ("a release requires a green coverage
  report attached to the GitHub Release notes") — `pnpm
  coverage:report` output.
- Commit message convention:
  `chore(release): phase 7 — 1.0 standardisation (1.0.0)`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `.changeset/phase7-one-point-zero.md` | Create | Phase-wide major changeset. |
| Per-package `package.json` + `CHANGELOG.md` | Modify (via `changeset version`) | `1.0.0` bumps + notes. |
| `CHANGELOG.md` (root) | Modify | Fill the 1.0.0 entry. |
| `examples/canvas2d-adapter/CONFORMANCE.md` + `conformance-report.json` | Modify (regenerated) | `generatedBy@1.0.0`. |
| Auto-generated `docs/primitives/**` + hover registry | Modify (regenerated) | Version-string sync. |
| `tasks/phase-7-standardisation/README.md` | Modify | Tick done-criteria. |

## Gates

Everything — `pnpm check`, `pnpm bench:ci`, `pnpm hover:check`,
`pnpm test:scripts`, `pnpm docs:build`, the conformance-report drift
gate. All exit zero before the closeout merges.

## Changeset

`.changeset/phase7-one-point-zero.md` (shown above).

## Acceptance Criteria

- [ ] All four phase-7 task changesets verified present before
      versioning.
- [ ] `pnpm changeset version` run; every publishable package at
      exactly `1.0.0` (no `PACKAGE_VERSION` constants to sync —
      removed from `src/index.ts` once real exports shipped).
- [ ] Root CHANGELOG 1.0.0 entry filled; per-package CHANGELOGs
      carry the release narrative.
- [ ] Canvas2d conformance report regenerated at `1.0.0`; drift gate
      green.
- [ ] Every gate listed above exits zero.
- [ ] Every done-criterion in the phase README ticked.
- [ ] npm publish succeeded via the CI release flow with provenance;
      `v1.0.0` tag pushed (the frozen spec snapshot); GitHub release
      carries the coverage report.

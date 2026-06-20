# Enforce Coverage Gate & Finalize

> **Status: TODO**

## Goal

Flip the coverage gate from allowlist-tolerant to fully enforcing: the
allowlist must be empty and is then deleted so the gate fails on *any*
future uncovered primitive. Do the final regeneration sweep, update
docs/skill counts and READMEs, and land the closing changeset.

## Prerequisites

Tasks 1–21 (every primitive family covered; allowlist drained to empty)
and Task 21b (language idioms — its `examples:idioms` gate runs here too).

## Current Behavior

`scripts/examples-coverage.ts` tolerates ids listed in
`examples/coverage-allowlist.json`. After Task 21 that file should be an
empty array.

## Desired Behavior

- The allowlist file is **removed**, and `examples-coverage.ts` no
  longer reads it — any primitive doc page without an example is now a
  hard CI failure.
- All generated artefacts (`scripts.ts`, `docs/examples/**`) are fresh
  and byte-clean.

## Requirements

### 0. (Parallel mode) Integrate the W1 wave first

If Tasks 3–21 were run in parallel worktrees, they deferred their
allowlist edits + generator runs (README "Execution Plan"). Before the
steps below: merge all `examples/catalogue/*.ts` fragments, run
`pnpm examples:generate` once (re-derives `scripts.ts`,
`docs/examples/**`, `examples/catalogue.json`), and recompute
`examples/coverage-allowlist.json` to the still-uncovered set — which
should now be empty. (In sequential mode this is already done; skip.)

### 1. Assert empty, then remove the allowlist

- Verify `examples/coverage-allowlist.json` is `[]`. If any id remains,
  **stop** — the owning family task is incomplete; report the leftover
  ids rather than force-emptying.
- Delete `examples/coverage-allowlist.json`.
- Edit `scripts/examples-coverage.ts` to drop the allowlist read (and
  the `STALE_ALLOWLIST` branch); the gate now requires
  `target ⊆ covered` exactly. Update `scripts/examples-coverage.test.ts`
  accordingly (a fixture with one uncovered id now fails; remove the
  allowlist-path tests). Keep 100% coverage on the helper.
- Update the `examples/CLAUDE.md` note to describe the now-enforcing
  gate (no allowlist).

### 2. Final regeneration sweep

- `pnpm examples:generate` — regenerate `scripts.ts` + `docs/examples`.
- `pnpm chartlang docs` — confirm `docs/primitives/**` is unchanged
  (these tasks add no primitives, so the reference tree must be
  byte-stable; `pnpm docs:gate` green).
- `pnpm skills:generate` — the chartlang-coding skill's generated
  `references/primitives.md` mirrors the language surface; re-emit and
  confirm `pnpm skills:gate` is green (no surface change expected, but
  verify per the root `CLAUDE.md` skill-sync rule).
- `pnpm examples:gate`, `pnpm examples:coverage` — both green with no
  allowlist.
- `pnpm examples:idioms` — green (Task 21b's idiom gate; manifest-keyed,
  no allowlist, so unaffected by the allowlist removal above).

### 3. Counts & READMEs

- Update any "N examples" references: `examples/CLAUDE.md`,
  `apps/site/README.md` (if it cites a count), `docs/examples/index.md`
  (auto-generated — just confirm the count is right), and the demo
  dialog's count label is data-driven (no hardcode).
- Confirm `docs/CLAUDE.md` and root `README.md` (≤300 lines) mention the
  full-coverage examples set where appropriate; keep package READMEs
  ≤100 lines.

### 4. Verify the demo still works end-to-end

- `pnpm docs:build` succeeds with the grouped Examples sidebar.
- `apps/site` Playwright demo suite green over the full catalogue
  (spot-check a deep-link `?script=<id>#demo` for one example per
  category renders without a gutter error, per `apps/CLAUDE.md`).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/coverage-allowlist.json` | Delete | Gate now fully enforcing. |
| `scripts/examples-coverage.ts` | Modify | Drop allowlist read. |
| `scripts/examples-coverage.test.ts` | Modify | Enforcing-mode tests. |
| `examples/CLAUDE.md` | Modify | Document enforcing gate + final counts. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | Final sweep. |
| `docs/examples/**` | Regenerate | Final sweep. |
| `skills/chartlang-coding/references/primitives.md` | Regenerate | Skill-sync rule. |
| root `README.md` / `docs/CLAUDE.md` | Modify (as needed) | Mention coverage set. |

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`
- `pnpm examples:gate`, `pnpm examples:coverage` (enforcing, no allowlist)
- `pnpm examples:idioms` (Task 21b's idiom gate, manifest-keyed)
- `pnpm docs:gate`, `pnpm skills:gate`
- `pnpm docs:build` + `apps/site` Playwright suite
- `pnpm readme:check`

## Changeset

`.changeset/examples-coverage-complete.md` — **patch**. Summarize that
the example catalogue now covers every primitive and the coverage gate
is enforcing.

## Acceptance Criteria

- `examples/coverage-allowlist.json` deleted; `examples-coverage.ts`
  enforces `target ⊆ covered` with no allowlist; a deliberately removed
  example makes the gate fail (verified by the helper test).
- All generators re-run; `examples:gate`, `docs:gate`, `skills:gate`,
  `readme:check` green; e2e compiles the full catalogue.
- Demo dialog + grouped docs sidebar build and render; counts accurate.
- Closing changeset committed.

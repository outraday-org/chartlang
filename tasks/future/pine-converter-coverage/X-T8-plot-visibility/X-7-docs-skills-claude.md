# Task 7 — Docs / skills / CLAUDE.md across affected packages

> **Status: TODO**

## Goal

Document the new `visible` channel everywhere the surface is taught: the
emissions spec, the Pine-migration guide, the generated primitive reference +
chartlang-coding skill, the converter `supported.md`, and every affected
per-package `CLAUDE.md`. This closes the root-`CLAUDE.md` contract that a
surface change updates its skill + per-folder docs in the same PR.

## Prerequisites

Tasks 1–6 (the surface + behaviour exist to document).

## Current Behavior

- `docs/spec/emissions.md` documents the `PlotEmission` wire fields + the
  validation rows; it has no `visible` row.
- `docs/spec/pine-migration.md` shows Pine→chartlang plot mappings; it has no
  `display=` entry.
- `skills/chartlang-coding/SKILL.md` teaches plotting in prose; the generated
  `skills/chartlang-coding/references/primitives.md`
  (`scripts/generate-skills-reference.ts`) covers `ta.*`/`draw.*` (and, after
  bgcolor/barcolor work, the plot family) — `visible` is a new plot opt.
- `docs/converter/supported.md` enumerates the converter's mapped surface; no
  `display=` row.
- Per-package `CLAUDE.md` files (core, adapter-kit, runtime, compiler,
  conformance, pine-converter) carry the invariants touched by Tasks 1–6.

## Desired Behavior

- The `visible` opt + wire field + adapter obligation + converter `display=`
  mapping are all documented and discoverable; `pnpm skills:gate` and
  `pnpm docs:check` pass.

## Requirements

### 1. Emissions spec (`docs/spec/emissions.md`)

Add a `visible` row to the `PlotEmission` field table + validation table:
optional boolean, omitted ⇒ visible, `false` ⇒ adapter skips the mark (not a
series gap). Note it is excluded from the `plot-hash` (asserted via
`plot-field`).

### 2. Pine migration (`docs/spec/pine-migration.md`)

Add a `display = display.all | display.none` → `{ visible }` row in the plot
section, with the ternary toggle example and the `plot-display-approximated`
caveat for unsupported `display.*` targets.

### 3. Generated reference + skill

If the `primitives.md` generator emits a plot-family section (added by the
bgcolor/barcolor work), ensure the `PlotOpts.visible` JSDoc surfaces there;
otherwise teach `visible` in `skills/chartlang-coding/SKILL.md` prose next to
the other plot opts. Run `pnpm skills:generate`; `skills:gate` must pass.

### 4. Converter docs (`docs/converter/supported.md`)

Add the `display=` → `{ visible }` mapping row. The generated
`docs/converter/diagnostics.md` already picks up `plot-display-approximated`
from Task 6's code entry.

### 5. Per-package CLAUDE.md

Confirm/extend each (most were touched in their own task, but verify a single
coherent description):

- `packages/core/CLAUDE.md` — `PlotOpts.visible` (additive within `apiVersion:1`).
- `packages/adapter-kit/CLAUDE.md` — `PlotEmission.visible` append-only +
  adapter skip obligation.
- `packages/runtime/CLAUDE.md` — omit-when-visible resolution rule.
- `packages/compiler/CLAUDE.md` — `manifest.plots[*].defaultVisible`.
- `packages/conformance/CLAUDE.md` — the visibility scenario + the "assert via
  `plot-field`, not `plot-hash`" rule.
- `packages/pine-converter/CLAUDE.md` — `display=` mapping in plotFamily.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/spec/emissions.md` | Modify | `visible` wire + validation row. |
| `docs/spec/pine-migration.md` | Modify | `display=` → `{ visible }` row. |
| `skills/chartlang-coding/SKILL.md` | Modify | Teach `visible`. |
| `skills/chartlang-coding/references/primitives.md` | Regenerate | `pnpm skills:generate`. |
| `docs/converter/supported.md` | Modify | `display=` mapping row. |
| `packages/{core,adapter-kit,runtime,compiler,conformance,pine-converter}/CLAUDE.md` | Modify | Per-package invariants. |

## Gates

- `pnpm docs:check`
- `pnpm skills:generate` + `pnpm skills:gate`
- `pnpm lint`

## Changeset

Covered by Task 1's shared T8 changeset (docs/skills are not separately
versioned).

## Acceptance Criteria

- `visible` documented in emissions spec, pine-migration, skill/reference, and
  converter supported docs.
- All six per-package CLAUDE.md files describe their slice of the channel.
- `docs:check` + `skills:gate` green.

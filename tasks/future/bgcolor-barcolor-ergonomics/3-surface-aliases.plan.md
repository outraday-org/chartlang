# Task 3 — Surface `bgcolor`/`barcolor` — Implementation Plan

## Context

Deliverable 1 of bgcolor-barcolor-ergonomics. Tasks 1 + 2 are landed
(uncommitted in the working tree): core holes `bgcolor(color, opts?)` /
`barcolor(color, opts?)` with full JSDoc (`@since 1.4`, `@stable`,
description), `BgColorOpts` / `BarColorOpts` opts types, registry entries,
compiler callsite-id injection + `manifest.plots` `kind`, runtime emit impls.
The four plotting holes (`plot`, `hline`, `bgcolor`, `barcolor`) now run
end-to-end but are **invisible** in the authoritative generated reference
(`skills/chartlang-coding/references/primitives.md`), which today emits only
`## ta.*` and `## draw.*`.

This task makes the plot family discoverable: add a `## plot family` section
to the generator, teach `bgcolor`/`barcolor` in the chartlang-coding
`SKILL.md`, and show the one-call alias in `docs/spec/pine-migration.md` §8.

## Pre-existing work (verified, do NOT clobber)

- `git status` shows Tasks 1/2/4 changes across core/compiler/runtime/
  adapter-kit + `.changeset/bgcolor-barcolor.md` + `bgcolor-barcolor-d2.md`.
  **None of my four target files** (`scripts/generate-skills-reference.ts`,
  `scripts/generate-skills-reference.test.ts`, `SKILL.md`,
  `docs/spec/pine-migration.md`) are touched yet.
- The briefing warned state-array Task 6 *might* have added a plot-family
  section to the generator. **Confirmed it did NOT** — `grep` for
  `plot family|collectPlotFamily|renderPlotBlock|bgcolor|barcolor` in the
  generator, its test, `primitives.md`, and `SKILL.md` returns nothing. No
  coexistence conflict; I add the section fresh.
- `packages/core/src/plot/plot.ts` already carries the full JSDoc for all
  four holes (`bgcolor`/`barcolor` added by Task 1) — the generator reads
  it; I do not edit plot.ts.

## Issues found / decisions

1. **`parsePrimitiveSource` cannot be reused for the plot holes.** It
   hard-throws on missing `@formula` / `@warmup` (genDocs.ts:242-244); the
   plot holes have only description + `@since` + stability + `@example`.
   `printSignature` / `pickPrimitive` are file-private in genDocs.ts.
   → Write a self-contained `collectPlotFamily` in the generator using the
   TS AST directly (the established "do NOT regex" pattern), requiring only
   the tags the holes actually carry: `@since` + a stability marker
   (`@stable`/`@experimental`/`@frozen`) + a description. This mirrors the
   *spirit* of `parsePrimitiveSource` (AST read, presence check) without
   inheriting its TA-specific `@formula`/`@warmup` requirements.
2. **Stability set.** Plot holes are `@stable`. The collector accepts
   `stable | experimental | frozen` (superset of genDocs's `stable | frozen`)
   so a future `@experimental` plotting hole renders honestly.
3. **Presence check (edge case from task).** Mirror genDocs's "no silent
   drop": if any of the four named holes is absent or missing
   `@since`/stability/description, the collector throws — a future
   undocumented plotting hole fails the generator instead of emitting a
   blank block.
4. **Author form, no `slotId`.** The core holes are already the author
   signatures (no leading `slotId`). The preamble already explains the
   `slotId` injection for `ta.*`/`draw.*`; I extend the preamble to note the
   plot family is shown in author form (the compiler injects the slot id at
   the callsite, but the core hole IS the author signature). Render as
   written.
5. **docs:check compiles `@example` blocks.** The pine-migration §8 block
   has `import { … } from "@invinite-org/chartlang-core"` + `defineIndicator(`,
   so `docs:check` compiles it. The new `bgcolor`/`barcolor` call inside it
   must compile clean — Tasks 1/2 make that true. I import `bgcolor`,
   `barcolor` in the §8 example.
6. **Changeset.** Docs/skills/generator-only — no new published-package
   src is touched. `.changeset/bgcolor-barcolor.md` (Task 1's shared
   Deliverable-1 changeset) already covers the published packages; per the
   task's Changeset note + scripts/CLAUDE.md (scripts are tooling, no
   bump), I add **no** new changeset.

## Steps

1. **Generator** (`scripts/generate-skills-reference.ts`):
   - Add `PLOT_SRC = packages/core/src/plot/plot.ts` constant.
   - Add `PLOT_FAMILY = ["plot", "hline", "bgcolor", "barcolor"] as const`
     (render order — author-intuitive: value plot, level, bg, bar).
   - Add a `PlotDocInput` local type (`name`, `signature`, `description`,
     `since`, `stability`).
   - Add `collectPlotFamily(): Promise<readonly PlotDocInput[]>` — read the
     plot source once, parse via `ts.createSourceFile`, for each name in
     `PLOT_FAMILY` find the exported `function <name>` decl, print its
     signature (export modifier + body stripped), read description + `@since`
     + stability; throw a clear error if any is missing.
   - Add `renderPlotBlock(p)` mirroring `renderTaBlock` / `renderDrawBlock`:
     `### <name>`, ts fence with signature, description, `**Since:** … · <stab>`.
   - Extend `renderReference(ta, draw, plotFamily)` with a `## plot family`
     section after `## draw.*`; update the preamble line to mention the plot
     family + the author-form note.
   - Thread `collectPlotFamily()` into `generateSkillsReference`'s
     `Promise.all` and the `renderReference` call.
2. **Generator test** (`scripts/generate-skills-reference.test.ts`):
   - Add a `PLOT_FIXTURE` + a test that `renderReference([], [], [fixture])`
     emits `## plot family`, `### bgcolor`, the signature, description, and
     `**Since:** 1.4 · stable`.
   - (collectPlotFamily IO path is covered by the live `skills:gate` run +
     the existing render unit tests; the render branch is the unit-testable
     pure surface, matching how ta/draw blocks are tested.)
3. **`pnpm -F @invinite-org/chartlang-core build`** first (briefing build
   note) if the generate step errors on missing core exports.
4. **`pnpm skills:generate`** → regenerate `primitives.md` (do NOT hand-edit).
5. **SKILL.md** (`skills/chartlang-coding/SKILL.md`): extend the §7
   plotting highlight to list `bgcolor(color, opts?)` / `barcolor(color, opts?)`
   as Pine-ergonomic aliases for `bg-color`/`bar-color`, with the `transp`
   note for `bgcolor` and a one-call conditional example. Add the "color
   expression is evaluated each bar" note WITHOUT promising the Deliverable-2
   `Series<Color>` channel.
6. **pine-migration §8** (`docs/spec/pine-migration.md`): show the alias form
   first (`bgcolor(rsi > 70 ? … , { transp })` / `barcolor(…)`), keep the
   verbose `plot(NaN, { style })` equivalent below, note both compile to the
   same emission. Keep the example a valid `defineIndicator` so docs:check
   compiles it.
7. **CLAUDE.md lockstep**: `scripts/CLAUDE.md` generator map row
   (`ta.*`/`draw.*` → `ta.*`/`draw.*`/plot-family). `packages/core/CLAUDE.md`
   already enumerates `plot`/`hline`/`alert` as holes in its header line and
   lists `bgcolor`/`barcolor` work in Task 1's scope — add a brief note only
   if the header enumeration omits them (it lists "plot/hline/alert"; append
   bgcolor/barcolor for accuracy).
8. **Gates**: `pnpm skills:generate` + `pnpm skills:gate` (no drift),
   `pnpm test:scripts`, `pnpm docs:check`, `pnpm readme:check`. (Per briefing,
   NOT full-workspace typecheck/lint/test/build.) Run `npx biome` +
   `tsc --noEmit` on the two scripts files for local hygiene.

## Files

| File | Action |
|------|--------|
| `scripts/generate-skills-reference.ts` | Modify — add `collectPlotFamily` + `renderPlotBlock` + `## plot family` section + preamble. |
| `scripts/generate-skills-reference.test.ts` | Modify — cover the plot-family render branch. |
| `skills/chartlang-coding/references/primitives.md` | Regenerate via `pnpm skills:generate`. |
| `skills/chartlang-coding/SKILL.md` | Modify — teach `bgcolor`/`barcolor`. |
| `docs/spec/pine-migration.md` | Modify — §8 one-call alias. |
| `scripts/CLAUDE.md` | Modify — generator map-row description. |
| `packages/core/CLAUDE.md` | Modify — header hole enumeration (if it omits the two). |

## Gates to keep green

- `pnpm skills:generate` then `pnpm skills:gate` — no drift.
- `pnpm test:scripts` — the generator render test.
- `pnpm docs:check` — §8 `bgcolor`/`barcolor` example compiles.
- `pnpm readme:check` — unchanged (no README structure touched).
- Local: `biome lint` + `tsc --noEmit` on the two scripts files.

## Changeset

None added. Generator/skills/docs-only; published-package bumps already
declared by Task 1's `.changeset/bgcolor-barcolor.md`. Matches scripts/CLAUDE.md
(scripts are tooling, no bump) and the task's Changeset note.

## Acceptance criteria

- Regenerated `primitives.md` has a `## plot family` section listing
  `plot` / `hline` / `bgcolor` / `barcolor`; `skills:gate` passes.
- `SKILL.md` teaches both aliases without overclaiming the Deliverable-2
  series channel.
- `docs/spec/pine-migration.md` §8 shows the one-call alias; `docs:check`
  compiles it.
- `scripts/CLAUDE.md` + `packages/core/CLAUDE.md` updated in lockstep.
- Diff is bg-task-3-only (no Task 1/2/4 or state-array files touched).
</content>
</invoke>

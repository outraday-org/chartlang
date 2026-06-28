# Task 3 — Surface `bgcolor`/`barcolor`: primitives.md generator + skill + docs

> **Status: TODO** — **completes Deliverable 1 (shippable after this task).**

> **Deliverable 1** (ergonomics tier).

## Goal

Make the `bgcolor` / `barcolor` aliases (and, alongside them, the existing
`plot` / `hline` plotting surface) **discoverable in the authoritative
generated reference** and **taught in the chartlang-coding skill**, and show
the one-call alias in the Pine-migration doc. Today the generated
`primitives.md` covers only `ta.*` and `draw.*`, so plotting is prose-only —
this task adds a plot-family section to the generator and updates the skill +
docs in lockstep (root CLAUDE.md: a skill change must ride the same PR, and
`skills:gate` re-checks the generated file).

## Prerequisites

- Task 1 (core holes, JSDoc, registry).
- Task 2 (compiler + runtime wiring — so the example scripts compile).

## Current Behavior

- `scripts/generate-skills-reference.ts` `renderReference` (`:149-175`)
  builds the reference from exactly two sections: `## ta.*` (`:165-167`,
  one block per `ta.*` registry primitive's JSDoc) and `## draw.*`
  (`:169-171`, one block per `draw/` source file). It walks
  `STATEFUL_PRIMITIVES` for `ta.*` (`collectTa`) and the `emit/draw` source
  tree for `draw.*` (`collectDraw`, `:101-122`). `plot` / `hline` /
  `bgcolor` / `barcolor` are NOT collected — they never appear in
  `skills/chartlang-coding/references/primitives.md`.
- The chartlang-coding `SKILL.md` teaches plotting in prose: `:252`
  (`plot(value, opts?)` / `hline(level, opts?)`), `:49` / `:164` / `:200`
  (`plot(...)` examples). There is no `bgcolor` / `barcolor` mention.
- `docs/spec/pine-migration.md` §8 "Visual Overrides" (`:218-233`) shows the
  verbose `plot(bar.close, { style: { kind: "bg-color", color, transp } })`
  / `{ kind: "bar-color" }` form. `docs/spec/emissions.md:99-100` documents
  the `bg-color` / `bar-color` style validation rows.
- The gate: `pnpm skills:generate` writes `primitives.md`; `pnpm skills:gate`
  (`--check`) byte-diffs it and fails CI on drift. Never hand-edit the
  generated file (scripts CLAUDE.md).

## Desired Behavior

- The generator emits a third section (e.g. `## plot family`) listing
  `plot`, `hline`, `bgcolor`, and `barcolor` with their signatures + JSDoc
  summary + `@since`/stability — sourced from the core hole JSDoc, the same
  way `ta.*`/`draw.*` blocks are. After `pnpm skills:generate`, the four
  plotting holes appear in `primitives.md`; `pnpm skills:gate` passes against
  the regenerated, committed file.
- The chartlang-coding `SKILL.md` documents the `bgcolor`/`barcolor` aliases
  in prose (the generated file shows signatures, but option-field semantics
  like `transp` and the per-bar-color idiom are taught in prose, mirroring
  how the `z`-order task taught `z` in `SKILL.md` only).
- `docs/spec/pine-migration.md` §8 shows the one-call alias
  (`bgcolor(close > open ? "#16a34a" : "#dc2626", { transp: 80 })`) as the
  preferred form, with the verbose `plot(NaN, { style })` kept as the
  explicit equivalent.

## Requirements

### 1. Generator plot-family section (`scripts/generate-skills-reference.ts`)

- Add a `collectPlotFamily()` collector that reads the JSDoc + signature for
  the four core plotting holes (`plot`, `hline`, `bgcolor`, `barcolor`) from
  `packages/core/src/plot/plot.ts`, reusing the existing JSDoc-parse helper
  the `ta.*`/`draw.*` collectors use (`parsePrimitiveSource` or the
  underlying TS-AST reader — follow the established pattern; do NOT regex).
- Add a `renderPlotBlock` (mirror `renderTaBlock` `:128` / `renderDrawBlock`
  `:137`) and a `## plot family` section in `renderReference` (`:149-175`),
  after `## draw.*`. Each block: `### plot` / `### hline` / `### bgcolor` /
  `### barcolor`, the signature in a `ts` fence, the JSDoc summary, and the
  `**Since:** … · <stability>` line.
- The compiler injects a leading `slotId` at every callsite — the existing
  reference preamble (`:161-163`) already explains this for `ta.*`/`draw.*`;
  confirm the plot-family signatures are shown in the **author** form
  (without `slotId`), since `bgcolor`/`barcolor`/`plot`/`hline` are the core
  holes (author signatures), not the runtime overloads. (Unlike `ta.*`, the
  core holes already ARE the no-slotId form — render them as written.)
- Run `pnpm skills:generate` and commit the regenerated `primitives.md`.

> **The generator is the gate's source of truth — re-run it, never
> hand-edit.** `pnpm skills:gate` will fail CI if the committed file drifts
> from the generator output. Add the generator change and the regenerated
> file in the same commit. Update `scripts/generate-skills-reference.test.ts`
> if it pins the rendered section list.

### 2. chartlang-coding skill (`skills/chartlang-coding/SKILL.md`)

- Extend the plotting highlight (`:252`) to mention `bgcolor(color, opts?)`
  and `barcolor(color, opts?)` as Pine-ergonomic aliases for the `bg-color` /
  `bar-color` styles, with the `transp` note for `bgcolor`.
- Add a short prose example showing the one-call dynamic-looking form
  (`bgcolor(bar.close > bar.open ? "#16a34a" : "#dc2626", { transp: 80 })`)
  AND a note that, in v1, the color is evaluated **once per bar** as a
  scalar (the per-bar `Series<Color>` channel is Deliverable 2 — do NOT
  promise dynamic recolor-every-bar semantics until that lands; phrase it as
  "the color expression is evaluated each bar" which is true for a
  per-bar-conditional scalar).

> **Do NOT overclaim Deliverable 2 here.** Until the `colorValue` channel
> ships (Tasks 4–6), `bgcolor(cond ? a : b)` recolors per bar only because
> the SCALAR is re-evaluated each compute step and the slot dedups
> last-write-wins — which is exactly the per-bar conditional case and works
> in Deliverable 1. The Deliverable-2 distinction is a true `Series<Color>`
> value (a pre-computed color series fed in). Teach the working case; defer
> the series case.

### 3. Pine-migration doc (`docs/spec/pine-migration.md` §8)

- Update §8 (`:218-233`) to show the alias form first:
  ```ts
  bgcolor(rsi > 70 ? "#ef4444" : "#22c55e", { transp: 85 });
  barcolor(rsi > 70 ? "#ef4444" : "#22c55e");
  ```
  and keep the verbose `plot(NaN, { style: { kind: "bg-color", … } })`
  equivalent below it as the explicit form. Note both compile to the same
  emission.

### 4. Per-folder CLAUDE.md updates (root CLAUDE.md rule)

- `packages/core/CLAUDE.md` — note `bgcolor`/`barcolor` as plotting holes
  alongside `plot`/`hline` if the file enumerates the script-facing surface.
- `scripts/CLAUDE.md` — the `generate-skills-reference.ts` map row says it
  "walks `ta.*`/`draw.*` JSDoc"; update it to "`ta.*`/`draw.*`/plot-family
  JSDoc" so the doc matches the new section.
- No example-script CLAUDE.md change is required unless Task 3 adds a demo
  script (optional — see Edge cases).

## Edge cases

- The generated reference preamble currently says "after changing a `ta.*` /
  `draw.*` primitive" (`:159`) — update it to include the plot family so the
  re-run instruction is accurate.
- If the generator's `collectTa`/`collectDraw` enforce JSDoc completeness
  (e.g. the `ta.*` "Missing JSDoc" throw `:94`), mirror an equivalent
  presence check for the four plot holes so a future undocumented plotting
  hole fails the generator rather than emitting an empty block.
- **Optional**: a dedicated example script (`examples/scripts/
  bgcolor-heat.chart.ts` + a `DEMO_SCRIPTS` entry → `pnpm examples:generate`)
  showcasing `bgcolor`/`barcolor`. If added, follow the examples/CLAUDE.md
  top-level-import + destructured-param convention and update the example
  gates. This is a nice-to-have, not required for Deliverable 1 completion.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/generate-skills-reference.ts` | Modify | Add `collectPlotFamily` + `renderPlotBlock` + `## plot family` section. |
| `scripts/generate-skills-reference.test.ts` | Modify | Cover the new section / collector. |
| `skills/chartlang-coding/references/primitives.md` | Regenerate | `pnpm skills:generate` output (do not hand-edit). |
| `skills/chartlang-coding/SKILL.md` | Modify | Teach `bgcolor`/`barcolor` aliases (prose). |
| `docs/spec/pine-migration.md` | Modify | §8 shows the one-call alias. |
| `packages/core/CLAUDE.md` | Modify | Note the two new plotting holes. |
| `scripts/CLAUDE.md` | Modify | Update the generator map-row description. |
| `examples/scripts/bgcolor-heat.chart.ts` (+ demo entry) | Create (optional) | Showcase example. |

## Gates

- `pnpm skills:generate` then `pnpm skills:gate` (no drift)
- `pnpm typecheck`, `pnpm lint`
- `pnpm test:scripts` (the generator test)
- `pnpm docs:check` (if the migration-doc example block qualifies for
  compiler execution — `bgcolor`/`barcolor` must compile clean)
- `pnpm examples:gate` (only if the optional example was added)

## Changeset

Covered by Task 1's shared Deliverable-1 changeset. A docs/skills/scripts-only
change needs no separate published-package bump beyond what Task 1 declared.

## Acceptance Criteria

- `primitives.md` (regenerated) contains a `## plot family` section listing
  `plot` / `hline` / `bgcolor` / `barcolor`; `skills:gate` passes.
- The chartlang-coding `SKILL.md` teaches the two aliases (without
  overclaiming the Deliverable-2 series channel).
- `docs/spec/pine-migration.md` §8 shows the one-call alias.
- `packages/core/CLAUDE.md` + `scripts/CLAUDE.md` updated in lockstep.
- All Deliverable-1 gates green. **Deliverable 1 is now complete and
  shippable.**

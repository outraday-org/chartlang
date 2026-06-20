# Tier 1 + 2: Normative Ordering Spec & Adapter Contract

> **Status: TODO**

## Goal

Promote chartlang's currently-implicit render ordering to a **normative,
spec-level guarantee** every conformant adapter must honor, and document
the fixed group stack in the adapter contract. Docs + skills only — no
code, no emit changes. This establishes the model that Tier 3's numeric
`z` field (Tasks 2–8) extends.

## Prerequisites

None. This is the foundation task.

## Current Behavior

- `docs/spec/semantics.md` §"Emission Ordering" (≈line 333) fixes the
  **queue** order in `RunnerEmissions` (`plots` → `drawings` → `alerts`
  → `alertConditions` → `logs` → `diagnostics`) and notes script-order
  within a queue plus last-write-wins dedup. It does **not** state that
  *adapters* must render in that order, nor pin the group stack.
- The reference adapter's paint order (axis → background → candles →
  bar overlays → plots → glyphs → hlines → drawings → alerts) is
  documented nowhere normative — it's incidental to
  `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts`.
- `docs/adapters/contract.md` describes the emission shapes but not a
  required render order.

## Desired Behavior

A new **"Render Ordering"** contract that any adapter MUST satisfy:

1. **Group bands (low → high z):** `background` → `plots` → `drawings`
   → `alerts/badges`. Background paints first (bottom); alert badges
   paint last (top). These bands are the default stacking when explicit
   `z` ties.
2. **Within a band, declaration order wins:** marks render in the order
   their primitive was called in `compute`; the last-declared mark of a
   band paints on top of earlier ones in the same band. (Matches the
   existing queue/script-order emission rule.)
3. **Forward reference to Tier 3:** the spec notes that an optional
   numeric `z` (added in Tasks 2–8) overrides band order — adapters
   sort by `(z ?? 0, groupBand, declarationOrder)` — but at the default
   `z=0` the band+declaration rule above is the whole contract, so this
   task's text stands alone and is back-compatible.

## Requirements

### 1. `docs/spec/semantics.md` — extend §"Emission Ordering"

Rename/extend the section to cover **render** ordering, not just
emission queue ordering. Add normative MUST language:

> **Render ordering (normative).** A conformant adapter MUST paint
> marks in the following group bands, from bottom to top: (1)
> background fills, (2) plots, (3) drawings, (4) alert badges. Within a
> single band, marks MUST render in **declaration order** — the order
> their `plot()` / `draw.*()` primitive was first called in `compute`
> on that bar — so that a later-declared mark in the same band appears
> on top of an earlier one. This is the same order in which emissions
> drain into their queues (see queue list above). The default placement
> of a mark in its band MAY be overridden by an explicit numeric `z`
> (see *Render order key* below).

Add a short **"Render order key"** subsection that forward-references
`z`: default `0`; adapters compute the global order as a stable sort by
`(z, groupBand, declarationOrder)`; omitting `z` (or `z === 0`) leaves
behavior identical to the band+declaration rule. Keep it tight — the
field's full wire docs live in `docs/spec/emissions.md` (Task 8).

### 2. `docs/adapters/contract.md` — pin the group stack

Add a **"Render order"** subsection to the adapter contract stating the
same four bands and declaration-order rule as a hard requirement for
adapter authors, cross-linking the spec section. State explicitly:
"Drawings paint above plots **by default**; this is overridable only via
the `z` field, never by the adapter silently reordering bands."

### 3. `docs/adapters/writing-an-adapter.md` — guidance

Add a paragraph guiding adapter authors to implement a single sorted
render pass keyed on `(z ?? 0, band, seq)` rather than hard-coding band
order, so they are forward-compatible with `z`. Reference the canvas2d
reference adapter (Task 5) as the worked example once it lands.

### 4. `skills/chartlang-coding/SKILL.md` — author-facing note

Add a short subsection ("Layering / draw order") teaching authors the
two levers they have **today** (before Tier 3 even ships):

- Marks in the same band render in **call order** — to put series A
  over series B, call `plot(B)` before `plot(A)`.
- Drawings render above plots by default.

Keep it to a few sentences; the `z` option is added to the skill in
Task 8 once it exists. Do **not** describe `z` here yet (it isn't
implemented until Task 2+), to keep the skill truthful at every commit.

### 5. Cross-checks

- Do **not** introduce `z` in any emission/type/example in this task —
  it does not exist yet. This task is purely the prose contract for
  behavior that already exists, plus a clearly-labeled forward
  reference.
- Confirm wording does not contradict the existing dedup rule
  (last-write-wins per `(slotId, bar)` / `(handleId, bar)`).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/spec/semantics.md` | Modify | Normative render-ordering contract + `z` forward ref |
| `docs/adapters/contract.md` | Modify | Pin group stack as adapter requirement |
| `docs/adapters/writing-an-adapter.md` | Modify | Guidance: single sorted pass |
| `skills/chartlang-coding/SKILL.md` | Modify | Author note: call-order layering |
| `docs/CLAUDE.md` / `skills/`-adjacent `CLAUDE.md` | Modify (if a documented invariant changes) | Per root `CLAUDE.md` rule |

## Gates

- `pnpm readme:check` (doc length gates, if applicable)
- `pnpm docs:check` (no broken JSDoc/links)
- `pnpm skills:gate` (SKILL.md edits must not break the gate; this task
  edits prose only, not `references/primitives.md`)
- Markdown link/lint as configured

## Changeset

None — docs/skills only, no published-package behavior change. (If the
repo requires an empty changeset for doc-only PRs, add
`.changeset/zorder-spec-docs.md` with no package bumps and a one-line
summary; otherwise omit.)

## Acceptance Criteria

- `docs/spec/semantics.md` states the four render bands and
  declaration-order rule as **normative MUST** language, with a labeled
  forward reference to the `z` key.
- `docs/adapters/contract.md` requires the group stack of adapters and
  forbids silent band reordering.
- `docs/adapters/writing-an-adapter.md` recommends a single `(z, band,
  seq)` sorted pass.
- `skills/chartlang-coding/SKILL.md` teaches call-order layering with no
  mention of the not-yet-existing `z` option.
- No `z` field, type, or example introduced anywhere in this task.
- Relevant per-folder `CLAUDE.md` updated if a documented invariant
  changed (root `CLAUDE.md` rule).
- Doc gates green.

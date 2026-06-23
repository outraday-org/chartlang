# Task 1 — Author the mutable-drawing-handles RFC

> **Status: TODO**

## Goal

Produce a written, decision-ready RFC for mutable drawing handles
(create-once, mutate-across-bars `line`/`label`/`box`/`polyline`) that a
maintainer can accept or reject. This task produces a **design document only**
— it changes no package source, adds no primitive, and ships no changeset.

## Prerequisites

None. (Informed by `../state-array/`, `../map-collection/`, and
`../../plot-draw-z-order/` but does not depend on them landing.)

## Current Behavior

- `draw.*` is declarative-per-bar; see this folder's `README.md` for the full
  current-state map. No addressable cross-bar drawing object exists.

## Desired Behavior (of this task)

A committed Markdown RFC at `docs/rfcs/NNNN-mutable-drawing-handles.md` (use the
repo's existing RFC/design-doc location + numbering convention; if none exists,
create `docs/rfcs/` and start at `0001`). The RFC is reviewable in a PR and
ends with a clear recommendation + an accept/reject checkbox section.

## Requirements

The RFC must contain, in order:

### 1. Problem statement & motivation
- Concrete use cases that declarative `draw.*` cannot serve cleanly: trailing
  stop line, extending anchored level, live HUD label updated each tick, "last
  N pivot" overlays with a fixed budget. Reference the anchored-line example
  (commit `6f7fc72`).

### 2. Survey of the Pine model
- How `line.new`/`label.new`/`box.new`/`polyline.new` + `set_*` + `delete` +
  `max_*_count` budgets behave. Cite the exact mutation surface to be matched
  or deliberately trimmed.

### 3. Options analysis (at least three, with trade-offs)
- **Option A — Stateful method handles.** `const h = draw.line.new(...)`
  returns a `MutableLineHandle` stored in a `state` slot; `h.setXY1(...)`,
  `h.delete()`. Closest Pine parity; needs new handle types + a runtime object
  store + an adapter contract decision.
- **Option B — Declarative reconciler.** Author re-issues drawings each bar
  with a stable author-supplied `id`; the runtime diffs against last bar and
  the adapter reconciles. Keeps the emission-only wire; less Pine-like
  ergonomics.
- **Option C — Hybrid.** Declarative `draw.*` stays the default; handles are an
  opt-in layer for the persist-and-mutate cases only.
- For each: ergonomics, adapter-contract impact, snapshot/restore + tick-replay
  correctness, conformance cost, converter feasibility, and z-order
  interaction.

### 4. Recommendation
- Pick one option with explicit rationale. State what is **in** v1 and what is
  deferred (e.g. start with `line` + `label`, defer `box`/`polyline`).

### 5. Proposed API sketch (recommended option only)
- Core handle type signatures (`MutableLineHandle`, etc.), the `draw.*.new`
  surface, the mutation methods, deletion, and the object-budget mechanism
  (reuse `state.map`/`state.array` bounded eviction — state which).

### 6. Adapter contract impact
- Spell out whether the wire stays full-set-per-bar or gains incremental
  mutation messages, and the capability key(s) a conformant adapter must
  advertise. Confirm existing adapters keep working (or document the migration).

### 7. Lifecycle & sandbox correctness
- How handles persist with committed/tentative semantics; how tick-replay /
  head-bar replacement restores the object set; confirmation that the object
  store is structurally cloneable (numbers/strings only) across the host
  transferable boundary, mirroring `state.map`'s constraint.

### 8. Z-order interaction
- How a long-lived object sources its `z` and slots into the global render
  order (`z`, group band, declaration order) from `../../plot-draw-z-order/`.

### 9. Converter feasibility
- Sketch the Pine `line.new`/`set_*`/`delete` → chartlang mapping under the
  recommended option. Feasibility + diagnostics strategy, not implementation.

### 10. Skills surface impact
- How mutable handles would be taught in `skills/chartlang-coding`: the
  `SKILL.md` prose (a new "mutable drawing handles" section vs folding into the
  `draw.*` prose), and whether the generated
  `skills/chartlang-coding/references/primitives.md` generator
  (`scripts/generate-skills-reference.ts`) must gain a handle/`draw.*.new`
  section or whether handles are documented by hand. State the
  `references/translating-from-pine.md` mapping rows the feature adds.
- Confirm whether `skills:generate` / `skills:gate` need a generator change or
  stay untouched.

### 11. react-starter surface impact
- State whether the react-starter seam (`apps/react-starter/src/lib/chart/`
  `activeAdapter.ts` + `seamVariants.ts`) needs any change. If the chosen wire
  stays emission-compatible (full-set-per-bar), the seam is unaffected and the
  feature flows through the compiler automatically — confirm this and note the
  verification (a `tests/compile.spec.ts` case + the existing
  `adapter-matrix.spec.ts`). If the wire gains incremental mutation messages,
  document the seam/host migration the five variants need.

### 12. Implementation plan outline & risks
- The follow-up task folder's anticipated split, enumerating **all six
  surfaces** explicitly: core → runtime → adapter-kit/adapters → conformance →
  converter → docs → skills → examples/demos → react-starter (verification).
  Note which surfaces need real code vs verification-only under the recommended
  wire choice. Rough sizing, and the top risks (adapter-contract break,
  snapshot correctness, conformance surface growth).

### 13. Decision section
- Accept / reject / revise checkboxes; open questions left for the maintainer.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/rfcs/NNNN-mutable-drawing-handles.md` | Create | The RFC. |
| `docs/rfcs/README.md` | Create (if absent) | RFC index/convention bootstrap. |
| `docs/.vitepress/config.*` | Modify (optional) | Surface the RFC in docs nav if RFCs are published. |

## Gates

- `pnpm docs:check` (if the RFC lives under `docs/` and the gate lints it)
- `pnpm readme:check` (if an RFC index README is added)
- No code gates: this task ships no package source, no tests, no changeset.

## Changeset

None — design document only.

## Acceptance Criteria

- RFC committed with all thirteen sections; at least three options analysed
  with trade-offs across ergonomics, adapter contract, lifecycle correctness,
  conformance, converter, and z-order.
- A single recommendation with explicit v1 scope + deferrals.
- Adapter-contract impact and sandbox/serialization correctness explicitly
  addressed.
- **All six surfaces explicitly analysed** — examples/demos, docs, skills,
  converter, adapters, and react-starter — with a clear per-surface
  code-vs-verification split in the implementation outline.
- Ends with a maintainer accept/reject decision section.
- No package source changed; docs gate green.

# Task 4 — Narrative docs: converter pages + language surface

> **Status: TODO**

## Goal

Update the hand-authored docs to reflect that `draw.fillBetween` exists
and that the converter now lowers `linefill.new` to it (no longer a
rotatedRectangle approximation). Keep the auto-generated
`docs/primitives/draw/fill-between.md` (kebab-case; produced in Task 2)
untouched.

## Prerequisites

Tasks 2 + 3 (the primitive and the converter behaviour must be final so
the docs describe real behaviour).

## Current Behavior

- `docs/converter/supported.md:19` — table row: `linefill.new →
  draw.rotatedRectangle … (best-effort; chartlang has no
  fill-between-series primitive)`.
- `docs/converter/index.md:63` — overview prose still says
  `linefill` is approximated as a filled `draw.rotatedRectangle`.
- `docs/converter/rejects.md:58-61` — prose: static two-line linefill is
  "approximated as a filled `draw.rotatedRectangle` quad … best-effort".
- `docs/converter/rejects.md:86` + `supported.md:133-134` —
  `fill(plot1, plot2)` errors `fill-not-mapped`, "chartlang has no
  plot-fill primitive".
- `docs/converter/diagnostics.md` — documents the linefill diagnostics
  including `linefill-rotatedrect-approximated` (removed in Task 3).
- `docs/language/` — `series-and-indexing.md`, `overview.md`, etc.
  mention `draw.*` but there is no fills/bands note.

## Desired Behavior

Docs state that `draw.fillBetween` is the native fill-between primitive,
that `linefill.new` lowers to it cleanly, and the removed diagnostic is
gone from the diagnostics reference. `fill(plot1, plot2)` stays a
documented reject (deferred), but its suggestion points at
`draw.fillBetween`.

## Requirements

### 1. `docs/converter/supported.md`

- Rewrite the `linefill.new` row (line 19): `linefill.new` →
  `draw.fillBetween` — a true filled ribbon between the two referenced
  lines' anchors (static two-line form). Drop the "best-effort / no
  fill-between primitive" wording.
- At the `fill(plot1, plot2)` note (lines 133-134): keep it as currently
  unmapped, but update the suggestion to mention `draw.fillBetween` for
  the drawing-level band and note plot-level series fill is a planned
  follow-up.

### 2. `docs/converter/index.md`

- Update the overview bullet that describes `linefill` so it says static
  two-line `linefill.new` lowers to `draw.fillBetween`; remove the
  rotatedRectangle approximation wording.

### 3. `docs/converter/rejects.md`

- Update the static-linefill paragraph (lines 58-61): it is now lowered
  to `draw.fillBetween`, not approximated; remove the "best-effort"
  framing. Keep `linefill-over-ring` / `cross-collection-linefill` rows
  but refresh their "Manual rewrite" suggestions to reference
  `draw.fillBetween` where apt.
- Update the `fill-not-mapped` row (line 86) suggestion to point at
  `draw.fillBetween`.

### 4. `docs/converter/diagnostics.md` — **generated, do not hand-edit**

`diagnostics.md` is regenerated from `DIAGNOSTIC_CODE_ENTRIES` by
`pnpm converter:docs:generate` and byte-gated by
`pnpm converter:docs:check`. The `linefill-rotatedrect-approximated`
removal and the `linefill-series-fill` rewording are produced by **Task
3** (which edits `codes.ts` and regenerates this file). In this task:

- **Do not edit `diagnostics.md` by hand.** Verify Task 3 already
  regenerated it (no `linefill-rotatedrect-approximated` section; the
  reworded `linefill-series-fill`).
- In the **hand-authored** `supported.md` / `rejects.md`, remove any
  dangling anchor link to `diagnostics.md#linefill-rotatedrect-approximated`
  (the section no longer exists). Keep the
  `#linefill-series-fill` / `#linefill-over-ring` /
  `#cross-collection-linefill` / `#fill-not-mapped` anchors.

### 5. `docs/language/` mention

`draw.*` is introduced in **`docs/language/overview.md`** (the module
surface table, ~line 72: `| `draw.*` | imperative drawing primitives …`).
`series-and-indexing.md` does **not** currently mention `draw.*`. Add the
short fills/bands note to `overview.md` (the place drawings are
introduced): a sentence + small example showing
`draw.fillBetween([...], [...], { fill, fillAlpha })` for a band between
two computed series, noting the closed-polygon (`edgeA` then reversed
`edgeB`) semantics. Do **not** duplicate the auto-generated primitive
page — link to **`/primitives/draw/fill-between`** (kebab-case path, the
generated page from Task 2; the camelCase `fillBetween.md` does not
exist).

### 6. Sidebar / nav

`docs/.vitepress/config.ts` exposes the Draw primitives as a **single
directory link** (`{ text: "Draw", link: "/primitives/draw/" }`, ~line
173) — it is **not** a per-primitive manual list, so there is **no
sidebar row to add**. The new `fill-between.md` is reached via the
`/primitives/draw/` index page. Just confirm `pnpm docs:build` succeeds
and the generated index lists it.

### 7. CLAUDE.md

`docs/CLAUDE.md` — if it enumerates converter doc invariants or a
"linefill is approximated" note, update it.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/converter/index.md` | Modify | overview linefill wording |
| `docs/converter/supported.md` | Modify | linefill + fill rows |
| `docs/converter/rejects.md` | Modify | static-linefill prose + suggestions |
| `docs/converter/diagnostics.md` | Verify only (generated in Task 3 — never hand-edit) | reflects code removal |
| `docs/language/overview.md` | Modify | fills/bands note (draw is introduced here, not in `series-and-indexing.md`) |
| `docs/.vitepress/config.ts` | Verify only | single `/primitives/draw/` directory link — no per-primitive row |
| `docs/CLAUDE.md` | Modify (if needed) | invariant |

## Gates

- `pnpm docs:gate` (auto-generated primitive pages unchanged — this task
  only touches hand-authored markdown)
- `pnpm converter:docs:check` (generated `diagnostics.md` still
  byte-matches — this task must not have hand-edited it)
- VitePress build (`pnpm docs:build`) succeeds with no broken links
- `pnpm lint` (if markdown is linted)

## Changeset

None — `docs/` is not a published package (deferred feature changeset is
in Task 5).

## Acceptance Criteria

- `supported.md` / `rejects.md` describe `draw.fillBetween` as the
  linefill target; no "best-effort rotatedRectangle" wording remains; no
  dangling `#linefill-rotatedrect-approximated` anchors.
- `diagnostics.md` (generated in Task 3) no longer documents
  `linefill-rotatedrect-approximated`; `pnpm converter:docs:check` green
  (this task did not hand-edit it).
- A fills/bands note + example exists in `docs/language/overview.md`
  linking `/primitives/draw/fill-between`.
- `pnpm docs:build` green (no broken links); `pnpm docs:gate` green.

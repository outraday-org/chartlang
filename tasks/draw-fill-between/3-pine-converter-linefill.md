# Task 3 — Pine converter: lower `linefill.new` to `draw.fillBetween`

> **Status: TODO**

## Goal

Replace the converter's best-effort `linefill.new → draw.rotatedRectangle`
approximation with the real `draw.fillBetween` primitive, retire the
`linefill-rotatedrect-approximated` diagnostic, soften the related
approximation notes, and regenerate the affected fixtures.

## Prerequisites

Tasks 1 + 2 (`draw.fillBetween` must exist in core + runtime so emitted
fixtures compile and the converter's output typechecks).

## Current Behavior

- `DRAWING_KIND_MAP` (`src/mapping/drawingKinds.ts:131-139`) marks
  `linefill.new → { chartlang: null, notes: "no direct chartlang
  analogue; Task 14 emits diagnostic" }`. The generic kind resolver is
  `drawingLookup(key)` (wraps `lookup(DRAWING_KIND_MAP, key)`) — there is
  **no** `resolveDrawingKind` function.
- `emitLinefill` (`src/transform/polylineLinefill.ts:498-555`) lowers a
  static two-line `linefill.new(lineA, lineB, color)` into
  `draw.rotatedRectangle(quad as const, opts)` over the two lines'
  endpoints. It reserves the handle slot via
  `appendHandleSlot(scaffold, { name: local, kind: "rectangle" })` (an
  IR-level helper — **not** a runtime `useDrawingHandleSlot`) and
  pushes:
  - `linefill-rotatedrect-approximated` (always, `codes.ts:480`),
  - `linefill-color-transp-approximated` (when the fill colour carries
    transparency, `codes.ts:473`),
  - `linefill-series-fill` (when both lines update bar-by-bar,
    `codes.ts:466`).
- Dynamic forms still hard-reject: `linefill-over-ring` (`codes.ts:343`),
  `cross-collection-linefill` (`codes.ts:366`).
- Fixtures: `fixtures/15-linefill-two-line.*` (static two-line),
  `fixtures/10-camp-c-reject-linefill.*` (Camp C reject).

## Desired Behavior

A static two-line `linefill.new(lineA, lineB, color)` lowers to:

```ts
draw.fillBetween(
    [/* lineA anchor 1 */, /* lineA anchor 2 */],
    [/* lineB anchor 1 */, /* lineB anchor 2 */],
    { fill: <color>, fillAlpha: <transp→alpha> },
)
```

The polygon `A1 → A2 → B2 → B1` is identical to the quad the
rotatedRectangle approximated, but now it is a true fill. The
`linefill-rotatedrect-approximated` diagnostic is **removed** (it is no
longer an approximation). The dynamic rejects are unchanged.

## Requirements

### 1. `emitLinefill` rewrite (`src/transform/polylineLinefill.ts`)

- Reuse the existing two-line anchor extraction that currently builds
  `quad`. Instead of one `AnchorQuad`, produce two edges:
  - `edgeA = [lineA.anchor1, lineA.anchor2]`
  - `edgeB = [lineB.anchor1, lineB.anchor2]`
  preserving the exact ordering so the closed polygon matches the old
  quad winding (`A1 → A2 → B2 → B1`; `draw.fillBetween` reverses
  `edgeB`, so pass `edgeB` as `[B1, B2]`).
- Emit `draw.fillBetween(edgeA, edgeB, opts)` into the handle slot in
  place of `draw.rotatedRectangle(...)`. Change the `appendHandleSlot`
  kind tag from `"rectangle"` to `"fill-between"` (confirm
  `appendHandleSlot`'s `kind` parameter accepts the new tag — widen its
  type/union if it is constrained to a closed set).
- The `opts` object keeps the fill colour mapping; map Pine
  `color.new(c, transp)` transparency to `fillAlpha` (the converter
  already computes this for the rotatedRectangle path — reuse it).
- Delete the `diagnostics.pushCode("linefill-rotatedrect-approximated",
  …)` call.
- Keep `linefill-color-transp-approximated` (colour-transparency
  rounding is still an approximation) **only if** the converter actually
  rounds; if `fillAlpha` now maps losslessly, remove it too — decide by
  inspecting the mapping and keep the fixtures honest.
- Re-evaluate `linefill-series-fill`: a fill between two bar-by-bar
  updated lines is still a *single updated band*, not a per-bar plot
  fill, so the note remains valid — **downgrade its message** to drop
  the "no fill-between primitive yet" wording and instead say the band
  tracks the two lines' latest anchors. Keep its severity `info`.

### 2. `DRAWING_KIND_MAP` note (`src/mapping/drawingKinds.ts:131`)

`linefill.new` is special-cased by `emitLinefill`, not lowered through
the generic `drawingLookup` path, so `chartlang` may stay `null` (REJECT
for the generic path) — but update `notes` to:
`"lowered to draw.fillBetween by the polyline/linefill transform (static two-line); dynamic forms reject"`.
If the generic `drawingLookup` path would now benefit from a non-null
kind, wire `chartlang: "fill-between"` instead and confirm no generic
path double-emits. Verify with the fixture suite either way.

### 3. Diagnostics (`src/diagnostics/codes.ts`)

- Remove the `linefill-rotatedrect-approximated` entry (`codes.ts:480`,
  severity `info`). Known references to clear first (grep `linefill-rotatedrect-approximated`):
  - `src/transform/polylineLinefill.ts:528` — the `diagnostics.pushCode(...)`
    call (removed in §1);
  - `src/diagnostics/codes.ts:480` — the registry entry (this removal);
  - any `*.expected.diagnostics.json` fixture and any unit test
    (`src/transform/linefill-*.test.ts`) asserting it — update those in §4.
  - `codes.test.ts` asserts `DIAGNOSTIC_CODES.size ===
    Object.keys(DIAGNOSTIC_CODE_ENTRIES).length` (auto-derived, so it
    stays green) and pins a few severities — only touch it if it pins
    `linefill-rotatedrect-approximated` explicitly.
- Adjust `linefill-series-fill` message per §1 (keep severity `info`).
- Leave `linefill-over-ring`, `cross-collection-linefill` untouched.
- **`diagnostics.md` is generated, not hand-authored** (`docs/converter/diagnostics.md`
  is byte-gated by `pnpm converter:docs:check` against `DIAGNOSTIC_CODE_ENTRIES`).
  After editing `codes.ts`, run **`pnpm converter:docs:generate`** and
  commit the regenerated `docs/converter/diagnostics.md` here (the
  removed code disappears and `linefill-series-fill` re-renders). Do
  **not** hand-edit it (Task 4 only touches the hand-authored
  `supported.md` / `rejects.md`).

### 4. Tests + fixtures

**The primary happy-path assertion is a unit test, not fixture 15.** The
`fixtures/15-linefill-two-line.pine` source calls `linefill.new(...)` as
an **unnamed statement**, so `emitLinefill` is silently skipped
(`handleNameOf` returns `null`) and the current `.expected.chart.ts`
contains only two `line.new` emissions — **no** linefill output and **no**
`linefill-rotatedrect-approximated` diagnostic. Regenerating it would
produce the same output. So:

- **Unit test (primary):** `src/transform/linefill-two-line.test.ts`
  currently asserts `expect(stmt).toContain("draw.rotatedRectangle(")`
  (~line 44). Change it to assert `draw.fillBetween(` with the two edges
  in the `A1 → A2` / `B1 → B2` ordering, and assert the
  `linefill-rotatedrect-approximated` diagnostic is **absent**. This is
  the real proof the lowering changed. Also re-check
  `src/transform/linefill-series-fill.test.ts` (the `linefill-series-fill`
  message wording from §1) and the coverage/synthetic suites
  (`polylineLinefill.coverage.test.ts`, `polylineLinefill.synthetic.test.ts`).
- **Fixture 15:** to make the golden actually exercise the lowering,
  update `fixtures/15-linefill-two-line.pine` to assign the linefill to a
  named var (`var linefill fill = linefill.new(lineA, lineB, color)`) so
  `emitLinefill` fires, then regenerate. If you instead leave the `.pine`
  unnamed, document that fixture 15 only covers the skip path and the
  lowering is covered by the unit test. Decide and keep the fixture
  honest.
- Regenerate fixtures via **`UPDATE_FIXTURES=1`** (the
  `src/tests/golden.test.ts` mechanism writes both `.expected.chart.ts`
  and `.expected.diagnostics.json`; do not hand-edit them):
  `UPDATE_FIXTURES=1 pnpm --filter @invinite-org/chartlang-pine-converter test src/tests/golden.test.ts`.
- Confirm any regenerated `.chart.ts` that emits `draw.fillBetween`
  **compiles** (the fixtures-compile test imports it from core — green
  only because Tasks 1+2 landed).
- `fixtures/10-camp-c-reject-linefill.*` stays unchanged (still a reject
  via `linefill-over-ring` / `cross-collection-linefill`); confirm green.

### 5. CLAUDE.md (`packages/pine-converter/CLAUDE.md`)

Update the linefill section: linefill now lowers to `draw.fillBetween`
(not a rotatedRectangle approximation); list the retained rejects and the
retained `linefill-series-fill` info note. Keep the camp taxonomy intact.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/polylineLinefill.ts` | Modify | `emitLinefill` → `draw.fillBetween` |
| `packages/pine-converter/src/mapping/drawingKinds.ts` | Modify | linefill note / kind |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | drop rotatedrect code, soften series-fill |
| `packages/pine-converter/src/diagnostics/codes.test.ts` | Modify (if it pins the dropped code) | severities/counts |
| `docs/converter/diagnostics.md` | Regenerate (`pnpm converter:docs:generate`) | generated — reflects code removal |
| `packages/pine-converter/src/transform/linefill-two-line.test.ts` | Modify | assert `draw.fillBetween` emit + diagnostic absent |
| `packages/pine-converter/src/transform/linefill-series-fill.test.ts` | Modify | series-fill message wording |
| `packages/pine-converter/fixtures/15-linefill-two-line.{pine,expected.chart.ts,expected.diagnostics.json}` | Modify + Regenerate | name the linefill so the lowering is exercised (or document the skip) |
| `packages/pine-converter/CLAUDE.md` | Modify | linefill section |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on pine-converter; fixtures-compile green)
- `pnpm converter:docs:check` (regenerated `diagnostics.md` byte-matches
  after the code removal)
- `pnpm docs:check` (if any JSDoc on changed exports)

## Changeset

Deferred to Task 5 (pine-converter gets a `minor` bump there).

## Acceptance Criteria

- Static two-line `linefill.new` lowers to `draw.fillBetween` with the
  correct two edges, proven by `linefill-two-line.test.ts` (asserts
  `draw.fillBetween(` and the absence of the removed diagnostic).
- `linefill-rotatedrect-approximated` removed from `codes.ts`;
  `diagnostics.md` regenerated and `pnpm converter:docs:check` green;
  `linefill-series-fill` message updated; rejects unchanged.
- 100% coverage on pine-converter; all fixture tests green (any
  `draw.fillBetween`-emitting fixture compiles).
- `packages/pine-converter/CLAUDE.md` updated.

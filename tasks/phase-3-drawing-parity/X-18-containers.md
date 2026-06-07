# Task 18 — Containers — `group` / `frame`

> **Status: TODO**

## Goal

Port the 2 container drawing kinds. Bucket: `other`. `group` is
the nesting parent (carries child handle ids); `frame` is a
bounded rectangle that can hold other drawings (carries 2
WorldPoints + optional label).

## Prerequisites

- Tasks 1–17 — `group` needs the full set of kinds emittable
  first so its children references are non-empty in the
  conformance scenario.

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source | Bucket |
|---|---|---|---|---|---|
| `group` | `group` | 0 (metadata) | `children: ReadonlyArray<string>` (handle ids), `style: { lineWidth?: number; color?: Color }` (boundary box style — adapter renders bounding box around children) | (no standalone tool — collab metadata only) | `other` |
| `frame` | `frame` | 2 (a, b) | `a`, `b`, `opts: FrameOpts` (label, bgColor) | (no standalone tool — `frame-tool.ts` doesn't exist in invinite; schema lives in `shared/trading-chart-collab-yjs/y-doc-bridge.ts` only) | `other` |

## Distinct Decisions

- **`group.children` is a list of handle ids** (string IDs the
  script collected from prior `draw.<kind>(...).id`). Validator
  pins `children.length ≤ 100` (sane cap; tighten later if
  needed).
- **`group` has no anchors of its own.** Adapter renders a
  bounding box derived from the children's anchor extrema.
  Canvas2d renderer queries
  `view.drawingsById.get(childId).state` for each child and
  computes the bounding box.
- **`frame` IS a bounded rectangle**. Renders the bounding
  box + optional label inside.
- **No standalone tool for `group` OR `frame`** — neither
  `group-tool.ts` nor `frame-tool.ts` exists in
  `../invinite/src/components/trading-chart/tools/`. Provenance
  header on BOTH `group.ts` and `frame.ts` cites
  `shared/trading-chart-collab-yjs/y-doc-bridge.ts` only
  (matches the `cypher-pattern` Task-15 pattern).

## Runtime Notes

- `draw.group(children: ReadonlyArray<DrawingHandle>)` accepts
  handle objects, reads `.id` from each, builds the state.
  Wrapper helper: `draw.group([h1, h2, h3])` is legal.
- `draw.frame(a, b, opts?)` straightforward.

## Renderer Notes

- `frame` — `strokeRect` + `fillText` for label + optional
  `fillRect` for bg.
- `group` — compute bounding box from children's emitted
  states; render boundary box dashed (signals grouping). NO
  re-render of children (they render themselves).

## Conformance

2 per-kind scenarios + `drawContainersAll.scenario.ts`. The
`group` scenario emits 3 lines then groups them.

## Tests

- `group.property.test.ts` — `children.length ≤ 100`; longer
  fails validation.
- `frame.property.test.ts` — `a.time < b.time` AND `a.price !=
  b.price` (degenerate frames fail validation? — make the
  degenerate case a warning diagnostic, NOT a hard fail, since
  the script may compute degenerate anchors mid-warmup. Pin
  this in the validator: degenerate frames pass validation but
  the renderer no-ops).
- Standard §22.10.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/runtime/src/emit/draw/{group,frame}.ts` + 5 test files each | Create |
| `packages/runtime/src/emit/draw/index.ts` | Modify (LAST 2 stubs replaced — `notYetImplemented` count drops to 0) |
| `packages/core/src/draw/drawingState.ts` | Modify |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify (2 validators) |
| `examples/canvas2d-adapter/src/render/draw/{group,frame}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify (LAST 2 stubs replaced) |
| `packages/conformance/src/scenarios/{drawGroup,drawFrame,drawContainersAll}.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `docs/primitives/draw/{group,frame}.md` | Create (auto-gen) |
| `.changeset/phase-3-task-18-containers.md` | Create |

## Gates

Standard set. Additionally: the `draw` namespace shell
(`emit/draw/index.ts`) is now stub-free — assert via a test
that no method body throws `"not yet implemented"`.

## Changeset

Minor on runtime, core, adapter-kit, canvas2d, conformance.

## Acceptance Criteria

- 2 kinds emit / validate / decode / render / scenario-pass.
- `group.children` length cap enforced.
- `frame` degenerate anchors pass validation, render as no-op.
- Provenance headers on `group.ts` and `frame.ts` cite
  `y-doc-bridge.ts` only (no `*-tool.ts` reference — neither
  tool file exists in invinite).
- `draw` namespace shell has zero `notYetImplemented` slots
  remaining (verified by test that iterates `DRAWING_KINDS`
  and asserts every method is a real function).
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–17 gates green.
- Changeset committed.

# Task 7 — Boxes B — `circle` / `ellipse` / `path` / `marker`

> **Status: TODO**

## Goal

Port the 4 curved-edge / single-anchor box kinds. Follows the
landing template from Task 5 with the per-task details below.

## Prerequisites

- Tasks 1–6.

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source | Bucket |
|---|---|---|---|---|---|
| `circle` | `circle` | 2 (center, edge) | `center`, `edge` (radius derived in canvas px from `\|edge - center\|`), `style: ShapeStyle` | `tools/circle-tool.ts` | `boxes` |
| `ellipse` | `ellipse` | 2 (from, to) | `from`, `to` (axis-aligned bounding box defines major/minor axes), `style: ShapeStyle` | `tools/ellipse-tool.ts` | `boxes` |
| `path` | `path` | 2..20 (points) | `points: ReadonlyArray<WorldPoint>` (OPEN polyline), `opts: PathOpts` (closed?) | `tools/path-tool.ts` | `polylines` |
| `marker` | `marker` | 2 (from, to) | `from`, `to`, `markerKind: "emoji" \| "icon"`, `value: string`, `color?: Color` | `tools/marker-tool.ts` | `labels` |

## Distinct Decisions vs Task 5

- **`circle` radius is computed in canvas pixel space**, not
  world space. The renderer projects `center` + `edge` to canvas
  px and uses the pixel distance as the radius. Persisting two
  world points (not center + worldRadius) is invinite's choice
  and matches its `circle-tool.ts`; mirroring keeps round-trip
  fidelity across zoom changes.
- **`ellipse` is axis-aligned in world space.** The two anchors
  define opposite corners of the bounding box; the renderer
  uses `(centerX, centerY, radiusX, radiusY)` via
  `ctx.ellipse(...)`. Rotated ellipses are NOT in Phase 3 (no
  invinite source — out of scope).
- **`path` distinct from `polyline` (Task 6).** `path` is OPEN
  (no auto-connect last→first); `polyline` is CLOSED.
  `PathOpts.closed?` lets the script override.
- **`marker.markerKind ∈ {"emoji", "icon"}` is a state-level
  discriminator.** Validator pins the enum; renderer uses
  `ctx.fillText(state.value, ...)` for emoji and a small
  icon-registry lookup for `icon` (canvas2d ships a 5-icon
  registry: `warning`, `info`, `arrow-up`, `arrow-down`, `check`
  — extensible in adapter consumer repos).
- **`marker.value` MAX_LENGTH = 32.** Cap pinned in the
  validator to bound the wire-size of label-bucket emissions.
  Match: `validateLabelStyle.MAX_LABEL_LENGTH = 128` for plot
  labels in Phase 1 — drawing-side cap is tighter because
  marker glyphs are typically 1–4 chars.

## Renderer Notes

- `circle` — `ctx.beginPath()` + `ctx.arc(cx, cy, r, 0, 2*PI)` +
  `ctx.stroke()` (+ `fill()`).
- `ellipse` — `ctx.beginPath()` + `ctx.ellipse(cx, cy, rx, ry,
  0, 0, 2*PI)` + `ctx.stroke()`.
- `path` — `ctx.beginPath()` + N `lineTo` (NO `closePath`) +
  `ctx.stroke()`. If `opts.closed === true`, do close.
- `marker` — text-only for emoji, icon-registry SVG-path for
  icon (registry: `examples/canvas2d-adapter/src/render/draw/iconRegistry.ts`,
  ~30 lines, ships in Task 7).

## Conformance

4 per-kind scenarios + Task 7 lands the COMBINED
`drawBoxesAll.scenario.ts` (emits all 8 box kinds from Tasks 6 +
7, supersedes Task 6's `drawBoxesA.scenario.ts` which is
removed in this PR — clean delete, no shim).

## Tests

Per-kind §22.10 set. Specific:
- `circle.property.test.ts` — radius monotonic in `|edge-center|`.
- `ellipse.property.test.ts` — axis-aligned guarantee.
- `path.property.test.ts` — open vs closed flag toggles last
  segment.
- `marker.property.test.ts` — `markerKind ∈ {"emoji", "icon"}`
  always validates; any other value fails.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/runtime/src/emit/draw/{circle,ellipse,path,marker}.ts` + 5 test files each | Create |
| `packages/runtime/src/emit/draw/index.ts` | Modify |
| `packages/core/src/draw/drawingState.ts` | Modify (refine 4 variants) |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify (4 validators) |
| `examples/canvas2d-adapter/src/render/draw/{circle,ellipse,path,marker}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/iconRegistry.ts` + test | Create |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify |
| `packages/conformance/src/scenarios/{drawCircle,drawEllipse,drawPath,drawMarker,drawBoxesAll}.scenario.ts` | Create |
| `packages/conformance/src/scenarios/drawBoxesA.scenario.ts` | Delete (superseded by `drawBoxesAll`) |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `docs/primitives/draw/{circle,ellipse,path,marker}.md` | Create (auto-gen) |
| `.changeset/phase-3-task-7-boxes-b.md` | Create |

## Gates

- `pnpm typecheck`, `pnpm test`, `pnpm conformance`,
  `pnpm bench:ci`, `pnpm docs:check`, `pnpm readme:check`.

## Changeset

Minor on runtime, core, adapter-kit, canvas2d, conformance.

## Acceptance Criteria

- 4 kinds emit / validate / decode / render / scenario-pass.
- `drawBoxesAll.scenario.ts` exercises all 8 box kinds (Tasks 6
  + 7) in one script.
- `drawBoxesA.scenario.ts` removed cleanly.
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–6 gates green.
- Changeset committed.

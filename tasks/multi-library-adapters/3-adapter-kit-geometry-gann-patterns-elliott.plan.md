# Plan — Task 3: adapter-kit geometry — gann, pitchforks, patterns, elliott, cycles, containers, table

Audit artifact for `3-adapter-kit-geometry-gann-patterns-elliott.md`. Validated
against the workspace on 2026-06-20.

## Context

Tasks 1+2 landed the geometry layer (`packages/adapter-kit/src/geometry/`): the
`DrawPrimitive` IR, projection (`timeToX`/`priceToY`/`worldPointToPixel`), the
`paintPrimitive` canvas sink, and `decomposeDrawing` covering 40 of 63 kinds.
The dispatcher's `default` arm currently widens (`const _exhaustive:
DrawingKind = e.drawingKind`) and returns `[]`. This task adds the final **23**
decomposers and swaps the `default` to the `const _exhaustive: never` guard,
making `decomposeDrawing` provably exhaustive over all 63 `DrawingKind`s.

All geometry is **moved, not re-derived** from
`examples/canvas2d-adapter/src/render/draw/*.ts`, translating each `ctx`-emitting
renderer into a pure `(state, view) => DrawPrimitive[]` decomposer with identical
pixel geometry (Task 4 re-pins the canvas2d hash with zero drift).

## Pre-existing work (Tasks 1–2) — reused, not forked

- `geometry/decompose.ts` — dispatcher with 40 arms + widening `default`.
  **Add 23 `case` arms; swap `default` to the `never` guard.**
- `geometry/_lib/namedPolyline.ts` — `namedPolylinePrimitives(points, labels,
  style)` already exists (default colour `#f59e0b`, `11px sans-serif`, label
  `align:center`/`baseline:bottom`, offset 6px). **Reused by all 6 patterns +
  5 elliott decomposers.**
- `geometry/_lib/dash.ts` — `dashPattern(LineStyle)`. Reused by cycles.
- `geometry/project.ts` — `worldPointToPixel`/`timeToX`/`priceToY`. Reused.
- `geometry/types.ts` — `DrawPrimitive`/`Point2`/`Viewport`/`StrokeStyle`/
  `FillStyle`. **No IR change needed** (table cell fill + frame bg use the
  existing `polyline.fill` `FillStyle`; cycle arcs use the existing `arc`).
- `geometry/_lib/bezier.ts` re-exports nothing new needed here.

## Verified source renderers (geometry contract — preserve exactly)

| Kind | Source | Geometry |
|------|--------|----------|
| `gann-box` | `gannBox.ts` | bbox of 2 anchors; 5 horizontal + 5 vertical polylines at `GANN_LEVELS` |
| `gann-square-fixed` | `gannSquareFixed.ts` | 80px square at anchor; 5+5 grid polylines |
| `gann-square` | `gannSquare.ts` | side `max(\|dx\|,\|dy\|)` from `a`, signed; 5+5 grid polylines |
| `gann-fan` | `gannFan.ts` | 9 rays from `a`, dir `(dx, ratio·dy)`, `mag===0` skip, length `max(w,h)·2` |
| `pitchfork` | `pitchfork.ts` + `pitchforkGeom.ts` | median `origin→target+Δ` (Δ=`target−origin`) + 2 parallels through `b`,`c`; variant via `medianOriginFor`/`medianTargetFor` |
| `pitchfan` | `pitchfan.ts` | 3 rays from `a` through `b`,`mid(b,c)`,`c`; `mag===0` skip; length `max(w,h)·2` |
| `xabcd-pattern` | `xabcdPattern.ts` | `namedPolylinePrimitives(pts, ["X","A","B","C","D"], style)` |
| `cypher-pattern` | `cypherPattern.ts` | same labels as xabcd |
| `head-and-shoulders` | `headAndShoulders.ts` | namedPolyline `["LS","LL","H","RL","RS"]` + neckline polyline `pts[1]→pts[3]` (default colour `#f59e0b`) |
| `abcd-pattern` | `abcdPattern.ts` | namedPolyline `["A","B","C","D"]` |
| `triangle-pattern` | `trianglePattern.ts` | namedPolyline `["A","B","C"]` |
| `three-drives-pattern` | `threeDrivesPattern.ts` | namedPolyline `["S","D1","R1","D2","R2","D3","E"]` |
| `elliott-impulse-wave` | `elliottImpulseWave.ts` | namedPolyline; default labels `["1".."5"]`, override by `state.labels` iff `length===pts.length`; style `{color:"#14b8a6", ...state.style}` |
| `elliott-correction-wave` | `elliottCorrectionWave.ts` | default `["A","B","C"]` |
| `elliott-triangle-wave` | `elliottTriangleWave.ts` | default `["a","b","c","d","e"]` |
| `elliott-double-combo` | `elliottDoubleCombo.ts` | default `["S","W","x1","X","x2","Yi","Y"]` |
| `elliott-triple-combo` | `elliottTripleCombo.ts` | default `["S","W","X1","Y","X2","Zi","Z"]` |
| `cyclic-lines` | `cyclicLines.ts` | repeated full-height vertical polylines spaced `periodPx`; `periodPx<=0` or non-finite → `[]`; `MAX_REPEATS=256`; break `x>pxWidth+16`, skip `x<-16` |
| `time-cycles` | `timeCycles.ts` | concentric upper-half arcs centred at `mid` on `from.y` baseline, radius `diameter/2`; `diameter<=0`/non-finite → `[]`; primary + right/left tiles, `MAX_REPEATS_PER_SIDE=64` |
| `sine-line` | `sineLine.ts` | one sampled polyline; 32 samples/period; baseline mid, amplitude `\|dy\|/2`, sign `peakAtFrom`; `halfPeriodPx<=0`/non-finite → `[]` |
| `group` | `group.ts` | `[]` (no-op container) |
| `frame` | `frame.ts` | optional bg `fill` polyline + border polyline (`#64748b`/1) + optional label `text` (`#1e293b`/`12px`/inset 6,14, baseline `bottom`≈alphabetic); degenerate (0 w/h, non-finite) → `[]` |
| `table` | `table.ts` | pixel/viewport layout; per cell: bg-fill polyline + text + optional border polyline; optional outer frame polyline. `position` resolved against `pxWidth`/`pxHeight` |

## Issues found / decisions

1. **Source `Point2` import.** `pitchforkGeom.ts` (canvas2d) imports `Point2`
   from `./bezier.js`; adapter-kit's `Point2` lives in `../types.js`. The move
   re-points the import to `../types.js` — pure relocation, same structural type.

2. **Pitchfork variant exhaustiveness.** `medianOriginFor`/`medianTargetFor`
   are `if`-chains over the 4-variant union with a trailing `return a` /
   `return midBC` default. The source has no `never` guard there (the default
   `return` IS the `standard` arm). Moved verbatim; unit tests feed all four
   variants so every branch is hit (100% branch coverage).

3. **No fills in the 6 patterns.** The task says "plus any filled region the
   source draws (`fill`)" — **none of the 6 pattern sources draw a fill**; they
   all delegate to `renderNamedPolyline` only (head-and-shoulders adds a stroke
   neckline, not a fill). Decomposers emit no `fill` — matching source. The
   `fill` opportunity in the task is conditional ("any … the source draws") and
   resolves to none. **Documented, not a deviation.**

4. **`table` baseline mapping.** The source frame label uses
   `textBaseline = "alphabetic"`; the IR `text.baseline` union is
   `"top"|"middle"|"bottom"`. Frame label maps to `"bottom"` (alphabetic sits
   on the baseline ≈ bottom of the cap box) — the closest IR baseline; the
   canvas painter (Task 1) maps IR baselines to `CanvasTextBaseline`, and Task 4
   re-pins the hash. This is a faithful IR projection of a renderer detail the
   IR cannot represent verbatim; pixel position is within the painter's mapping.
   **Recorded.** (Frame `LABEL_INSET_Y=14` from the top keeps the visual
   position; the baseline choice only affects the painter's vertical anchor.)

5. **Table is the only pixel-space decomposer.** It ignores world transforms
   and resolves `position` against `Viewport.pxWidth`/`pxHeight` — the layout
   helpers (`layoutTable`, `resolveX/Y`, `cellTextX/Y`, `textAlign/Baseline`,
   `estimateTextWidth`, `columnCount`, `textSizePx`) move verbatim into the
   decomposer file. Zero rows/cols → empty grid, no throw (the `for` loops and
   `reduce`s yield width/height 0 and emit no cells; only the outer `frame`
   polyline emits if `state.frame` set — a degenerate 0×0 rect, matching source
   which strokes it too).

6. **`never` exhaustiveness guard.** Mirror canvas2d `drawingDispatch.ts:309`
   exactly: `default: { const _exhaustive: never = e.drawingKind; void
   _exhaustive; return []; }`. The canvas2d default carries **no** coverage
   pragma and satisfies 100% coverage (the `default` body is unreachable but the
   `switch` is exhaustive so v8 counts the arm as covered via the type system —
   verified: canvas2d passes its 100% gate with this exact shape). Replicate
   verbatim; no pragma.

## Steps

1. `geometry/_lib/gannLevels.ts` (+test) — move verbatim from canvas2d
   `gannLevels.ts`: `GANN_LEVELS`, `GANN_FAN_RATIOS`, `GANN_FAN_LABELS`,
   `formatGannRatio`. `@since 0.3` (verbatim move). Test: freeze/identity +
   `formatGannRatio` both branches.
2. `geometry/_lib/pitchforkGeom.ts` (+test) — move `medianOriginFor`/
   `medianTargetFor`, re-pointing `Point2` to `../types.js`. `@since 0.3`. Test:
   all 4 variants for both functions.
3. `geometry/kinds/gann.ts` (+test) — `decomposeGannBox`, `decomposeGannSquareFixed`,
   `decomposeGannSquare`, `decomposeGannFan`. Shared `gridPolylines(left,right,
   top,bottom)` helper for the 3 boxes (DRY). Fan reuses `GANN_FAN_RATIOS`,
   `mag===0` skip.
4. `geometry/kinds/pitchforks.ts` (+test) — `decomposePitchfork` (3 polylines via
   `medianOriginFor`/`medianTargetFor`), `decomposePitchfan` (3 rays, skip
   degenerate).
5. `geometry/kinds/patterns.ts` (+test) — 6 decomposers via
   `namedPolylinePrimitives`; head-and-shoulders appends the neckline polyline.
6. `geometry/kinds/elliott.ts` (+test) — 5 decomposers; shared `elliottLabels`
   default-vs-override helper; style merge `{color:"#14b8a6", ...state.style}`.
7. `geometry/kinds/cycles.ts` (+test) — `decomposeCyclicLines`,
   `decomposeTimeCycles` (arc primitives), `decomposeSineLine` (sampled
   polyline). Reuse `dashPattern`.
8. `geometry/kinds/containers.ts` (+test) — `decomposeGroup` (`[]`),
   `decomposeFrame`, `decomposeTable` (verbatim pixel layout).
9. `geometry/decompose.ts` — import the 23 decomposers; add 23 `case` arms; swap
   `default` to the `never` guard; update the function JSDoc (now exhaustive).
10. `geometry/decompose.test.ts` — add a `TASK3` table (23 kinds), assert each
    routes to primitives (group asserts `[]`), assert `toHaveLength(23)`; update
    the "returns [] for unimplemented" test (none remain — replace with a
    `group → []` assertion, already covered by the TASK3 group entry; remove the
    stale `gann-box → []` test).
11. `.changeset/adapter-kit-geometry-complete.md` — minor.
12. `packages/adapter-kit/CLAUDE.md` — update the `default`-arm invariant: it is
    now the `never` guard (exhaustive over 63 kinds); add a one-line table /
    container / pixel-space note.

## Files to create / modify

| File | Action | Purpose |
|------|--------|---------|
| `geometry/_lib/gannLevels.ts` (+test) | Create | moved gann level/ratio tables |
| `geometry/_lib/pitchforkGeom.ts` (+test) | Create | moved median-line geometry |
| `geometry/kinds/gann.ts` (+test) | Create | 4 decomposers |
| `geometry/kinds/pitchforks.ts` (+test) | Create | 2 decomposers |
| `geometry/kinds/patterns.ts` (+test) | Create | 6 decomposers |
| `geometry/kinds/elliott.ts` (+test) | Create | 5 decomposers |
| `geometry/kinds/cycles.ts` (+test) | Create | 3 decomposers |
| `geometry/kinds/containers.ts` (+test) | Create | group/frame/table (3) |
| `geometry/decompose.ts` | Modify | +23 arms, `never` guard |
| `geometry/decompose.test.ts` | Modify | TASK3 table (23), drop stale test |
| `packages/adapter-kit/CLAUDE.md` | Modify | exhaustive-dispatcher invariant |
| `.changeset/adapter-kit-geometry-complete.md` | Create | minor |

(All paths under `packages/adapter-kit/src/` unless noted.)

## Gates to keep green

- `pnpm typecheck` — the `never` guard must compile (proves 63-kind coverage).
- `pnpm lint` — biome (4-space, 100-col, double quotes, `useImportType`).
- `pnpm test` — adapter-kit **100%** line/branch/function/statement.
- `pnpm docs:check` — JSDoc + `@since` + `@example` + stability on every NEW
  export (`@formula`/`@anchors` not required outside `/src/ta`, `/src/draw`).
- `pnpm readme:check` — README untouched (≤ 100 lines).
- canvas2d UNTOUCHED (geometry moved INTO adapter-kit; source renderers stay
  until Task 4 deletes them).

## Changeset

`.changeset/adapter-kit-geometry-complete.md` — **minor** for
`@invinite-org/chartlang-adapter-kit` (completes the 63-kind decomposer; the
`never` guard makes `decomposeDrawing` exhaustive). Additive, backward-compatible.

## Acceptance criteria

- [ ] All 63 `DrawingKind`s decompose to `DrawPrimitive[]`; per-kind unit tests
      cover gann/pitchfork/pattern/elliott/cycle/container/table.
- [ ] The `never` exhaustiveness guard compiles (proves full coverage).
- [ ] All shared geometry (`gannLevels`, `pitchforkGeom`, `fibLevels`,
      `namedPolyline`, `bezier`) lives once in `_lib`.
- [ ] 100% coverage; docs:check + readme:check green; lint + typecheck clean.
- [ ] CLAUDE.md exhaustive-dispatcher invariant updated; changeset (minor) added.

## Deviations from the task (recorded)

1. **No `fill` in the 6 patterns** (Issue 3) — no pattern source draws a filled
   region; the task's `fill` is conditional and resolves to none.
2. **Frame label baseline `"alphabetic"` → IR `"bottom"`** (Issue 4) — the IR
   `text.baseline` union has no `alphabetic`; `bottom` is the faithful map and
   the painter handles the canvas baseline.

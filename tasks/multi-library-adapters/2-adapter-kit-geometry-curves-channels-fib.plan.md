# Plan — Task 2: adapter-kit geometry — curves, freehand, channels, fibonacci

Audit artifact for `2-adapter-kit-geometry-curves-channels-fib.md`. Validated
against the workspace on 2026-06-20.

## Context

Extend Task 1's `decomposeDrawing` dispatcher with 20 more drawing kinds —
3 curves, 3 freehand, 4 channels, 10 fibonacci — each a pure
`(state, view) => DrawPrimitive[]` decomposer **moved** (not re-derived) from
the matching `examples/canvas2d-adapter/src/render/draw/*.ts` renderer. One
minimal IR addition: an optional `StrokeStyle.alpha` so the `highlighter`
translucent stroke is expressible. The fib level set + label formatter move
verbatim into a shared `_lib/fibLevels.ts`.

## Pre-existing work (Task 1) — reused, not forked

- `src/geometry/decompose.ts` — dispatcher with 20 basic arms + widening
  `default` returning `[]`. **Add 20 `case` arms; keep the `default`.**
- `src/geometry/types.ts` — `Point2`, `Viewport`, `StrokeStyle`, `FillStyle`,
  `DrawPrimitive`. **Add `alpha?: number` to `StrokeStyle`.**
- `src/geometry/kinds/{lines,boxes,annotations,marker}.ts` — decomposer style.
  New kinds go in **new** sibling files `{curves,freehand,channels,fibonacci}.ts`.
- `src/geometry/_lib/{bezier,lineExtend,shapeStyle,textStyle,dash,namedPolyline}.ts`
  — reused. `bezier.sampleQuadratic`/`sampleCubic` cover arc/curve/double-curve/
  spiral. `lineExtend.extendLineSegment` covers fib-retracement extend. `dash`
  covers all stroke dashes.
- `src/canvas/paintPrimitive.ts` (+test) — **modify** to honor `StrokeStyle.alpha`.
- `src/geometry/index.ts` — barrel; no new public export needed (the new
  decomposers are reached only through `decomposeDrawing`; `_lib` is private).

## Verified source renderers (geometry contract — preserve exactly)

| Kind | Source | Geometry |
|------|--------|----------|
| `arc` | `draw/arc.ts` | inverse-quadratic control `2*apex − 0.5*(from+to)`; `sampleQuadratic(from, control, to, 32)` → open polyline |
| `curve` | `draw/curve.ts` | middle anchor IS control; `sampleQuadratic(from, control, to, 32)` → open polyline |
| `double-curve` | `draw/doubleCurve.ts` | `sampleCubic(P0, P1, P3, P4, 32)` (anchors[2] mid unused) → open polyline |
| `pen` | `draw/pen.ts` | open polyline, `LineDrawStyle`, default `#000`/1/solid |
| `highlighter` | `draw/highlighter.ts` | open polyline, width **6**, `stroke.alpha = style.alpha`, color required |
| `brush` | `draw/brush.ts` | closed polyline, fill `style.fill` (alpha 1) + stroke `style.stroke` width 1 |
| `trend-channel` | `draw/trendChannel.ts` | 2 polylines: primary `a→b`, parallel `a+Δ→b+Δ` where `Δ = hook−a` |
| `flat-top-bottom` | `draw/flatTopBottom.ts` | 2 horizontal polylines at max/min(p0.price,p2.price), x from p0.time/p1.time |
| `disjoint-channel` | `draw/disjointChannel.ts` | 2 polylines: `a→b`, `c→d` |
| `regression-trend` | `draw/regressionTrend.ts` | **1 polyline** `a→b`, color default `#3b82f6`, width 1, solid (see Issue 1) |
| `fib-retracement` | `draw/fibRetracement.ts` | per level: horizontal polyline at price `from+level*(to−from)`, extendLeft/Right via `extendLineSegment`; optional right-edge label |
| `fib-trend-extension` | `draw/fibTrendExtension.ts` | per level: horizontal polyline `startX=timeToX(C.time)`→`pxWidth` at `C.price+level*(B−A)`; optional label at `pxWidth+4` |
| `fib-channel` | `draw/fibChannel.ts` | per level: polyline `a→b` offset by `level*(c.y−a.y)` in pixel-y; optional label at `b.x+4` |
| `fib-time-zone` | `draw/fibTimeZone.ts` | per level: vertical polyline at `timeToX(A.time+level*(B.time−A.time))`, full height; optional label at top, baseline top |
| `fib-wedge` | `draw/fibWedge.ts` | per level: ray from pivot at interpolated dir; `mag===0` skip; length `max(w,h)*2`; optional label at 0.25 along |
| `fib-speed-fan` | `draw/fibSpeedFan.ts` | per level: ray from `from`, dir `(dx, level*dy)`; `mag===0` skip; length `max(w,h)*2`; optional label at 0.25 |
| `fib-speed-arcs` | `draw/fibSpeedArcs.ts` | per level: full arc radius `level*r0`, `r0=|edge−centre|`; optional label at `cx+radius+4` |
| `fib-spiral` | `draw/fibSpiral.ts` | golden-ratio cubic-Bezier sweep (8 quarters, 16 samples/quarter, φ, k); `r===0` → `[]`; single open polyline |
| `fib-circles` | `draw/fibCircles.ts` | per level: full arc radius `level*r0`; optional label `cx+radius+4` |
| `fib-trend-time` | `draw/fibTrendTime.ts` | per level: vertical polyline at `timeToX(C.time+level*(B.time−A.time))`; optional label top |

Label style (all fib labels): font `12px sans-serif`, color = level color,
`align:"left"`, baseline `"middle"` (price/radius fibs) or `"top"` (time fibs).
`showLabels` defaults to **false** (`=== true` gate in every source). Label is
emitted only when `showLabels === true` — exactly matches source.

## Issues found / decisions

1. **`regression-trend` is a placeholder line, NOT bands.** The task §3 says
   "computes the regression line + optional upper/lower std-dev bands from
   `RegressionTrendOpts` … state carries the computed anchors". **This is not
   achievable and contradicts the workspace:** `RegressionTrendState.anchors`
   is an `AnchorPair` (2 points only — no band anchors), and
   `RegressionTrendOpts` carries only `source` / `stdevMultiplier` /
   `showUpperBand` / `showLowerBand` / `color` — no σ, no fitted series. The σ
   bands require a bar buffer the `Viewport` does not expose (the canvas2d
   source `regressionTrend.ts` documents exactly this and renders a single
   placeholder line `a→b`). Per the feature's **"moved, not re-derived"**
   mandate (README §8) and the repo rule "preserve exact pixel geometry", the
   decomposer reproduces the source: **one polyline `a→b`, color default
   `#3b82f6`, width 1, solid dash.** `showUpperBand`/`showLowerBand`/
   `stdevMultiplier`/`source` are accepted but unused (documented in JSDoc),
   matching the source's deferred-fidelity note. **Deviation from task §3.**

2. **Channels are stroke-only — no fill between rails.** The task §3 says each
   channel "emits … plus an optional filled `polyline` between rails (use
   `fill` with the channel's alpha)". **The source renderers + the `LineDrawStyle`
   type forbid this:** `trend-channel` / `flat-top-bottom` / `disjoint-channel`
   carry `LineDrawStyle` (no `fill` / `fillAlpha` field), and the canvas2d
   renderers are explicitly stroke-only (`trendChannel.ts` JSDoc: "Stroke-only
   — the fill between rails is deferred … no `fillAlpha` on `LineDrawStyle`").
   `regression-trend` likewise. Decomposers are **stroke-only**, matching the
   source exactly. **Deviation from task §3** — there is no styling channel to
   carry a fill alpha, so adding one would invent geometry, violating
   "moved, not re-derived".

3. **`StrokeStyle.alpha` added (the one IR change).** Optional
   `alpha?: number`. `paintPrimitive` wraps the `stroke()` call in
   `globalAlpha = stroke.alpha` / reset to `1` when present (mirrors the source
   `highlighter.ts` globalAlpha bracket). When absent, the painter's call
   sequence is **byte-identical** to Task 1 (no extra `set` records) — so every
   Task-1 paint test that omits `alpha` keeps its pinned sequence. Only one new
   `highlighter`-path test asserts the alpha bracket. `applyFill` already
   brackets `globalAlpha` for fills; the stroke bracket is the symmetric add.
   The `arc` / `marker` painter arms inherit the same `applyStroke` bracket
   (covered by their existing + one new test).

4. **fibLevels moved verbatim.** `_lib/fibLevels.ts` is the canvas2d
   `draw/fibLevels.ts` byte-for-byte except the import-relative comments (none)
   — `FIB_LEVELS` (frozen 13-element array incl. the biome-ignore on 1.414) +
   `formatLevel`. Both exported from the file; consumed by all 10 fib
   decomposers. Not re-exported from the package barrel (`_lib` is private, per
   the CLAUDE.md invariant). The `@since` stays `0.3` (it is a verbatim move of
   an existing-versioned export); new fib decomposers use `@since 1.3` like
   Task 1's geometry exports.

5. **Highlighter / brush color fields are required** (`HighlighterStyle.color`
   + `.alpha`, `BrushStyle.stroke` + `.fill` are non-optional) — no defaulting
   needed. Highlighter width default is **6** (source `DEFAULT_LINE_WIDTH = 6`);
   brush stroke width **1**; brush fill alpha **1** (source `ctx.fill()` at
   globalAlpha 1).

6. **fib edge cases.** `style.levels ?? FIB_LEVELS` (empty array → no level
   primitives, matches source loop). `fib-spiral` / (and the task notes
   `fib-circles`) zero radius: spiral source early-returns `[]` when `r === 0`
   — reproduce. `fib-circles` / `fib-speed-arcs` source do NOT early-return on
   `r0 === 0` (they emit zero-radius arcs); to "preserve exact pixel geometry"
   the decomposers also emit zero-radius arcs (the painter draws a degenerate
   arc, same as source). The task's "`fib-circles` zero radius → `[]`" is
   **not** what the source does; we follow the source (Issue documented). Only
   `fib-spiral` early-returns (matches source).

7. **fib-wedge / fib-speed-fan `mag === 0` skip.** Source `continue`s past a
   degenerate ray — the decomposer omits that level's primitive(s) (both the
   ray polyline AND its label), preserving geometry. Covered by a unit test
   feeding a degenerate ray direction.

## Steps

1. `geometry/types.ts` — add `readonly alpha?: number` to `StrokeStyle` with a
   JSDoc note; update the `@example` comment line only if needed (keep stable).
2. `canvas/paintPrimitive.ts` — extend `applyStrokeStyle` usage: wrap each
   `stroke()` in a `globalAlpha` bracket when `stroke.alpha !== undefined`.
   Factor a small `strokeWithAlpha(ctx, stroke)` helper used by all three
   stroke arms (polyline/arc/marker) to keep DRY and 100% branch coverage.
3. `canvas/paintPrimitive.test.ts` — add: (a) a polyline-with-alpha test
   asserting the `set globalAlpha` → `stroke` → `set globalAlpha` → `setLineDash`
   sequence; (b) assert the no-alpha path is unchanged (already covered — add an
   explicit "omits globalAlpha when alpha undefined" assertion if a branch is
   otherwise uncovered).
4. `geometry/_lib/fibLevels.ts` (+test) — move verbatim from canvas2d
   `draw/fibLevels.ts` (`FIB_LEVELS`, `formatLevel`). Test: array identity /
   freeze / formatLevel integer-vs-fractional branches.
5. `geometry/kinds/curves.ts` (+test) — `decomposeArc`, `decomposeCurve`,
   `decomposeDoubleCurve`. Reuse `sampleQuadratic`/`sampleCubic` + `dashPattern`.
6. `geometry/kinds/freehand.ts` (+test) — `decomposePen`, `decomposeHighlighter`
   (`stroke.alpha`), `decomposeBrush` (closed, fill+stroke).
7. `geometry/kinds/channels.ts` (+test) — `decomposeTrendChannel`,
   `decomposeFlatTopBottom`, `decomposeDisjointChannel`,
   `decomposeRegressionTrend` (placeholder line). Reuse `dashPattern` +
   `worldPointToPixel`.
8. `geometry/kinds/fibonacci.ts` (+test) — 10 decomposers reusing
   `FIB_LEVELS`/`formatLevel`, `worldPointToPixel`/`timeToX`/`priceToY`,
   `extendLineSegment`, `sampleCubic`. A shared package-private
   `fibLabel(text, x, y, color, baseline)` helper builds the `text` primitive
   to keep the 10 decomposers DRY.
9. `geometry/decompose.ts` — import the 20 new decomposers; add 20 `case` arms;
   keep the widening `default` (Task 3 closes it).
10. `geometry/decompose.test.ts` — extend the per-kind coverage list with the
    20 new kinds (representative anchors), asserting the primitive kinds.
11. `.changeset/adapter-kit-geometry-curves-fib.md` — minor.
12. `packages/adapter-kit/CLAUDE.md` — add a geometry invariant documenting (a)
    `StrokeStyle.alpha`'s globalAlpha bracket + no-alpha byte-identity, and (b)
    that `regression-trend` / channels are stroke-only placeholders matching the
    source (no bands, no rail fill).

## Files to create / modify

| File | Action |
|------|--------|
| `packages/adapter-kit/src/geometry/types.ts` | Modify — add `StrokeStyle.alpha?` |
| `packages/adapter-kit/src/canvas/paintPrimitive.ts` | Modify — honor `alpha` |
| `packages/adapter-kit/src/canvas/paintPrimitive.test.ts` | Modify — alpha tests |
| `packages/adapter-kit/src/geometry/_lib/fibLevels.ts` (+test) | Create — verbatim move |
| `packages/adapter-kit/src/geometry/kinds/curves.ts` (+test) | Create |
| `packages/adapter-kit/src/geometry/kinds/freehand.ts` (+test) | Create |
| `packages/adapter-kit/src/geometry/kinds/channels.ts` (+test) | Create |
| `packages/adapter-kit/src/geometry/kinds/fibonacci.ts` (+test) | Create |
| `packages/adapter-kit/src/geometry/decompose.ts` | Modify — 20 arms |
| `packages/adapter-kit/src/geometry/decompose.test.ts` | Modify — 20 kinds |
| `packages/adapter-kit/CLAUDE.md` | Modify — invariants |
| `.changeset/adapter-kit-geometry-curves-fib.md` | Create — minor |

## Gates to keep green

- `pnpm typecheck` — strict; no `any`, no `!`, no incompatible `as`.
- `pnpm lint` — biome (4-space, 100-col, double quotes, `useImportType`).
- `pnpm test` — adapter-kit **100%** line/branch/function/statement.
- `pnpm docs:check` — every new export has JSDoc + `@since` + `@example` +
  stability marker (`@formula`/`@anchors` NOT required outside `/src/ta`,
  `/src/draw`).
- `pnpm readme:check` — README untouched (≤ 100 lines, already passing).
- canvas2d UNTOUCHED (geometry moved INTO adapter-kit; the source renderers stay
  until Task 4 deletes them).

## Changeset

`.changeset/adapter-kit-geometry-curves-fib.md` — **minor** for
`@invinite-org/chartlang-adapter-kit` (extends decomposer coverage + adds the
optional `StrokeStyle.alpha` IR field; both backward-compatible).

## Acceptance criteria

- [ ] `decomposeDrawing` returns correct primitives for all 20 curve / freehand
      / channel / fibonacci kinds, per-kind unit-tested.
- [ ] `StrokeStyle.alpha` added (optional) + honored by `paintPrimitive`;
      no-alpha path byte-identical; Task-1 paint tests still green.
- [ ] `_lib/fibLevels.ts` moved verbatim (exact `FIB_LEVELS` + `formatLevel`),
      reused by every fib decomposer (no parallel level array).
- [ ] 100% coverage; docs:check + readme:check green; lint + typecheck clean.
- [ ] CLAUDE.md invariant added; changeset (minor) committed.

## Deviations from the task (recorded)

1. **`regression-trend` → single placeholder line, not σ bands** (Issue 1) —
   the state + opts cannot carry band geometry and the source renders a line;
   "moved, not re-derived" wins.
2. **Channels are stroke-only — no inter-rail fill** (Issue 2) — `LineDrawStyle`
   has no fill alpha and the source renderers are stroke-only.
3. **`fib-circles` / `fib-speed-arcs` do NOT early-return on zero radius** —
   they emit zero-radius arcs, matching the source (only `fib-spiral`
   early-returns `[]`, which the source does). Task §"edge cases" said
   `fib-circles` zero radius → `[]`; the source disagrees and the source is the
   contract.

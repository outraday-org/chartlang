# Task 10 — Channels — `trendChannel` / `flatTopBottom` / `disjointChannel` / `regressionTrend`

> **Status: TODO**

## Goal

Port the 4 channel-family drawing kinds. Bucket: `polylines`.

## Prerequisites

- Tasks 1–9.

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source | Bucket |
|---|---|---|---|---|---|
| `trend-channel` | `trendChannel` | 3 (p1, p2, p3) | `p1`, `p2`, `p3` (3rd defines parallel offset), `style: LineDrawStyle` | `tools/trend-channel-tool.ts` | `polylines` |
| `flat-top-bottom` | `flatTopBottom` | 4 (p1, p2, p3, p4) | 2 angled rails + 2 horizontal rails, `style: LineDrawStyle` | `tools/flat-top-bottom-tool.ts` | `polylines` |
| `disjoint-channel` | `disjointChannel` | 4 (p1, p2, p3, p4) | Two independent parallel lines (no perpendicular constraint), `style: LineDrawStyle` | `tools/disjoint-channel-tool.ts` | `polylines` |
| `regression-trend` | `regressionTrend` | 2 (start: Time, end: Time) | `start: Time`, `end: Time`, `opts: RegressionTrendOpts` (source, stdevMultiplier, showUpperBand, showLowerBand) | `tools/regression-trend-tool.ts` | `polylines` |

## Distinct Decisions

- **`regressionTrend` is the only kind with time-only anchors,
  not WorldPoint.** It runs an OLS regression over the
  `source`-field bars in `[start, end]` and renders the
  regression line + optional ±stdev bands. The compute happens
  in the ADAPTER (or in a host helper) — Phase 3's runtime
  emit just persists the inputs (start, end, opts). Canvas2d's
  renderer runs the regression locally over the visible bar
  buffer.

  Important: this means `regression-trend` is the only Phase-3
  kind whose render fidelity depends on bar data the adapter
  has access to. Canvas2d's renderer queries
  `view.barsInRange(start, end)` (extend `Viewport` in
  `coords.ts` with a `barsInRange` accessor if not already
  present; verify in the PR) and computes slope/intercept
  inline. Other adapters can implement equivalently.

  Reuse `packages/runtime/src/ta/lib/linearRegression.ts` (the
  Phase-2 OLS helper). Verified state: the file ships at that
  path but is NOT currently re-exported from
  `packages/runtime/src/ta/index.ts` or
  `packages/runtime/src/index.ts` (it's a `lib/` internal). Task
  10 widens the public surface — add the re-export to
  `packages/runtime/src/index.ts` so consumer adapters that
  render `regressionTrend` (and any future ports) can import
  the same math without duplicating. JSDoc on the export
  carries `@since 0.3` and `@experimental`.

- **`trendChannel`'s `p3` is a single offset point**, not a
  parallel line specification. Renderer: line(p1, p2) +
  parallel line through p3 (shifted by the perpendicular
  distance from p3 to the p1→p2 line).
- **`flatTopBottom` is a five-rail / four-anchor structure** —
  see invinite's `flat-top-bottom-tool.ts` for the geometry.
  Two-anchor angled line + horizontal line spanning the other
  two anchors.
- **`disjointChannel` is just two independent parallel
  segments** — 4 anchors define 2 line segments; no shared
  geometry constraint.

## Renderer Notes

- `trendChannel` — line(p1, p2) + parallelLineThrough(p3, p1→p2);
  fill the polygon between (optional, gated by `style.fillAlpha`).
- `flatTopBottom` — 2× `ctx.beginPath` + stroke for the two rail
  pairs.
- `disjointChannel` — 2× independent strokes.
- `regressionTrend` — runs OLS on visible bars in range; strokes
  the line + 0–2 stdev bands (per `opts.showUpperBand` /
  `showLowerBand`).

## Conformance

4 per-kind scenarios + 1 category bundle. The
`regressionTrend.scenario.ts` uses `bars[100..200]` as the
regression range so the result is stable across reruns.

## Tests

- `regressionTrend.golden.test.ts` — pin the regression
  slope/intercept against the goldenBars window.
- `regressionTrend.property.test.ts` — `start < end` always;
  `stdevMultiplier ≥ 0` enforced.
- Other kinds standard §22.10.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/runtime/src/emit/draw/{trendChannel,flatTopBottom,disjointChannel,regressionTrend}.ts` + 5 test files each | Create |
| `packages/runtime/src/emit/draw/index.ts` | Modify |
| `packages/core/src/draw/drawingState.ts` | Modify |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify (4 validators) |
| `packages/runtime/src/index.ts` | Modify (re-export `linearRegression` if not public) |
| `examples/canvas2d-adapter/src/render/draw/{trendChannel,flatTopBottom,disjointChannel,regressionTrend}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify |
| `packages/conformance/src/scenarios/{drawTrendChannel,drawFlatTopBottom,drawDisjointChannel,drawRegressionTrend,drawChannelsAll}.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `docs/primitives/draw/{trend-channel,flat-top-bottom,disjoint-channel,regression-trend}.md` | Create (auto-gen) |
| `.changeset/phase-3-task-10-channels.md` | Create |

## Gates

Standard set.

## Changeset

Minor on runtime, core, adapter-kit, canvas2d, conformance.

## Acceptance Criteria

- 4 kinds emit / validate / decode / render / scenario-pass.
- `regressionTrend` reuses `linearRegression` from Phase 2
  Task 4; no duplicated math.
- Per-kind golden hashes pinned; `regressionTrend` golden
  validates against a stable `bars[100..200]` window.
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–9 gates green.
- Changeset committed.

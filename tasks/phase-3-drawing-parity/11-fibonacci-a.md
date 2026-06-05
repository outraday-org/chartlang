# Task 11 — Fibonacci A — `fibRetracement` / `fibTrendExtension` / `fibChannel` / `fibTimeZone` / `fibWedge`

> **Status: TODO**

## Goal

Port the 5 "linear" fib kinds (level-line and zone-divider
geometry). Bucket: `other` for all 5. The radial fib kinds
(speedFan, speedArcs, spiral, circles, trendTime) land in
Task 12.

## Prerequisites

- Tasks 1–10 (Task 4's `FIB_LEVELS` + `formatLevel` consumed).

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source | Bucket |
|---|---|---|---|---|---|
| `fib-retracement` | `fibRetracement` | 2 (from, to) | `from`, `to`, `opts: FibOpts` (levels overrideable; default = `FIB_LEVELS`) | `tools/fib-retracement-tool.ts` | `other` |
| `fib-trend-extension` | `fibTrendExtension` | 3 (a, b, c) | `a`, `b`, `c`, `opts: FibOpts` | `tools/fib-trend-extension-tool.ts` | `other` |
| `fib-channel` | `fibChannel` | 3 (a, b, c) | `a`, `b`, `c`, `opts: FibOpts` | `tools/fib-channel-tool.ts` | `other` |
| `fib-time-zone` | `fibTimeZone` | 2 (at: WorldPoint, span: Time) | `at`, `span: Time` (vertical divisions at fib-spaced times after `at.time`), `opts: FibOpts` | `tools/fib-time-zone-tool.ts` | `other` |
| `fib-wedge` | `fibWedge` | 3 (apex, b, c) | `apex`, `b`, `c`, `opts: FibOpts` | `tools/fib-wedge-tool.ts` | `other` |

## Distinct Decisions

- **All 5 share the `FibOpts` style bag** declared in Task 1.
  `opts.levels` defaults to `Array.from(FIB_LEVELS)` if omitted —
  the renderer normalises.
- **`fibRetracement` is the canonical fib drawing.** Renders
  horizontal level lines between `from.price` and `to.price` at
  each fib ratio; labels on the right edge (`formatLevel`).
  Optionally extends left/right per `opts.extendLeft` /
  `extendRight`.
- **`fibTrendExtension`** uses the (a→b→c) leg to project
  extensions beyond `c.time` at fib ratios of `|b - a|`. Renders
  horizontal level lines.
- **`fibChannel`** is a parallel-line fib — like `trendChannel`
  but with fib-spaced parallels.
- **`fibTimeZone`** renders VERTICAL lines at fib-spaced times
  starting at `at.time` with `span` as the unit. Useful for
  cycle-projection studies.
- **`fibWedge`** renders radial lines from `apex` through
  fib-spaced angles bounded by the (apex→b) and (apex→c)
  directions.

## Renderer Notes

- All 5 use `FIB_LEVELS` from Task 4 (unless `opts.levels`
  overrides). Each level renders + a label at the right edge
  (`formatLevel(level)`).
- `fibRetracement` — N horizontal strokes spanning the
  viewport's visible x range (or `[from.time, to.time]` if
  neither extend flag set).
- `fibTrendExtension` — N horizontal strokes at projected price
  levels.
- `fibChannel` — N parallel strokes.
- `fibTimeZone` — N vertical strokes at `at.time + i*span` for
  `i ∈ {1, 2, 3, 5, 8, 13, 21, ...}` (fib sequence — different
  from level RATIOS). Helper
  `examples/canvas2d-adapter/src/render/draw/fibSequence.ts`
  declares `FIB_SEQUENCE: ReadonlyArray<number>` = `[1, 2, 3,
  5, 8, 13, 21, 34, 55, 89, 144]`.
- `fibWedge` — radial strokes from `apex`.

## Conformance

5 per-kind scenarios + 1 bundle (`drawFibAScenario.ts` — Task
12 supersedes with the full `drawFibAll.scenario.ts`).
`fibRetracement.scenario.ts` uses `bars[0].time` → `bars[500].time`
as the leg.

## Tests

- `fibRetracement.golden.test.ts` — pin hash for default levels.
- `fibTimeZone.property.test.ts` — `at.time + i*span` for every
  `i ∈ FIB_SEQUENCE` is finite.
- Other kinds standard §22.10.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/runtime/src/emit/draw/{fibRetracement,fibTrendExtension,fibChannel,fibTimeZone,fibWedge}.ts` + 5 test files each | Create |
| `packages/runtime/src/emit/draw/index.ts` | Modify (replace 5 in `fib` sub-namespace stubs) |
| `packages/core/src/draw/drawingState.ts` | Modify |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify (5 validators) |
| `examples/canvas2d-adapter/src/render/draw/{fibRetracement,fibTrendExtension,fibChannel,fibTimeZone,fibWedge}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/fibSequence.ts` + test | Create |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify |
| `packages/conformance/src/scenarios/{drawFibRetracement,drawFibTrendExtension,drawFibChannel,drawFibTimeZone,drawFibWedge,drawFibA}.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `docs/primitives/draw/{fib-retracement,fib-trend-extension,fib-channel,fib-time-zone,fib-wedge}.md` | Create (auto-gen) |
| `.changeset/phase-3-task-11-fibonacci-a.md` | Create |

## Gates

Standard set.

## Changeset

Minor on runtime, core, adapter-kit, canvas2d, conformance.

## Acceptance Criteria

- 5 kinds emit / validate / decode / render / scenario-pass.
- `FIB_LEVELS` reused (not duplicated).
- `FIB_SEQUENCE` declared once in canvas2d-adapter (consumed by
  Task 12's `fibTrendTime` and `fibSpiral` if applicable).
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–10 gates green.
- Changeset committed.

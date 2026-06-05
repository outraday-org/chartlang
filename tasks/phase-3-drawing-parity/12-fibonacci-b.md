# Task 12 — Fibonacci B — `fibSpeedFan` / `fibSpeedArcs` / `fibSpiral` / `fibCircles` / `fibTrendTime`

> **Status: TODO**

## Goal

Port the 5 radial/curve fib kinds. Bucket: `other`.

## Prerequisites

- Tasks 1–11 (`FIB_LEVELS` from Task 4; `FIB_SEQUENCE` from
  Task 11; `quadraticBezier` / `cubicBezier` / `sampleQuadratic`
  from Task 4).

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source | Bucket |
|---|---|---|---|---|---|
| `fib-speed-fan` | `fibSpeedFan` | 2 (from, to) | `from`, `to`, `opts: FibOpts` (radial fan at fib-spaced angles from `from` to `to` slopes) | `tools/fib-speed-fan-tool.ts` | `other` |
| `fib-speed-arcs` | `fibSpeedArcs` | 2 (from, to) | `from`, `to`, `opts: FibOpts` (half-disk or full-circle arcs at fib-spaced radii from `from`) | `tools/fib-speed-arcs-tool.ts` | `other` |
| `fib-spiral` | `fibSpiral` | 2 (from, to) | `from`, `to`, `opts: { counterClockwise?: boolean } & FibOpts` (golden spiral fit) | `tools/fib-spiral-tool.ts` | `other` |
| `fib-circles` | `fibCircles` | 2 (center, radiusPoint) | `center`, `radiusPoint`, `opts: FibOpts` (concentric circles at fib-spaced radii) | `tools/fib-circles-tool.ts` | `other` |
| `fib-trend-time` | `fibTrendTime` | 3 (a, b, c) | `a`, `b`, `c`, `opts: FibOpts` (time-axis fib intersected with trend) | `tools/fib-trend-time-tool.ts` | `other` |

## Distinct Decisions

- **`fibSpiral` `counterClockwise` flag** — `y-doc-bridge.ts`
  `FibSpiralDrawing` carries it; validator pins as optional
  boolean. Renderer uses `cubicBezier` repeatedly (one Bezier per
  quarter-turn, scaled by φ) to approximate the golden spiral.
- **`fibSpeedArcs`** can be half-disk or full-circle —
  determined by the relative position of `to` (above or below
  `from`). Renderer uses `ctx.arc` for each radius.
- **`fibCircles`** is concentric circles centred at `center`,
  not at `from`. Render N circles at radii `(i * |radiusPoint -
  center|)` for `i ∈ {1, 2, 3, 5, 8}` (a subset of FIB_SEQUENCE
  appropriate for visual clarity).
- **`fibSpeedFan`** is the radial line equivalent — N rays from
  `from` at slopes scaled by fib ratios of the (from→to) slope.

## Renderer Notes

- `fibSpeedFan` — N strokes from `from` to viewport edge.
- `fibSpeedArcs` — N `ctx.arc(from, r, 0, halfOrFull, false)`.
- `fibSpiral` — N quarter-Beziers in a spiral.
- `fibCircles` — N `ctx.beginPath()` + `ctx.arc` + `ctx.stroke`.
- `fibTrendTime` — combination of `fibRetracement` levels +
  `fibTimeZone` time-axis divisions intersected.

## Conformance

5 per-kind scenarios + `drawFibAll.scenario.ts` (supersedes
Task 11's `drawFibA.scenario.ts`; deleted in this PR).
`drawFibAll` emits all 10 fib kinds in one script.

## Tests

- `fibSpiral.property.test.ts` — quadrant count + spiral
  monotonic (radius strictly increases).
- `fibCircles.property.test.ts` — radii monotonic.
- Other kinds standard §22.10.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/runtime/src/emit/draw/{fibSpeedFan,fibSpeedArcs,fibSpiral,fibCircles,fibTrendTime}.ts` + 5 test files each | Create |
| `packages/runtime/src/emit/draw/index.ts` | Modify |
| `packages/core/src/draw/drawingState.ts` | Modify |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify (5 validators) |
| `examples/canvas2d-adapter/src/render/draw/{fibSpeedFan,fibSpeedArcs,fibSpiral,fibCircles,fibTrendTime}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify |
| `packages/conformance/src/scenarios/{drawFibSpeedFan,drawFibSpeedArcs,drawFibSpiral,drawFibCircles,drawFibTrendTime,drawFibAll}.scenario.ts` | Create |
| `packages/conformance/src/scenarios/drawFibA.scenario.ts` | Delete |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `docs/primitives/draw/{fib-speed-fan,fib-speed-arcs,fib-spiral,fib-circles,fib-trend-time}.md` | Create (auto-gen) |
| `.changeset/phase-3-task-12-fibonacci-b.md` | Create |

## Gates

Standard set.

## Changeset

Minor on runtime, core, adapter-kit, canvas2d, conformance.

## Acceptance Criteria

- 5 kinds emit / validate / decode / render / scenario-pass.
- `drawFibAll.scenario.ts` exercises all 10 fib kinds.
- `drawFibA.scenario.ts` removed cleanly.
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–11 gates green.
- Changeset committed.

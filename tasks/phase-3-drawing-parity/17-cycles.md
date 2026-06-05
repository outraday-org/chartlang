# Task 17 — Cycles — `cyclicLines` / `timeCycles` / `sineLine`

> **Status: TODO**

## Goal

Port the 3 cycle drawing kinds. Bucket: `other`.

## Prerequisites

- Tasks 1–16.

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source | Bucket |
|---|---|---|---|---|---|
| `cyclic-lines` | `cyclicLines` | 2 (from, to) | `from`, `to`, `style: LineDrawStyle` (period = `to.time - from.time`; renders vertical lines at every multiple of period extending right) | `tools/cyclic-lines-tool.ts` | `other` |
| `time-cycles` | `timeCycles` | 2 (from, to) | `from`, `to`, `style: ShapeStyle` (renders concentric shaded arcs at the period) | `tools/time-cycles-tool.ts` | `other` |
| `sine-line` | `sineLine` | 2 (from, to) | `from`, `to`, `period: number`, `style: LineDrawStyle` | `tools/sine-line-tool.ts` | `other` |

## Distinct Decisions

- **Period in time-ms.** All 3 use `to.time - from.time` as the
  base period (`cyclicLines`, `timeCycles`) or the explicit
  `period: number` (`sineLine` — number of bars per cycle).
- **`cyclicLines` is unbounded right.** Renderer projects
  vertical strokes at every `from.time + i * period` for
  `i ∈ [0, viewportSpan / period]`. The unbounded nature is
  capped by the viewport, not by anchor count.
- **`timeCycles` renders concentric arcs.** The center is the
  midpoint of (from, to); radii at multiples of the half-period.
  Filled with `style.fill` + `style.fillAlpha`.
- **`sineLine` renders a sampled sinusoidal waveform.** N
  samples per cycle (e.g. 32); amplitude = `(to.price -
  from.price) / 2`; period = `period` arg (bars). Renderer uses
  `Math.sin(2 * PI * t / period)` over the time span.

## Renderer Notes

- `cyclicLines` — loop over `i` strokes vertical line at
  projected x.
- `timeCycles` — multiple `ctx.arc` calls.
- `sineLine` — `ctx.beginPath()` + N `lineTo` for the sampled
  waveform.

## Conformance

3 per-kind scenarios + `drawCyclesAll.scenario.ts`.

## Tests

- `sineLine.property.test.ts` — `period > 0` enforced
  (`sineLine` carries the explicit `period: number` field);
  amplitude bounded by `|to.price - from.price| / 2`.
- `cyclicLines.test.ts` — `to.time > from.time` enforced (the
  cycle period is `to.time - from.time`; degenerate or
  reversed anchors fail validation with `malformed-emission`).
  `cyclicLines` carries no explicit `period` field; the
  validator works against the two anchors only.
- `timeCycles.test.ts` — same `to.time > from.time` check.
- Standard §22.10 otherwise.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/runtime/src/emit/draw/{cyclicLines,timeCycles,sineLine}.ts` + 5 test files each | Create |
| `packages/runtime/src/emit/draw/index.ts` | Modify |
| `packages/core/src/draw/drawingState.ts` | Modify |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify (3 validators) |
| `examples/canvas2d-adapter/src/render/draw/{cyclicLines,timeCycles,sineLine}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify |
| `packages/conformance/src/scenarios/{drawCyclicLines,drawTimeCycles,drawSineLine,drawCyclesAll}.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `docs/primitives/draw/{cyclic-lines,time-cycles,sine-line}.md` | Create (auto-gen) |
| `.changeset/phase-3-task-17-cycles.md` | Create |

## Gates

Standard set.

## Changeset

Minor on runtime, core, adapter-kit, canvas2d, conformance.

## Acceptance Criteria

- 3 kinds emit / validate / decode / render / scenario-pass.
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–16 gates green.
- Changeset committed.

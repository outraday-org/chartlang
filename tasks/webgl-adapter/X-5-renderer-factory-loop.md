# Renderer orchestration + createWebglAdapter factory + run loop

> **Status: TODO**

## Goal

Port invinite's `Renderer.ts` (per-pane frame orchestration: viewport +
scissor + clear + per-descriptor program dispatch) and wire it into the
real `createWebglAdapter` factory + `runWebglLoop`, so a mounted GL
canvas paints whatever descriptors Task 4's `buildFrame` produces. After
this task the pipeline is end-to-end (no programs dispatch yet → blank
clears; Tasks 6–7 add candles + lines).

## Prerequisites

Task 2 (context/program/cache), Task 3 (projection/viewport/buffers),
Task 4 (state/buildFrame/descriptors).

## Desired Behavior

`createWebglAdapter({ canvas, ... })` builds a `GlContext`, an
`AdapterState`, a `Renderer`, and the host; `onEmissions` ingests +
schedules a draw; the per-frame draw walks panes, sets
`gl.viewport`/`gl.scissor` from `paneViewport`, builds the `ortho2d`
matrix from the pane's world window, and dispatches each descriptor to
its program (via `program-cache`). `runWebglLoop` drives candles.

## Requirements

1. **`src/webgl/Renderer.ts`** — port the orchestrator (provenance):
   - `new Renderer(glContext)`; `update(panes: PaneRenderState[])`
     stages a snapshot; `drawNow()` paints synchronously;
     `scheduleDraw()` coalesces via `requestAnimationFrame`;
     `prunePane(key)`; `dispose()` (idempotent, walks used programs).
   - `drawNow`: `beginFrame` clears (scissor disabled), then per pane:
     `gl.viewport`/`gl.scissor` from `paneViewport`, optional bg clear,
     compute `ortho2d` from the pane's `window`, and `dispatchLayer()`
     per descriptor — selecting the program by `descriptor.kind` from
     `program-cache`. For THIS task `dispatchLayer` may handle the
     (empty) descriptor set gracefully; the candle/line program arms land
     in Tasks 6–7. Drop invinite's React/stats coupling (keep a minimal
     `getStats()` if cheap, else omit).

2. **`createWebglAdapter` (src/index.ts)** — replace the Task-1 stub
   body: resolve `gl` (from `opts.gl` test seam or
   `canvas.getContext("webgl2")` via `gl-context.ts`); build
   `AdapterState`; thread `opts.initialVisibleBars` onto state (conditional
   spread, `exactOptionalPropertyTypes`); build the host
   (`opts.host ?? createWorkerHost(...)`); create the `Renderer`. Keep the
   headless path: if no real canvas/`gl` is available (the default
   capabilities-only export, `{width,height}` only), construct WITHOUT a
   `Renderer`/`gl` so conformance + node tests still work — `onEmissions`
   updates state but the draw is a no-op when there is no `gl`.

3. **`onEmissions`** — `applyEmissions(state, emissions)` (Task 4) then,
   when a `Renderer` exists, `renderer.update(buildFrame(state, layout))`
   + `scheduleDraw()`. Resolve the layout rects (single overlay pane for
   MVP; subpanes in Task 10).

4. **`runWebglLoop`** — finalize the shared loop (iterate
   `candles({interval})` → `host.push` → yield → `host.drain` →
   `onEmissions`; abort on `opts.signal`). Mirror `runRendererLoop`.

5. **DOM-wiring guard** — like canvas2d, only attach a real GL context /
   `requestAnimationFrame` when `canvas` is a real element; headless
   tests pass `{width,height}` (+ optionally a stub `gl`) and no
   rAF/listeners attach (`/* v8 ignore */` the DOM seam).

6. **Tests** — unit-test the headless factory path (state updates on
   `onEmissions`, no `gl` → no throw, `dispose` idempotent,
   `runWebglLoop` over `mockCandleSource`). Browser GL rendering is
   exercised by the demo (Task 9), not node.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/webgl/Renderer.ts` | Create | Frame orchestration |
| `examples/webgl-adapter/src/index.ts` | Modify | Real factory + onEmissions + run loop |
| `examples/webgl-adapter/src/index.test.ts` | Modify | Headless factory/loop tests |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test`
- `pnpm adapters:generate` + `pnpm adapters:gate` (factory surface
  changed → re-bake the CLI bundle)
- `pnpm conformance` (still green via the headless default export)

## Changeset

None.

## Acceptance Criteria

- `Renderer` ported with provenance; per-pane viewport/scissor/ortho2d
  draw loop in place; `dispose` idempotent.
- `createWebglAdapter` renders through `gl` when mounted on a real
  canvas, and stays a safe no-op draw when headless (conformance/default
  export unaffected).
- `pnpm adapters:gate` + `pnpm conformance` green; headless factory tests
  pass.

# WebGL Adapter (full parity with invinite's `trading-chart/webgl`)

## 1. Overview

Add a sixth bundled chart adapter — `examples/webgl-adapter`
(`chartlang-example-webgl-adapter`) — a **raw WebGL2, zero-dependency**
GPU renderer ported from invinite's `src/components/trading-chart/webgl/`
(SHA `cd883292b4977362c9497de75af9d3ea8b5440b7`). It renders candles
(GPU-instanced bodies + wicks with device-pixel snapping), plot series
(miter-joined, anti-aliased line strips), drawings, fills, markers,
cursors, and axes — TradingView-grade output (see the "wobbly MA / thin
candle" investigation and its follow-ups: the wins there were the 120-bar
default window, HiDPI rendering, and default monotone-cubic line smoothing —
all now shipped on the other five adapters; the WebGL adapter matches that
smoothness AND additionally brings true GPU MSAA + thick miter-joined line
quads, the AA tier the canvas/SVG adapters cannot reach).

The adapter satisfies the same `Adapter` contract as the existing five
(`packages/adapter-kit`), is wired into the registry / CLI bundles /
react-starter seam / create-chartlang installer / apps/site demo, and
passes the shared conformance suite (emission contract).

This is a **full-parity** rollout. Tasks 1–9 land an MVP renderer
(candles, line/area/step plots, axes, pan/zoom, the 120-bar default
window) and wire it end-to-end so it is selectable in the demo and
clonable by the installer. Tasks 10–14 add the remaining invinite
programs (vertical/volume bars, filled bands, cursors, glyphs/markers,
drawings, candle/background overrides + z-order).

References: repo `CLAUDE.md` (per-folder contract rule), `examples/CLAUDE.md`
(adapter layout + "only canvas2d is coverage-gated"),
`packages/adapter-kit/CLAUDE.md` (geometry / interaction / wire
invariants), `apps/react-starter/CLAUDE.md` (seam SSOT),
`packages/create-chartlang/CLAUDE.md` (seamTemplates parity),
`scripts/CLAUDE.md` (registry SSOT), §22.4 (scaffold), §16.3 (test
layers), §22.10 (landing contract).

## 2. Current State

- Five adapters: `canvas2d` (reference, the only coverage-gated example),
  `lightweight-charts`, `uplot`, `echarts`, `konva` — now all at **full
  feature parity** (per `tasks/adapter-feature-parity/`): a shared
  `sortByRenderOrder` + `RENDER_BAND` z-order pass, full glyphs (incl.
  the `marker` style), line-family `colorValue` (3-state) wire-honesty,
  `alertConditions`/`logs` rendering, and candle-override by bull/bear/
  doji direction. webgl is the **sixth** adapter and must meet the same
  parity bar.
- **Default `line` smoothing + HiDPI crispness + sticky zoom** also landed
  on the five (the "wobbly MA / thin candle" follow-ups): plain `line` plots
  render as a smooth curve by default (canvas2d `monotoneCubicSegments`, konva
  `tension`, echarts `smooth`, uPlot `paths.spline()`, lightweight-charts
  `lineType: Curved`); self-scaled canvas adapters draw at `devicePixelRatio`
  via an ambient `setTransform`; and the shared `ViewController` seeds the first
  zoom/pan from the framed view (no snap-back to fit-all). webgl inherits the
  zoom fix for free (it reuses `ViewController`) and gets HiDPI crispness from
  its planned MSAA + DPR line width, but it must **add line smoothing** (Task 7)
  to avoid being the lone faceted adapter.
- The `Adapter` contract + capabilities model + emission validators +
  shared **geometry layer** (`decomposeDrawing` → `DrawPrimitive`),
  **interaction layer** (`createViewController`, `yRangeInWindow`,
  `attachInteraction`), and **canvas sink** live in
  `packages/adapter-kit`.
- A new adapter is added by touching ~14 places: `scripts/adapters/registry.ts`
  (SSOT) → `pnpm adapters:generate` bakes `packages/cli/src/generated/adapters/*`;
  `apps/react-starter/src/lib/chart/seamVariants.ts` (+ byte-identical
  `create-chartlang/src/seamTemplates.ts`); `apps/site/src/components/demo/adapters/*`;
  per-adapter `src/conformance.test.ts`; plus CLAUDE.md updates.
- The `initialVisibleBars` default-window option (120) exists on every
  current adapter and is passed by all three seams + the demo.
- No GPU/WebGL renderer exists. No adapter is dependency-free except
  canvas2d (raw Canvas2D).

## 3. Target State

- `examples/webgl-adapter/` ships a `createWebglAdapter(opts)` +
  `runWebglLoop(handle, opts)` + `WebglAdapterHandle` +
  `WEBGL_CAPABILITIES` + a capabilities-only default export, mirroring
  the canvas2d factory shape. **Zero npm chart-lib dependency** (raw
  WebGL2), like canvas2d.
- Full invinite program set ported: candle bodies, candle wicks,
  line-strip, vertical bars, filled band, cursors, indicator/trade
  markers, drawings; shader modules `assemble` / `project32` /
  `nan-skip` / `aa`; `gl-context`, `program`, `program-cache`,
  `buffer-pool`, `vao`, `projection` (ortho2d), `viewport`, `geometry`,
  `Renderer`, `ChartController`.
- Pure layers (projection math, viewport rounding, geometry packers,
  emission→descriptor mapping, color resolution) are **unit-tested
  headlessly**; raw `gl.*` calls are browser-only (exercised by the
  demo + the react-starter `vite build` matrix). Text (axis labels,
  drawing labels, marker/alert text) renders via a thin **2D-canvas
  overlay** layered over the GL canvas.
- Reuses the shared `ViewController` (pan/zoom + `initialVisibleBars`
  auto-follow window), `yRangeInWindow` (y-autofit to the visible
  window), `medianBarSpacing` / `projectShiftedX` (xShift),
  `decomposeDrawing` (all 63 drawing kinds → primitives), `feedKey`,
  `mockCandleSource`, and `createWorkerHost` — never forks them. Also
  consumes the **post-parity** shared helpers `sortByRenderOrder` +
  `RENDER_BAND` (z-order, promoted by `tasks/adapter-feature-parity`
  Task 1) and `adapter-kit/canvas/glyphs.ts` (glyph geometry, promoted
  by Task 9) instead of re-deriving them.
- Meets the post-parity feature bar: the `marker` plot style is
  dispatched, line-family `colorValue` (omitted ⇒ static, present ⇒
  override, `null` ⇒ gap) paints, candle-override resolves bull/bear/
  doji by bar direction, and `alertConditions`/`logs` render — same as
  the other five adapters.
- Registry entry + CLI bundle + react-starter seam (byte-identical
  installer template) + demo driver + conformance test, all green.
  Selectable as "WebGL" in the demo; `add-adapter webgl` clones it.

## 4. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Raw WebGL2, zero npm dep** | Faithful to invinite; no peer lib (like canvas2d). `library: ""`, `libraryRange: ""` in the registry. |
| **Pure packers + capabilities-only conformance; browser-only `gl.*`** | No native dep (mirrors canvas2d's "no node-canvas" rule). Conformance is emission-contract (renderer-independent), so the default export only needs valid `capabilities`. Geometry/projection packers are pure → unit-tested. |
| **NOT in the 100% coverage gate** | `scripts/coverage-merge.ts` walks `packages/*` + `examples/canvas2d-adapter` only. The webgl example adapter follows the other library adapters (echarts/konva/uplot/lwc): tests exist but no 100% gate, so browser-only GL code is acceptable. |
| **Reuse adapter-kit interaction + geometry; port only GPU layers** | `ViewController` / `yRangeInWindow` / `decomposeDrawing` / shift helpers are the shared cross-adapter contracts. Port invinite's `ortho2d`/`viewport`/programs/shaders; convert the resolved world window → ortho matrix. Never fork the shared layer. |
| **Consume the post-parity shared render-order + glyph helpers (do NOT re-derive)** | `tasks/adapter-feature-parity` promoted the z-order comparator (`sortByRenderOrder` + `RENDER_BAND`, Task 1) into `adapter-kit` and the glyph geometry (`drawShape`/`drawCharacter`/`drawArrow`/`drawMarker`/`drawLabel`, Task 9) into `adapter-kit/canvas/glyphs.ts`. Those are now the canonical copies (canvas2d/uplot/lwc import them). webgl imports both — same "never fork the shared layer" rule. Task 14's z-pass supplies only its mark payload + application; Task 12/13 glyphs paint through the shared canvas helper on the 2D overlay. |
| **Match the post-parity feature bar** | Parity is now defined against the upgraded five: dispatch the `marker` style, honor line-family `colorValue` (3-state, per-segment recolor — wire-honest; no script emits it yet), resolve candle-override bull/bear/doji by direction, and render `alertConditions`/`logs`. webgl meets the same bar so `z-layering` / glyph / override samples render identically. |
| **Text via a 2D-canvas overlay, not GPU SDF** | WebGL text is costly (SDF atlas). A `<canvas>` overlay sized to the GL canvas paints axis labels, drawing text, marker/alert text with the existing `RenderCtx` text API. Keeps the GL pipeline scoped to geometry. |
| **`initialVisibleBars` default window = 120** | Consistency with the other five adapters; the three seams + demo pass it. The GL projection's x-window comes from `ViewController.resolveXWindow(dataXMin, dataXMax, autoFollowXMin)`. |
| **MVP first (tasks 1–9), parity after (10–14)** | The MVP is independently shippable + selectable; parity programs extend it without reworking the core. |
| **Provenance on every ported file** | invinite is a sibling private repo; ports carry the 4-line header + SHA `cd883292b...`. "Translate, not transcribe" — adapt to the chartlang `Adapter`/emission contract. |

## 5. Dependency Graph

```
Task 1 (scaffold + capabilities + registry + generation + conformance stub)
  |
  v
Task 2 (GL infra: context, program, program-cache, geometry, vao)
  |
  v
Task 3 (pure math: projection ortho2d, viewport, shader-modules, buffer-pool)
  |
  v
Task 4 (state + emission ingestion + layer descriptors + window/y-fit reuse)
  |
  v
Task 5 (Renderer orchestration + createWebglAdapter factory + runWebglLoop)
  |
  +--> Task 6 (candle bodies + wicks programs)
  |
  +--> Task 7 (line-strip program: line/area/step plots)
          |
          v
        Task 8 (axes + grid + 2D text overlay + ChartController interaction)
          |
          v
        Task 9 (MVP wiring: seam + demo + installer + matrix + CLAUDE.md)  <-- MVP shippable
          |
          +--> Task 10 (vertical/volume bars + subpane layout)
          +--> Task 11 (filled-band program: fillBetween / Bollinger)
          +--> Task 12 (cursors + glyphs + markers + alert badges via overlay)
                  |
                  v
                Task 13 (drawings: decomposeDrawing -> GL polyline/arc + overlay text/marker)
                  |
                  v
                Task 14 (bg/bar/candle overrides + z-order pass + docs + changeset + gates)
```

## 6. Task Summary

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Scaffold + capabilities + registry wiring](./1-scaffold-capabilities-registry.md) | examples/webgl-adapter, scripts, cli | None | Medium |
| 2 | [GL context + program + cache + VAO + geometry](./2-gl-context-program-infra.md) | examples/webgl-adapter | 1 | High |
| 3 | [Projection + viewport + shader modules + buffer pool](./3-projection-shaders-buffers.md) | examples/webgl-adapter | 2 | High |
| 4 | [Adapter state + emission ingestion + descriptors + window](./4-state-emission-descriptors.md) | examples/webgl-adapter | 1, 3 | High |
| 5 | [Renderer orchestration + factory + run loop](./5-renderer-factory-loop.md) | examples/webgl-adapter | 2, 3, 4 | High |
| 6 | [Candle bodies + wicks programs](./6-candle-programs.md) | examples/webgl-adapter | 5 | High |
| 7 | [Line-strip program (line/area/step plots)](./7-line-strip-program.md) | examples/webgl-adapter | 5 | High |
| 8 | [Axes + grid + text overlay + interaction](./8-axes-overlay-interaction.md) | examples/webgl-adapter | 6, 7 | High |
| 9 | [MVP wiring: seam + demo + installer + matrix](./9-mvp-wiring.md) | apps, packages/create-chartlang | 5–8 | Medium |
| 10 | [Vertical/volume bars + subpane layout](./10-vertical-bars-subpanes.md) | examples/webgl-adapter | 9 | High |
| 11 | [Filled-band program (fillBetween / Bollinger)](./11-filled-band.md) | examples/webgl-adapter | 7, 10 | Medium |
| 12 | [Cursors + glyphs + markers + alert badges](./12-cursors-glyphs-markers.md) | examples/webgl-adapter | 8 | High |
| 13 | [Drawings via decomposeDrawing → GL](./13-drawings.md) | examples/webgl-adapter | 7, 11, 12 | High |
| 14 | [Overrides + z-order + docs + changeset + gates](./14-overrides-zorder-docs.md) | examples/webgl-adapter, docs | 10–13 | Medium |

## 7. Code Reuse

Never fork these — import from the published package surface:

| Symbol | Import path | Used by |
|--------|-------------|---------|
| `Adapter`, `Capabilities`, emission types | `@invinite-org/chartlang-adapter-kit` | all tasks |
| `createViewController`, `ViewController` | `@invinite-org/chartlang-adapter-kit` (`interaction/viewController.ts:125`) | 4, 8 (pan/zoom + `initialVisibleBars` window) |
| `yRangeInWindow` | `@invinite-org/chartlang-adapter-kit` (`viewController.ts:213`) | 4 (y-autofit to visible window) |
| `attachInteraction` | `@invinite-org/chartlang-adapter-kit` (`interaction/domWiring.ts:113`) | 8 (or port `ChartController`; prefer the shared wiring) |
| `medianBarSpacing`, `projectShiftedX` | `@invinite-org/chartlang-adapter-kit` (`geometry/shift.ts:29,95`) | 4, 7 (xShift) |
| `monotoneCubicSegments` (curve sampler) | `@invinite-org/chartlang-adapter-kit` (`geometry/monotoneSpline.ts`, promoted from canvas2d by Task 7) | 7 (default `line` smoothing — sample the shared spline into line-strip points; do NOT fork) |
| `Viewport`, `timeToX`, `priceToY` | `@invinite-org/chartlang-adapter-kit` (`geometry/{types,project}.ts`) | 4, 8 (text overlay reuses pixel projection) |
| `decomposeDrawing` → `DrawPrimitive` | `@invinite-org/chartlang-adapter-kit` (`geometry/decompose.ts:167`) | 13 (all 63 drawing kinds) |
| `sortByRenderOrder`, `RENDER_BAND`, `RenderOrderKey` | `@invinite-org/chartlang-adapter-kit` (promoted from canvas2d by `tasks/adapter-feature-parity` Task 1) | 14 (per-pane z-order — consume the shared comparator + bands; webgl supplies only its mark payload, never re-derives `a.z - b.z \|\| a.band - b.band \|\| a.seq - b.seq`) |
| glyph geometry: `drawShape`/`drawCharacter`/`drawArrow`/`drawMarker`/`drawLabel` | `@invinite-org/chartlang-adapter-kit/canvas` (`glyphs.ts`, promoted by `tasks/adapter-feature-parity` Task 9) | 12, 13 (overlay glyph + marker rendering — shared with uplot + lwc; identical geometry guarantees parity) |
| `mockCandleSource`, `feedKey` | `@invinite-org/chartlang-adapter-kit` (`mocks/mockCandleSource.ts:89`) | tests, multi-feed |
| `createWorkerHost`, `ScriptHost` | `@invinite-org/chartlang-host-worker` (`createWorkerHost.ts:83`) | 5 (factory builds the host) |
| `WEBGL_CAPABILITIES` shape | copy the canvas2d capability bag (`examples/canvas2d-adapter/src/capabilities.ts`) | 1 |
| `RenderCtx` text API (for the 2D overlay) | `@invinite-org/chartlang-adapter-kit/canvas` | 8, 12, 13 |

Do **not** re-derive bar-shift x projection, drawing geometry, the
visible-window math, the candle-state override semantics, **the z-order
comparator (`sortByRenderOrder`/`RENDER_BAND`), the glyph geometry
(`adapter-kit/canvas/glyphs.ts`), or the monotone-cubic line sampler
(`adapter-kit/geometry/monotoneSpline.ts`)** — they are shared. Port from invinite
ONLY the GPU layers (context, programs, shaders, buffers, ortho2d/
viewport, Renderer, ChartController).

## 8. Provenance

All ports are from `/Users/julianwaibel/Documents/GitHub/invinite`
`src/components/trading-chart/webgl/` at SHA
`cd883292b4977362c9497de75af9d3ea8b5440b7`. Every ported file carries:

```
// Ported from invinite src/components/trading-chart/webgl/<file> @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
```

Per-task source files (line counts from the inventory):

| invinite source | LOC | Task |
|-----------------|-----|------|
| `gl-context.ts` / `program.ts` / `program-cache.ts` / `geometry.ts` / `vao.ts` | 314/201/61/34/83 | 2 |
| `projection.ts` / `viewport.ts` / `buffer-pool.ts` / `shader-modules/*` | 50/66/461/159 | 3 |
| `layer-descriptor.ts` / `frame-state.ts` / `colors.ts` | 558/74/113 | 4 |
| `Renderer.ts` | 794 | 5 |
| `programs/{base,candle-bodies,candle-wicks}-program.ts` | 306/307/492 | 6 |
| `programs/line-strip-{program,pack}.ts` | 565/167 | 7 |
| `ChartController.ts` / `chart-controller-bus.ts` | 710/622 | 8 |
| `programs/vertical-bars-program.ts` / `horizontal-volume-bars-program.ts` | 287/376 | 10 |
| `programs/filled-band-program.ts` | 329 | 11 |
| `programs/{cursors,indicator-markers,markers,drawings}-program.ts` | 214/257/273/91 | 12, 13 |

## 9. Deferred / Follow-Up Work

- Tail-mutation dirty-range fast-path (invinite's per-frame upload-once
  + `bufferSubData` hints) — port the correctness first; the perf
  fast-path can land as a follow-up if profiling needs it.
- WebGL context-loss recovery (`webglcontextlost`/`restored`) beyond the
  basic guard.
- Image export / `preserveDrawingBuffer` blit path.
- GPU SDF text (replace the 2D-canvas overlay) if overlay text becomes a
  perf bottleneck.
- Making `webgl` a default/featured adapter in the installer — stays
  opt-in; `canvas2d` remains the committed seam default.

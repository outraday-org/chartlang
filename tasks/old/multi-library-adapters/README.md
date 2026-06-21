# Multi-Library Rendering Adapters

## 1. Overview

Today the repo ships exactly one rendering adapter —
`examples/canvas2d-adapter/`, which renders chartlang emissions to an
HTML Canvas 2D context. This feature adds **four more full-surface
example adapters** for the chart libraries that research showed can
host the complete chartlang drawing surface:

| Adapter | Library | License | Why |
|---------|---------|---------|-----|
| `examples/lightweight-charts-adapter/` | `lightweight-charts` (TradingView) | Apache-2.0 | Financial-native; Series-Primitives API hands you a `ctx` + price/time→coordinate converters. Candles/axes/panes for free. |
| `examples/uplot-adapter/` | `uplot` | MIT | Tiny/fast; draw-hooks expose raw `ctx` + `valToPos` — same immediate-mode model as canvas2d. |
| `examples/echarts-adapter/` | `echarts` | Apache-2.0 | Huge install base; native candlesticks; `custom` series + `graphic` with `api.coord()`. |
| `examples/konva-adapter/` | `konva` | MIT | Generic 2D scene-graph; every drawing maps to a node; retained-mode hit-testing showcases interactive drawings. |

All four are **full-surface** (all 63 `DrawingKind`s — the 62
`allPhase3Drawings()` kinds + `table` — plus all `PlotKind`s),
**headless-testable** (mock library surface + hashed call-log, mirroring
`MockCanvas2DContext`), and **conformance-wired**. None ship a browser
demo — they match the existing `canvas2d-adapter` shape exactly
(library package + test seam + conformance default export).

The enabling refactor: a **renderer-agnostic geometry layer** is added
to `packages/adapter-kit/` so the 63-kind drawing geometry
(fib/gann/elliott/bezier/pitchfork math) is derived **once** and shared.
`canvas2d-adapter` is refactored to consume it too, so no adapter owns a
parallel copy of the geometry.

**Discovery + distribution (Tasks 14–15).** Because the examples are
private (not npm-installable), the model is "copy the example." Tasks 14–15
make that one-command and discoverable: an adapters **registry** (single
source of truth) feeds both a `chartlang add-adapter <library>` CLI
installer (offline, version-pinned templates baked into the published CLI)
and a **generated** `docs/adapters/gallery.md` (comparison matrix + GitHub
deep links + install commands), kept in sync by an `adapters:gate`
byte-diff. Live in-browser demos are deferred (the adapters stay headless).

See repo `CLAUDE.md` (skill-mirroring rule), `examples/CLAUDE.md`,
`examples/canvas2d-adapter/CLAUDE.md`, `packages/conformance/CLAUDE.md`.

## 2. Current State

- **`packages/adapter-kit/`** (`@invinite-org/chartlang-adapter-kit`,
  public, MIT) exports: `defineAdapter`, `capabilities` builders,
  `validateEmission`/`decodeDrawing`, `mockCandleSource`,
  `BufferingAdapter`/`PassThroughAdapter`, and all emission/`Capabilities`
  types. **No geometry/projection helpers exist** — `timeToX`/`priceToY`/
  `Viewport`/`worldPointToCanvas` and all 63 drawing geometries live
  inside `examples/canvas2d-adapter/src/render/`.
- **`examples/canvas2d-adapter/`** (`chartlang-example-canvas2d-adapter`,
  private) is the reference adapter:
  - `src/render/draw/` — 63 per-kind renderers + dispatch
    (`drawingDispatch.ts`) + geometry helpers (`worldToCanvas.ts`,
    `bezier.ts`, `gannLevels.ts`, `pitchforkGeom.ts`, `lineExtend.ts`,
    `arrowhead.ts`, `chevron.ts`, `namedPolyline.ts`, `fibLevels.ts`,
    `shapeStyle.ts`, `textStyle.ts`).
  - `src/render/coords.ts` — `Viewport`, `timeToX`, `priceToY`.
  - `src/render/clear.ts` — the `RenderCtx` structural type.
  - `src/testing.ts` — `MockCanvas2DContext` (records calls; `hashCallLog`
    canonicalises floats to 4 dp), exposed via the `./testing` sub-path.
  - `src/createCanvas2dAdapter.ts` — factory, `AdapterState` (WeakMap),
    `runRendererLoop`, ingest + per-frame render.
  - `src/defaultAdapter.ts` — headless `DEFAULT_ADAPTER` (capabilities-only).
  - `src/streamPump.ts` — `createMultiStreamCandlePump` (MTF interleave).
  - `src/integration.test.ts` — pins a `hashCallLog` constant.
- **`packages/conformance/`** — `runConformanceSuite(adapter, opts?)`
  loads `ALL_SCENARIOS`, compiles each script, drives the **runtime**
  (never a host or renderer), drains emissions, asserts. It reads
  `adapter.capabilities` **only**.
- **`scripts/run-conformance.ts`** — hardcodes the canvas2d default
  export as the single adapter under test.
- **`scripts/scaffold.ts`** — `PACKAGE_DIRS` lists every package + the
  single `examples/canvas2d-adapter`; `pnpm scaffold` emits the §22.4
  six-file template.

## 3. Target State

### Public surface deltas

`packages/adapter-kit/` gains a **geometry** module (public surface):

```ts
// new exports from @invinite-org/chartlang-adapter-kit
export type { Viewport, Point2 } from "./geometry/index.js";
export { timeToX, priceToY, worldPointToPixel } from "./geometry/index.js";
export type { DrawPrimitive, StrokeStyle, FillStyle } from "./geometry/index.js";
export { decomposeDrawing } from "./geometry/index.js";
// canvas sub-path: @invinite-org/chartlang-adapter-kit/canvas
export type { RenderCtx } from "./canvas/index.js";
export { paintPrimitive, MockCanvasContext, hashCallLog } from "./canvas/index.js";
```

- `decomposeDrawing(emission, viewport): ReadonlyArray<DrawPrimitive>` —
  pure, renderer-agnostic, exhaustive over all 63 `DrawingKind`s.
- `DrawPrimitive` IR — `polyline` | `arc` | `text` | `marker` with
  `StrokeStyle`/`FillStyle`. Every drawing reduces to a flat list.
- `paintPrimitive(ctx, prim)` + `RenderCtx` + `MockCanvasContext` —
  the canvas-family sink (consumed by canvas2d, lightweight-charts, uplot).

### New packages (all private, MIT, `chartlang-example-*`)

- `examples/lightweight-charts-adapter/`
- `examples/uplot-adapter/`
- `examples/echarts-adapter/`
- `examples/konva-adapter/`

Each exposes a `default` headless export (capabilities-only) for
conformance, a real factory (`createXAdapter`), a full `Capabilities`
(all 63 drawings + all plot kinds), a mock library surface + hashed
integration test, and a README + docs page.

### Test/tooling deltas

- `scripts/run-conformance.ts` iterates **all five** adapters.
- `skills/chartlang-setup/` adapter-contract reference gains the geometry
  layer + the new adapters (per the repo-root skill-mirroring rule).
- Root `README.md` + `docs/adapters/` list the five adapters.

## 4. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Geometry layer lives in `adapter-kit`, not a new package** | adapter-kit is already "the SDK for writing adapters"; projection + drawing decomposition is exactly adapter-facing geometry. Avoids a new package + scaffold. |
| **`DrawPrimitive` IR (polyline/arc/text/marker)** | Every one of the 63 renderers reduces to these four shapes with stroke/fill/dash. A flat IR is the smallest thing all five libraries can consume (ctx paths, Konva nodes, ECharts `graphic`, LC primitive). |
| **`decomposeDrawing` is pure + exhaustive** | No `ctx`, no library types — testable in isolation to 100% in adapter-kit. The `never` exhaustiveness default keeps all 63 kinds covered at compile time. |
| **Only drawings are shared; plots/candles/panes use each library's native facilities** | The whole point of lightweight-charts/ECharts is their native candlesticks, series, and panes. Hand-painting candles there would be wrong. Drawings are the genuinely library-agnostic, expensive-to-duplicate part. |
| **Canvas sink (`paintPrimitive` + `RenderCtx` + `MockCanvasContext`) in `adapter-kit/canvas`** | lightweight-charts (Series-Primitive), uplot (draw-hook), and canvas2d all paint to a `CanvasRenderingContext2D`. They share one painter + one mock. ECharts/Konva don't import it. |
| **`canvas2d/src/testing.ts` + `./testing` path stay** | A documented invariant (conformance imports `MockCanvas2DContext` from `chartlang-example-canvas2d-adapter/testing`). `testing.ts` re-exports adapter-kit's `MockCanvasContext` as `MockCanvas2DContext` — implementation shared, public path + name unchanged. |
| **Full `Capabilities` for all four** | Drawings are hand-painted (ctx/graphic/node) so every kind is achievable in every library; declaring the full set keeps adapters interchangeable and exercises the whole conformance surface. |
| **Headless mock-surface tests, no browser demo** | Mirrors canvas2d exactly: CI-gateable, deterministic hashed call-logs, no jsdom/Vite serve surface. The user chose "match canvas2d." |
| **Conformance default export is capabilities-only** | `runConformanceSuite` reads `capabilities` only; spinning up a real LC/ECharts/Konva chart for an emission-contract test is unnecessary (same as canvas2d's `DEFAULT_ADAPTER`). |

## 5. Dependency Graph

```
Task 1 (adapter-kit geometry foundation: IR + projection + paint + basic kinds)
  |
  v
Task 2 (adapter-kit geometry: curves, freehand, channels, fibonacci)
  |
  v
Task 3 (adapter-kit geometry: gann, pitchforks, patterns, elliott, cycles, containers, table)
  |
  v
Task 4 (refactor canvas2d to consume decomposeDrawing/paintPrimitive)
  |
  +-----------------+-----------------+-----------------+
  v                 v                 v                 v
Task 5 (LC          Task 7 (uplot     Task 9 (echarts   Task 11 (konva
  scaffold+series)    scaffold+series)  scaffold+series)  scaffold+series)
  |                 |                 |                 |
  v                 v                 v                 v
Task 6 (LC          Task 8 (uplot     Task 10 (echarts  Task 12 (konva
  drawings+conf)      drawings+conf)    drawings+conf)    drawings+conf)
  |                 |                 |                 |
  +-----------------+--------+--------+-----------------+
                            v
              Task 13 (run-conformance multi-adapter + skills + docs index)
                            |
                            v
              Task 14 (adapters registry + `add-adapter` CLI installer + bundle generator)
                            |
                            v
              Task 15 (generated docs gallery + README standardization + UX polish)
```

## 6. Task Summary

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [adapter-kit geometry foundation](./1-adapter-kit-geometry-foundation.md) | adapter-kit | None | High |
| 2 | [geometry: curves / channels / fibonacci](./2-adapter-kit-geometry-curves-channels-fib.md) | adapter-kit | 1 | High |
| 3 | [geometry: gann / patterns / elliott / cycles / containers](./3-adapter-kit-geometry-gann-patterns-elliott.md) | adapter-kit | 1, 2 | High |
| 4 | [refactor canvas2d onto shared geometry](./4-canvas2d-refactor-onto-geometry.md) | canvas2d-adapter | 1, 2, 3 | Medium |
| 5 | [lightweight-charts: scaffold + series/candles/panes](./5-lightweight-charts-scaffold-series.md) | lightweight-charts-adapter | 1–3 | High |
| 6 | [lightweight-charts: drawings + conformance](./6-lightweight-charts-drawings-conformance.md) | lightweight-charts-adapter | 5 | Medium |
| 7 | [uplot: scaffold + series/candles/panes](./7-uplot-scaffold-series.md) | uplot-adapter | 1–3 | High |
| 8 | [uplot: drawings + conformance](./8-uplot-drawings-conformance.md) | uplot-adapter | 7 | Medium |
| 9 | [echarts: scaffold + series/candles/panes](./9-echarts-scaffold-series.md) | echarts-adapter | 1–3 | High |
| 10 | [echarts: drawings + conformance](./10-echarts-drawings-conformance.md) | echarts-adapter | 9 | Medium |
| 11 | [konva: scaffold + series/candles/panes](./11-konva-scaffold-series.md) | konva-adapter | 1–3 | High |
| 12 | [konva: drawings + conformance](./12-konva-drawings-conformance.md) | konva-adapter | 11 | Medium |
| 13 | [conformance runner + skills + docs index](./13-conformance-runner-docs-skills.md) | scripts / skills / docs | 4, 6, 8, 10, 12 | Medium |
| 14 | [`add-adapter` CLI installer + registry + bundle generator](./14-add-adapter-cli-installer.md) | cli / scripts | 4, 6, 8, 10, 12 | High |
| 15 | [generated docs gallery + README standardization + UX](./15-docs-adapters-gallery-and-ux.md) | scripts / docs / examples | 13, 14 | Medium |

## 7. Code Reuse

| Existing code | Import path | Used by |
|---------------|-------------|---------|
| `defineAdapter`, `capabilities.*`, `union`, `mockCandleSource` | `@invinite-org/chartlang-adapter-kit` | every adapter task |
| `BufferingAdapter` base | `@invinite-org/chartlang-adapter-kit` | adapter factories |
| `validateEmission`, `decodeDrawing` | `@invinite-org/chartlang-adapter-kit` | every adapter ingest path |
| `CANVAS2D_CAPABILITIES` shape | `examples/canvas2d-adapter/src/capabilities.ts` | template for each adapter's full `Capabilities` |
| `DEFAULT_ADAPTER` shape | `examples/canvas2d-adapter/src/defaultAdapter.ts` | template for each headless conformance export |
| `createMultiStreamCandlePump` | `examples/canvas2d-adapter/src/streamPump.ts` | MTF pump reused/ported per adapter as needed |
| Existing 63 canvas2d renderers (geometry math) | `examples/canvas2d-adapter/src/render/draw/*.ts` | **source of truth** ported into `decomposeDrawing` (Tasks 1–3) |
| `bezier.ts`, `gannLevels.ts`, `pitchforkGeom.ts`, `lineExtend.ts`, `arrowhead.ts`, `chevron.ts`, `namedPolyline.ts`, `fibLevels.ts`, `shapeStyle.ts`, `textStyle.ts` | `examples/canvas2d-adapter/src/render/draw/` | moved into `adapter-kit/src/geometry/_lib/` (Task 1–3) |
| `MockCanvas2DContext` / `hashCallLog` | `examples/canvas2d-adapter/src/testing.ts` | generalised into `adapter-kit/canvas` `MockCanvasContext`; canvas2d re-exports (Task 1, 4) |
| `runConformanceSuite`, `ALL_SCENARIOS` | `@invinite-org/chartlang-conformance` | each adapter's conformance test + Task 13 |
| `DrawingState` union, `WorldPoint`, `Bar` | `@invinite-org/chartlang-core` | `decomposeDrawing` input types |
| `runCli` dispatcher + `parseArgs` pattern, `scaffold-adapter` command, `adapterTemplate/templates.ts` (string-template approach) | `packages/cli/src/` | Task 14 `add-adapter` command + bundle shape |
| `chartlang docs` / `examples:generate` generate-then-byte-diff-gate pattern | `scripts/` + `pnpm docs:gate`/`examples:gate` | Task 14–15 `adapters:generate` / `adapters:gate` |
| `githubFolder` deep-link convention `github.com/outraday-org/chartlang/tree/main/examples/<dir>` | existing `docs/adapters/writing-an-adapter.md` | Task 14 registry + Task 15 gallery links |

**Never** cross-import between sibling example `src/` folders. The shared
geometry/paint/mock surface is consumed through the **public**
`@invinite-org/chartlang-adapter-kit` package boundary only.

## 8. Provenance

No `../invinite/` ports. The geometry in Tasks 1–3 is "moved, not
re-derived" from the existing `examples/canvas2d-adapter/src/render/draw/`
renderers — translate each `ctx`-emitting renderer into a pure
`DrawPrimitive[]`-returning decomposer, preserving the exact pixel
geometry so the canvas2d integration hash (Task 4) can be re-pinned with
zero behavioural drift where the call sequence is unchanged.

## 9. Deferred / Follow-Up Work

- **Live in-browser demos** (StackBlitz/CodeSandbox "Open in browser" +
  a minimal runnable browser entry per adapter) — deferred per the
  headless decision; the gallery (Task 15) links GitHub folders +
  conformance reports instead. This is the most-requested follow-up if the
  headless constraint is later relaxed.
- Runnable in-browser demo pages per adapter (Vite/HTML) — explicitly out
  of scope; adapters match the headless canvas2d shape.
- A WebGL (PixiJS) and a raw-SVG adapter — researched as PARTIAL/high-effort;
  defer until the shared geometry layer proves out on these four.
- Interactive editing/drag of drawings (Konva's retained-mode strength) —
  a follow-up that would extend the adapter beyond render-only.
- Sharing the plot/candle/pane layout math (currently per-adapter, mapped
  to native facilities) — only worth extracting if a second pure-canvas
  adapter (beyond canvas2d/uplot) appears.
- Commercial libraries (Highcharts/Highstock, amCharts) — disqualified on
  license for an open-source example; revisit only on explicit request.

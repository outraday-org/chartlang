# Adapters

An **adapter** teaches a chart library how to render chartlang emissions.
The runtime produces typed, JSON-safe emissions (candles, plots, drawings,
alerts); the adapter translates them into draw calls on a specific chart
vendor's surface. One script, many charts.

Start here:

- [Adapter contract](./contract.md) — the type-level reference for
  `Adapter`, `Capabilities`, `CandleEvent`, and every emission shape.
- [Capabilities](./capabilities.md) — declare what your adapter supports;
  anything undeclared becomes a silent no-op, never an error.
- [Writing an adapter](./writing-an-adapter.md) — the long-form tutorial
  with per-emission render code.
- [Rendering inputs](./rendering-inputs.md) — turn `manifest.inputs` into
  grouped settings-panel sections and inline rows.
- [Plot overrides](./plot-overrides.md) — runtime restyling of plots.
- [Conformance](./conformance.md) — the 240+ scenario suite, the report
  format, and how scenarios are gated by capability.

New to adapters? The [getting-started walkthrough](../getting-started/write-your-first-adapter.md)
scaffolds a starter package and runs it through conformance.

## The shared geometry layer

The 63 drawing kinds carry expensive per-kind geometry (Fibonacci levels,
Gann fans, pitchforks, Bézier curves, Elliott waves). It is derived **once**
in `@invinite-org/chartlang-adapter-kit` and shared across every adapter:

- `decomposeDrawing(emission, viewport)` — pure, renderer-agnostic, and
  exhaustive over all 63 `DrawingKind`s. Each drawing reduces to a flat list
  of four `DrawPrimitive` shapes: `polyline` | `arc` | `text` | `marker`.
- `paintPrimitive(ctx, prim)` (from the `/canvas` sub-path) — the shared
  canvas sink for ctx-based adapters, plus `MockCanvasContext` for headless
  hashed tests.

So an adapter author writes a small "decompose once, map primitives to my
library" step, never the drawing math. Canvas-family adapters reuse
`paintPrimitive` directly; scene-graph / declarative adapters map the
primitive IR to nodes or option elements. See the per-library pages below.

## Reference adapters

The repo ships five full-surface example adapters — each declares the
complete surface (every plot kind + all 63 drawing kinds) and is
conformance-green. Copy the one closest to your library.

| Adapter | Library | License | Drawing sink |
| --- | --- | --- | --- |
| [Canvas 2D](./reference/canvas2d.md) | HTML Canvas 2D | MIT | `paintPrimitive` (reference) |
| [Lightweight Charts](./reference/lightweight-charts.md) | TradingView lightweight-charts | Apache-2.0 | `paintPrimitive` via a series primitive |
| [uPlot](./reference/uplot.md) | uPlot | MIT | `paintPrimitive` in a draw hook |
| [ECharts](./reference/echarts.md) | Apache ECharts | Apache-2.0 | `graphic` elements (declarative) |
| [Konva](./reference/konva.md) | Konva | MIT | scene-graph nodes |

The first three are **ctx-based** — they paint the primitive IR through the
shared `paintPrimitive` canvas sink. The last two are **mappers** — Konva
maps each primitive to a scene-graph node, ECharts to a declarative
`graphic` element. All five share `decomposeDrawing`; no adapter owns a
parallel copy of the drawing geometry.

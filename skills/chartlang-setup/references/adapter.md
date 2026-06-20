# Write a chart adapter

Teach a new chart library how to render chartlang emissions. The
`@invinite-org/chartlang-adapter-kit` contract is small — declare what
you support, feed candles, translate emissions — and a 220-scenario
conformance suite tells you when the implementation is correct.
Condensed from
[`docs/getting-started/write-your-first-adapter.md`](https://github.com/outraday-org/chartlang/blob/main/docs/getting-started/write-your-first-adapter.md).
The worked reference is
[`examples/canvas2d-adapter/src/`](https://github.com/outraday-org/chartlang/tree/main/examples/canvas2d-adapter/src)
(`capabilities.ts`, `createCanvas2dAdapter.ts`, `defaultAdapter.ts`).

## Scaffold a starter (optional)

The CLI generates a complete starter package — source, smoke test,
conformance test, and a report script:

```bash
pnpm dlx @invinite-org/chartlang-cli scaffold-adapter my-trading-chart
cd my-trading-chart && pnpm install
```

The scaffold is `"private": true` (adapter packages live in consumer
repos and publish under the owner's scope). Re-running against a
non-empty directory refuses to overwrite — there is no `--force`. See
`chartlang scaffold-adapter <name> [--target <dir>]` in
[`packages/cli/`](https://github.com/outraday-org/chartlang/tree/main/packages/cli)
help.

## Declare capabilities honestly

The capability surface is the source of truth. Anything you do not
declare is a **silent runtime no-op** — scripts that emit an unsupported
plot kind, drawing kind, or alert kind drop the emission and log a
diagnostic instead of crashing the renderer.

```ts
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";

export const myCapabilities: Capabilities = {
    plots: capabilities.union(capabilities.line(), capabilities.area()),
    drawings: new Set(["line", "horizontal-line"]),
    alerts: new Set(["toast"]),
    alertConditions: false,
    logs: true,
    inputs: new Set(["int", "float", "bool", "color", "source"]),
    intervals: [{ value: "1D", label: "1 day", group: "daily" }],
    multiTimeframe: false,
    subPanes: 1,
    symInfoFields: new Set(["ticker", "mintick", "timezone"]),
    maxDrawingsPerScript: { lines: 100, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 5000,
    maxTickHz: 10,
};
```

Rules of honesty: do not declare a plot kind until the renderer can both
create AND update its series; do not declare a drawing kind until you
implement both the create-or-update branch and the remove branch; do not
declare `multiTimeframe` unless `candles({ interval })` can supply
secondary streams for every entry in `intervals`.

## Implement the adapter

An adapter is a single object built with `defineAdapter` — it exposes
`capabilities`, an async `candles` generator, an `onEmissions` handler,
and a `dispose` cleanup:

```ts
import { defineAdapter, mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type {
    Adapter,
    CandleEvent,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";

import { myCapabilities } from "./capabilities";

async function* candles(opts: { interval: string }): AsyncIterable<CandleEvent> {
    void opts;
    yield { kind: "history", bars: [] };
    // for await (const bar of livePriceStream()) yield { kind: "close", bar };
}

function onEmissions(emissions: RunnerEmissions): void {
    for (const plot of emissions.plots) {
        void plot; // hand off to your chart library's series API
    }
    for (const drawing of emissions.drawings) {
        if (drawing.op === "remove") {
            // remove from your renderer
        } else {
            // create or update
        }
        void drawing;
    }
    for (const alert of emissions.alerts) {
        void alert; // hand off to your toast / notification surface
    }
}

export const adapter: Adapter = defineAdapter({
    id: "my-trading-chart",
    name: "My Trading Chart",
    capabilities: myCapabilities,
    candles,
    onEmissions,
    dispose: () => {},
});
export default adapter;
```

The full contract — every `CandleEvent` kind, every `PlotEmission` /
`DrawingEmission` / `AlertEmission` shape, the adapter-facing `symInfo`,
and the `dispose` cleanup contract — is in the
[adapter author guide](https://github.com/outraday-org/chartlang/blob/main/docs/adapters/writing-an-adapter.md).
The
[`examples/canvas2d-adapter`](https://github.com/outraday-org/chartlang/tree/main/examples/canvas2d-adapter)
package is the reference implementation worth copying from.

## Render drawings via the shared geometry layer

The 63 drawing kinds (lines, boxes, curves, Fibonacci, Gann, pitchforks,
harmonic patterns, Elliott waves, cycles, containers, `table`) carry
expensive per-kind geometry (fib levels, Gann fans, pitchfork forks, Bézier
sampling). **Do not re-derive it per adapter.** `adapter-kit` ships a
renderer-agnostic geometry layer so every adapter shares one implementation:

```ts
import { decomposeDrawing } from "@invinite-org/chartlang-adapter-kit";
import type { DrawPrimitive, Viewport } from "@invinite-org/chartlang-adapter-kit";

// view: build a linear Viewport from your chart's time→x / price→y mapping.
declare const view: Viewport;
declare const drawing: import("@invinite-org/chartlang-adapter-kit").DrawingEmission;

const primitives: ReadonlyArray<DrawPrimitive> = decomposeDrawing(drawing, view);
```

`decomposeDrawing(emission, viewport)` is **pure and exhaustive over all 63
`DrawingKind`s** — no `ctx`, no library types. Each drawing reduces to a flat
list of four `DrawPrimitive` shapes: `polyline` | `arc` | `text` | `marker`,
each with `StrokeStyle` / `FillStyle`. The recommended authoring pattern is
**decompose once, then map each primitive to your library** — you only write
the four-primitive mapping, never the drawing math.

There are **two integration strategies** for the mapping step:

1. **Canvas / ctx adapters reuse the shared painter.** If your library hands
   you a `CanvasRenderingContext2D` (or you self-scale to a canvas), import
   the canvas sink from the `/canvas` sub-path and paint each primitive
   directly — no per-primitive mapping code at all:

   ```ts
   import { paintPrimitive } from "@invinite-org/chartlang-adapter-kit/canvas";
   import type { RenderCtx } from "@invinite-org/chartlang-adapter-kit/canvas";

   declare const ctx: RenderCtx; // your CanvasRenderingContext2D
   for (const prim of primitives) paintPrimitive(ctx, prim);
   ```

   `RenderCtx` is the structural canvas type the painter needs;
   `MockCanvasContext` (same sub-path) records calls for hashed, headless
   tests. `canvas2d`, `lightweight-charts` (series-primitive overlay), and
   `uplot` (draw hook) all paint through `paintPrimitive`.

2. **Scene-graph / declarative adapters map the IR to nodes/options.** If
   your library has no `ctx` — Konva (a retained scene graph) and ECharts (a
   declarative option tree) — write a small `primitive → node/element`
   mapper instead of calling `paintPrimitive`. Konva maps each
   `DrawPrimitive` to a `Line` / `Arc` / `Path` / `Text` node; ECharts maps
   it to a `graphic` element (`polyline` / `polygon` / `arc` / `text` /
   `circle`). You still call `decomposeDrawing` for the geometry — only the
   sink differs.

The repo ships five worked example adapters that demonstrate both
strategies — copy the one closest to your library:

| Example | Library | License | Drawing sink |
| --- | --- | --- | --- |
| `examples/canvas2d-adapter/` | HTML Canvas 2D | MIT | `paintPrimitive` (reference) |
| `examples/lightweight-charts-adapter/` | TradingView lightweight-charts | Apache-2.0 | `paintPrimitive` via a series primitive |
| `examples/uplot-adapter/` | uPlot | MIT | `paintPrimitive` in a draw hook |
| `examples/echarts-adapter/` | Apache ECharts | Apache-2.0 | `graphic` elements (declarative) |
| `examples/konva-adapter/` | Konva | MIT | scene-graph nodes |

All five declare the full surface (every plot kind + all 63 drawing kinds)
and are conformance-green via the same suite. The ctx-family adapters reuse
the shared painter + mock; the scene/option adapters map the primitive IR.
No adapter owns a copy of the drawing geometry — to change a drawing's
shape, edit the `decomposeDrawing` decomposers in `adapter-kit`, never a
per-adapter renderer.

## Validate with the conformance harness

`@invinite-org/chartlang-conformance` ships 220 scenarios covering every
plot kind, drawing kind, alert kind, multi-timeframe flows,
drawing-budget overflow, and unsupported-capability gating. Each
scenario is **gated by capability** — your adapter only runs the
scenarios matching what you declared, so a minimal "lines and toasts"
adapter sees a focused subset.

```bash
pnpm test                      # unit + conformance via vitest (scaffolded package)
pnpm conformance:report        # writes CONFORMANCE.md + conformance-report.json
```

The committed `CONFORMANCE.md` is human-readable and diff-friendly; the
JSON sibling powers tooling. The reference adapter ships a green
[`examples/canvas2d-adapter/CONFORMANCE.md`](https://github.com/outraday-org/chartlang/blob/main/examples/canvas2d-adapter/CONFORMANCE.md)
to diff against — from the repo root, `pnpm conformance` runs the suite
in
[`packages/conformance/`](https://github.com/outraday-org/chartlang/tree/main/packages/conformance)
against that reference adapter.

## Next steps

- [Adapter contract](https://github.com/outraday-org/chartlang/blob/main/docs/adapters/contract.md) — type-level reference for `Adapter`, `Capabilities`, `CandleEvent`, every emission shape.
- [Conformance](https://github.com/outraday-org/chartlang/blob/main/docs/adapters/conformance.md) — the suite, report format, and capability-gated scenarios.

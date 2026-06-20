# Konva adapter

The in-repo [Konva](https://konvajs.org) example adapter
(`examples/konva-adapter/`, private `chartlang-example-konva-adapter`) is a
**full-surface** rendering adapter: candles, every `plot` kind, horizontal
lines, and all 63 drawing kinds. Konva is a generic 2D **scene-graph** —
retained-mode nodes, not an immediate-mode `ctx` — so every visual is a
node (`Line` / `Rect` / `Text` / `Arc` / `Path`) the adapter adds to a
layer. Copy the folder when writing your own Konva adapter.

## Architecture

Konva has no chart facilities, so the adapter owns its own coordinate scale
(it is the second self-scaled adapter after canvas2d):

- **Self-computed `Viewport`.** The adapter derives a `Viewport` from the
  bar window + stage size and projects with the shared adapter-kit
  `timeToX` / `priceToY` — no local projection copy.
- **Two layers.** A `seriesLayer` (candles + plot series + hlines) and a
  dedicated `drawingsLayer` above it. Both are torn down and rebuilt every
  drain (`destroyChildren()` → re-add → `batchDraw()`), matching canvas2d's
  stateless redraw.
- **Plots map to native Konva nodes.** candles → `Line` wick + `Rect` body;
  line / step-line → `Line`; area → closed filled `Line`; histogram →
  per-bar `Rect`; filled-band → closed `Line`; horizontal-line → a pane-wide
  `Line`; glyph / override kinds → `Text` / `Rect`.

## Drawings

Drawings reuse the shared, renderer-agnostic geometry layer in
`@invinite-org/chartlang-adapter-kit` — the adapter never re-derives per-kind
geometry. Each drain rebuilds the drawings layer from the buffered drawing
state, decomposing each drawing **once** into the `DrawPrimitive` IR and
mapping each primitive to its Konva node(s):

```ts
import { decomposeDrawing } from "@invinite-org/chartlang-adapter-kit";
import { primitiveToNode } from "chartlang-example-konva-adapter";

drawingsLayer.destroyChildren();
const view = overlayViewport(state); // the overlay pane's Viewport
const group = new K.Group({ x: view.x, y: view.y });
for (const d of state.drawings.values()) {
    for (const prim of decomposeDrawing(d, view)) {
        for (const node of primitiveToNode(K, prim)) group.add(node);
    }
}
drawingsLayer.add(group);
drawingsLayer.batchDraw();
```

`op: "remove"` drawings are dropped at ingest, so the map only ever holds
live drawings. Drawings render in the overlay pane (matching canvas2d), so
the group rides the overlay pane's pixel origin and the IR's pixel-space
output lands on the candle scale.

## `DrawPrimitive` → Konva node mapping

`primitiveToNode(K, prim)` returns the node(s) for one primitive:

| IR primitive | Konva node(s) |
| --- | --- |
| `polyline` | one `Line` (`closed: true/false`, `dash`, `fill`) |
| full-circle `arc` | one `Arc` ring (`innerRadius === outerRadius`, `angle: 360`) |
| partial `arc` | one `Path` — SVG `M … A … Z` (the `A` arc + the `Z` chord match canvas `arc() + closePath()`) |
| `text` | one `Text` (+ a backing `Rect` first, when `bgColor` is set) |
| `marker` | a per-shape glyph: circle → `Arc`, square → `Rect`, diamond / triangle → closed `Line` |

### Caveats

- **Arc unit + wedge.** Konva's `Arc` draws a sector (two radial lines to
  the centre) and its `angle` / `rotation` are **degrees**, whereas the IR
  uses radians. A full circle renders as a clean ring with no wedge, so
  `Arc` is used only for full sweeps; every partial sweep uses `Path`, whose
  `A` command plus closing `Z` chord reproduce the canvas arc shape exactly.
- **Text alignment.** The IR `align` / `baseline` map straight to Konva's
  `align` / `verticalAlign` (the same vocabulary as canvas `textAlign` /
  `textBaseline`). The font string (`"<px>px <family>"`) is split into
  `fontSize` / `fontFamily` by `parseFont`.
- **Text background is a Konva enrichment.** The canvas painter drops a
  text primitive's `bgColor` (a structural `ctx` cannot measure text); Konva
  *can* express it, so the adapter prepends a backing `Rect`. The box is
  sized from a font-px × glyph-count heuristic (the headless mock has no
  `measureText`); each adapter owns its own integration hash, so there is no
  cross-adapter pixel-parity contract this diverges from.
- **NaN anchors skip the node.** A primitive whose vertices are all
  non-finite yields no node (a divergence from the canvas painter's
  `moveTo(NaN, …)` no-op).

## Capabilities and conformance

The adapter declares the full surface (every Phase-5 plot kind, all 63
drawing kinds, `log` + `toast` alerts, MTF, unlimited sub-panes) so it is
interchangeable with the canvas2d reference. The package's headless
`default` export is capabilities-only; `runConformanceSuite(default)` drives
every bundled scenario through the runtime against that bag and asserts zero
failures (`src/conformance.test.ts`).

## Headless testing

Konva is scene-graph, so the test surface is the **node tree**, not pixels.
`MockKonva` (the `chartlang-example-konva-adapter/testing` sub-path) is a
headless stand-in whose constructors record each node's type + config + child
tree. `hashKonvaScene(mock)` projects the drawable nodes into canvas
`RecordedCall`s and delegates to the shared `hashCallLog` (floats rounded to
4 dp), so the integration test pins one stable golden hash. No `node-canvas`
/ native `canvas` dependency is used.

## Minimum-viable usage

```ts
import Konva from "konva";
import { createKonvaAdapter, feedCandleEvent } from "chartlang-example-konva-adapter";
import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";

declare const compiled: import("@invinite-org/chartlang-compiler").CompiledScript;
declare const bars: ReadonlyArray<import("@invinite-org/chartlang-core").Bar>;

const adapter = createKonvaAdapter({
    konva: Konva,
    stage: { width: 800, height: 400 },
    candleSource: mockCandleSource(bars, { interval: "1D", mode: "stream" }),
});
await adapter.host.load({ moduleSource: compiled.moduleSource, manifest: compiled.manifest });
for (const bar of bars) feedCandleEvent(adapter, { kind: "close", bar });
```

See also [`docs/adapters/writing-an-adapter.md`](../writing-an-adapter.md)
for the general adapter contract.

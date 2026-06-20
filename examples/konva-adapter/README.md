# chartlang-example-konva-adapter

`experimental`

Example adapter — renders chartlang OHLC candles, `plot` series, `hline`
horizontal lines, and all 63 `draw.*` drawing kinds to a
[Konva](https://konvajs.org) scene-graph (nodes, not pixels). Konva has no
chart facilities, so the adapter owns its own coordinate scale (the shared
adapter-kit projection) and builds every visual as a `Rect` / `Line` /
`Text` / `Arc` / `Path` node. Drawings are decomposed once via the shared
`decomposeDrawing` IR, then each `DrawPrimitive` maps to its Konva node(s)
through `primitiveToNode`. Copy from this folder when writing your own
Konva adapter.

## Install

Not published — copy from `examples/konva-adapter/`.

## Public surface

- `createKonvaAdapter(opts) → KonvaAdapterHandle` — main factory; returns
  an `Adapter` plus an attached `ScriptHost`. `opts.konva` is the injected
  Konva namespace (production passes the real `Konva`; tests pass
  `MockKonva`) — the factory never statically imports `konva`, keeping the
  package headless + free of the native `canvas` dependency.
- `feedCandleEvent(handle, event)` — feed one candle event into the bar
  buffer and rebuild the series + drawings layers.
- `handleInterval(handle) → string` — the resolved chart interval.
- `primitiveToNode(K, prim) → ReadonlyArray<KonvaNode>` — map one
  `DrawPrimitive` to Konva node(s): `polyline` → `Line` (open / closed);
  full-circle `arc` → `Arc` ring; partial `arc` → `Path` (SVG `A` + `Z`
  chord); `text` → `Text` (+ a backing `Rect` when `bgColor` is set);
  `marker` → a per-shape `Arc` / `Rect` / closed `Line` glyph. `parseFont`
  splits the IR `"<px>px <family>"` font string into Konva's
  `fontSize` / `fontFamily`.
- `KONVA_CAPABILITIES` — `Capabilities` bag declaring every Phase-5 plot
  kind, all 63 drawing kinds (62 `allPhase3Drawings()` + `table`), `log` +
  `toast` alerts, multi-timeframe candles, unlimited sub-panes, full
  `syminfo.*`, alert conditions, and logs. Byte-for-byte the canvas2d
  shape.
- `KONVA_SYM_INFO` — demo symbol metadata.
- `DEFAULT_ADAPTER` (also the default export) — headless,
  capabilities-only conformance export.
- `computePaneLayout`, `PaneRect`, `PaneLayoutEntry` — adapter-local pane
  layout (overlay 80% + uniform subpanes).
- `DEFAULT_PALETTE`, `KonvaPalette` — colour constants + type.
- The `KonvaNamespace` structural seam types (`KonvaStage`, `KonvaLayer`,
  `Rect`/`Line`/`Text`/`Arc`/`Path` config bags, …).
- Sub-path `chartlang-example-konva-adapter/testing`:
  - `MockKonva` — headless recording stand-in for the Konva namespace.
  - `hashKonvaScene(mock) → string` / `projectNode` — project the recorded
    node tree into canvas `RecordedCall`s and hash via the shared
    `hashCallLog` (floats rounded to 4 dp).

## Minimum-viable API call

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

## Docs

See [`docs/adapters/writing-an-adapter.md`](../../docs/adapters/writing-an-adapter.md).

## License

MIT

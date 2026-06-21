# chartlang-example-konva-adapter

Full-surface adapter — renders OHLC candles, `plot` series, `hline`
horizontal lines, and all 63 `draw.*` drawing kinds to a
[Konva](https://konvajs.org) scene-graph. Konva has no chart facilities, so
the adapter owns its own coordinate scale and builds every visual as a
retained-mode node (`Rect` / `Line` / `Text` / `Arc` / `Path`).

`experimental` · MIT · copy-only — not published · Scene-graph (Canvas) ·
full conformance

## Get it

```bash
npx @invinite-org/chartlang-cli add-adapter konva
```

Not published to npm — `add-adapter` bakes a version-pinned copy into your
repo, or copy
[`examples/konva-adapter/`](https://github.com/outraday-org/chartlang/tree/main/examples/konva-adapter)
directly.

## Public surface

- `createKonvaAdapter(opts) → KonvaAdapterHandle` — main factory; returns an
  `Adapter` plus an attached `ScriptHost`. `opts.konva` is the injected
  Konva namespace (real `Konva` in production, `MockKonva` in tests), so the
  package never statically imports `konva` and stays headless.
- `feedCandleEvent(handle, event)` / `handleInterval(handle) → string` —
  feed one candle event + read the resolved chart interval.
- `KONVA_CAPABILITIES` / `KONVA_SYM_INFO` — full `Capabilities` bag + demo
  symbol metadata.
- `DEFAULT_ADAPTER` (also the package `default`) — headless,
  capabilities-only adapter the conformance suite consumes.
- `primitiveToNode(K, prim) → ReadonlyArray<KonvaNode>` — the scene-graph
  drawing map; `computePaneLayout` + the `KonvaNamespace` structural seam
  types round out the surface.
- Sub-path `chartlang-example-konva-adapter/testing` — `MockKonva` +
  `hashKonvaScene(mock)` (projects nodes to canvas calls, then `hashCallLog`).

## How drawings render

The shared `decomposeDrawing(emission, view)` IR maps each primitive via
`primitiveToNode` to its Konva node(s) — `polyline` → `Line`, full-circle
`arc` → `Arc` ring, partial `arc` → `Path`, `text` → `Text` (+ a backing
`Rect`), `marker` → a per-shape glyph. No `paintPrimitive` (nodes, not pixels).

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

See the [adapter gallery](../../docs/adapters/gallery.md) for a comparison of
all five adapters, and
[`docs/adapters/reference/konva.md`](../../docs/adapters/reference/konva.md)
for this adapter's deep dive.

## License

MIT

# `draw.fibSpeedArcs`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `other`
> **Wire kind:** `fib-speed-arcs`

Draw a set of Fibonacci speed-arcs — concentric circular arcs centred
at `a` with radii `level * |b - a|` for each `level` in
`opts.levels ?? FIB_LEVELS`. Mirrors invinite's
`fib-speed-arcs-tool.ts` shape.

## Anchors

`a`, `b` — two `WorldPoint`s (centre, edge)

Anchor count: 2.

## Signature

```ts
function fibSpeedArcs(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.fibSpeedArcs(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.fibSpeedArcs demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.fibSpeedArcs(
                { time: bar.time, price: bar.close },
                { time: bar.time + 30_000, price: bar.high },
                { showLabels: true },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/fibB/fibSpeedArcs.ts)
- [`draw.*` namespace index](./index.md)

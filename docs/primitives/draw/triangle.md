# `draw.triangle`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `boxes`
> **Wire kind:** `triangle`

Draw a triangle as a closed three-vertex polygon. Vertices may be
supplied CW or CCW; the renderer walks them as a closed path. Not to
be confused with `draw.trianglePattern` — that variant is
the harmonic five-anchor triangle pattern.

## Anchors

`anchors` — 3 `WorldPoint`s

Anchor count: 3.

## Signature

```ts
function triangle(anchors: AnchorTriple, opts?: ShapeStyle): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.triangle(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.triangle demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.triangle(
                [
                    { time: bar.time, price: bar.low },
                    { time: bar.time, price: bar.high },
                    { time: bar.time, price: bar.close },
                ],
                { stroke: "#ef4444", fill: "#fee2e2", fillAlpha: 0.5 },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/boxes/triangle.ts)
- [`draw.*` namespace index](./index.md)

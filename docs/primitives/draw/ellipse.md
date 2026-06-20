# `draw.ellipse`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `boxes`
> **Wire kind:** `ellipse`

Draw an axis-aligned ellipse inscribed in the bounding box of two
world anchors. The renderer derives `(centerX, centerY, radiusX,
radiusY)` from the projected bbox and paints a polyline
approximation. Rotated ellipses (invinite's `widthOffset` form)
are out of scope for now.

## Anchors

`a`, `b` — two `WorldPoint`s (opposite bbox corners)

Anchor count: 2.

## Signature

```ts
function ellipse(a: WorldPoint, b: WorldPoint, opts?: ShapeStyle): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.ellipse(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.ellipse demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.ellipse(
                { time: bar.time, price: bar.low },
                { time: bar.time, price: bar.high },
                { stroke: "#22c55e", fill: "#dcfce7", fillAlpha: 0.3 },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/boxes/ellipse.ts)
- [`draw.*` namespace index](./index.md)

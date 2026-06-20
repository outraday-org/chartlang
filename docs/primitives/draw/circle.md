# `draw.circle`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `boxes`
> **Wire kind:** `circle`

Draw a circle defined by a centre + an edge anchor. The radius is
derived in canvas-pixel space at render time from the projected
distance between the two anchors (`|edge - centre|`) — persisting
two world points keeps round-trip fidelity across zoom changes
(matches invinite's `circle-tool.ts`).

## Anchors

`centre`, `radiusAnchor` — two `WorldPoint`s

Anchor count: 2.

## Signature

```ts
function circle(centre: WorldPoint, radiusAnchor: WorldPoint, opts?: ShapeStyle): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.circle(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.circle demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.circle(
                { time: bar.time, price: bar.close },
                { time: bar.time, price: bar.high },
                { stroke: "#3b82f6", fill: "#dbeafe", fillAlpha: 0.3 },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/boxes/circle.ts)
- [`draw.*` namespace index](./index.md)

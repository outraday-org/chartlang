# `draw.arc`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `polylines`
> **Wire kind:** `arc`

Draw an arc through three world anchors `[from, apex, to]`. The
renderer derives a quadratic Bezier control point from the apex via
inverse-quadratic interpolation so the curve passes through `apex`
at parameter `t = 0.5` — distinct from {@link curve} whose middle
anchor IS the control point (and the curve does NOT pass through
it). Mirrors invinite's `arc-tool.ts` shape.

## Anchors

`anchors` — `[from, apex, to]` triple

Anchor count: 3.

## Signature

```ts
function arc(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.arc(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.arc demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.arc(
                [
                    { time: bar.time, price: bar.low },
                    { time: bar.time, price: bar.high },
                    { time: bar.time, price: bar.close },
                ],
                { color: "#3b82f6", lineWidth: 2 },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/curves/arc.ts)
- [`draw.*` namespace index](./index.md)

# `draw.flatTopBottom`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `polylines`
> **Wire kind:** `flat-top-bottom`

Draw a flat-top / flat-bottom channel — two parallel horizontal
rails. Anchors `[leftEdge, rightEdge, oppositeHook]`: leftEdge and
rightEdge fix the time range; the opposite-edge price comes from
`oppositeHook.price`. Mirrors invinite's `flat-top-bottom-tool.ts`
shape — note the landed core shape persists 3 anchors.

## Anchors

`anchors` — `[leftEdge, rightEdge, oppositeHook]` triple

Anchor count: 3.

## Signature

```ts
function flatTopBottom(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.flatTopBottom(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.flatTopBottom demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.flatTopBottom(
                [
                    { time: bar.time, price: bar.high },
                    { time: bar.time, price: bar.high },
                    { time: bar.time, price: bar.low },
                ],
                { color: "#3b82f6", lineStyle: "dashed" },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/channels/flatTopBottom.ts)
- [`draw.*` namespace index](./index.md)

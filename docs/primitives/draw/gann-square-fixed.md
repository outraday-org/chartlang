# `draw.gannSquareFixed`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `other`
> **Wire kind:** `gann-square-fixed`

Draw a Gann square-of-nine with a fixed pixel side anchored at a
single world point. The renderer paints a `80×80` pixel square
subdivided by `GANN_LEVELS`. Mirrors invinite's
`gann-square-fixed-tool.ts` shape.

## Anchors

`anchor` — a single `WorldPoint`

Anchor count: 1.

## Signature

```ts
function gannSquareFixed(anchor: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.gannSquareFixed(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.gannSquareFixed demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.gannSquareFixed({ time: bar.time, price: bar.close });
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/gann/gannSquareFixed.ts)
- [`draw.*` namespace index](./index.md)

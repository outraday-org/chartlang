# `draw.gannFan`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `other`
> **Wire kind:** `gann-fan`

Draw a Gann fan — 9 rays emanating from `a` at the canonical Gann
angles (`1x1`, `1x2`, `1x3`, `2x1`, `3x1`, `1x4`, `4x1`, `1x8`,
`8x1`). The 1×1 ray points directly at `b`; the other 8 are slope
scalings of the (a→b) direction vector. Mirrors invinite's
`gann-fan-tool.ts` shape.

## Anchors

`a`, `b` — two `WorldPoint`s (pivot, reference)

Anchor count: 2.

## Signature

```ts
function gannFan(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.gannFan(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.gannFan demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.gannFan(
                { time: bar.time, price: bar.low },
                { time: bar.time + 30_000, price: bar.high },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/gann/gannFan.ts)
- [`draw.*` namespace index](./index.md)

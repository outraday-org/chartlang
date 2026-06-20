# `draw.frame`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `other`
> **Wire kind:** `frame`

Draw a labelled rectangular frame between two world anchors
`[topLeft, bottomRight]`. The frame renders an outlined rectangle
plus an optional background fill (`opts.bgColor`) and label
(`opts.label`). Children of the frame render
themselves — the frame is a visual envelope, not a re-render layer.

## Anchors

`a`, `b` — two `WorldPoint`s `(topLeft, bottomRight)`

Anchor count: 2.

## Signature

```ts
function frame(a: WorldPoint, b: WorldPoint, opts?: FrameOpts): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.frame(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.frame demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.frame(
                { time: bar.time, price: bar.low },
                { time: bar.time + 60_000, price: bar.high },
                { label: "Trade idea", bgColor: "#f1f5f9" },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/containers/frame.ts)
- [`draw.*` namespace index](./index.md)

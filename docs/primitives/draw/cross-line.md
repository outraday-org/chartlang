# `draw.crossLine`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `lines`
> **Wire kind:** `cross-line`

Draw an orthogonal cross — horizontal + vertical line — through
`anchor`. Both strokes span the full viewport in their respective
axes.

## Anchors

`anchor` — one `WorldPoint`

Anchor count: 1.

## Signature

```ts
function crossLine(anchor: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.crossLine(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.crossLine demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.crossLine(
                { time: bar.time, price: bar.close },
                { color: "#a855f7", lineStyle: "dotted" },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/lines/crossLine.ts)
- [`draw.*` namespace index](./index.md)

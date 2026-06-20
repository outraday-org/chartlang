# `draw.curve`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `polylines`
> **Wire kind:** `curve`

Draw a quadratic Bezier curve through three world anchors
`[from, control, to]`. The middle anchor IS the off-curve Bezier
control point — the rendered curve does NOT pass through it
(distinct from {@link arc} whose middle anchor is the apex the
curve passes through). Mirrors invinite's `curve-tool.ts` shape.

## Anchors

`anchors` — `[from, control, to]` triple

Anchor count: 3.

## Signature

```ts
function curve(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.curve(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.curve demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.curve(
                [
                    { time: bar.time, price: bar.open },
                    { time: bar.time, price: bar.high },
                    { time: bar.time, price: bar.close },
                ],
                { color: "#22c55e", lineWidth: 1 },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/curves/curve.ts)
- [`draw.*` namespace index](./index.md)

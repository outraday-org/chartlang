# `draw.fibWedge`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `other`
> **Wire kind:** `fib-wedge`

Draw a Fibonacci wedge — rays fanning from `anchors[0]` (the pivot)
at fib-ratio interpolated angles between the (pivot→`anchors[1]`)
and (pivot→`anchors[2]`) directions. Mirrors invinite's
`fib-wedge-tool.ts` shape.

## Anchors

`anchors` — `[pivot, range1, range2]` triple

Anchor count: 3.

## Signature

```ts
function fibWedge(anchors: AnchorTriple, opts?: FibOpts): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.fibWedge(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.fibWedge demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.fibWedge(
                [
                    { time: bar.time, price: bar.close },
                    { time: bar.time + 30_000, price: bar.high },
                    { time: bar.time + 30_000, price: bar.low },
                ],
                { showLabels: true },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/fibA/fibWedge.ts)
- [`draw.*` namespace index](./index.md)

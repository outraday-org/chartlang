# `draw.fibSpiral`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `other`
> **Wire kind:** `fib-spiral`

Draw a Fibonacci (golden) spiral approximated by chained cubic
Beziers, one per quarter-turn. The spiral starts at `a` (centre) with
initial radius `|b - a|` and scales by φ ≈ 1.618 per quarter-turn.
Mirrors invinite's `fib-spiral-tool.ts` shape. The `counterClockwise`
flag from the invinite tool is deferred; the
landed renderer is clockwise-only.

## Anchors

`a`, `b` — two `WorldPoint`s (centre, initial-radius edge)

Anchor count: 2.

## Signature

```ts
function fibSpiral(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.fibSpiral(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.fibSpiral demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.fibSpiral(
                { time: bar.time, price: bar.close },
                { time: bar.time + 30_000, price: bar.high },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/fibB/fibSpiral.ts)
- [`draw.*` namespace index](./index.md)

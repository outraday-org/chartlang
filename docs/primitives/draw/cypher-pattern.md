# `draw.cypherPattern`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `polylines`
> **Wire kind:** `cypher-pattern`

Draw a Cypher harmonic pattern through 5 world anchors `[X, A, B, C,
D]`. The renderer strokes the connecting legs (X-A, A-B, B-C, C-D)
and labels each pivot. Mirrors invinite's `CypherPatternDrawing`
schema — `cypher-pattern` has no standalone tool in invinite, only
the y-doc-bridge type; the UI surface lives in `defineDrawing`.

## Anchors

`anchors` — `[X, A, B, C, D]` quint of world points

Anchor count: 5.

## Signature

```ts
function cypherPattern(anchors: AnchorQuint, opts?: LineDrawStyle): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.cypherPattern(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.cypherPattern demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.cypherPattern([
                { time: bar.time, price: bar.low },
                { time: bar.time + 15_000, price: bar.high },
                { time: bar.time + 30_000, price: bar.close },
                { time: bar.time + 45_000, price: bar.high - 1 },
                { time: bar.time + 60_000, price: bar.low + 1 },
            ]);
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/patterns/cypherPattern.ts)
- [`draw.*` namespace index](./index.md)

# `draw.trianglePattern`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `polylines`
> **Wire kind:** `triangle-pattern`

Draw a triangle pattern (ascending / descending / symmetrical)
through 3 world anchors `[apex, baseHigh, baseLow]`. The renderer
strokes the 3-vertex closed polygon and labels each pivot.
**Distinct from `draw.triangle`** (a solid-shape primitive
with ShapeStyle); this is the harmonic-pattern outline with
LineDrawStyle. Mirrors invinite's `triangle-pattern-tool.ts` shape.

## Anchors

`anchors` — `[apex, baseHigh, baseLow]` triple

Anchor count: 3.

## Signature

```ts
function trianglePattern(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.trianglePattern(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.trianglePattern demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.trianglePattern([
                { time: bar.time + 60_000, price: bar.close },
                { time: bar.time, price: bar.high },
                { time: bar.time, price: bar.low },
            ]);
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/patterns/trianglePattern.ts)
- [`draw.*` namespace index](./index.md)

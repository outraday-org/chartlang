# `draw.regressionTrend`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `polylines`
> **Wire kind:** `regression-trend`

Draw an OLS regression-trend line between two world anchors with
optional ±σ bands. The runtime emits the anchor pair + opts;
the actual OLS fit is computed by the adapter — consumer adapters
can use {@link import ("@invinite-org/chartlang-runtime").linearRegression}
without duplicating math. The reference
canvas2d adapter renders a placeholder anchor-to-anchor line because
`Viewport` does not expose a bar accessor. Mirrors
invinite's `regression-trend-tool.ts` shape.

## Anchors

`a`, `b` — start and end `WorldPoint`s (a.time < b.time)

Anchor count: 2.

## Signature

```ts
function regressionTrend(a: WorldPoint, b: WorldPoint, opts?: RegressionTrendOpts): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.regressionTrend(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.regressionTrend demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.regressionTrend(
                { time: bar.time, price: bar.close },
                { time: bar.time + 30_000, price: bar.close },
                {
                    source: "close",
                    stdevMultiplier: 2,
                    showUpperBand: true,
                    showLowerBand: true,
                },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/channels/regressionTrend.ts)
- [`draw.*` namespace index](./index.md)

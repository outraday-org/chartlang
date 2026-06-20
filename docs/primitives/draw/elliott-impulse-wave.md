# `draw.elliottImpulseWave`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `polylines`
> **Wire kind:** `elliott-impulse-wave`

Draw an Elliott five-wave impulse pattern through 5 world anchors
`[wave1End, wave2End, wave3End, wave4End, wave5End]`. The renderer
strokes the connecting legs (1-2, 2-3, 3-4, 4-5) and labels each
pivot. Pass `opts.labels` to override the default `["1", "2", "3",
"4", "5"]` labels.

## Anchors

`anchors` — `[wave1End, wave2End, wave3End, wave4End, wave5End]`

Anchor count: 5.

## Signature

```ts
function elliottImpulseWave(anchors: AnchorQuint, opts?: LineDrawStyle): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.elliottImpulseWave(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.elliottImpulseWave demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.elliottImpulseWave([
                { time: bar.time, price: bar.low },
                { time: bar.time + 15_000, price: bar.high },
                { time: bar.time + 30_000, price: bar.close },
                { time: bar.time + 45_000, price: bar.high + 1 },
                { time: bar.time + 60_000, price: bar.close + 0.5 },
            ]);
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/elliott/elliottImpulseWave.ts)
- [`draw.*` namespace index](./index.md)

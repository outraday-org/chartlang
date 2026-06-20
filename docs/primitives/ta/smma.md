# `ta.smma`

> **Stability:** stable
> **Since:** 0.2

Smoothed moving average (Wilder's RMA). Recurrence
`SMMA[t] = α·x[t] + (1 − α)·SMMA[t − 1]` with `α = 1 / length`
after a seed of the simple mean of the first `length` finite
source values. Mid-stream NaN forward-fills the prior value
(matches the recurrence-MA convention shared with `ta.ema`).
Tick-mode (`onBarTick`) recomputes the head from the previous
closed SMMA so partial-bar values don't bleed into the next
close's recurrence.

## Formula

α = 1 / length ;
seed at bar length−1 = mean(source[0..length−1]) ;
SMMA[t] = source[t]·α + SMMA[t−1]·(1−α)

## Warmup

length − 1

## Signature

```ts
function smma(slotId: string, source: ScalarOrSeries, length: number, _opts?: SmmaOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `source` | `ScalarOrSeries` | — | — |
| `length` | `number` | — | — |
| `_opts` | `SmmaOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-core";
    // const s = ta.smma(bar.close, 14);
    // plot(s);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/smma.ts)

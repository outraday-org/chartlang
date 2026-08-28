# `ta.ema`

> **Stability:** stable
> **Since:** 0.1

Exponential moving average. Recurrence `EMA[t] = α·x[t] + (1 − α)·EMA[t − 1]`
with `α = 2 / (length + 1)`. The first finite source value seeds the
recurrence immediately. A missing source bar emits `NaN` without changing
the last finite closed EMA. Tick-mode (`onBarTick`) recomputes the head from
the state before the current closed head so tentative values don't bleed
into the next close's recurrence. A non-positive or non-integer `length`
produces `NaN`.

## Formula

α = 2 / (length + 1) ;
EMA[first finite t] = source[t] ;
EMA[t] = source[t]·α + EMA[t−1]·(1−α)

## Warmup

0 on a finite source; leading/missing source bars emit NaN

## Signature

```ts
function ema(slotId: string, source: ScalarOrSeries, length: number, opts?: EmaOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `source` | `ScalarOrSeries` | — | — |
| `length` | `number` | — | — |
| `opts` | `EmaOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-runtime";
    // const e = ta.ema("slot-id", bar.close, 20);
    // const head = e.current; // finite from the first finite source bar
    // const projected = ta.ema("slot2", bar.close, 20, { offset: 5 });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/ema.ts)

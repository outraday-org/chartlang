# `ta.median`

> **Stability:** stable
> **Since:** 0.2

Rolling median — middle-value statistic across the trailing
`length` source values. NaN slots are dropped from the sort
(window length effectively shrinks); if every slot is NaN the
output is NaN. Robust to single-bar spikes the way an SMA isn't.
Tick-mode replays the head by substituting the tick value for
the age-0 slot before sorting — the closed window is unchanged.

## Formula

out[t] = median(source[t − length + 1 .. t]) ;
odd length → middle value ; even length → mean of the
two middle values ; NaN slots dropped before sort

## Warmup

length − 1

## Signature

```ts
function median(slotId: string, source: ScalarOrSeries, length: number, _opts?: MedianOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `source` | `ScalarOrSeries` | — | — |
| `length` | `number` | — | — |
| `_opts` | `MedianOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-core";
    // const m = ta.median(bar.close, 21);
    // plot(m);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/median.ts)

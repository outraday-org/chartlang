# `ta.lowestbars`

> **Stability:** stable
> **Since:** 0.2

Bar offset (≤ 0) to the lowest `source` value over the trailing
`length` bars (the window INCLUDES the current bar). `0` means the
current bar is the lowest; `-k` means the lowest occurred `k` bars
ago. Ties resolve to the MOST RECENT bar (smallest |offset|). NaN
inputs are skipped as candidates; an all-NaN window emits NaN. The
output is NaN until `length` closed bars have folded in. Tick-mode
replays the in-progress head as the offset-0 candidate without
advancing the buffer.

## Formula

out[t] = argmin_{k ∈ [0, length)} source[t − k] expressed as −k
(NaN slots skipped; ties → smallest k)

## Warmup

length − 1

## Signature

```ts
function lowestbars(slotId: string, source: ScalarOrSeries, length: number, _opts?: LowestbarsOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `source` | `ScalarOrSeries` | — | — |
| `length` | `number` | — | — |
| `_opts` | `LowestbarsOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-core";
    // const lbar = ta.lowestbars(bar.low, 20);
    // const left = bar.point(lbar.current, bar.low.current);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/lowestbars.ts)

# `ta.lowest`

> **Stability:** stable
> **Since:** 0.2

Rolling minimum of the last `length` source values. NaN inputs are
skipped from the window; the output is NaN until `length` closed
bars have been folded in. Tick-mode replays the head as
`min(closedMinExcludingHead, tickValue)`.

## Formula

out[t] = min(source[t − length + 1 .. t])  (NaN slots skipped)

## Warmup

length − 1

## Signature

```ts
function lowest(slotId: string, source: ScalarOrSeries, length: number, _opts?: LowestOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `source` | `ScalarOrSeries` | — | — |
| `length` | `number` | — | — |
| `_opts` | `LowestOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-core";
    // const lower = ta.lowest(bar.low, 20);
    // plot(lower);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/lowest.ts)

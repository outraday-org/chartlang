# `ta.rising`

> **Stability:** stable
> **Since:** 1.8

`true` when `source` rose on each of the trailing `length` bars — every
one of the last `length` consecutive first-differences is strictly
positive. A `NaN` anywhere in the window yields `false` (the
boolean-series convention shared with `ta.crossover`).

## Formula

out[t] = ⋀_{k=1..length} src[t−k+1] > src[t−k]

## Warmup

length

## Signature

```ts
function rising(slotId: string, source: ScalarOrSeries, length: number): Series<boolean>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `source` | `ScalarOrSeries` | — | — |
| `length` | `number` | — | — |

## Returns

`Series<boolean>`

## Example

```ts
// const up = ta.rising(bar.close, 3);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/rising.ts)

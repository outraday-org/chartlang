# `ta.falling`

> **Stability:** stable
> **Since:** 1.8

`true` when `source` fell on each of the trailing `length` bars — every
one of the last `length` consecutive first-differences is strictly
negative. A `NaN` anywhere in the window yields `false` (the
boolean-series convention shared with `ta.crossunder`).

## Formula

out[t] = ⋀_{k=1..length} src[t−k+1] < src[t−k]

## Warmup

length

## Signature

```ts
function falling(slotId: string, source: ScalarOrSeries, length: number): Series<boolean>;
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
// const down = ta.falling(bar.close, 3);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/falling.ts)

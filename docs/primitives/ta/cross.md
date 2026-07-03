# `ta.cross`

> **Stability:** stable
> **Since:** 1.8

`true` on the bar where `a` crosses `b` in either direction — the union
of `ta.crossover(a, b)` and `ta.crossunder(a, b)`. A `NaN` operand in
the one-bar window yields `false`.

## Formula

out[t] = crossover(a,b)[t] ∨ crossunder(a,b)[t]

## Warmup

1

## Signature

```ts
function cross(slotId: string, a: ScalarOrSeries, b: ScalarOrSeries): Series<boolean>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `a` | `ScalarOrSeries` | — | — |
| `b` | `ScalarOrSeries` | — | — |

## Returns

`Series<boolean>`

## Example

```ts
// const touched = ta.cross(ta.ema(bar.close, 9), ta.ema(bar.close, 21));
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/cross.ts)

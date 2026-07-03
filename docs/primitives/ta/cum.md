# `ta.cum`

> **Stability:** stable
> **Since:** 1.8

Running (cumulative) sum of `source` from the first bar. A `NaN` sample
contributes `0`, carrying the total forward without polluting it
(matching Pine `ta.cum` and the `obv` / `adl` accumulator convention).

**Tick mode.** Replays the head bar's contribution against a snapshot of
the prior-close total (`prevClosedCum`) so a partial-bar tick doesn't
pollute the next close's accumulator.

## Formula

out[t] = Σ_{u=0..t} (isFinite(src[u]) ? src[u] : 0)

## Warmup

0

## Signature

```ts
function cum(slotId: string, source: ScalarOrSeries): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `source` | `ScalarOrSeries` | — | — |

## Returns

`Series<number>`

## Example

```ts
// const cumVol = ta.cum(bar.volume);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/cum.ts)

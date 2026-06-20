# `ta.crossunder`

> **Stability:** stable
> **Since:** 0.1

`true` exactly at the bar where `a` crosses below `b`: `a.current <
b.current && a.prev >= b.prev`. Mirror of {@link crossover}; NaN
inputs yield `false`.

## Formula

out[t] = a[t] < b[t] && a[t − 1] ≥ b[t − 1] (else false)

## Warmup

1

## Signature

```ts
function crossunder(slotId: string, a: ScalarOrSeries, b: ScalarOrSeries, opts?: CrossunderOpts): Series<boolean>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `a` | `ScalarOrSeries` | — | — |
| `b` | `ScalarOrSeries` | — | — |
| `opts` | `CrossunderOpts` | (optional) | — |

## Returns

`Series<boolean>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-runtime";
    // const c = ta.crossunder("slot", fastEma, slowEma);
    // if (c.current) { ... }
    // const lagged = ta.crossunder("slot2", fastEma, slowEma, { offset: 1 });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/crossunder.ts)

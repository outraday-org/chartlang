# `ta.cci`

> **Stability:** stable
> **Since:** 0.2

Commodity Channel Index — momentum oscillator centred on `0`.
Compares the source (typically `bar.hlc3`) to its SMA over the
trailing `length` bars, normalised by mean absolute deviation
with the classic Lambert `scaling = 0.015` constant. Unbounded
by construction; `meanDev === 0` (flat-line window) emits `NaN`.

## Formula

tp           = source[t] ;
sma          = mean(tp[t − length + 1 .. t]) ;
meanAbsDev   = mean(|tp[i] − sma| for i in window) ;
cci          = (tp[t] − sma) / (0.015 · meanAbsDev) ;
NaN          when meanAbsDev === 0

## Warmup

length − 1

## Signature

```ts
function cci(slotId: string, source: ScalarOrSeries, length: number, _opts?: CciOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `source` | `ScalarOrSeries` | — | — |
| `length` | `number` | — | — |
| `_opts` | `CciOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-runtime";
    // const c = ta.cci("slot", bar.hlc3, 20);
    // const head = c.current;
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/cci.ts)

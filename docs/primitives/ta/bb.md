# `ta.bb`

> **Stability:** stable
> **Since:** 0.1

Bollinger Bands — `multiplier × σ` envelope around an SMA(length)
middle band. Default `multiplier = 2` per Pine. Returns a cached
`{ upper, middle, lower }` record (same identity every bar) backed
by three `Series<number>` Proxies. The middle band is the
underlying SMA primitive's output (identity-shared).

## Formula

middle = sma(source, length) ;
σ      = stdev(source, length, { biased: true }) ;
upper  = middle + multiplier · σ ;
lower  = middle − multiplier · σ

## Warmup

length − 1

## Signature

```ts
function bb(slotId: string, source: ScalarOrSeries, length: number, opts?: BbOpts): BbResult;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `source` | `ScalarOrSeries` | — | — |
| `length` | `number` | — | — |
| `opts` | `BbOpts` | (optional) | — |

## Returns

`BbResult`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-runtime";
    // const bands = ta.bb("slot", bar.close, 20, { multiplier: 2 });
    // const u = bands.upper.current;
    // const lagged = ta.bb("slot2", bar.close, 20, { offset: 5 });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/bb.ts)

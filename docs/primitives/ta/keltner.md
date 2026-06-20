# `ta.keltner`

> **Stability:** stable
> **Since:** 0.2

Keltner Channels — overlay volatility envelope. Middle band is an
`maType` MA of `bar.close` over `length`; upper / lower bands sit
`multiplier · ATR(length)` above / below the middle. Defaults
`length = 20`, `multiplier = 2`, `maType = "ema"` (Linda Raschke /
TradingView canonical form — Chester Keltner's original used a
different "typical range" formulation; every modern reference
defaults to EMA + Wilder ATR). Composes the registered MA primitive
via sub-slot `${slotId}/<maType>` and `ta.atr` via sub-slot
`${slotId}/atr` — fixes to either flow in for free. Returns a
cached `{ upper, middle, lower }` record (same identity every bar).
NaN across all outputs while the trailing window is unwarmed.

## Formula

middle = MA(close, length, maType) ;
upper  = middle + multiplier · atr(length) ;
lower  = middle − multiplier · atr(length)

## Warmup

length

## Anchors

maType

## Signature

```ts
function keltner(slotId: string, opts?: KeltnerOpts): KeltnerResult;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `opts` | `KeltnerOpts` | (optional) | — |

## Returns

`KeltnerResult`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-core";
    // const k = ta.keltner({ length: 20, multiplier: 2 });
    // plot(k.upper);
    // plot(k.middle);
    // plot(k.lower);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/keltner.ts)

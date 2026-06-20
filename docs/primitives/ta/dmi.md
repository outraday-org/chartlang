# `ta.dmi`

> **Stability:** stable
> **Since:** 0.2

Wilder's Directional Movement Index — `+DI` / `−DI` pair derived
from the Wilder-smoothed `+DM` / `−DM` over the smoothed True
Range. Reads `bar.high` / `bar.low` / `bar.close` directly
(mirrors Pine's `ta.dmi(length)` — no source param). Both series
∈ [0, 100] when defined; NaN until `length` closed bars have
folded into the seed window. The first defined value lands at
bar index `length` (counted zero-based — matches the
full-recompute reference in `lib/wilderDirectional.ts`).

## Formula

TR[t]     = max(high − low, |high − prevClose|, |low − prevClose|) ;
upMove    = high[t] − high[t−1] ; downMove = low[t−1] − low[t] ;
+DM       = upMove   > downMove && upMove   > 0 ? upMove   : 0 ;
−DM       = downMove > upMove   && downMove > 0 ? downMove : 0 ;
seed at bar `length` = simple sum over the seed window ;
smoothed via wilderStep(α = 1/length) thereafter ;
+DI       = 100 · smoothed+DM / smoothedTR ;
−DI       = 100 · smoothed−DM / smoothedTR ;
DI falls back to 0 when smoothedTR is 0 (matches invinite).

## Warmup

length

## Signature

```ts
function dmi(slotId: string, length: number, opts?: DmiOpts): DmiResult;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `length` | `number` | — | — |
| `opts` | `DmiOpts` | (optional) | — |

## Returns

`DmiResult`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-runtime";
    // const d = ta.dmi("slot", 14);
    // plot(d.plusDi);
    // plot(d.minusDi);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/dmi.ts)

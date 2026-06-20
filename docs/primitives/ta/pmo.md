# `ta.pmo`

> **Stability:** stable
> **Since:** 0.2

Carl Swenlin's Price Momentum Oscillator (PMO). Three-pass smoothing
of the 1-bar ROC, scaled to PMO's characteristic ±10 swing range:

  1. `roc1[t] = ((src[t] / src[t-1]) - 1) × 1000`.
  2. `ema1 = SwenlinEMA(firstSmoothing)(roc1)` — `α = 2 / firstSmoothing`.
  3. `scaled = ema1 × 10`.
  4. `pmo  = SwenlinEMA(secondSmoothing)(scaled)` — `α = 2 / secondSmoothing`.
  5. `signal = EMA(signalLength)(pmo)` — standard `α = 2 / (signalLength + 1)`.

The Swenlin EMA factor diverges from canonical `ta.ema`'s `α = 2 /
(length + 1)`; without it the PMO output is off by a multiplicative
constant. Matches TradingView's published PMO output verbatim.

## Formula

roc1[t]   = ((src[t]/src[t-1]) - 1) × 1000 ;
ema1[t]   = SwenlinEMA(firstSmoothing)(roc1) ;
pmo[t]    = SwenlinEMA(secondSmoothing)(ema1 × 10) ;
signal[t] = EMA(signalLength)(pmo)

## Warmup

firstSmoothing + secondSmoothing − 1 (pmo line); firstSmoothing + secondSmoothing + signalLength − 3 (signal line)

## Signature

```ts
function pmo(slotId: string, source: ScalarOrSeries, opts?: PmoOpts): PmoResult;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `source` | `ScalarOrSeries` | — | — |
| `opts` | `PmoOpts` | (optional) | — |

## Returns

`PmoResult`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-runtime";
    // const p = ta.pmo("slot", bar.close);
    // plot(p.pmo); plot(p.signal);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/pmo.ts)

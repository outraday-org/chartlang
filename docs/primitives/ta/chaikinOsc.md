# `ta.chaikinOsc`

> **Stability:** stable
> **Since:** 0.2

Chaikin Oscillator — `EMA(ADL, fastLength) − EMA(ADL, slowLength)`.
Composes one `ta.adl` sub-slot (cumulative money-flow volume) plus
two `ta.ema` sub-slots over the ADL series; a fix to `ta.adl` or
`ta.ema` flows in for free. Renders in its own pane (volume
category, oscillator-shape around zero).

Defaults `{ fastLength: 3, slowLength: 10 }` (TradingView /
invinite canonical). ADL and both EMA stages seed on bar zero, so
the oscillator is finite immediately for a finite bar.

**Tick mode.** The sub-slots handle their own tick replay (ADL
snapshots `prevClosedCumAdl`; EMA snapshots `priorClosedEma`); this
primitive's parent slot just re-evaluates `fastEma − slowEma`
against the live sub-slot heads and `replaceHead`s its own output.

## Formula

chaikinOsc[t] = ema(adl(t), fastLength) − ema(adl(t), slowLength)

## Warmup

0 on a finite ADL source

## Signature

```ts
function chaikinOsc(slotId: string, opts?: ChaikinOscOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `opts` | `ChaikinOscOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta, plot } from "@invinite-org/chartlang-core";
    // const c = ta.chaikinOsc();
    // plot(c);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/chaikinOsc.ts)

# `ta.chandeKrollStop`

> **Stability:** stable
> **Since:** 0.2

Chande Kroll Stop — two-pass ATR-offset trailing stops. The first
pass anchors each bar to its `length`-bar high/low extreme minus /
plus `multiplier · ATR`; the second pass smooths the first-pass
stops by taking the rolling max / min over a `smoothingLength`-bar
window. `long` is the long-trade trailing stop ceiling (max of
`firstHigh`), `short` is the short-trade trailing stop floor (min
of `firstLow`). Composes `ta.atr` plus `ta.highest`
and `ta.lowest` at sub-slots.

Source field is hard-coded to `bar.high` / `bar.low` (matches Pine
`ta.cks` and the canonical TradingView CKS). Invinite's `source`
parameter is omitted; a `source` opt could land in a follow-up.

NaN ATR or NaN extreme → NaN at both first-pass and second-pass
outputs for that bar (the rolling window retains the NaN slot;
downstream max/min skip NaN entries via `Number.isFinite`).

## Formula

firstHigh = highest(bar.high, length) − multiplier · atr(length) ;
firstLow  = lowest(bar.low,   length) + multiplier · atr(length) ;
long  = max(firstHigh over smoothingLength bars) ;
short = min(firstLow  over smoothingLength bars)

## Warmup

length + smoothingLength − 1

## Anchors

length, multiplier

## Signature

```ts
function chandeKrollStop(slotId: string, opts?: ChandeKrollStopOpts): ChandeKrollStopResult;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `opts` | `ChandeKrollStopOpts` | (optional) | — |

## Returns

`ChandeKrollStopResult`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-core";
    // const c = ta.chandeKrollStop({ length: 10, multiplier: 1, smoothingLength: 9 });
    // plot(c.long);
    // plot(c.short);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/chandeKrollStop.ts)

# `ta.bbPercentB`

> **Stability:** stable
> **Since:** 0.2

Bollinger %B — sub-pane oscillator measuring price position
relative to the Bollinger Band envelope. `0` sits on the lower
band, `1` on the upper; excursions past either signal a volatility
breakout. Composes `ta.bb` via sub-slot `${slotId}/bb` — a fix to
the BB envelope math flows in for free. NaN when the band collapses
(`upper === lower`) or during warmup.

## Formula

bands  = bb(source, length, { multiplier }) ;
pct    = (source − bands.lower) / (bands.upper − bands.lower)

## Warmup

length − 1

## Signature

```ts
function bbPercentB(slotId: string, source: ScalarOrSeries, length: number, opts?: BbPercentBOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `source` | `ScalarOrSeries` | — | — |
| `length` | `number` | — | — |
| `opts` | `BbPercentBOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-core";
    // const pct = ta.bbPercentB(bar.close, 20, { multiplier: 2 });
    // plot(pct);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/bbPercentB.ts)

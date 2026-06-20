# `ta.adr`

> **Stability:** stable
> **Since:** 0.2

Average Daily Range — SMA of `high − low` across the trailing
`length` completed UTC calendar days. Default `length = 14` per
TradingView. Reads `bar.high` / `bar.low` / `bar.time` directly
(no `source` argument per the absolute-range formula).

**Calendar-day boundary.** "daily" keys on the UTC midnight
boundary (`Math.floor(time / 86_400_000)`). Bars sharing a day key
are aggregated into a single `(dailyHigh, dailyLow)` pair; the day
range commits to the rolling SMA when the next bar's day key differs.
The in-progress (currently-aggregating) day is NEVER included in the
average. A future release lifts this onto `syminfo.session` so symbols
with non-UTC sessions can override the convention.

**Tick mode.** Ticks within the in-progress bar do NOT shift the day
boundary (per the runtime invariant that ticks happen inside the
current bar); the emitted value is the cached SMA of the already-
committed days. The next close re-folds the bar into the in-progress
day aggregate.

**NaN.** Bars with non-finite `high` / `low` / `time` are skipped
(no aggregation, no commit); the output reflects only the previously
committed days.

## Formula

out[t] = mean( (dailyHigh − dailyLow) over the last `length`
completed UTC days, in price units )

## Warmup

length daily bars

## Signature

```ts
function adr(slotId: string, opts?: AdrOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `opts` | `AdrOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-core";
    // const r = ta.adr({ length: 14 });
    // plot(r);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/adr.ts)

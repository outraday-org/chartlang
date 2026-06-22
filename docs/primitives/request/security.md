# `request.security`

> **Stability:** stable
> **Since:** 0.4

Read a secondary candle stream at a script-author-fixed **higher**
interval. Two forms:

- **Data**: `request.security({ interval })` → a `SecurityBar`.
  Every OHLCV field — plus the derived `hl2` / `hlc3` / `ohlc4` /
  `hlcc4` and `symbol` / `interval` — is a `Series<...>` aligned
  no-lookahead to the chart's bars, so a script can read prior secondary
  values such as `weekly.close[5]`.
- **Expression**: `request.security({ interval }, (bar) => …)` →
  `Series<number>`. The callback runs **on the higher-timeframe clock**
  (once per HTF bar), so `ta.*` inside it accumulate over HTF bars; the
  result is aligned no-lookahead down to the main timeline. This is the
  only correct way to get a "weekly EMA(20)" — the data form's series is
  clocked to the main timeline, so `ta.ema(weekly.close, 20)` would
  average 20 *main* bars.

Both `symbol` and `interval` must be compile-time literals (a string
literal, an `input.symbol` default, or an `input.enum` value); the compiler
walks every call to populate `manifest.requestedFeeds` (and the main-symbol
projection `manifest.requestedIntervals`). `symbol` is **optional** —
omitting it reads the chart's own symbol (the higher-timeframe-only case).
When the adapter does not advertise `Capabilities.multiTimeframe`, the
series degrades to all-NaN rather than erroring; a non-chart `symbol`
additionally requires `Capabilities.multiSymbol` and otherwise degrades to
all-NaN. See the multi-timeframe guide for alignment and interval-format
details.

## Signature

```ts
function security(opts: RequestSecurityOpts): SecurityBar;
```

## Example

```ts
// weekly EMA(20) — computed over weekly bars, drawn on the chart
    const trend = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20));
    plot(trend, { title: "Weekly EMA(20)" });
```

## See also

- `request.*` namespace — [Multi-timeframe guide](/language/multi-timeframe)
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/request/request.ts)

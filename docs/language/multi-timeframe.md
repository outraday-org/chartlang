# Multi-timeframe

Scripts read a second timeframe through the `request.*` namespace:

| Call | Direction | Returns |
| --- | --- | --- |
| `request.security({ interval })` | a **higher** timeframe (chart symbol) | a `SecurityBar` (series-shaped OHLCV view) |
| `request.security({ symbol, interval })` | a **different instrument** | a `SecurityBar` for that symbol |
| `request.lowerTf({ interval })` | a **lower** timeframe | a `Series<ReadonlyArray<Bar>>` (the intrabar bars inside each main bar) |

## Higher timeframe: `request.security`

`request.security` pulls a coarser stream aligned to the chart's bars. The
returned `SecurityBar` exposes every OHLCV field — plus the derived
`hl2` / `hlc3` / `ohlc4` / `hlcc4` and `symbol` / `interval` — as a
`Series<...>`, so you can read prior secondary values such as
`weekly.close[5]`.

```ts
import { defineIndicator, plot, request, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "HTF Trend Filter",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, request }) {
        // Current-timeframe trend.
        const fast = ta.ema(bar.close, 20);
        plot(fast, { color: "#26a69a", title: "EMA(20)" });

        // Higher-timeframe trend pulled from weekly candles via
        // request.security. The interval must be a compile-time literal;
        // alignment is no-lookahead (weekly value holds until the next
        // weekly close).
        const weekly = request.security({ interval: "1W" });
        const weeklyTrend = ta.ema(weekly.close, 10);
        plot(weeklyTrend, { color: "#ef5350", title: "Weekly EMA(10)" });
    },
});
```

[Try it live](https://chartlang.invinite.com/?script=htf-trend-filter#demo).

## Expression form: `request.security({ interval }, (bar) => …)`

The data form above returns a series aligned onto the **main** timeline, so a
`ta.*` applied to it counts its window in **main** bars — `ta.ema(weekly.close,
20)` averages 20 *main* bars of a weekly-stepped series, which on daily data
comes out nearly identical to the daily EMA(20), not a weekly trend.

To run an indicator **on the higher-timeframe clock**, pass a callback as the
second argument:

```ts
const weeklyTrend = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20));
```

The callback receives the higher-timeframe `bar` (a `SecurityBar` on its own
clock) and returns a `Series<number>` or a `number`. It runs once per HTF bar —
so `ta.ema(bar.close, 20)` accumulates over 20 *weekly* bars (≈ 140 days) — and
the result is then aligned no-lookahead down to the main timeline.

| Form | Clock the `ta.*` runs on | `ta.ema(…, 20)` on daily data |
| --- | --- | --- |
| `ta.ema(weekly.close, 20)` (data form) | main | ≈ a daily EMA(20) |
| `request.security({ interval: "1W" }, (b) => ta.ema(b.close, 20))` | weekly | a true 20-**week** EMA |

### Restricted scope

The callback runs in an isolated HTF context, so it may reference **only**:

- the `bar` parameter (the HTF `SecurityBar`) and locals it declares,
- the ambient `ta` and `inputs` namespaces,
- the safe `Math.*` globals (`Math.max`, `Math.abs`, …; `Math.random` stays
  forbidden by `hostile-global`), and
- literal constants.

chartlang has **no `math` namespace** — scalar math uses JS operators and the
allowed `Math.*` globals. Capturing any **other** outer binding (a main-timeline
local) would smuggle the wrong clock back in, so the compiler rejects it at
compile time with `request-security-expr-captures-local`:

```ts
const len = inputs.weeklyLength as number;
// ❌ `len` is an outer local — request-security-expr-captures-local
request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, len));
// ✅ read the input inside the callback instead
request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, inputs.weeklyLength as number));
```

The expression form shares the data form's alignment contract below: the
returned series is held no-lookahead until the next HTF close, reads the
**same symbol** as the chart, and falls back to all-`NaN` when the adapter does
not advertise `Capabilities.multiTimeframe`. The compiler records each
expression callsite in `manifest.securityExpressions` (see
[the manifest spec](../spec/manifest.md)).

## Lower timeframe: `request.lowerTf`

`request.lowerTf` returns, for each main bar, the array of finer-grained
bars contained within it. The result is a `Series<ReadonlyArray<Bar>>`;
out-of-range or unsupported reads are empty frozen arrays. The requested
interval must be **strictly lower** than the chart interval — a higher or
equal interval is rejected at compile time with `lower-tf-not-lower` when
the ordering is statically known.

## Multi-symbol: a different instrument

Pass a `symbol` alongside the `interval` to read a **different instrument**,
the way Pine's `request.security("NASDAQ:AAPL", "1D", close)` does. Omitting
`symbol` keeps the existing meaning (the chart's own symbol at a higher
timeframe), so every pre-multi-symbol script is byte-identical.

```ts
// SPY priced in QQQ — a ratio against a DIFFERENT symbol.
const spy = request.security({ symbol: "AMEX:SPY", interval: "1D" });
const qqq = request.security({ symbol: "NASDAQ:QQQ", interval: "1D" });
plot(spy.close.current / qqq.close.current, { title: "SPY/QQQ" });

// A weekly EMA(20) of a different symbol — the expression form carries
// the symbol too, and runs on that symbol's weekly clock.
const trend = request.security(
    { symbol: "NASDAQ:AAPL", interval: "1W" },
    (bar) => ta.ema(bar.close, 20),
);
plot(trend, { title: "AAPL weekly EMA(20)" });
```

A `SecurityBar` field is a `Series<...>`, not a number, so cross-symbol
arithmetic reads the scalar head explicitly — `spy.close.current /
qqq.close.current`, not `spy.close / qqq.close`.

## Both `symbol` and `interval` must be literals

Both are part of the compiled manifest, so each must be a **compile-time
literal** — a string literal, an `input.symbol` default, or an `input.enum`
value. A dynamic expression is rejected by the compiler
(`request-security-interval-not-literal` for the interval,
`request-security-symbol-not-literal` for the symbol). The compiler walks every
`request.security` call to populate `manifest.requestedFeeds` (the full set of
distinct `(symbol?, interval)` feeds) and `manifest.requestedIntervals` (the
main-symbol projection, retained for back-compat), which is how the host knows
which secondary streams to feed.

## Interval format

Intervals are an integer count plus a unit: `"30s"`, `"1m"`, `"1h"`,
`"1d"`, `"1w"`, `"1M"` (seconds / minutes / hours / days / weeks /
months). The unit case follows the chartlang convention — `m` is minutes,
`M` is months. The demo's sample data is daily (`"1D"`), so the HTF example
above requests weekly (`"1W"`).

## No-lookahead alignment

A secondary value is only known at its **close**. The runtime aligns the
secondary series to the main bars with a no-lookahead two-pointer walk: a
main bar that precedes the first secondary bar reads `NaN`; otherwise the
most-recent *closed* secondary value is held until the next secondary close
arrives. A higher-timeframe series therefore steps forward only on its own
boundaries and never reveals a future value to an earlier main bar.

## Adapter support

Higher-timeframe reads of the **chart's own symbol** are gated on the adapter
advertising `Capabilities.multiTimeframe`. Reading a **different symbol** is a
strictly larger ask (an adapter that can resample its own symbol to a higher
timeframe cannot necessarily fetch another instrument), so it has its own gate:
`Capabilities.multiSymbol`.

When the adapter does not advertise the relevant capability (or the interval is
unsupported, or the host fails to register the stream), the `SecurityBar` falls
back to all-`NaN` series and the script degrades to a silent no-op rather than
erroring — per the capability-gating contract. A different-symbol request
against an adapter declaring `multiSymbol: false` degrades with a single
`multi-symbol-not-supported` diagnostic, mirroring `multi-timeframe-not-
supported`; the symbol gate precedes the timeframe gate, so a request that is
both a different symbol AND a different timeframe against `multiSymbol: false`
emits only `multi-symbol-not-supported`.

## Cross-links

- Series shape + NaN semantics: [Series and indexing](./series-and-indexing.md).
- Inputs (including `input.enum` for a user-pickable interval): [Inputs](./inputs.md).
- The worked example: [HTF Trend Filter](../examples/htf-trend-filter.md).

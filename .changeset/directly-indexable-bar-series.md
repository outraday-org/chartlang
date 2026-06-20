---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
---

Make the compute bar's OHLCV + derived fields directly indexable as a series.

`bar.close`, `bar.open`, `bar.high`, `bar.low`, `bar.volume`, and the derived
`bar.hl2` / `bar.hlc3` / `bar.ohlc4` / `bar.hlcc4` are now `PriceSeries` /
`VolumeSeries` (`number & Series<number>`) on the bar passed to `compute`
(`ComputeContext.bar`, typed as the new `BarSeries`). Each field is **both** a
scalar — `bar.close * 2`, `plot(bar.close)`, `ta.ema(bar.close, 20)` keep
working unchanged — **and** an indexable series, so a script can read prior
bars directly:

```ts
const sma5 = (bar.close[0] + bar.close[1] + bar.close[2] + bar.close[3] + bar.close[4]) / 5;
```

This removes the `ta.ema(bar.close, 1)` identity-trick that scripts previously
needed to "republish" a scalar price as an indexable `Series`.

The adapter-supplied candle type `Bar` (and `request.lowerTf` intrabar bars) is
unchanged — it stays scalar OHLCV; only the streaming `compute` bar gains the
series shape. `request.security`'s higher-timeframe bar remains the separate
`SecurityBar`.

Migration note: because the field is now an object, `Number.isFinite(bar.close)`
is always `false` (it does not coerce) and `bar.close === 42` is `false` (object
vs number). Use `bar.close.current` or `+bar.close` in those raw-number
contexts. `bar.point(0, bar.close)` continues to work — the runtime coerces the
anchor price to a scalar.

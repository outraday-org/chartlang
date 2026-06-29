---
"@invinite-org/chartlang-pine-converter": minor
---

Back history-indexed series-in-Pine receivers with indexable `state.*Series`
slots so they compile, instead of emitting `x[1]` on a `.current` scalar
(the Trend Wizard `cf_slope`/`cf_macross` cluster — 31 TS7053 errors → 0).

Two converter-only promotions:

- **Cross-UDF / non-`ta.*` series locals (Part A).** A top-level `=`-decl
  whose value is series-qualified and `[n]`-indexed but is not directly a
  `ta.*` call (`ma_1_slope = cf_slope(…)`, `ma_slope_comp = … ? ta.sma :
  ta.ema`), and a simple-identifier argument passed to a stateful UDF whose
  body history-indexes the matching parameter (`cf_slope(ma_1, …)` → promote
  `ma_1`), now lower to a numeric `state.series` slot. An OHLCV argument
  (already an indexable `PriceSeries`) is left untouched.
- **History-indexed inlined body-locals (Part B).** A stateful UDF body-local
  read at `[n]` (`cf_macross`'s `ma_cross = ta.crossover(…)` read at
  `ma_cross[1]`/`[2]`) is backed by a `state.boolSeries`/`state.series` slot at
  each inline call site, so every call site gets independent history.

`request.security` reads are now `.current`-projected (data, expression, and
the new block-callback form for a stateful UDF inlined into the HTF closure),
and OHLCV reads inside a `request.security` callback project `.current` for
scalar use. No core or runtime change.

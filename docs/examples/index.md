# Examples

A catalogue of chartlang scripts — the same set you can edit live in the
[demo](https://chartlang.invinite.com/#demo). Each page shows the full source and links
back to run it in your browser.

- [EMA Cross](/examples/ema-cross) — A fast/slow EMA pair on the candles, firing alerts when the fast EMA crosses the slow one.
- [Bollinger Bands](/examples/bollinger-bands) — Bollinger Bands via ta.bb — upper, middle, and lower bands plotted over price.
- [RSI Divergence Alert](/examples/rsi-divergence-alert) — RSI(14) in its own pane with 70/30 overbought/oversold guides and alerts on each crossing.
- [Smoothed RSI Cross](/examples/smoothed-rsi-cross) — Indicator composition: one indicator feeding another, with RSI(14) smoothed by an EMA(9) of its own output.
- [Explicit Pane Routing](/examples/explicit-pane-routing) — An EMA pair on the price pane plus an RSI oscillator routed to its own subpane via explicit pane ids.
- [Manual SMA](/examples/manual-sma) — Define an SMA by hand from the price series: a bounded for loop sums bar.close[i] over the window (the loop index is sized precisely), averages the last 5 closes, and overlays ta.sma(5).
- [Trend Composition](/examples/trend-composition) — Phase-7 indicator composition: a private dependency, a named export, and a default consumer that marks crossovers.
- [HTF Trend Filter](/examples/htf-trend-filter) — Multi-timeframe: a current-timeframe EMA(20) overlaid with a true weekly EMA(20) computed ON the weekly bars via the request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20)) expression form — a smooth, lagged trend, not 20 daily bars of a weekly-stepped series.
- [SMA Offset](/examples/sma-offset) — Three SMA(20) lines: one unshifted plus a +5 copy displaced right and a −5 copy displaced left via the universal ta offset option — a presentation-only display shift (the values stay unshifted).
- [Pivot High Ray](/examples/pivot-high-ray) — Track the latest swing high's price and time in persistent state.* slots, then draw one horizontal ray from it that follows each new pivot via a reused draw.horizontalRay handle.
- [Forecast Line](/examples/forecast-line) — Project the recent EMA(20) slope 20 bars into the future with bar.point(+N, …), drawing a dotted line to the right of the last candle — the positive (future) offset path.
- [Fill between series (band)](/examples/fill-between-band) — A filled ribbon between two EMAs via draw.fillBetween — the native linefill / fill() equivalent.
- [Anchored Line](/examples/anchored-line) — One draw.line composing both X-axis anchor styles: an absolute-time start (the first bar's time and close, pinned in state.* slots) drawn to a bar-index end via bar.point(0, …), so the head stays fixed in time while the tail tracks the current bar.
- [Up Streak](/examples/up-streak) — state.series — a writable, indexable user series. Counts consecutive up-closes: the history of a value you compute yourself (here a self-referential streak defined from its own prior bar), which bar.close[N] can't express, then reads it back three bars ago.
- [Rolling Window Mean](/examples/rolling-window-mean) — state.array — a bounded collection you push many values into. Here a rolling mean over the last 20 closes: push one close per bar into a fixed-capacity FIFO ring, then iterate the ELEMENTS (a.get(i), 0 = newest) to average them. This is the bounded bag of the last K pushed values that state.series (one value's bar history) can't express.
- [Symbol Ratio](/examples/symbol-ratio) — Multi-symbol request.security: read two DIFFERENT instruments (AMEX:SPY and NASDAQ:QQQ) at the chart interval and plot their close ratio. The symbol must be a compile-time literal, and a non-chart symbol needs the adapter's multiSymbol capability — otherwise the series degrade to NaN with a multi-symbol-not-supported diagnostic.
- [Z-Order Layering](/examples/z-layering) — Use the presentation-only z option to cross render bands: a draw.fillBetween band given z: -1 renders BEHIND the price plot (a drawing beneath a plot, which the default group stack forbids), while an SMA at z: 1 sits on top.

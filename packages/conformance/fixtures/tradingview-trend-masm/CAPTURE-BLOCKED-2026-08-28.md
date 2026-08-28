# TradingView bulk export blocked — 2026-08-28

This is the authenticated TradingView settings/export log, not the bulk numeric
oracle. TradingView refused the chart-data export for the Essential account.
The owner therefore approved a separate Pine-derived oracle: exactly 3,000
adjusted TQQQ daily bars from Invinite's authenticated server-side Massive path
plus the standalone zero-import evaluator frozen beside `oracle.json`. Do not
transform the rounded UI facts in this file into expected rows and do not
substitute Chartlang output.

## Authenticated chart facts

- Chart URL: `https://www.tradingview.com/chart/HNckvQvP/`
- Saved layout: `Handy`
- Symbol: `NASDAQ:TQQQ` / ProShares UltraPro QQQ
- Interval: `1D`
- Chart timezone shown in the UI: `UTC+2`
- Adjustment: `ADJ` active (adjust data for dividends)
- Exchange: `NASDAQ`
- Session/extended hours: not exposed as a setting on the `1D` chart. TradingView
  Symbol settings showed no session or extended-hours toggle. The visible
  `Overnight via BOATS` element was a non-interactive market-status pill, not a
  pressed/checked control. The fixture therefore records `extendedHours: null`
  instead of inventing a boolean.
- TradingView build: not exposed by the accessible chart UI
- Capture time: 2026-08-28, approximately 05:23 in the chart's UTC+2 clock
- Exactly two saved scripts were on the chart: MASM first, Trend Wizard second

## Export blocker

The authenticated UI exposed **Manage layouts → Download chart data…**. The
download action opened a plan upsell instead of producing a file: the account's
current plan is Essential and chart-data export requires Premium. Therefore no
legitimate export of the requested 3,000 TQQQ daily OHLCV bars or full script
outputs exists from this capture. A current-bar data-window value or a visual
screenshot is not accepted as a replacement.

## Saved MASM inputs observed

- Script: `MASM Strat 2.3 LIVE`
- Timeframe: 2019-01-01 through 2027-01-01
- Trade Long: on
- Trade Short: off
- Source: `Trend Wizard v1.0: Tab Trend Long` (displayed as
  `Trend Wizard: Tab Trend Long`)
- Entry C1 / MA: on; LT adjustment on; factors 0.5 / 0.5
- Entry C2 / RSI: on; cutoff 2.5
- Exit C1 / MA: on; LT adjustment on; factors 0.5 / 0.5
- Exit C2 / Earnings: off
- Exit C3 / Stoploss: on; delay 11; Save Wicks off; RSI gating off
- Exit C4 / MA slope derivative: off; cutoff -0.4
- Exit C5 / RSI: off; cutoff -1.5
- Stay-long conditions: off
- Never-long conditions: off
- ATR: length 100, smoothing 50
- Guidelines: off; range 2
- Comparison mode: off
- Hide Labels: on
- Strategy / Comparison: on
- Moving average: length 21, EMA, smoothing 3, derivative smoothing 6
- Consolidation: range 1, tolerance 4
- Seven-day market: off
- Visible style channels: Background Color, MA Slope, Consolidation Overlay
  Bars, Never Long C1/C2 Cancel markers, Stay Long C Cancel, Guideline
  Top/Bottom, and pane labels/lines
- Trade-signal plots: disabled

## Saved Trend inputs observed

- Script: `Trend Wizard`
- Timeframe: Chart
- Custom symbol field: `NASDAQ:QQQ`
- Use Custom Symbol: off
- Table Outputs: on
- Plot invisible: on
- Trend: on; T2/T3/T4: off
- Short: on; Medium/Long display toggles: off
- Preset: Trade Rational Default
- Overwrite preset with settings: on
- MA 1–5: 8 EMA, 21 EMA, 50 SMA, 145 SMA, 241 SMA
- Slope MAs: all on; divisors all 1; smoothing 3/1/3/3/3
- Combine slopes: on; SMA length 1
- Combine derivatives: on; SMA length 21; scale 5
- Distances: all on; smoothing 10/4/5/8/10; combined; scale 0.1
- Crossings: only 1–2 on; smoothing 1; exclusion 2
- RSI MA: length 14; smoothing 4; RSI MA on; centered; scale 0.1;
  slope scale 2.5
- Testing booleans: all on
- Trend scaling: short 1.1, medium 1.35, long 1.9
- Visible style channels: Tab Trend Short/Medium/Long, Plot, Zero Line,
  Max/Min, Mid +/-50%, Consol Upper/Lower, and Hlines Background

## Canonical source checksums

- `Trend_Wizard.md` SHA-256:
  `4e0ec9ed37d213011a5792cb0a878881ca8c12fc85eb2a4c972ff26f77da5752`
- `MASM_Strat.md` SHA-256:
  `97dea1d3a623fdc79d4b07e0349101dc491dbbd8185eec987e5daefb17a7fb5f`

## Approved bulk-oracle substitute

The owner approved using frozen adjusted Massive bars and a transparent
Pine-derived evaluator after the Premium-only export blocker was confirmed.
TradingView remains the source of the saved input/binding snapshot and a rounded
2026-08-27 Data Window sanity anchor only. The bulk oracle's provider,
independence, checksums, tolerance, range, and expected rows live in
`oracle.json`; its integrity is enforced by `validateTrendMasmParityOracle`.

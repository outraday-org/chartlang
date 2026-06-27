---
"@invinite-org/chartlang-examples": patch
---

Add the trend / directional / trailing-stop example scripts and the
`ta-trend` catalogue fragment.

- One runnable `examples/scripts/<id>.chart.ts` per trend/directional
  primitive: `ta.ichimoku` (ichimoku-cloud), `ta.adx`
  (adx-trend-strength), `ta.dmi` (dmi-directional), `ta.aroon`
  (aroon-up-down), `ta.aroonOsc` (aroon-oscillator), `ta.psar`
  (parabolic-sar), `ta.supertrend` (supertrend), `ta.vortex`
  (vortex-indicator), `ta.chandeKrollStop` (chande-kroll-stop),
  `ta.volatilityStop` (volatility-stop), and `ta.chandelier`
  (chandelier-exit).
- Add `examples/catalogue/ta-trend.ts` crediting each primitive under
  the `ta-trend` category.

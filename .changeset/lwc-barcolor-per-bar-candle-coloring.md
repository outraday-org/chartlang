---
---

Fix the lightweight-charts reference adapter rendering `barcolor(...)` /
`bar-override` candles in their default green/red colours. `bar-color` /
`bar-override` emissions now colour the candle PER BAR via lightweight-charts'
native candlestick data-point colour fields (`color` / `borderColor` /
`wickColor`, with `borderVisible: true`), so the candle body AND border AND
wick all take the override colour for exactly that bar — replacing the old
whole-series `applyOptions` tint that left borders/wicks at their defaults and
could only show the last bar's colour. The per-bar colour resolves the dynamic
`colorValue ?? style.color` precedence (`colorValue` present overrides the
static colour; `colorValue === null` clears the override; omitted uses the
static colour). `candle-override` is unchanged (whole-series up/down tint).
`bg-color` remains the documented no-op. (Private example package; no published
surface — empty changeset.)

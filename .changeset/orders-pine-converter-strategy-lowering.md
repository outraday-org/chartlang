---
"@invinite-org/chartlang-pine-converter": minor
---

Lower `strategy.*` to `order.*` market intents instead of `alert(...)`

A converted Pine strategy used to come out as prose. `strategy.entry` became
`alert("...")` and whatever consumed the script had to guess a side from the
message text — which is precisely the convention `order.*` exists to replace.

`strategy.entry` / `strategy.order` / `strategy.close` / `strategy.exit` /
`strategy.close_all` now lower to `order.buy` / `order.sell` / `order.close`.
The direction comes from a literal `strategy.long` / `strategy.short`; every
recognised member carries its Pine positional parameter list, so a dropped
argument is reported by the name its author would recognise rather than as
`#4`. `strategy.cancel` / `cancel_all` are deliberately NOT lowered — chartlang
has no resting order to cancel, so they keep failing as `unknown-identifier`
rather than converting into something that silently does nothing.

Diagnostics — **two new codes, zero removed or renamed**:

- `pine-converter/transform/strategy-direction-assumed` (**warning**) — the
  direction argument was not a literal `strategy.long` / `strategy.short`, so the
  side could not be resolved at conversion time and `order.buy` was assumed.
- `pine-converter/transform/strategy-order-args-dropped` (**warning**) — the call
  passed arguments a market intent cannot honor (a resting `limit` / `stop`, a
  trailing stop, an OCA group, `qty_percent`, a target entry id) and they were
  dropped.

`pine-converter/parse/unsupported-strategy` **drops from `error` to `warning`**.
A `strategy(...)` declaration is no longer a dead end: it converts to an
indicator that emits real order signals, and only the backtester's own settings
(capital, sizing, commission, slippage, fill model) are ignored. If you gate on
severity, a strategy script that previously failed conversion now succeeds with
warnings. `strategy-signal-only` and `strategy-args-dropped` keep their codes and
severities and are reworded to describe the new lowering.

---
"@invinite-org/chartlang-examples": minor
---

New `orders` example category — three runnable strategy scripts

`order-ema-cross` (the canonical entry / exit round trip),
`order-rsi-reversal` (a long / short reversal driven by `order.position()`), and
`order-silent-markers` (`marker: false` plus a hand-drawn glyph, for an app that
wants its own marker art).

Each demonstrates the lag that matters in practice: `order.position()` reads the
position as of the PREVIOUS confirmed step, because the runtime folds a bar's
orders after `compute` returns — the same lag Pine's `strategy.position_size`
has. Hoisting the position read out of the branches is what keeps a run of
consecutive crossovers from stacking a second entry on an open long.

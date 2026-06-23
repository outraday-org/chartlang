---
---

Fix the lightweight-charts reference adapter ignoring a plot's `color`. The
production bridge's `addSeries` discarded its `options` argument, so every
`line` / `step-line` / `area` / `histogram` series fell back to
lightweight-charts' default series colour — a script's `plot(..., { color })`
(and a step-line's `lineType`) never reached the real chart, unlike every other
reference adapter. `defaultCreateChart` now threads the caller's creation
options through to the native series (merged OVER the default candle palette, so
an explicit colour wins). `MockLwcApi` records the `addSeries` creation
`options` so the forwarding is assertable headlessly. (Private example package;
no published surface — empty changeset.)

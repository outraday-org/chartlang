---
"@invinite-org/chartlang-examples": patch
---

Add worked examples for the state / plot / hline family — one
single-primitive default per uncovered id in the `state-plot-alert`
category: `state.int` (bar-counter), `state.float` (running-max-close),
`state.bool` (cross-latch), `state.string` (last-signal-label),
`state.tick.int` (tick-count), `state.tick.float` (tick-running-sum),
`state.tick.bool` (tick-latch), `state.tick.string` (tick-last-event),
`plot` (plot-styled, the multi-option line surface), and `hline`
(hline-guides, two oscillator guides). The `state.*` demos mutate a
persistent slot per bar so cross-bar persistence is observable; the
`state.tick.*` demos document their intrabar `varip` semantics (visually
identical on the confirmed-bar demo feed).

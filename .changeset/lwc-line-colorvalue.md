---
---

lightweight-charts reference adapter: honor the per-bar dynamic-color channel
`PlotEmission.colorValue` for the line family, completing line-family
`colorValue` across all five reference adapters. LC line / area series carry a
single creation-time colour with no per-point field, so a `colorValue`-bearing
`line` / `step-line` / `area` slot is SPLIT into consecutive same-colour RUNS,
each its own native series; a run boundary duplicates the prior bar's point so
the segments visually join, and a `colorValue:null` bar is a whitespace gap
(the run ends, no series spans it). `histogram` is simpler — LC histogram
points carry per-point `color`, so it stays one series and stamps the resolved
colour on the data point (`null` ⇒ a whitespace column). The 3-state precedence
mirrors the canvas2d reference (omitted ⇒ static colour via the single-series
path, byte-identical to the pre-feature wire; present ⇒ override; `null` ⇒
paint-nothing gap); the static top-level `color` never splits a run, so a
no-`colorValue` slot stays ONE native series and existing call-log goldens /
the conformance `plot-hash` are untouched. Native LC per-series y-scaling means
a pure-gap bar's finite value is not folded into the price scale (the
LC-managed-scaling caveat, documented). Wire-level honesty only (no script
emits line-family `colorValue` today). Private example package — no published
surface; empty changeset.

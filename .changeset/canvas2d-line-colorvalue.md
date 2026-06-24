---
---

canvas2d reference adapter: honor the per-bar dynamic-color channel
`PlotEmission.colorValue` for the line family (`line` / `step-line` /
`area` / `histogram`) under the normative 3-state precedence — omitted ⇒
static color, present ⇒ per-segment override, `null` ⇒ paint-nothing gap.
Line / step-line / area paint as consecutive same-color runs (a `null`
bar or an explicit differing `colorValue` starts a new sub-path; the
static top-level `color` never splits, so no-`colorValue` frames stay
byte-identical); histogram resolves per independent column. The 3-state
resolution lives in one shared `resolvePaintColor` helper. This
establishes the reference per-segment-recolor pattern the echarts /
konva / uplot / lightweight-charts line-family tasks mirror. Wire-level
honesty only (no script emits line-family `colorValue` today) — private
example package, no published bump.

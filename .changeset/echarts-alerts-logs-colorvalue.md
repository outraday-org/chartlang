---
---

echarts example adapter: render the declared `alertConditions` + `logs`
capabilities as always-on-top `graphic.text` overlay panels (a right-anchored
fired-condition list + a bottom-left latest-log pane, mirroring the canvas2d
reference layout), and honour per-bar line-family `colorValue` by splitting
line / step-line / area series into consecutive same-paint runs (omitted ⇒ the
static colour, a string ⇒ a per-bar override, `null` ⇒ a paint-nothing gap). A
series with no per-bar `colorValue` stays one byte-identical series. Private
example package — no published version bump.
</content>
</invoke>

---
---

konva example adapter: render `alertConditions` (fired-only, top-right strip)
and `logs` (latest 5, bottom-left pane) as always-on-top `Text` nodes —
mirroring the canvas2d reference's `drawAlertConditions` / `drawLogPane` in the
konva node model (painted after the per-pane z-sorted pass, not sortable by
`z` in v1). Honour line-family `colorValue` (3-state: omitted ⇒ static color,
present ⇒ override, `null` ⇒ paint-nothing gap) for line / step-line / area
(split into consecutive same-color runs — the static `color` never splits a
run) and histogram (per column; `null` ⇒ skip column), via the new konva-local
`resolvePaintColor` helper. The `colorValue` is orthogonal to the y-scale (a
finite value with `colorValue:null` still folds into the price range; only the
paint is suppressed). All capability flags are now backed by real rendering.
Private example package — no published version bump.

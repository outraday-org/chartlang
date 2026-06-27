---
"@invinite-org/chartlang-examples": patch
---

Add `draw-lines` example scripts: one runnable `.chart.ts` per uncovered
line/ray `draw.*` kind — `draw.arrow` (`pivot-arrow`), `draw.horizontalLine`
(`swing-high-level`), `draw.verticalLine` (`cross-event-marker`),
`draw.crossLine` (`pivot-crosshair`), `draw.trendAngle` (`trend-angle-slope`),
`draw.sineLine` (`sine-wave-cycle`), `draw.polyline` (`pivot-polyline`), and
`draw.path` (`swing-path`) — each anchored via `bar.point` / tracked `state.*`
swing points and reusing one drawing handle, with a matching `draw-lines`
catalogue fragment crediting each primitive. `draw.line`, `draw.horizontalRay`,
and `draw.fillBetween` are already covered by migrated defaults and are skipped.

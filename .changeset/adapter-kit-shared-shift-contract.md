---
"@invinite-org/chartlang-adapter-kit": minor
---

Add the shared bar-shift projection contract (`geometry/shift.ts`) so every
adapter honours the universal plot `offset` (`PlotEmission.xShift`) identically.
New public exports: `medianBarSpacing`, `shiftedBarTime`, `projectShiftedX`
(promoted out of the canvas2d reference adapter), plus `maxShiftedTime` (widen a
self-scaled adapter's `xMax` for a `+k` future-projected point) and
`shiftedBarIndex` (the category/index analogue for declarative adapters). The
three rendering models — self-scaled time (canvas2d, konva), category/index
(echarts), and aligned/native-time (uplot, lightweight-charts) — now share one
pure, fully-covered implementation instead of four divergent ports, which is
what let four of the five reference adapters silently drop the offset and
collapse multi-plot/offset scripts onto a single x-position. An omitted / `0`
`xShift` reproduces the unshifted projection byte-for-byte, so no rendering
goldens change from this addition.

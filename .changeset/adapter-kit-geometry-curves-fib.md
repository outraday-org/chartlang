---
"@invinite-org/chartlang-adapter-kit": minor
---

Extend the `adapter-kit` geometry layer with 20 more drawing-kind decomposers —
3 curves (`arc`, `curve`, `double-curve`), 3 freehand (`pen`, `highlighter`,
`brush`), 4 channels (`trend-channel`, `flat-top-bottom`, `disjoint-channel`,
`regression-trend`), and 10 fibonacci (`fib-retracement`, `fib-trend-extension`,
`fib-channel`, `fib-time-zone`, `fib-wedge`, `fib-speed-fan`, `fib-speed-arcs`,
`fib-spiral`, `fib-circles`, `fib-trend-time`). `decomposeDrawing` now covers 40
of the 63 kinds; the remaining 23 return `[]` until Task 3.

Add an optional `StrokeStyle.alpha` IR field (backward-compatible — omitted
strokes are byte-identical to before): `paintPrimitive` brackets the `stroke()`
in `globalAlpha` when set, expressing the `highlighter` translucency.

Move the shared `FIB_LEVELS` ratio array + `formatLevel` label formatter into a
package-private `geometry/_lib/fibLevels.ts`, reused by every fib decomposer.

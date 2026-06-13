---
"chartlang-example-canvas2d-adapter": patch
---

Add three pure canvas2d render helpers for subpane rendering:
`computePaneLayout` (splits a canvas into a 70% price pane + N uniform
subpanes, last subpane absorbing the rounding remainder),
`clearPaneRect` (fills one pane rect with the background colour), and
`drawPaneSeparator` (1px divider at the top of a subpane, half-pixel
aligned). Each ships with its own call-sequence unit test and is
re-exported from `src/render/index.ts`. The helpers are not yet wired
into `createCanvas2dAdapter.ts` — that integration lands in the next
step of the `subpane-rendering` feature.

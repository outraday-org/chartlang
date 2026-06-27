---
"@invinite-org/chartlang-examples": patch
---

Add one runnable example per shape / freehand `draw.*` kind under the
`draw-shapes` category — `draw.circle`, `draw.ellipse`, `draw.arc`,
`draw.rectangle`, `draw.rotatedRectangle`, `draw.triangle`, `draw.frame`,
`draw.curve`, `draw.doubleCurve`, `draw.brush`, `draw.pen`, and
`draw.highlighter` — each anchored over a recent window via `bar.point`
and reusing one drawing handle, and credit their primitives so the
coverage allowlist can shrink by these ids.

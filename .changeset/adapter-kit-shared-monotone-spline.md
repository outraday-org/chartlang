---
"@invinite-org/chartlang-adapter-kit": minor
---

Promote `monotoneCubicSegments` to the public geometry surface so every
smoothing adapter samples one monotone-cubic (Fritsch–Carlson) curve source
instead of forking it per adapter (the bug class the `shift.ts` /
`renderOrder.ts` promotions exist to kill). New public exports on the geometry
barrel and the root barrel:

- `monotoneCubicSegments(pts: ReadonlyArray<Point2>): BezierSegment[]` — converts
  a polyline into monotone-cubic Bézier segments that pass **through** every
  point with **no overshoot** (safe on indicator data). A canvas2d adapter
  issues one `bezierCurveTo` per segment; a GPU adapter samples each segment
  into denser line-strip points.
- `BezierSegment` — the per-segment control-points + end-point type.

Moved verbatim out of the canvas2d reference adapter's
`render/monotoneSpline.ts` (now a bare re-export); behaviour is byte-identical,
so the canvas2d goldens are untouched. The webgl example adapter samples it for
its default smooth `line` plots.

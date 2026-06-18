# `draw.*` primitives

The `draw.*` namespace is chartlang's drawing surface — 61 imperative
primitives that emit a `DrawingHandle` the script can update or remove
across bars. Each primitive's page on this index is **auto-generated**
from the runtime's JSDoc by `chartlang docs` (see
[`packages/cli/src/commands/extractDrawingPages.ts`](../../../packages/cli/src/commands/extractDrawingPages.ts)).
This index page is hand-maintained.

The per-kind
[`DrawingState`](../../../packages/core/src/draw/drawingState.ts)
variants pin the wire shape and the
[`KIND_BUCKET`](../../../packages/core/src/draw/buckets.ts) table
pins the `DrawingCounts` budget bucket every kind maps to.

## Anchoring drawings: `WorldPoint` and `bar.point`

Every `draw.*` anchor argument is a `WorldPoint` — a `{ time, price }`
pair in the chart's world coordinates. Drawings persist **only** that
shape; there is no bar-index anchor on the wire.

You can build a `WorldPoint` two ways:

- **Literally**, when you already have an absolute time — typically the
  current bar:

  ```ts
  draw.line({ time: bar.time, price: bar.close }, { time: bar.time, price: bar.open });
  ```

- **With `bar.point(offset, price)` sugar**, when you want to anchor by
  integer bar offset instead of a literal timestamp. `offset === 0` is the
  current bar, `offset < 0` is `N` bars back (real historical time), and
  `offset > 0` is a future bar (time extrapolated from recent bar spacing):

  ```ts
  // From the close 10 bars ago to the current close.
  draw.line(bar.point(-10, bar.close), bar.point(0, bar.close));
  ```

`bar.point` is authoring sugar only — it resolves to the same
`WorldPoint` shape and introduces no new anchor kind. Reach for it when
your anchor is naturally relative ("10 bars ago", "5 bars ahead"); use a
literal `{ time, price }` when you already hold an absolute timestamp.

For the full offset semantics — historical resolution, future
extrapolation, and how negative literal offsets size the runtime's time
buffer — see
[Series and indexing § Anchoring drawings by bar offset](../../language/series-and-indexing.md#anchoring-drawings-by-bar-offset-bar-point).

## Lines / Rays (6)

- [`draw.line`](./line.md)
- [`draw.horizontalLine`](./horizontal-line.md)
- [`draw.horizontalRay`](./horizontal-ray.md)
- [`draw.verticalLine`](./vertical-line.md)
- [`draw.crossLine`](./cross-line.md)
- [`draw.trendAngle`](./trend-angle.md)

## Boxes / Shapes (8)

- [`draw.rectangle`](./rectangle.md)
- [`draw.rotatedRectangle`](./rotated-rectangle.md)
- [`draw.triangle`](./triangle.md)
- [`draw.polyline`](./polyline.md)
- [`draw.circle`](./circle.md)
- [`draw.ellipse`](./ellipse.md)
- [`draw.path`](./path.md)
- [`draw.marker`](./marker.md)

## Curves (3)

- [`draw.arc`](./arc.md)
- [`draw.curve`](./curve.md)
- [`draw.doubleCurve`](./double-curve.md)

## Freehand (3)

- [`draw.pen`](./pen.md)
- [`draw.highlighter`](./highlighter.md)
- [`draw.brush`](./brush.md)

## Annotations (5)

- [`draw.text`](./text.md)
- [`draw.arrow`](./arrow.md)
- [`draw.arrowMarker`](./arrow-marker.md)
- [`draw.arrowMarkUp`](./arrow-mark-up.md)
- [`draw.arrowMarkDown`](./arrow-mark-down.md)

## Channels (4)

- [`draw.trendChannel`](./trend-channel.md)
- [`draw.flatTopBottom`](./flat-top-bottom.md)
- [`draw.disjointChannel`](./disjoint-channel.md)
- [`draw.regressionTrend`](./regression-trend.md)

## Fibonacci (10)

- [`draw.fibRetracement`](./fib-retracement.md)
- [`draw.fibTrendExtension`](./fib-trend-extension.md)
- [`draw.fibChannel`](./fib-channel.md)
- [`draw.fibTimeZone`](./fib-time-zone.md)
- [`draw.fibWedge`](./fib-wedge.md)
- [`draw.fibSpeedFan`](./fib-speed-fan.md)
- [`draw.fibSpeedArcs`](./fib-speed-arcs.md)
- [`draw.fibSpiral`](./fib-spiral.md)
- [`draw.fibCircles`](./fib-circles.md)
- [`draw.fibTrendTime`](./fib-trend-time.md)

## Gann (4)

- [`draw.gannBox`](./gann-box.md)
- [`draw.gannSquareFixed`](./gann-square-fixed.md)
- [`draw.gannSquare`](./gann-square.md)
- [`draw.gannFan`](./gann-fan.md)

## Pitchforks (2)

- [`draw.pitchfork`](./pitchfork.md)
- [`draw.pitchfan`](./pitchfan.md)

## Harmonic Patterns (6)

- [`draw.xabcdPattern`](./xabcd-pattern.md)
- [`draw.cypherPattern`](./cypher-pattern.md)
- [`draw.headAndShoulders`](./head-and-shoulders.md)
- [`draw.abcdPattern`](./abcd-pattern.md)
- [`draw.trianglePattern`](./triangle-pattern.md)
- [`draw.threeDrivesPattern`](./three-drives-pattern.md)

## Elliott Waves (5)

- [`draw.elliottImpulseWave`](./elliott-impulse-wave.md)
- [`draw.elliottCorrectionWave`](./elliott-correction-wave.md)
- [`draw.elliottTriangleWave`](./elliott-triangle-wave.md)
- [`draw.elliottDoubleCombo`](./elliott-double-combo.md)
- [`draw.elliottTripleCombo`](./elliott-triple-combo.md)

## Cycles (3)

- [`draw.cyclicLines`](./cyclic-lines.md)
- [`draw.timeCycles`](./time-cycles.md)
- [`draw.sineLine`](./sine-line.md)

## Containers (2)

- [`draw.group`](./group.md)
- [`draw.frame`](./frame.md)

## Regenerating

```bash
pnpm docs:generate     # runs `chartlang docs` — refreshes ta + draw
pnpm docs:gate         # CI gate — fails on any per-page drift
```

The gate diffs the regenerated pages against the committed tree
byte-for-byte. Hand-edits to any `<kebab-kind>.md` page (except this
`index.md`) are rejected.

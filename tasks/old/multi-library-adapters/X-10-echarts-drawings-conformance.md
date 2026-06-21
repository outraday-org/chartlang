# ECharts adapter: drawings + conformance

> **Status: TODO**

## Goal

Complete the ECharts adapter: render all 63 drawing kinds via the ECharts
`graphic` component by mapping `decomposeDrawing(emission, viewport)` →
ECharts graphic elements (`line`/`polyline`/`polygon`/`text`/`arc`/`sector`).
Build the `Viewport` from ECharts' pixel conversion of the grid extents.
Add the recorded-graphic integration test, wire conformance, ship README +
docs.

## Prerequisites

- Task 9 (ECharts scaffold + series).
- Tasks 1–3.

## Current Behavior

After Task 9 the adapter renders candles/plots/panes and buffers drawings
without rendering them.

## Desired Behavior

Drawings render as `graphic` elements; adapter is full-surface,
conformance-green.

## Requirements

### 1. Primitive → graphic mapper — `src/primitiveToGraphic.ts`

ECharts is **not** ctx-based, so map the IR (not `paintPrimitive`):

```ts
import type { DrawPrimitive } from "@invinite-org/chartlang-adapter-kit";

export function primitiveToGraphic(p: DrawPrimitive): EChartsGraphicElement {
    switch (p.kind) {
        case "polyline": return p.closed
            ? { type: "polygon", shape: { points: p.points.map(pt => [pt.x, pt.y]) },
                style: { stroke: p.stroke?.color, lineWidth: p.stroke?.width,
                         lineDash: p.stroke?.dash, fill: p.fill?.color, opacity: p.fill?.alpha } }
            : { type: "polyline", shape: { points: ... }, style: { ...stroke, fill: "none" } };
        case "arc":   return { type: "arc",  shape: { cx: p.cx, cy: p.cy, r: p.r,
                                  startAngle: p.start, endAngle: p.end }, style: {...} };
        case "text":  return { type: "text", x: p.x, y: p.y,
                                  style: { text: p.text, fill: p.color, font: p.font,
                                           align: p.align, verticalAlign: p.baseline,
                                           backgroundColor: p.bgColor } };
        case "marker": return markerGraphic(p);  // small polygon/circle per shape
    }
}
```

Honor `StrokeStyle.dash` → `lineDash`, `StrokeStyle.alpha`/`FillStyle.alpha`
→ `opacity`. Graphic elements use **pixel** coordinates — which is exactly
what `decomposeDrawing` produces.

### 2. Viewport from ECharts — `src/viewport.ts`

Build the `Viewport` so adapter-kit's linear projection matches ECharts'
grid pixels: sample `chart.convertToPixel({ gridIndex: 0 }, [time, price])`
at the visible x/y extremes to derive `xMin/xMax/yMin/yMax` +
`pxWidth/pxHeight`. (ECharts value axes are linear; time axis linear in ms.)
Verify against `convertToPixel` in a test. Account for the grid's
`left/top` offset.

### 3. Render drawings — extend `createEChartsAdapter`

On each drain, after building series, set the `graphic` array:

```ts
const view = buildViewport(chart);
const graphics = [...state.drawings.values()]
    .filter(d => d.op !== "remove")
    .flatMap(d => decomposeDrawing(d, view).map(primitiveToGraphic));
chart.setOption({ graphic: graphics }, { replaceMerge: ["graphic"] });
```

### 4. Integration test — `src/integration.test.ts`

Inline indicator emitting plots + drawings, driven through the factory
with `MockECharts`; assert the recorded `graphic` element tree (types,
points, styles) for representative kinds (line, rectangle→polygon,
fib→multiple polylines+texts, marker). Pin a stable hash of the graphic
tree (canonicalise floats to 4 dp using the adapter-kit canonicaliser).

### 5. Conformance test — `src/conformance.test.ts`

`runConformanceSuite(default)` → `failed === 0`.

### 6. README + docs

- `README.md` (≤ 100 lines): purpose, install, public surface,
  graphic-mapping note, license.
- `docs/adapters/reference/echarts.md` (per-library pages live under
  `docs/adapters/reference/`, matching the established vitepress
  convention; Task 13 wires the nav).

### Edge cases

- `op: "remove"` filtered out; `replaceMerge` clears stale graphics.
- NaN anchors → NaN pixel → skip the element (filter non-finite points to
  avoid ECharts warnings) — document this divergence from ctx no-op.
- Closed vs open polyline → `polygon` vs `polyline`.
- `marker` shapes mapped to the correct small graphic per shape enum.
- Grid offset applied so graphics align with the candlestick series.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `.../src/primitiveToGraphic.ts` (+test) | Create | IR → ECharts graphic |
| `.../src/viewport.ts` (+test) | Create | `Viewport` from `convertToPixel` |
| `.../src/createEChartsAdapter.ts` | Modify | set `graphic` from drawings |
| `.../src/integration.test.ts` | Create | hashed graphic-tree integration |
| `.../src/conformance.test.ts` | Create | conformance green |
| `.../README.md` | Modify | full surface docs |
| `docs/adapters/reference/echarts.md` | Create | adapter guide |
| `examples/echarts-adapter/CLAUDE.md` | Modify | graphic-mapping; NaN-filter note |

## Gates

- `pnpm typecheck` / `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm conformance`
- `pnpm docs:check` / `pnpm readme:check`

## Changeset

Private example → no public changeset (patch if repo changesets privates).

## Acceptance Criteria

- All 63 drawings map to ECharts `graphic` elements via
  `decomposeDrawing`+`primitiveToGraphic`; hashed integration test pinned;
  viewport verified against `convertToPixel`.
- `runConformanceSuite(default)` → `failed === 0`.
- README ≤ 100 lines; docs page added; CLAUDE.md updated.
- 100% coverage; all gates green.

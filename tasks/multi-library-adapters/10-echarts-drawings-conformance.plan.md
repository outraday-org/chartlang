# Plan — Task 10: ECharts adapter drawings + conformance

## Context

Task 9 (echarts scaffold + declarative `setOption` series, drawings BUFFERED in
`state.drawings`) is COMPLETE. ECharts is **not** ctx-based, so this task maps
the shared `DrawPrimitive` IR (from `decomposeDrawing`, in
`@invinite-org/chartlang-adapter-kit`) → ECharts `graphic` component elements
(`polyline` / `polygon` / `arc` / `text` / small-glyph) rather than
`paintPrimitive`. It builds the `Viewport` from ECharts' grid pixel extents,
adds the recorded-graphic integration test, the in-package conformance test,
and the reference docs.

## Validated references

- `DrawPrimitive` / `StrokeStyle` / `FillStyle` / `Point2` / `Viewport` +
  `decomposeDrawing(e: DrawingEmission, view: Viewport)` →
  `ReadonlyArray<DrawPrimitive>` — adapter-kit barrel (dist verified). The IR is
  the four shapes `polyline` (open or `closed`) | `arc` (cx,cy,r,start,end) |
  `text` (x,y,text,color,font,align,baseline,bgColor?) | `marker`
  (shape,x,y,size). `decomposeDrawing` produces PIXEL coords already.
- ECharts `graphic`: `EChartsOption["graphic"]` is
  `GraphicComponentLooseOption | GraphicComponentLooseOption[]` (exported as
  `GraphicComponentOption`). A ZRPath graphic element is `{ type?: string;
  x?/y? (via TransitionOptionMixin); shape?: Dictionary<any>; style?:
  PathStyleProps }`; a text element is `{ type: "text"; x?; y?; style:
  TextStyleProps }`. `PathStyleProps` carries `stroke` / `fill` / `lineWidth` /
  `lineDash` / `opacity`; `TextStyleProps` carries `text` / `fill` / `font` /
  `align` / `verticalAlign` / `backgroundColor`. arc shape uses
  `cx/cy/r/startAngle/endAngle`.
- `runConformanceSuite(adapter)` → `{ passed, failed, failures, scenarios }`;
  `ALL_SCENARIOS` from `@invinite-org/chartlang-conformance`. Reads
  `capabilities` only, so the **default** export (capabilities-only) is the
  conformance subject — full drawing set already declared in Task 9.
- Task-9 `createEChartsAdapter` buffers drawings in `state.drawings`
  (`applyDrawing`: `op:"remove"` deletes, else last-write by `handleId`);
  `buildOption(state)` returns the option tree. I extend `buildOption` to set
  `option.graphic` from `state.drawings`.

## Design decisions

1. **`EChartsGraphicElement` is a narrow, self-documented union** assignable to
   echarts' `GraphicComponentLooseOption`, not the raw echarts type (which is
   `Dictionary<any>`-loose and would lose all safety). `primitiveToGraphic`
   returns this narrow type; `buildOption` asserts the array satisfies
   `EChartsOption["graphic"]` at the single assignment boundary (assignability
   verified by `pnpm typecheck`, no `as`).
2. **Pure mapper.** `src/primitiveToGraphic.ts` is a pure
   `DrawPrimitive → EChartsGraphicElement` switch (exhaustive `never` default
   guard mirroring decompose). polyline→`polyline` (open) / `polygon`
   (`closed`); arc→`arc`; text→`text`; marker→a small graphic per `shape`
   (`circle`→`circle`; `square`/`diamond`/`triangle-up`/`triangle-down`→
   `polygon` with the shape's vertices). Stroke→`style.stroke`/`lineWidth`/
   `lineDash` (omit `lineDash` when dash is `[]` → solid); fill→`style.fill`
   + `style.fillOpacity` (FillStyle.alpha). `StrokeStyle.alpha` →
   `style.strokeOpacity`. Omitted stroke/fill → those style keys omitted
   (no `fill:"none"` literal — ECharts treats a missing `fill` as no-fill;
   omission keeps the option tree minimal + the hash stable).
3. **`buildViewport(chart, state)`** (`src/viewport.ts`). ECharts'
   `convertToPixel({ gridIndex: 0 }, [valueX, valueY])` maps a
   value-coordinate to a pixel. But chartlang drawings anchor on bar TIME /
   PRICE while the adapter's x-axis is a **category** axis of bar times — so the
   `Viewport`'s `xMin/xMax` are bar TIMES and `decomposeDrawing` does the linear
   time→x projection. I sample two grid corners via `convertToPixel` to obtain
   the grid's pixel rect (`left/top` offset + `pxWidth/pxHeight`) and the visible
   price extent, and derive `xMin/xMax` from the bar-time range. `convertToPixel`
   is DOM/layout-bound (only meaningful on a real laid-out chart), so the
   production sampler is `v8 ignore`d the same way Task 9 ignores genuinely
   DOM-bound lines; the PURE math (`computeViewport` taking sampled corners +
   extents) is fully unit-tested and verified against the linear-projection
   identity. **`EChartsSurface` gains an optional `convertToPixel?`** (the mock
   provides it for the viewport test); when absent (default/headless or a chart
   not yet laid out) `buildViewport` returns a deterministic fallback viewport
   so `buildOption` never throws.
4. **NaN-anchor filter (documented divergence).** ECharts emits console
   warnings for non-finite graphic coords, so `primitiveToGraphic`-fed points
   are filtered: a polyline/polygon drops non-finite points (empty → element
   skipped), an arc/text/marker with any non-finite coord is skipped entirely.
   This diverges from the ctx adapters (which paint a no-op path); documented in
   README + CLAUDE.md. Filtering lives in `buildOption`'s graphic assembly
   (`flatMap` returns `[]` for a skipped element) so `primitiveToGraphic` stays
   a total pure function.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/primitiveToGraphic.ts` (+`.test.ts`) | Create | pure IR → `EChartsGraphicElement` |
| `src/viewport.ts` (+`.test.ts`) | Create | `buildViewport` + pure `computeViewport` |
| `src/createEChartsAdapter.ts` | Modify | set `option.graphic` from `state.drawings` (skip `op:"remove"` already done in `applyDrawing`); NaN-filter |
| `src/types.ts` | Modify | add optional `convertToPixel?` to `EChartsSurface` |
| `src/testing.ts` | Modify | `MockECharts.convertToPixel` (records + returns a deterministic linear pixel) |
| `src/integration.test.ts` | Modify | add drawings to the inline indicator; re-pin `hashOptionLog`; assert graphic tree for line / rectangle→polygon / fib / marker |
| `src/conformance.test.ts` (+) | Create | `runConformanceSuite(default)` → `failed === 0` |
| `README.md` | Modify | graphic-mapping note + NaN divergence (≤100 lines) |
| `docs/adapters/reference/echarts.md` | Create | adapter guide |
| `examples/echarts-adapter/CLAUDE.md` | Modify | graphic-mapping + NaN-filter invariants; drop "deferred to Task 10" |

## Coverage strategy

- `primitiveToGraphic.test.ts`: every IR kind + closed/open + dash/solid +
  alpha present/absent + stroke/fill present/absent + every marker shape + the
  `never` default-guard (unknown-kind cast).
- `viewport.test.ts`: `computeViewport` linear identity (project a known value →
  matches `convertToPixel`); fallback path (no `convertToPixel`); grid offset.
- `createEChartsAdapter.test.ts`: drive a drawing emission through ingest +
  `setOption`, assert `option.graphic` populated; NaN-anchor → element skipped;
  `op:"remove"` → graphic dropped; empty drawings → `graphic: []`.
- `testing.test.ts`: `MockECharts.convertToPixel` records + returns.
- Genuinely DOM-bound `buildViewport` production sampler lines → `v8 ignore`
  (mirroring Task 9), pure math 100% covered.

## Conventions

- MIT header; no `any` / no `!` / no incompatible `as`; `import type`.
- Consume shared IR ONLY via `@invinite-org/chartlang-adapter-kit`.
- JSDoc `@since 1.5` + `@example` + `@experimental` on new exports.
- Private example → NO changeset.

## Gates

- `pnpm --filter chartlang-example-echarts-adapter test` (100% coverage).
- Final: `pnpm typecheck`, `pnpm lint`, `pnpm readme:check`, `pnpm docs:check`
  reported to lead.

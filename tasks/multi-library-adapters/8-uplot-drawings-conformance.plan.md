# Plan — Task 8: uPlot adapter drawings + conformance

## Context

Complete `examples/uplot-adapter/` by painting all 63 drawing kinds inside the
overlay/subpane `hooks.draw` pass (established in Task 7 for candles + hlines)
via `decomposeDrawing(emission, viewport)` → `paintPrimitive(u.ctx, prim)`, with
the `Viewport` built from uPlot's scales + bbox. Add the hashed integration
test, the in-package conformance test, the README full-surface docs, and the
`docs/adapters/reference/uplot.md` adapter guide. Extend the EXISTING draw hook
(`paintPaneOverlay`) — do NOT add a parallel hook.

## Validated references

- `@invinite-org/chartlang-adapter-kit`: `decomposeDrawing`, `timeToX`,
  `priceToY`, `Viewport`, `DrawPrimitive` — CONFIRMED in dist `index.d.ts`.
- `@invinite-org/chartlang-adapter-kit/canvas`: `paintPrimitive`, `RenderCtx`,
  `MockCanvasContext`, `hashCallLog` — CONFIRMED in dist `canvas/index.d.ts`.
- `@invinite-org/chartlang-conformance`: `runConformanceSuite(adapter, opts?)`
  → `Promise<ConformanceReport>` with `{ passed, failed, scenarios }`;
  `ALL_SCENARIOS`. CONFIRMED in dist.
- uPlot v1.6.32 surface: `u.scales[key].min/max`, `u.bbox.{left,top,width,
  height}` (canvas px), `u.valToPos(val, scaleKey, canvasPixels?)`,
  `u.ctx` (CanvasRenderingContext2D ⊇ RenderCtx). CONFIRMED in bundled
  `uPlot.d.ts`.

## dpr / offset decision (resolved from the Task-7 contract, not guessed)

Task 7 paints candles + hlines into `u.ctx` in **CSS pixels** using a viewport
whose `pxWidth/pxHeight` are CSS px (`computePaneViewportFor`), with hline y from
`u.valToPos(price,"y",true)` and x spanning `[0, viewport.pxWidth]` (plot-area
origin). The headless `MockUplot.valToPos` is a pure CSS-px linear stub
(no dpr, no bbox offset). So the established headless contract is
**plotting-area-relative CSS px**.

For drawings I build a `Viewport` from uPlot's own scales + bbox so adapter-kit's
`timeToX`/`priceToY` REPRODUCE `u.valToPos(val, key, true)`:

- `xMin/xMax = u.scales.x.min/max`, `yMin/yMax = u.scales.y.min/max`.
- `pxWidth = u.bbox.width / dpr`, `pxHeight = u.bbox.height / dpr` (CSS px).
- The bbox `left/top` plot-area offset is **folded into the viewport** by adding
  `u.bbox.left/dpr` / `u.bbox.top/dpr` to the projected pixel — implemented by
  decomposing in plot-area space then translating the ctx by the CSS-px offset
  ONCE around the drawing pass (so `decomposeDrawing`'s pure plot-area output
  lands at the same canvas pixel uPlot's series use). DOCUMENTED in viewport.ts.

I VERIFY in `viewport.test.ts` that, after the offset translate, painting a point
at `worldPointToPixel(p, view)` lands at `(valToPos(time,"x"), valToPos(price,
"y"))` by sampling several `(time, price)` pairs against a stub `valToPos`.

Because the headless mock keeps dpr=1 and bbox offset=0, the offset translate is
`translate(0,0)` under test (a no-op the hash absorbs); the real-DOM dpr/offset
path rides the same code and is covered by the sampling test against the stub.

## Steps

1. **`src/viewport.ts` (+ `viewport.test.ts`)** — `buildViewport(u): Viewport`
   reading `u.scales.x`, `u.scales.y`, `u.bbox`, `devicePixelRatio`. Export
   `UPLOT_PRICE_SCALE = "y"`. Extend `UplotLike` (in createUplotAdapter.ts) with
   `readonly scales` + `readonly bbox` so `buildViewport` is testable headlessly;
   extend `MockUplot` to expose them (driven off the last `setScale("y")` +
   constructed dims). Add an `offsetForViewport(u)` helper returning the CSS-px
   `{ dx, dy }` plot-area offset.
2. **`src/createUplotAdapter.ts`** — in `paintPaneOverlay`, AFTER the hlines
   loop, build `const view = buildViewport(u)`, `ctx.save()` + `ctx.translate(dx,
   dy)`, then `for (const d of state.drawings.values()) { if (d.op === "remove")
   continue; for (const prim of decomposeDrawing(d, view)) paintPrimitive(ctx,
   prim); }`, `ctx.restore()`. (`op:"remove"` is already dropped at ingest by
   `applyDrawing`, but the guard is kept per the task spec + defensive.)
   Drawings render in EVERY pane's hook (matches canvas2d overlay-tail behaviour
   where drawings live in the overlay; subpanes get their own viewport — a
   sub-pane drawing still decomposes against that pane's scales).
3. **`src/integration.test.ts`** — mirror canvas2d: an inline `{ manifest,
   compute }` bundle emitting plots + a `draw.line` + a `draw.rectangle`, driven
   through `createUplotAdapter` with `makeMockUplotFactory` + the real worker
   shim (MessageChannel pair, cribbed from canvas2d integration). After the loop,
   `runDraw()` the overlay, assert structural calls (fillRect candles, drawing
   strokes), and pin `hashCallLog(overlay.ctx.calls)` to a constant.
4. **`src/conformance.test.ts`** — `runConformanceSuite(DEFAULT_ADAPTER)` →
   `report.failed === 0`, `report.passed === ALL_SCENARIOS.length`.
5. **`src/index.ts` (+ index.test.ts)** — export `buildViewport`,
   `UPLOT_PRICE_SCALE`; assert in the barrel test.
6. **`README.md`** — update the drawings line (no longer "land in Task 8");
   document the draw-hook decomposeDrawing/paintPrimitive rendering + the
   viewport/offset note. Keep ≤ 100 lines.
7. **`docs/adapters/reference/uplot.md`** — adapter guide (purpose, install,
   mapping table, viewport/dpr/offset note, conformance). Task 13 wires nav.
8. **`examples/uplot-adapter/CLAUDE.md`** — replace the "drawings buffered, not
   rendered" invariant with the draw-hook drawings invariant + dpr/offset notes
   + the buildViewport/valToPos reproduction contract.

## Coverage

100% hard gate. The only genuinely DOM-bound line stays the v8-ignored
`defaultUplotFactory`. `buildViewport` + the offset translate + the drawing loop
are all exercised through `MockUplot` (its `scales`/`bbox` now populated). Mirror
Task 7's v8-ignore pattern ONLY if a new DOM-only line appears (not expected).

## Gates

- `pnpm --filter chartlang-example-uplot-adapter test` (100% coverage)
- `pnpm typecheck` / `pnpm lint` / `pnpm readme:check` / `pnpm docs:check`
- conformance green via the in-package `conformance.test.ts`

## Boundaries

- Touch ONLY `examples/uplot-adapter/**` + `docs/adapters/reference/uplot.md`.
- No changeset (private example).
- Shared geometry consumed ONLY via public adapter-kit (+ `/canvas`).

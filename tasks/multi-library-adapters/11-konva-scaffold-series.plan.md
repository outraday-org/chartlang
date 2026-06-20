# Plan — Task 11: Konva adapter (scaffold + series / candles / panes)

## Context

Implement `examples/konva-adapter/` — a private `chartlang-example-konva-adapter`
that renders chartlang candles + every plot kind + horizontal lines + sub-panes
as **Konva scene-graph nodes**. Konva is a generic 2D scene-graph with no chart
facilities, so the adapter (like canvas2d) owns its own coordinate scale: it
computes a `Viewport` from bars + stage size and projects via the shared
adapter-kit `timeToX`/`priceToY`. Drawings are declared in `Capabilities` but
NOT rendered here — that is Task 12.

The package mirrors the canvas2d reference adapter's shape: full `Capabilities`,
a headless capabilities-only `DEFAULT_ADAPTER` conformance export, a real
`createKonvaAdapter` factory with WeakMap-held state, a mock library surface
(`MockKonva`) + a hashed integration test. No browser demo; no native canvas.

## Pre-existing work (do NOT redo)

- Package scaffolded (six-file §22.4 template present): `package.json` (deps
  adapter-kit + host-worker `workspace:^`, `konva ^9`; devDeps compiler/core/
  runtime + `@types/node`; private; single `.` export), `tsconfig.json`,
  `vitest.config.ts` (identical to canvas2d: 100% thresholds, excludes
  `*.test.ts`/`index.ts`/`types.ts`/`__fixtures__`), `README.md` stub,
  `src/index.ts` (`PACKAGE_VERSION` stub) + `src/index.test.ts`.
- Registered in `pnpm-workspace.yaml`; `pnpm install` already run.
- Do NOT touch `scripts/scaffold.ts`, `pnpm-workspace.yaml`; do NOT run
  `pnpm scaffold` / `pnpm install`.

## Validated references (all confirmed against the workspace)

- `@invinite-org/chartlang-adapter-kit` barrel exports: `defineAdapter`,
  `validateEmission`, `capabilities` (with `allPhase5Plots()`,
  `allPhase3Drawings()`, `drawTable()`, `union()`), `timeToX`, `priceToY`,
  `worldPointToPixel`, types `Viewport`, `Adapter`, `Capabilities`,
  `AdapterSymInfo`, `CandleEvent`, `PlotEmission`, `PlotStyle`,
  `DrawingEmission`, `RunnerEmissions`, `DrawingKind`, `PlotKind`, `InputKind`,
  `SymInfoField`. (`packages/adapter-kit/src/index.ts`.)
- `@invinite-org/chartlang-adapter-kit/canvas` exports `hashCallLog`
  (`ReadonlyArray<RecordedCall>` → sha256, floats canonicalised to 4dp) and the
  `RecordedCall` closed union. `canonicalise()` has NO default arm — only real
  `RecordedCall` values hash meaningfully. (`packages/adapter-kit/src/canvas/`.)
- `@invinite-org/chartlang-host-worker` exports `createWorkerHost`,
  types `ScriptHost`, `WorkerLike`.
- `@invinite-org/chartlang-core` exports type `Bar` (scalar OHLCV).
- canvas2d template: `capabilities.ts`, `defaultAdapter.ts`,
  `createCanvas2dAdapter.ts` (AdapterState shape, `HANDLE_STATE` WeakMap,
  `ingest`, `computePaneViewport`, frozen `defineAdapter` handle, `dispose`
  resets + `host.dispose()`), `render/paneLayout.ts` (`PaneRect`,
  `PaneLayoutEntry`, `computePaneLayout` — overlay top 80% + uniform subpanes,
  last absorbs rounding).
- `RunnerEmissions` carries `plots`, `drawings`, `alerts`, `alertConditions`,
  `logs`, `diagnostics`. `PlotStyle` is the 16-kind union (line, step-line,
  horizontal-line, histogram, area, filled-band, label, marker, shape,
  character, arrow, candle-override, bar-override, bg-color, bar-color,
  horizontal-histogram) == `PHASE_5_PLOT_KINDS`.

## Issues found

1. **`hashCallLog` type mismatch (resolved with team lead — mapping approach).**
   `hashCallLog` is hard-typed to the canvas `RecordedCall` union with a
   no-default `canonicalise` switch, so a Konva node-tree call log cannot be
   hashed directly (would need a forbidden `as` cast AND collapse to a
   meaningless hash). Resolution: `src/testing.ts` projects each DRAWABLE Konva
   node into genuine `RecordedCall` values (Rect→`set fillStyle`+`fillRect`;
   Line→`set strokeStyle`/`lineWidth`(+`setLineDash`)/`moveTo`/`lineTo`(+
   `closePath` when closed)+`stroke`; Text→`set font`/`textAlign`/`textBaseline`
   +`fillText`; Arc→`arc`), then calls the REAL `hashCallLog`. Non-visual ops
   (`add`/`destroy`/`batchDraw`) have no `RecordedCall` variant + no geometry →
   excluded from the hash, asserted structurally on the raw recorded tree. Only
   `hashCallLog` is imported from `/canvas` — NOT the painter / MockCanvasContext.

2. **No in-package conformance test (confirmed).** Conformance runs externally
   via `scripts/run-conformance.ts` (Task 13); canvas2d has none in-package. Do
   not add `conformance.test.ts`.

3. **No static `import Konva from "konva"` (confirmed).** Importing the real
   `konva` at module top-level touches `window` and pulls native canvas. The
   factory uses `import type` only and resolves the namespace from `opts.konva`
   (mirrors canvas2d's `opts.ctx` "caller provides the surface" seam). Tests
   inject `MockKonva`; production callers pass the real `Konva`. `konva` stays a
   declared dep (typings + copy-the-example consumers).

## Improvements over a naive port

- REUSE adapter-kit `Viewport`/`timeToX`/`priceToY` (no local coords copy).
- Port ONLY pane-layout + per-pane viewport policy locally (`src/paneLayout.ts`),
  documented as the second self-scaled adapter; shared extraction deferred.
- One `KonvaSurface` structural seam (minimal Konva subset) so the factory is
  decoupled from the full `konva` typings and the mock satisfies it exactly.
- Rebuild-the-series-layer-each-drain (stateless redraw), matching canvas2d.

## Steps

1. **`src/konvaSurface.ts`** — declare the minimal structural Konva seam the
   factory + mock both satisfy: `KonvaNode` (with `add`/`destroy`), `KonvaStage`
   (`add(layer)`, `destroy()`), `KonvaLayer` (`add(node)`,
   `destroyChildren()`/`removeChildren`, `batchDraw()`), `KonvaGroup`, and node
   ctors `Rect`/`Line`/`Text`/`Group` returning `KonvaNode`; `KonvaNamespace`
   (`Stage`/`Layer`/`Group`/`Rect`/`Line`/`Text` constructors). Config bag types
   mirror the Konva v9 props used (x/y/width/height/fill/stroke/strokeWidth/
   points/closed/dash/fontSize/fontFamily/align/text/listening). `types.ts`-style
   declarations-only file → excluded from coverage. (Named `konvaSurface.ts`, not
   `types.ts`, so it can hold a couple of `as const` palette constants if needed;
   if it ends up declarations-only, rename to keep coverage clean — decide at
   implementation: KEEP runtime-free → name it `types.ts`? No: vitest excludes
   only `types.ts`/`index.ts`. Plan: make it declarations-only and name it
   `konvaSurface.ts` BUT add it to the local `vitest.config.ts` exclude is NOT
   allowed (don't edit generated config). → Decision: keep ALL runtime values
   out of this file so v8 reports 0 statements (type-only files report no
   executable lines, like `renderCtx.ts` in adapter-kit which is covered by the
   "type-only → nothing to cover" rule). Verify 100% holds; if v8 flags it, fold
   the types into `createKonvaAdapter.ts`.)
2. **`src/palette.ts`** — `KonvaPalette` + `DEFAULT_PALETTE` (candle bull/bear/
   wick, line/area/histogram defaults, hline default, bg). Frozen. Mirror
   canvas2d's `palette.ts` shape; covered by `palette.test.ts` (or asserted via
   the factory tests — prefer a tiny direct test for determinism).
3. **`src/capabilities.ts`** — `KONVA_CAPABILITIES` (frozen): `plots:
   new Set(capabilities.allPhase5Plots())`, `drawings: capabilities.union(
   capabilities.allPhase3Drawings(), capabilities.drawTable())`, alerts
   `log`/`toast`, empty inputs, maxLookback/maxTickHz, intervals,
   multiTimeframe(true), subPanes(MAX_SAFE_INTEGER), full symInfoFields,
   maxDrawingsPerScript, alertConditions(true), logs(true). `KONVA_SYM_INFO`
   (frozen demo symbol). Mirror canvas2d's `capabilities.ts`.
4. **`src/paneLayout.ts`** — port `PaneRect`/`PaneLayoutEntry`/`computePaneLayout`
   verbatim-in-behaviour from canvas2d's `render/paneLayout.ts` (overlay top
   80%, uniform subpanes, last absorbs remainder, zero subpanes → full height).
   Adapter-local layout policy (documented). `@since 1.4`.
5. **`src/defaultAdapter.ts`** — frozen headless `Adapter` `DEFAULT_ADAPTER`
   (id/name/capabilities/symInfo, resolveInputs `{}`, empty candle source,
   no-op onEmissions/dispose) + `export default DEFAULT_ADAPTER`. Mirror
   canvas2d.
6. **`src/createKonvaAdapter.ts`** — the factory:
   - `CreateKonvaAdapterOpts`: `konva: KonvaNamespace` (injected surface; NO
     default static import), `stage: { width; height }`, `candleSource`,
     optional `capabilities`/`interval`/`palette`/`resolveInputs`/`host`/
     `workerLike`.
   - `KonvaAdapterHandle = Adapter & { readonly host: ScriptHost }`.
   - `AdapterState` (WeakMap-held): bars[], paneOrder (overlay first), per-pane
     plotSeries map (`${pane}|${slotId}` → PlotPoint[]), plotSeriesStyle,
     plotOverlays (glyph/override emissions), hlines map, drawings map (buffered
     for Task 12), stage, seriesLayer, drawingsLayer, palette.
   - Build a Konva `Stage` + a series `Layer` + a (empty, for Task 12) drawings
     `Layer` via the injected namespace.
   - `onEmissions(RunnerEmissions)`: validate every plot via `validateEmission`,
     apply to state; buffer every drawing (validate + store, NO render);
     **alerts/alertConditions/logs/diagnostics validated-and-ignored (no throw,
     documented no-ops)**; then `rebuildSeriesLayer(state)` + `batchDraw()`.
   - `rebuildSeriesLayer`: `seriesLayer.destroyChildren()`; compute pane layout
     from `stage` size + paneOrder; per pane: a `Group` positioned at the pane
     rect; compute the pane `Viewport`; build candle nodes (overlay pane only:
     `Rect` body + `Line` wick per bar), plot-series nodes (line/step via
     `Line` points; area via closed `Line` + fill; histogram via per-bar `Rect`;
     filled-band via closed `Line` with a per-bar gap where bounds null),
     horizontal-line nodes (`Line` across pane), and override/style kinds mapped
     to the closest Konva facility (candle-override/bar-color → per-bar body
     `Rect` fill; bg-color → background `Rect`; bar-override → outline `Rect`;
     horizontal-histogram → per-bucket `Rect`s; shape/character/arrow/marker/
     label → `Text`/`Rect` glyph). NaN/null values skip the point/segment.
     Append each pane group to `seriesLayer`.
   - `dispose`: clear state, `stage.destroy()`, `host.dispose()`.
   - Frozen handle; `HANDLE_STATE` WeakMap; foreign-handle accessor throws a
     documented sentinel (mirror canvas2d's `runRendererLoop` guard) — exposed
     via an exported `rebuildKonvaSeries(handle)` test/host hook OR kept private;
     prefer driving render through `onEmissions` only (simpler, matches scope) +
     keep the WeakMap private. (Decide: no public runner needed for Task 11 —
     `onEmissions` does the render inline like canvas2d. Keep WeakMap purely for
     `dispose`/state; no exported foreign-handle function unless a test needs it.)
7. **`src/testing.ts`** — `MockKonva`: a `KonvaNamespace` whose constructors
   produce recording nodes. Each node records `{ type, config }` and `add`/
   `destroy`/`destroyChildren`/`batchDraw` into a shared `RecordedNode[]` tree
   (parent → children). Expose: the constructed `Stage`, a flat `recordedCalls`
   list (node creations + ops in order), and `toRecordedCallLog(): RecordedCall[]`
   that PROJECTS drawable nodes (Rect/Line/Text) into genuine `RecordedCall`
   values for `hashCallLog`. Re-export nothing from `/canvas` except importing
   `hashCallLog` + `RecordedCall` type. Exposed via package `src/testing.ts`
   (covered by `testing.test.ts`); NOT a `__fixtures__` file.
   - RESOLVED: added a `./testing` subpath export to `package.json` — the
     concurrent lightweight-charts / uplot / echarts siblings all added one, so
     konva matches for consistency (parallel to canvas2d's `./testing`).
8. **`src/index.ts`** — barrel: re-export `KONVA_CAPABILITIES`/`KONVA_SYM_INFO`,
   `DEFAULT_ADAPTER` + default, `createKonvaAdapter`, `KonvaAdapterHandle`/
   `CreateKonvaAdapterOpts`, `computePaneLayout`/`PaneRect`/`PaneLayoutEntry`,
   palette, the `KonvaNamespace`/surface types. Drop the `PACKAGE_VERSION` stub.
9. **Tests (100% coverage):** `capabilities.test.ts`, `defaultAdapter.test.ts`,
   `paneLayout.test.ts`, `palette.test.ts`, `index.test.ts` (barrel surface),
   `testing.test.ts` (MockKonva recording + `toRecordedCallLog` projection +
   `hashCallLog` stability), `createKonvaAdapter.test.ts` (drive candles + each
   plot kind + each override/style kind + hlines + multi-pane through MockKonva;
   assert the recorded node tree structure AND a pinned `hashCallLog` constant;
   edge cases: empty bars, filled-band null gap, NaN skip, pane ordering,
   alerts/logs/conditions/diagnostics validated-and-ignored, dispose, foreign/
   missing surface error paths, factory default capabilities/palette).
10. **`examples/konva-adapter/CLAUDE.md`** — invariants (self-scaled like
    canvas2d; pane-layout ported locally, shared extraction deferred;
    default-export-is-capabilities-only; Konva namespace injected via
    `opts.konva`, no static import, no node-canvas; mock node tree is the test
    surface + `hashCallLog` reuse via RecordedCall projection; drawings buffered
    but NOT rendered — deferred to Task 12; alerts/logs/conditions no-op'd).

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/konvaSurface.ts` | Create | structural Konva seam (decl-only) |
| `src/palette.ts` (+test) | Create | default palette |
| `src/capabilities.ts` (+test) | Create | full caps + symInfo |
| `src/paneLayout.ts` (+test) | Create | ported pane/viewport policy |
| `src/defaultAdapter.ts` (+test) | Create | headless conformance export |
| `src/createKonvaAdapter.ts` (+test) | Create | node-based candle/plot/pane factory |
| `src/testing.ts` (+test) | Create | `MockKonva` recorder + RecordedCall projection |
| `src/index.ts` (+ index.test.ts) | Modify | barrel + default (drop stub) |
| `examples/konva-adapter/CLAUDE.md` | Create | invariants |

## Gates

- `pnpm --filter chartlang-example-konva-adapter test` (100% coverage) — primary
  iteration gate, run sparingly.
- `pnpm typecheck`, `pnpm lint`, `pnpm readme:check` — full-workspace gates run
  by the lead/CI; I will run `npx tsc --noEmit -p examples/konva-adapter/
  tsconfig.json` + `npx biome lint examples/konva-adapter/src` locally for the
  package only.

## Acceptance checklist

- [ ] `KONVA_CAPABILITIES` declares all 16 plot kinds + 63 drawings (62 phase3 +
      table) + alerts/conditions/logs/MTF/subPanes/symInfo.
- [ ] `DEFAULT_ADAPTER` is capabilities-only + frozen + default export.
- [ ] Factory renders candles + every plot kind + hlines + multi-pane groups as
      Konva nodes through the injected namespace.
- [ ] Drawings buffered (validate+store), NOT rendered (Task 12).
- [ ] alerts/alertConditions/logs/diagnostics validated-and-ignored, no throw.
- [ ] REUSES adapter-kit `Viewport`/`timeToX`/`priceToY`; pane layout local.
- [ ] No static `import Konva from "konva"`; namespace via `opts.konva`.
- [ ] `hashCallLog` reused via RecordedCall projection (no `as`, no Konva-local
      hasher); raw node tree asserted structurally.
- [ ] No `any`, no `!`, no incompatible `as`; `import type`; MIT header on every
      new `.ts`.
- [ ] 100% line/branch/function/statement coverage.
- [ ] `examples/konva-adapter/CLAUDE.md` created.
- [ ] No changeset (private example).

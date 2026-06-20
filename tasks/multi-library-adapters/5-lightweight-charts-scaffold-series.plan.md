# Plan — Task 5: lightweight-charts adapter (scaffold + series/candles/panes)

## Context

Implement `examples/lightweight-charts-adapter/` — everything **except**
drawings (Task 6). The package is already scaffolded, wired into
`pnpm-workspace.yaml`, has the correct `package.json` deps, and
`pnpm install` has been run (verified: `node_modules/lightweight-charts`
is v5.2.0). I only author `src/*` + `CLAUDE.md`.

The reference is `examples/canvas2d-adapter/`. The shared geometry/mock
surface is consumed ONLY via the public `@invinite-org/chartlang-adapter-kit`
and `.../canvas` boundaries (verified exports below). Drawings/candles/panes
in LWC map onto **native** lightweight-charts v5 facilities, NOT hand-painted.

## Validated workspace facts

- `@invinite-org/chartlang-adapter-kit` exports: `defineAdapter`,
  `capabilities` (object with `.allPhase5Plots()`, `.allPhase3Drawings()`,
  `.union()`, `.alerts()`, `.intervals()`, `.multiTimeframe()`,
  `.subPanes()`, `.symInfoFields()`, `.maxDrawingsPerScript()`,
  `.alertConditions()`, `.logs()`), `validateEmission`, `mockCandleSource`,
  and the `Adapter`/`Capabilities`/`PlotEmission`/`PlotStyle`/`CandleEvent`/
  `AdapterSymInfo`/`RunnerEmissions`/`DrawingEmission`/etc. types.
  **`union` is `capabilities.union`, NOT a separate named export.**
- `@invinite-org/chartlang-adapter-kit/canvas` exports `hashCallLog`,
  `MockCanvasContext`, `RecordedCall`, `paintPrimitive`, `RenderCtx`.
  Task 5 only needs `hashCallLog` (reused to hash the LWC `RecordedCall[]`).
- `@invinite-org/chartlang-host-worker` exports `createWorkerHost`,
  `ScriptHost`, `WorkerLike`. `ScriptHost` = `{ load, push, drain,
  setPlotOverrides, dispose, limits }`.
- lightweight-charts v5.2 exports the series-definition consts
  `CandlestickSeries`, `LineSeries`, `AreaSeries`, `HistogramSeries`,
  the v5 unified `createChart`, and `createSeriesMarkers`. v5 API:
  `chart.addSeries(def, options?, paneIndex?)`, `chart.addPane()`,
  `chart.remove()`, `series.setData()`, `series.update()`,
  `series.applyOptions()`, `series.createPriceLine(opts)`,
  `createSeriesMarkers(series, markers)`. (Verified in
  `node_modules/lightweight-charts/dist/typings.d.ts`.)
- `PHASE_5_PLOT_KINDS` (16): line, step-line, horizontal-line, histogram,
  area, filled-band, label, marker, shape, character, arrow,
  candle-override, bar-override, bg-color, bar-color, horizontal-histogram.
- canvas2d's `vitest.config.ts` uses NO factory/render-loop coverage
  excludes — it drives the whole factory through the mock ctx to 100%.
  I mirror that: the LWC test drives every branch through `MockLwcApi`.
  The scaffolded LWC `vitest.config.ts` is already byte-identical to
  canvas2d's, so no edit is needed.

## Pre-existing work (do NOT redo)

- Six-file §22.4 template exists; `package.json` deps correct;
  workspace-registered; `pnpm install` done.

## Issues / decisions

1. **Typing the chart API.** The real `IChartApi`/`ISeriesApi` types are
   deeply generic. The factory takes a **narrow structural** `LwcChartApi`
   interface covering only the methods used (`addSeries`, `addPane`,
   `remove`). A real `createChart(container)` result is structurally
   assignable. Production callers pass `opts.chartApi` (test seam, mirrors
   canvas2d's `opts.ctx`); when omitted the factory calls the real
   `createChart` against `opts.container`. To keep coverage at 100% without
   a DOM, the real-`createChart` branch is guarded the same way canvas2d
   guards `resolveCtx` (throw if neither seam nor container resolvable),
   and tests cover both the seam path and the throw path — but I do NOT
   call the real `createChart` in tests (no DOM). **Coverage concern:** the
   real-createChart line would be uncovered. Resolution: factor chart
   resolution exactly like canvas2d's `resolveCtx` — `opts.chartApi`
   wins; else require a `createChart`-bearing container and call it. The
   test injects a mock for the seam path and asserts the throw for the
   missing-seam path. The single `createChart(...)` call line is covered by
   passing a stub `container.__createChart`-style? No — canvas2d covers its
   real `getContext` call by passing a `{ getContext }` object whose
   `getContext` returns the mock. **Mirror that exactly:** `resolveChartApi`
   reads `opts.chartApi` first; else expects `opts.container` to expose a
   structural `createChart`-like resolver is NOT how LWC works (createChart
   is a free function). Instead: accept `opts.createChart?` injectable
   (defaults to the real imported `createChart`) + `opts.container`. Test
   passes `opts.createChart: () => mock` to cover the "construct from
   container" branch AND `opts.chartApi: mock` to cover the seam branch,
   plus a throw test when neither container nor chartApi is present. This
   keeps the real `createChart` import referenced (production default) while
   every branch is test-covered without a DOM.

2. **`hashCallLog` reuse.** LWC records its own `RecordedCall[]` shape
   (different fields from the canvas mock's union). `hashCallLog` accepts
   `ReadonlyArray<RecordedCall>` from the canvas module — a different type.
   Decision: the LWC mock records calls as a flat `{ kind, ...payload }`
   structurally compatible enough? `hashCallLog`'s `canonicalise` switches
   on canvas-specific `kind`s, so feeding LWC calls would hit no case and
   throw/return undefined. **Resolution:** the LWC test hashes its log with
   a local deterministic JSON+sha256 — but the task explicitly says "reusing
   the `hashCallLog` canonicalisation approach". Re-reading: it says reuse
   the *approach*, and "import `hashCallLog` from `.../canvas`". Compromise
   that satisfies both: the LWC mock serialises each recorded call into the
   canvas `RecordedCall` vocabulary is wrong. **Final decision:** import and
   re-use `hashCallLog` by having `MockLwcApi` expose `calls: RecordedCall[]`
   typed as the canvas union is impossible (LWC ops aren't canvas ops).
   Therefore: the LWC mock records `LwcRecordedCall[]`, and `testing.ts`
   exports a local `hashLwcCallLog(calls)` that mirrors the canvas approach
   (round floats to 4dp via the same technique) AND the test ALSO imports
   `hashCallLog` from `.../canvas` to prove the boundary is consumed (used
   on an empty `[]` smoke assertion). This honours "consume via the public
   boundary" + "mirror the approach" while staying type-honest. **Flag to
   lead in report.**

   (Simpler alternative considered & chosen: make `LwcRecordedCall` a
   subset that maps cleanly — but canvas `canonicalise` is exhaustive over
   canvas kinds only, so it cannot. The local `hashLwcCallLog` mirroring the
   4dp rounding is the honest reuse.)

3. **Plot-kind mapping (native vs deferred vs no-op)** — documented in a
   header comment in `createLightweightChartsAdapter.ts` and CLAUDE.md:
   - `line` → `addSeries(LineSeries)`.
   - `step-line` → `addSeries(LineSeries, { lineType: LineType.WithSteps })`.
   - `area` → `addSeries(AreaSeries)`.
   - `histogram` → `addSeries(HistogramSeries)`.
   - `horizontal-line` → `series.createPriceLine()` on the pane's candle/
     anchor series (or a dedicated line series when overlay has candles).
   - `filled-band` → two `LineSeries` (upper/lower); the fill BETWEEN is a
     Task-6 drawing (seam documented; null upper/lower → whitespace point).
   - `shape`/`character`/`arrow`/`marker`/`label` → `createSeriesMarkers`
     on the anchored series (markers plugin). `label` text → marker `text`.
   - `candle-override`/`bar-override`/`bar-color` →
     `candleSeries.applyOptions(...)` closest native facility
     (per-point color via `update`); documented partial.
   - `bg-color` → `chart.applyOptions({ layout })` is not per-bar; LWC has
     no per-bar background band natively → **no-op, documented**.
   - `horizontal-histogram` → no native facility → Task-6 primitive path /
     **no-op, documented**.
   - **visible:false** → `series.applyOptions({ visible: false })` (hidden,
     not removed).
   - **NaN value** → emit `{ time }` whitespace point (no line break).

## Files to create / modify

| File | Action | Purpose |
|------|--------|---------|
| `src/capabilities.ts` | Create | `LWC_CAPABILITIES` (allPhase5Plots + union(allPhase3Drawings, table) + builders) + `LWC_SYM_INFO` |
| `src/capabilities.test.ts` | Create | full-surface assertions |
| `src/defaultAdapter.ts` | Create | frozen headless `DEFAULT_ADAPTER` + package default |
| `src/defaultAdapter.test.ts` | Create | shape + frozen + no-op coverage |
| `src/testing.ts` | Create | `LwcRecordedCall`, `MockLwcApi`, `createMockChart()`, `hashLwcCallLog` |
| `src/testing.test.ts` | Create | mock records every op; hash stable |
| `src/createLightweightChartsAdapter.ts` | Create | native series/candle/pane factory + `host` |
| `src/createLightweightChartsAdapter.test.ts` | Create | candles + each plot kind + hlines + panes + dispose + edge cases via mock |
| `src/index.ts` | Modify | barrel + `export { default } ` of headless adapter |
| `src/index.test.ts` | Modify | barrel asserts named + default exports |
| `CLAUDE.md` | Create | invariants: native-series map, default-export-is-capabilities-only, drawings deferred to Task 6, mock seam |

No `package.json` / `vitest.config.ts` / `tsconfig.json` edits expected
(deps + coverage already correct). No `scripts/` / `pnpm-workspace.yaml`
edits. Private package → no changeset.

## Steps

1. `src/capabilities.ts` — `LWC_CAPABILITIES` using builders:
   `plots: capabilities.allPhase5Plots()`,
   `drawings: capabilities.union(capabilities.allPhase3Drawings(), new Set(["table"]))`,
   `alerts: capabilities.alerts("log","toast")`, `inputs: new Set()`,
   `maxLookback`, `maxTickHz`, spread `intervals/multiTimeframe/subPanes/
   symInfoFields/maxDrawingsPerScript/alertConditions/logs`. Frozen.
   `LWC_SYM_INFO` frozen demo metadata. JSDoc + `@since 0.1`/`@stable`.
2. `src/defaultAdapter.ts` — mirror canvas2d `DEFAULT_ADAPTER` exactly
   (empty candle source, no-op `onEmissions`/`dispose`, empty
   `resolveInputs`). Export as named `DEFAULT_ADAPTER`.
3. `src/testing.ts` — `LwcRecordedCall` union (addSeries{type}, setData,
   update, applyOptions, createPriceLine, createSeriesMarkers,
   setMarkers, addPane, remove). `MockSeries`/`MockChart` record into a
   shared log. `createMockChart()` → `{ chart, calls }`. `hashLwcCallLog`
   mirrors canvas 4dp rounding.
4. `src/createLightweightChartsAdapter.ts` — narrow `LwcChartApi` +
   `LwcSeriesApi` structural types; `LwcAdapterHandle = Adapter & { host }`;
   WeakMap state; `resolveChartApi(opts)`; ingest via `validateEmission`;
   per-`slotId` series creation keyed by `${pane}|${slotId}`; pane routing
   (`overlay`→0, `new`→`addPane()`, named→stable index map); candle
   mapping (`history`→setData, `close`→push+update, `tick`→update last);
   plot-kind switch (native/deferred/no-op per decision 3); dispose →
   `chart.remove()`. Buffer drawings for Task 6 (store, no render).
5. `src/index.ts` — barrel re-exports + `export { DEFAULT_ADAPTER as default }`.
6. Tests for 100% coverage of every authored non-barrel file.
7. `CLAUDE.md`.

## Gates

- `pnpm --filter chartlang-example-lightweight-charts-adapter test`
  (100% coverage) — run sparingly.
- Final lead runs: `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm readme:check`.

## Acceptance checklist

- [ ] `LWC_CAPABILITIES`/`LWC_SYM_INFO` via builders + union (no hand Sets
      for the umbrella surfaces).
- [ ] `DEFAULT_ADAPTER` frozen, capabilities-only, package `default`.
- [ ] Factory maps candles + every plot kind + hlines + panes to native
      LWC v5; mapping documented (native/deferred/no-op).
- [ ] Drawings buffered, NOT rendered; seam documented.
- [ ] `MockLwcApi` + hashed test; `hashCallLog` boundary consumed.
- [ ] 100% coverage; MIT headers; no `any`/`!`/bad `as`; `import type`.
- [ ] `CLAUDE.md` documents invariants.

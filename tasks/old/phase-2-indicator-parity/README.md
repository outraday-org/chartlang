# Phase 2 — `0.2` Full Indicator Parity

> **Plan reference:** PLAN.md §19 Phase 2, with cross-cuts into §9 (full
> primitive list), §3.1 (invinite reference paths), §7.2 / §7.3
> (`PlotKind` + `PlotStyle` expansion), §16.6 (math-port coverage),
> §17.4 (auto-generated primitive docs), §22.10 (per-port landing
> rule).
> **Prerequisite:** Phase 1 walking skeleton (`0.1`) shipped — see
> `tasks/phase-1-walking-skeleton/README.md`.
> **Version target:** `0.2` (per-package). `apiVersion: 1` script
> header unchanged (Phase 2 is additive at runtime, no script-author
> breaking changes).
> **Invinite reference commit:**
> `078f41fe2569d659d5aba726da8bcb5d3e2ced02`. Every port task pins
> this SHA in its provenance header.

## Goal

Port every indicator from the invinite reference math library into
`packages/runtime/src/ta/` so a Pine author can rewrite the median
real-world indicator script in chartlang without missing primitives.
Ship the §16.6 five-file set (impl + property + golden + bench +
unit) plus a conformance scenario, JSDoc per §17.2, and an
auto-generated `docs/primitives/ta/<id>.md` page for every port —
per §22.10's landing rule. Wire universal `opts.offset` (§9.1) on
every primitive (Phase-1 prims backfilled at end of phase) and
expand the `PlotKind` surface so the new primitives have somewhere
to render.

## Current State

Phase 1 left the repo at:

- 9 `ta.*` primitives in `packages/runtime/src/ta/` (`sma`, `ema`,
  `stdev`, `bb`, `rsi`, `macd`, `atr`, `crossover`, `crossunder`)
  with the §22.10 set landed (impl + 4 test files + JSDoc with
  `@formula`/`@warmup`/`@since`/`@example`/stability marker +
  conformance scenarios in
  `packages/conformance/src/scenarios/`).
- 8 ported math helpers in `packages/runtime/src/ta/lib/`
  (`applyOffset`, `readSourceField`, `pickCandleSource`,
  `emaFloat64`, `smaFloat64`, `rollingStddev`, `trSeries`,
  `wilderSmoothing`).
- 3 `PlotKind`s — `line`, `step-line`, `horizontal-line` (§7.3) —
  declared in `packages/core/src/plot/plot.ts`, wired through
  `@invinite-org/chartlang-adapter-kit`'s `capabilities.line()` /
  `capabilities.stepLine()` / `capabilities.horizontalLine()`
  builders, and rendered by `examples/canvas2d-adapter/`.
- `STATEFUL_PRIMITIVES` (`packages/core/src/statefulPrimitives.ts`)
  carries exactly the 9 `ta.*` + `plot` + `hline` + `alert`
  surfaces.
- `gen-docs.ts` (the `docs/primitives/ta/<id>.md` generator) is the
  documented Phase-2 follow-up — Phase 1 deferred it from §22.10
  point 8.
- `opts.offset` ships as a typed field on the existing primitive
  option bags but is unwired on every primitive (every
  implementation honours `0` only).

## Target State

After all 30 tasks land:

### Runtime (`packages/runtime/src/ta/`)

- ~75 new `ta.*` files in `packages/runtime/src/ta/<id>.ts`
  alongside the existing 9, each with its §22.10 five-file set
  (`<id>.ts`, `<id>.test.ts`, `<id>.property.test.ts`,
  `<id>.golden.test.ts`, `<id>.bench.ts` + `<id>.bench.test.ts`).
- Expanded `packages/runtime/src/ta/lib/` with the helpers §9.4
  enumerates as the Phase-2 backbone (`wmaFloat64`, `smmaFloat64`,
  `vwmaFloat64`, `computeMaOfFloat64`, `computeMa`, `maTypes`,
  `donchianMid`, `wilderDirectional`, `adxFromDi`,
  `linearRegression`, `pearson`).
- 6 cross-functional `ta.*` primitives (`nz`, `highest`, `lowest`,
  `change`, `valuewhen`, `barssince`).
- `TA_REGISTRY` in `packages/runtime/src/ta/registry.ts` regenerated
  — final entry count = **9 (Phase 1) + 6 (cross-functional) + 75
  (port batches across §9.2)** = **90 callable surfaces** before
  universal-offset backfill. Backfill (Task 29) does not change the
  registry count. `STATEFUL_PRIMITIVES` ends Phase 2 at **93
  entries** (90 `ta.*` + `plot` + `hline` + `alert`).
- `RuntimeTaNamespace` (the slot-aware runtime view, §22.10 +
  Phase-1 Task 7) mirrors core's `TaNamespace` 1-for-1 across the
  new surface.

### Core (`packages/core/src/`)

- `TaNamespace` (`packages/core/src/ta/ta.ts`) extended with the new
  ~81 surfaces (6 cross-functional + 75 ports). Per-primitive option
  bags (`WmaOpts`, `CciOpts`, `StochResult`, etc.) added next to the
  Phase-1 placeholders.
- **`Bar` (`packages/core/src/types.ts`) extended with the four
  pre-computed derived sources `hl2` / `hlc3` / `ohlc4` / `hlcc4`** —
  the runtime's `BarView` already pre-computes these on every close;
  Phase 2 widens the script-facing `Bar` so authors can write
  `ta.cci(bar.hlc3, 20)` directly, matching Pine. Backfilled in
  Task 1 (the foundational task).
- `STATEFUL_PRIMITIVES`
  (`packages/core/src/statefulPrimitives.ts`) extended with every
  new `ta.<id>` name. The shape evolves from `ReadonlySet<string>`
  to `ReadonlySet<{ name: string; slot: boolean }>` in Task 5 so
  `ta.nz` (the only stateless `ta.*`) can opt out of slot-id
  injection. Test suite asserts the new shape's cardinality
  (`.size === 93` at phase end).
- `PlotKind` (`packages/core/src/plot/plot.ts`) extended with the
  6 new kinds needed by Phase-2 ports: `histogram`, `bars`, `area`,
  `filled-band`, `label`, `marker`. (`shape`, `character`, `arrow`,
  `candle-override`, `bar-override`, `bg-color`, `bar-color`,
  `vertical-line`, `horizontal-histogram` stay deferred to Phase 5
  per §19.)
- `PlotStyle` discriminated union extended with the matching style
  variants.
- Universal `opts.offset` honoured on every primitive — Phase 1
  primitives backfilled in Task 29.

### Adapter-kit (`packages/adapter-kit/src/`)

- `capabilities.*` builder set extended with `histogram()`,
  `bars()`, `area()`, `filledBand()`, `label()`, `marker()`, and
  `allPhase2Plots()` (the union of every Phase-2 kind).
- `validateEmission` (`packages/adapter-kit/src/validation/
  validateEmission.ts`) recognises the new `PlotStyle.kind` values
  and validates their payload fields.

### Canvas2d reference adapter (`examples/canvas2d-adapter/`)

- `CANVAS2D_CAPABILITIES.plots` extended via
  `capabilities.allPhase2Plots()` so the conformance suite covers
  every new kind end-to-end.
- `src/render/` gains `histogram.ts`, `area.ts`, `filledBand.ts`,
  `label.ts`, `marker.ts` (one renderer per new `PlotKind`).
- Each renderer is pure on the `RenderCtx` test seam — the same
  `MockCanvas2DContext` is used in tests.

### CLI (`packages/cli/src/`)

- New `gen-docs.ts` script + `chartlang docs` subcommand that
  walks `packages/runtime/src/ta/<id>.ts` JSDoc and writes
  `docs/primitives/ta/<id>.md` per template (§17.4). The Phase-1
  primitives' pages land first (Task 2) so the gate is on; every
  subsequent port re-runs the generator and commits its page.

### Conformance (`packages/conformance/`)

- One scenario per new port batch in
  `packages/conformance/src/scenarios/`, asserted against the
  shared `goldenBars.json` (Phase 1 fixture, no regen) plus
  hand-curated edge fixtures where the port introduces a new
  numerical regime (e.g. `psar.scenario.ts` uses a sharp-reversal
  fixture).
- **`Scenario` type extended in Task 1** with an `inlineSource?:
  string` field — Phase-1 scenarios use `scriptPath` to point at a
  curated `examples/scripts/*.chart.ts` file; Phase-2 ports each
  inline a 6-line `defineIndicator` source into their scenario
  file so `examples/scripts/` stays a curated demo set (3 files)
  rather than ballooning to 80+ micro-scripts. `runConformanceSuite`
  prefers `inlineSource` when present, falls back to
  `readFile(scriptPath)` otherwise.
- `scenarios/index.ts` re-export list grows monotonically.

### Docs (`docs/primitives/ta/`)

- Auto-generated `docs/primitives/ta/<id>.md` per primitive (Phase
  1 prims first via Task 2, then per-port via Task 3-28). Each
  page sources the runtime export's JSDoc (`@formula`, `@warmup`,
  `@anchors`, `@since`, `@example`, stability marker).

### Repo-level

- Phase-1 primitives' impls in `packages/runtime/src/ta/` modified
  to honour `opts.offset` via the existing `lib/applyOffset`
  helper (Task 29). Their `@example` blocks pick up `offset: 0` in
  one updated case to exercise the path through the docs-check
  executor.
- Per-primitive bench thresholds (`THRESHOLD_MS = ceil(median × 3)`)
  pinned against post-port Apple-silicon runs; the bench harness
  itself unchanged.
- Each port lands a changeset (`packages/runtime` minor for new
  exports, `packages/core` minor for the `TaNamespace` /
  `STATEFUL_PRIMITIVES` extension).
- Final `0.2` package version bump in Task 30.

## Architecture Decisions

| Decision | Rationale |
|---|---|
| **Category-grouped batches (2–4 primitives per task)** | 30 tasks, average ~3 primitives each. §9.2's category map (MAs, oscillators, momentum, trend, volatility, volume, S/R, statistical) is the natural grouping — within a category, primitives share math helpers, so a batch's spec amortises the boilerplate. Per-spec size stays under 300 lines per `/write-tasks` constraint. |
| **Helpers ported in two dedicated tasks first** | Per §9.4 ordering: chained-MA family (Task 3) and stats/volatility helpers (Task 4) unblock ~half the indicators. Without these, every MA-derived port would re-port its own EMA/WMA core, defeating the "translate, don't transcribe" rule. |
| **Cross-functional `ta.*` primitives in Task 5** | `ta.highest`, `ta.lowest`, `ta.change`, `ta.valuewhen`, `ta.barssince` are consumed by ~30 of the §9.2 ports (aroon, donchian, williamsR, pivots-*, supertrend, …). Landing them up front keeps every later port one-line slim. `ta.nz` rides along — same task, same conformance scenario (NaN-handling fixture). |
| **`PlotKind` expansion lands as Task 1** | Every batch after Task 1 may need `histogram` / `area` / `filled-band` / `label` / `marker`. Pre-landing the kind + style discriminant + capability builder + canvas2d renderer means the per-port spec stays focused on math; if a port needs an existing kind, no setup work is needed. Sticking to additive kinds keeps `apiVersion: 1` intact (§7.3 minor bump). |
| **Task 1 also lands the `Bar.hl2/hlc3/ohlc4/hlcc4` extension and the `Scenario.inlineSource` extension** | Two foundational widenings every subsequent port depends on. The runtime's `BarView` already pre-computes the four derived sources; Phase 2 just surfaces them to scripts (Pine-canonical `bar.hlc3` access). The `Scenario.inlineSource` extension keeps `examples/scripts/` curated — Phase-2 scenarios inline their 6-line `defineIndicator` source. Both lands as the first foundational PR alongside the PlotKind expansion so every later task assumes them. |
| **`STATEFUL_PRIMITIVES` shape evolves in Task 5** | The Phase-1 `ReadonlySet<string>` widens to `ReadonlySet<{ name: string; slot: boolean }>` because `ta.nz` is stateless (no slot-id injection) while every other entry is stateful. Task 5 cascades the shape update through every consumer: `packages/compiler/src/api.ts`, `packages/compiler/src/program.ts`, `packages/compiler/src/analysis/statefulCallInLoop.ts`, `packages/compiler/src/transformers/callsiteIdInjection.ts`, and all their tests. Each subsequent batch task adds entries with `slot: true`. |
| **Defer `horizontal-histogram` + volume-profile family + `correlationCoeff` to Phase 5** | The 4 volume-profile primitives need `horizontal-histogram` + viewport / anchored / session input plumbing; PLAN §19 Phase 5 explicitly groups these. `correlationCoeff` reads a secondary-symbol OHLCV stream (external-data registry path) — that's a multi-timeframe surface that lands in Phase 5. Phase 2 keeps the scope tight on built-in `ta.*` math. |
| **Defer external-data primitives entirely** | The 7 trade-narrative external-data primitives (`transactionMarkers`, `riskLevels`, `tradeMaeMfeMarkers`, `tradeCostBasis`, `tradeEquityCurve`, `tradeRMultiple`, `tradeDistanceToStop`) plus `correlationCoeff` require the `input.externalSeries` core surface + `adapter.feedExternalSeries` plumbing, which belongs in Phase 4 alongside the rest of the input surface. Phase 2 stays a pure `ta.*` math expansion. |
| **`gen-docs.ts` lands as Task 2 (before any new port)** | §22.10 point 8 requires every port to commit its `docs/primitives/ta/<id>.md`. Building the generator first means every port task is just "run `pnpm docs:generate` and commit the diff." Phase 1 primitives' pages land in Task 2's same PR so the gate is on for everything that follows. |
| **`opts.offset` wired during the port, not as a Phase-end backfill across the new primitives** | Each Phase-2 port honours `opts.offset` in its first commit via the shared `lib/applyOffset` helper. Phase-1 primitives get a separate backfill task (Task 29) because they shipped without offset wiring — keeping the diff focused on the offset call paths plus golden updates (offset 0 is a no-op for goldens, but the property test asserts the path executes). |
| **`ulcerIndex` ports from invinite** | invinite has `ulcer-index.ts`; the Phase-1 README's earlier worry was a missing reference, but the file exists. Same port treatment as every other indicator. |
| **Per-port conformance scenarios, not a bundled task** | §22.10 says all five files + scenario in the same PR. Co-locating prevents a coverage-hostile end-of-phase bottleneck and means the scenario is reviewed alongside the math. Each scenario uses the existing 10 000-bar `goldenBars.json` fixture (Phase 1 generated it; Phase 2 doesn't regen). |
| **Numbering = execution order; no parallel waves** | Task 1 sets up plot kinds + adapter surface; Task 2 ships `gen-docs.ts`; Tasks 3–4 port helpers; Task 5 ports cross-functional primitives; Tasks 6–28 port category batches in dependency order (MAs first → oscillators that consume MAs → trend that consumes ADX → volatility → volume → S/R → statistical); Task 29 backfills `opts.offset` on Phase-1 prims; Task 30 closes the phase with registry verification + version bump. Each task's prerequisites are strictly lower-numbered. |

## Dependency Graph

```
Task 1 (PlotKind expansion + canvas2d renderers)
    |
    v
Task 2 (gen-docs.ts + auto-generated docs for Phase 1 primitives)
    |
    v
Task 3 (helpers — chained-MA family)
    |
    v
Task 4 (helpers — stats/volatility/regression/pearson)
    |
    v
Task 5 (cross-functional ta.* primitives: nz/highest/lowest/change/valuewhen/barssince)
    |
    +-----> Tasks 6-8   (MA ports: wma/vwma/hma/smma → dema/tema/kama/alma → lsma/mcginley/maRibbon)
    |                |
    |                v
    +-----> Tasks 9-12  (Oscillator ports — depend on MA + ATR + RSI)
    |                |
    |                v
    +-----> Tasks 13-14 (Momentum ports — depend on EMA + change)
    |                |
    |                v
    +-----> Tasks 15-17 (Trend ports — depend on highest/lowest + wilderDirectional)
    |                |
    |                v
    +-----> Tasks 18-20 (Volatility ports — depend on SMA + stdev + TR)
    |                |
    |                v
    +-----> Tasks 21-24 (Volume ports — depend on cumulative sums + EMA chains)
    |                |
    |                v
    +-----> Tasks 25-27 (S/R ports — depend on ATR + highest/lowest + linearRegression)
    |                |
    |                v
    +-----> Task 28     (Statistical ports — median/adr/ulcerIndex)
                     |
                     v
Task 29 (universal opts.offset backfill on Phase-1 primitives)
    |
    v
Task 30 (Phase 2 closeout — registry verification + 0.2 version bump + changeset)
```

Task 5 unblocks every batch after it. Within Tasks 6–28 the
ordering is execution order — the runtime exposes new primitives
each task, but each batch's ports only reach across to lower-task
helpers / primitives.

## Task Summary

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|---|---|---|---|
| 1 | [PlotKind expansion + canvas2d renderers + `Bar` extension + `Scenario.inlineSource` extension](./1-plotkind-expansion.md) | core, adapter-kit, canvas2d, runtime, conformance | None | High |
| 2 | [gen-docs.ts CLI + auto-generated docs for Phase 1 primitives](./2-gen-docs-script.md) | cli, runtime, docs | 1 | Medium |
| 3 | [Helpers — chained-MA family (wma / smma / vwma / computeMa)](./3-helpers-chained-ma.md) | runtime | 2 | Medium |
| 4 | [Helpers — stats / volatility / regression / pearson](./4-helpers-stats-volatility.md) | runtime | 2 | Medium |
| 5 | [Cross-functional `ta.*` primitives (nz / highest / lowest / change / valuewhen / barssince)](./5-cross-functional-ta.md) | core, runtime, conformance | 3, 4 | High |
| 6 | [MA ports — wma, vwma, hma, smma](./6-ma-wma-vwma-hma-smma.md) | core, runtime, conformance | 3, 5 | Medium |
| 7 | [MA ports — dema, tema, kama, alma](./7-ma-dema-tema-kama-alma.md) | core, runtime, conformance | 6 | Medium |
| 8 | [MA ports — lsma, mcginley, maRibbon](./8-ma-lsma-mcginley-ribbon.md) | core, runtime, conformance | 4, 7 | Medium |
| 9 | [Oscillator ports — cci, stoch, williamsR](./9-osc-cci-stoch-williamsr.md) | core, runtime, conformance | 5 | Medium |
| 10 | [Oscillator ports — ppo, dpo, connorsRsi](./10-osc-ppo-dpo-connorsrsi.md) | core, runtime, conformance | 7, 9 | Medium |
| 11 | [Oscillator ports — stochRsi, ultimateOsc, coppock](./11-osc-stochrsi-ultimateosc-coppock.md) | core, runtime, conformance | 9 | Medium |
| 12 | [Oscillator ports — kst, fisher, klinger, rvgi](./12-osc-kst-fisher-klinger-rvgi.md) | core, runtime, conformance | 7 | Medium |
| 13 | [Momentum ports — ao, cmo, momentum, roc](./13-mom-ao-cmo-momentum-roc.md) | core, runtime, conformance | 5 | Medium |
| 14 | [Momentum ports — pmo, smi, tsi](./14-mom-pmo-smi-tsi.md) | core, runtime, conformance | 7, 13 | Medium |
| 15 | [Trend ports — aroon, aroonOsc](./15-trend-aroon-aroonosc.md) | core, runtime, conformance | 5 | Low |
| 16 | [Trend ports — adx, dmi, trix](./16-trend-adx-dmi-trix.md) | core, runtime, conformance | 4, 7 | High |
| 17 | [Trend ports — vortex, trendStrengthIndex, ichimoku](./17-trend-vortex-tsi-ichimoku.md) | core, runtime, conformance | 4, 16 | High |
| 18 | [Volatility ports — bbPercentB, bbw, donchian](./18-vol-bbpercentb-bbw-donchian.md) | core, runtime, conformance | 4, 5 | Medium |
| 19 | [Volatility ports — keltner, envelope, chop](./19-vol-keltner-envelope-chop.md) | core, runtime, conformance | 7, 18 | Medium |
| 20 | [Volatility ports — historicalVolatility, rvi, massIndex](./20-vol-histvol-rvi-massindex.md) | core, runtime, conformance | 7, 18 | Medium |
| 21 | [Volume ports — vol, vwap, anchoredVwap](./21-volume-vol-vwap-anchoredvwap.md) | core, runtime, conformance | 1, 5 | Medium |
| 22 | [Volume ports — obv, adl, bop, cmf](./22-volume-obv-adl-bop-cmf.md) | core, runtime, conformance | 21 | Medium |
| 23 | [Volume ports — chaikinOsc, mfi, netVolume, pvo](./23-volume-chaikinosc-mfi-netvol-pvo.md) | core, runtime, conformance | 7, 22 | Medium |
| 24 | [Volume ports — pvt, eom, nvi, pvi](./24-volume-pvt-eom-nvi-pvi.md) | core, runtime, conformance | 22 | Medium |
| 25 | [S/R ports — psar, supertrend](./25-sr-psar-supertrend.md) | core, runtime, conformance | 5 | High |
| 26 | [S/R ports — chandelier, chandeKrollStop, williamsFractal](./26-sr-chandelier-chandekrollstop-fractal.md) | core, runtime, conformance | 5, 25 | Medium |
| 27 | [S/R ports — zigZag, pivotsHighLow, pivotsStandard, volatilityStop](./27-sr-zigzag-pivots-volatilitystop.md) | core, runtime, conformance | 5, 25 | High |
| 28 | [Statistical ports — median, adr, ulcerIndex](./28-stat-median-adr-ulcerindex.md) | core, runtime, conformance | 5 | Low |
| 29 | [Universal `opts.offset` backfill on Phase-1 primitives](./29-opts-offset-backfill.md) | core, runtime | 5 | Low |
| 30 | [Phase 2 closeout — registry verification + `0.2` version bump + changeset](./30-phase-closeout.md) | core, runtime, adapter-kit, canvas2d, conformance, cli | 1-29 | Low |

## Code Reuse

Phase 2 reuses every Phase-1 facility — coverage / lint / scaffold /
docs / readme / conformance gates, the `Float64RingBuffer` /
`Series<T>` data structures, the slot-store mechanism, the
`RuntimeContext` accessor, and the existing helpers in
`packages/runtime/src/ta/lib/`.

| Reuse | Source | Notes |
|---|---|---|
| `packages/runtime/src/ta/lib/applyOffset.ts` | Phase 1 | Universal `opts.offset` honoured by every Phase-2 port and by the Task-29 Phase-1 backfill. |
| `packages/runtime/src/ta/lib/readSourceField.ts` + `pickCandleSource.ts` | Phase 1 | "open/high/low/close/hl2/hlc3/ohlc4/hlcc4" resolution for every source-taking port. |
| `packages/runtime/src/ta/lib/{sma,ema}Float64.ts` | Phase 1 | Existing chained-MA cores; reused by every MA-derived port. The Task-3 dispatcher (`computeMaOfFloat64`) routes through these. |
| `packages/runtime/src/ta/lib/rollingStddev.ts` | Phase 1 | Reused by `bbPercentB`, `bbw`, `historicalVolatility`. |
| `packages/runtime/src/ta/lib/trSeries.ts` | Phase 1 | Reused by `keltner`, `chop`, `supertrend`, `chandelier`, `volatilityStop`. |
| `packages/runtime/src/ta/lib/wilderSmoothing.ts` | Phase 1 | Reused by `dmi`, `adx`. |
| `packages/conformance/fixtures/goldenBars.json` | Phase 1 | 10 000-bar deterministic fixture. Phase 2 does NOT regen — every new golden test loads it; only the per-port output hashes are pinned in Task spec. |
| `packages/conformance/src/scenarios/scenarios.test.ts` | Phase 1 | Existing scenario runner. Each new conformance scenario plugs into the existing `runConformanceSuite()` re-export. |
| `examples/canvas2d-adapter/src/render/*` | Phase 1 | Existing `line.ts`, `horizontalLine.ts`, `alertBadge.ts` renderers — new helpers in Task 1 sit alongside under the same `RenderCtx` test seam. |
| `scripts/scaffold.ts` | Phase 0 | No new packages in Phase 2 — no scaffold edits needed. |
| `scripts/docs-check.ts` | Phase 1 Task 3 | Continues to execute `@example` blocks in JSDoc — every new primitive's `@example` runs through it. The Task-2 `gen-docs.ts` is a separate generator (writes markdown), not a replacement. |

Phase-2-introduced reusable artefacts (consumed by Tasks 6–28 ports):

| New artefact | Location | Rationale |
|---|---|---|
| `packages/runtime/src/ta/lib/wmaFloat64.ts` | Task 3 | Linear-weighted MA core. Consumed by `ta.wma`, `ta.hma`. |
| `packages/runtime/src/ta/lib/smmaFloat64.ts` | Task 3 | Smoothed (Wilder-style) MA. Consumed by `ta.smma`, `ta.cmo`. |
| `packages/runtime/src/ta/lib/vwmaFloat64.ts` | Task 3 | Volume-weighted MA. Consumed by `ta.vwma`. |
| `packages/runtime/src/ta/lib/computeMaOfFloat64.ts` + `computeMa.ts` + `maTypes.ts` | Task 3 | MA-kind dispatcher used by primitives that accept an `maType` opt (`donchian` mid, `bb` middle override, `keltner`, `envelope`, `chop`). |
| `packages/runtime/src/ta/lib/donchianMid.ts` | Task 4 | Donchian midpoint. Consumed by `ta.ichimoku`, `ta.donchian`. |
| `packages/runtime/src/ta/lib/wilderDirectional.ts` | Task 4 | Wilder +DM / −DM. Consumed by `ta.dmi`, `ta.adx`. |
| `packages/runtime/src/ta/lib/adxFromDi.ts` | Task 4 | ADX from `+DI` / `−DI`. Consumed by `ta.adx`. |
| `packages/runtime/src/ta/lib/linearRegression.ts` | Task 4 | OLS regression slope + intercept on a rolling window. Consumed by `ta.lsma`, `ta.dpo`, future Phase-3 `regressionTrend` drawing. |
| `packages/runtime/src/ta/lib/pearson.ts` | Task 4 | Pearson correlation. Consumed by `ta.trendStrengthIndex` (and `correlationCoeff` once Phase 5 lights up). |
| Cross-functional `ta.*` primitives — `ta.highest`, `ta.lowest`, `ta.change`, `ta.valuewhen`, `ta.barssince`, `ta.nz` | Task 5 | Consumed by ~30 of the §9.2 ports. |
| `PlotKind` extensions (`histogram` / `bars` / `area` / `filled-band` / `label` / `marker`) + canvas2d renderers | Task 1 | New primitives use these to plot. Renderers are pure on `RenderCtx` (declared in `examples/canvas2d-adapter/src/render/clear.ts`). |
| `Bar.hl2` / `Bar.hlc3` / `Bar.ohlc4` / `Bar.hlcc4` (script-facing derived sources) | Task 1 | Surfaces what the runtime's `BarView` already pre-computes. Lets scripts write `ta.cci(bar.hlc3, 20)` like Pine. |
| `Scenario.inlineSource?: string` (extends `packages/conformance/src/runConformanceSuite.ts` `Scenario` type) | Task 1 | Phase-2 scenarios inline their 6-line `defineIndicator` source rather than spawning 80+ `.chart.ts` files in `examples/scripts/`. `runConformanceSuite` writes inline source to the existing `.cache/` tmp file and `import()`s it. |
| `STATEFUL_PRIMITIVES` shape evolution (`ReadonlySet<string>` → `ReadonlySet<{ name; slot: boolean }>`) + matching compiler consumer updates | Task 5 | Lets `ta.nz` (stateless) coexist with every other (stateful) entry. Cascade list pinned in Task 5. |

## Provenance

All ports trace to `../invinite/src/components/trading-chart/
indicators/` at commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`.
Every ported `<id>.ts` carries the 4-line CONTRIBUTING §4
provenance + relicense header (mirroring the Phase-1 convention
documented at `packages/runtime/src/ta/CLAUDE.md`):

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/<id>.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
```

Primitives without an invinite source (`ta.nz`, `ta.change`,
`ta.highest`, `ta.lowest`, `ta.valuewhen`, `ta.barssince` — all
Pine-canonical helpers; `ulcerIndex` IS in invinite — see Task 28)
use the alternative header from `packages/runtime/src/ta/
CLAUDE.md` ("No invinite source — semantics per Pine `ta.<name>`").

## Deferred / Follow-Up Work

Anything tagged Phase 3+ in PLAN.md §19 stays out of scope. Items
consciously **not** in Phase 2 (with §19 references):

- **Drawings (Phase 3 / §10).** `draw.*` namespace, 61
  `DrawingKind`s, `decodeDrawing` real impl.
- **Editor (Phase 4 / §14).** Language service hover / completions
  for the Phase-2 primitives lands when the editor itself lands.
  Phase-2 JSDoc is structured so the language service can consume
  it without rework.
- **Tier-1 ergonomics (Phase 4).** `state.*` / `state.tick.*`,
  `barstate.*`, `syminfo.*`, `timeframe.*` stay deferred.
- **Input UI (Phase 4).** `input.*` builders remain at the Phase-1
  stub level. Every Phase-2 indicator's params come from the
  script-author's destructured `opts` — no runtime input
  resolution.
- **External-data primitives (Phase 4+).** `input.externalSeries`
  + `adapter.feedExternalSeries` are not built in Phase 2; the 7
  trade-narrative external-data primitives + `correlationCoeff`
  defer.
- **Volume-profile family + `horizontal-histogram` PlotKind (Phase
  5).** `visibleRangeVolumeProfile`, `anchoredVolumeProfile`,
  `sessionVolumeProfile`, `fixedRangeVolumeProfile` require the
  viewport / anchor / session input plumbing.
- **Other deferred PlotKinds (Phase 5).** `shape`, `character`,
  `arrow`, `candle-override`, `bar-override`, `bg-color`,
  `bar-color`, `vertical-line` — Phase 5's PlotKind expansion.
- **Multi-timeframe (Phases 4-5).** `request.security` /
  `request.lowerTf` / `align-htf-series-to-ltf.ts` defer.
- **`host-quickjs` + `defineAlertCondition` + `runtime.log.*` +
  `runtime.error()` + `draw.table` (Phase 5).**
- **CLI `lint` + `bench` subcommands.** Phase 2 adds only the
  `docs` (gen-docs) subcommand on top of Phase 1's `compile` +
  `scaffold-adapter`. `lint` / `bench` defer to a later phase.
- **VitePress build (`pnpm docs:build`).** Phase 2 generates
  `docs/primitives/ta/<id>.md` markdown but does not stand up the
  vitepress config or theme — that lands in Phase 4 alongside the
  editor.
- **`pivotsStandard` extended levels (R3+, S3+).** The Phase-2 port
  ships R1–R3 / S1–S3; the (R4, S4, R5, S5) extensions defer with
  the Tier-3 surface.

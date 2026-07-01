# Pine-parity additions

Two Pine-Script parity features that close genuine gaps in the
`apiVersion: 1` surface, identified by auditing chartlang against Pine
v6 (and cross-checking ThinkScript / MQL / NinjaScript):

1. **Four small `ta.*` helper primitives** — `ta.rising`, `ta.falling`,
   `ta.cross`, `ta.cum`. Ubiquitous Pine idioms with no chartlang
   equivalent today (you currently hand-roll a bounded loop or a
   `state.float` accumulator).
2. **Custom OHLC candle-series plotting** — `plotcandle(o,h,l,c)` /
   `plotbar(o,h,l,c)`. Today `style: { kind: "candle-override" |
   "bar-override" }` only *recolors the existing chart candles*; there
   is no way to render a **derived** candle series (Heikin-Ashi,
   smoothed candles, a secondary-symbol / HTF candle overlay, Renko-ish
   transforms). This is the one real *capability* hole in the plot
   surface.

Strategy / backtesting (`strategy.*`) was explicitly scoped **out** — it
is a large product decision, not a bolt-on, and may cross an intended
scope boundary. It is listed under Deferred.

Everything here is **additive within `apiVersion: 1`** (new callsites /
new style kinds only — no reshaping of existing types), so no snapshot,
golden, or manifest that predates these tasks changes byte-for-byte. See
root `CLAUDE.md`, `packages/core/CLAUDE.md`, and CONTRIBUTING §22.10
(the primitive-landing set) / §16.3 (the test-layer table).

## Current State

- **`ta.*`** — ~130 primitives in `packages/runtime/src/ta/`, declared
  as sentinel holes in `packages/core/src/ta/ta.ts`, registered in
  `packages/core/src/statefulPrimitives.ts` (`slot: true`) and
  `packages/runtime/src/ta/registry.ts` (`TA_REGISTRY` +
  `TA_REGISTRY_METADATA`). No `rising` / `falling` / `cross` / `cum`.
  `ta.crossover` / `ta.crossunder` exist (one-direction crosses);
  `ta.obv` / `ta.adl` / `ta.pvt` are the only cumulative primitives
  (all specialized — no generic running sum).
- **Plot family** — `plot` / `hline` / `bgcolor` / `barcolor` are
  plot-family holes in `packages/core/src/plot/plot.ts`, exported via
  `plot/index.ts` + root `index.ts:264`, registered in
  `statefulPrimitives.ts:115-121`, and mirrored in the compiler ambient
  shim `packages/compiler/src/program.ts:857-860,1510-1511`. The wire
  `PlotStyle` union lives in `packages/adapter-kit/src/types.ts`;
  `candle-override` / `bar-override` are **color-only** overrides of the
  primary candles. The multi-value precedent is `filled-band`, which
  carries `upper` / `lower` numerics **inside the style object** and is
  drawn by `examples/canvas2d-adapter/src/render/filledBand.ts` via a
  per-bar `PlotPoint` accumulator.

## Target State

- **`ta.rising(source, length)`** / **`ta.falling(source, length)`** →
  `Series<boolean>`; **`ta.cross(a, b)`** → `Series<boolean>`;
  **`ta.cum(source)`** → `Series<number>`. Each ships the full §22.10
  set (JSDoc `@formula`+`@warmup`, unit + property + golden + bench
  tests, conformance scenario, auto-generated docs page, skills
  regen, changeset).
- **`plotcandle(open, high, low, close, opts?)`** and
  **`plotbar(open, high, low, close, opts?)`** as new plot-family
  free functions (same precedent as the `bgcolor` / `barcolor`
  aliases), lowering to two new **value-carrying** wire styles
  `kind: "candle"` and `kind: "ohlc-bar"`. New `PlotKind` capability
  entries; the reference canvas2d adapter renders both; a fully-null
  OHLC bar is a legit gap, a partially-null bar is `malformed-emission`.
  Missing capability → silent no-op via the existing
  `unsupported-plot-kind` path.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Dedicated `plotcandle` / `plotbar` functions, not a `plot()` style arm** | Mirrors Pine 1:1 and reuses the exact `bgcolor` / `barcolor` alias precedent (free function → plot emission). Author writes 4 OHLC args, not a style bag. |
| **New wire kinds `"candle"` / `"ohlc-bar"` (not overloading `candle-override` / `bar-override`)** | The existing kinds are *color-only* recolors of the primary candles and are already shipped `@stable`. Value-carrying candles are a different render topology; a new kind keeps both byte-stable. |
| **Per-bar OHLC numerics live *inside* the style object** | The established multi-channel pattern (`filled-band.upper` / `lower`). The `PlotEmission.value` field stays single-channel; the adapter accumulates a per-bar `PlotPoint` and draws at flush (mirrors `renderFilledBandSeries`). |
| **`ta.cross` composes `crossover` + `crossunder` sub-slots** | No new cross math — reuse the registered primitives via sub-slots `${slotId}/over` / `${slotId}/under` (the `aroonOsc` / `donchian` composition seam), so a fix flows in for free. |
| **`ta.rising` / `ta.falling` = strict monotonic over `length` steps** | Each of the trailing `length` consecutive deltas is strictly positive (rising) / negative (falling). Warmup `length`; NaN in-window ⇒ `false` (boolean-series convention, matching `crossover`). |
| **`ta.cum` NaN contributes 0** | Matches Pine `ta.cum` and the `obv` / `adl` accumulator convention (carry the running total forward without polluting it). Warmup 0. Tick-mode replays the head against a prior-close snapshot. |
| **All four `ta.*` are `slot: true`** | They own per-bar state (windows / accumulators / sub-slots); only `ta.nz` is `slot: false`. |

## Dependency Graph

```
Feature A — ta.* helpers            Feature B — plotcandle / plotbar
─────────────────────────           ────────────────────────────────
Task 1 (core: 4 holes,              Task 4 (adapter-kit: wire kinds
        opts, registry)                     "candle"/"ohlc-bar",
  |                                          PlotKind, validateEmission)
  ├──> Task 2 (runtime                 |
  |     ta.rising + ta.falling)        v
  |                                  Task 5 (core: plotcandle/plotbar
  └──> Task 3 (runtime                       holes, opts, program.ts shim)
        ta.cross + ta.cum)                  |
                                            v
                                     Task 6 (runtime: emit + value
                                             resolution + gate)
                                            |
                                            v
                                     Task 7 (canvas2d: render funcs +
                                             capabilities + accumulation)
                                            |
                                            v
                                     Task 8 (conformance scenarios +
                                             docs/skills regen + SKILL.md)
```

Features A and B are independent; the numbering interleaves them only to
define a single execution order. Every task's prerequisites are strictly
lower-numbered.

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Core contract for `ta` helpers](./1-core-ta-helper-contract.md) | core | None | Medium |
| 2 | [Runtime `ta.rising` + `ta.falling`](./2-runtime-ta-rising-falling.md) | runtime | 1 | Medium |
| 3 | [Runtime `ta.cross` + `ta.cum`](./3-runtime-ta-cross-cum.md) | runtime | 1 | Medium |
| 4 | [Adapter-kit candle wire contract](./4-adapter-kit-candle-wire-contract.md) | adapter-kit | None | Medium |
| 5 | [Core `plotcandle` / `plotbar` API](./5-core-plotcandle-plotbar-api.md) | core | 4 | Medium |
| 6 | [Runtime candle emit + gate](./6-runtime-plotcandle-plotbar-emit.md) | runtime | 4, 5 | Medium |
| 7 | [canvas2d candle render](./7-canvas2d-candle-render.md) | canvas2d-adapter | 4, 6 | High |
| 8 | [Conformance + docs/skills](./8-conformance-docs-candle.md) | conformance | 2, 3, 6, 7 | Low |

## Code Reuse

| Existing | Path | Reused by |
|----------|------|-----------|
| `ta.change` slot shape (window + tick replay) | `packages/runtime/src/ta/change.ts` | Task 2 (`rising`/`falling` window) |
| `ta.crossover` / `ta.crossunder` (boolean series, NaN⇒false) | `packages/runtime/src/ta/crossover.ts`, `crossunder.ts` | Task 3 (`cross` composes both) |
| `ta.obv` / `ta.adl` accumulator + tick snapshot | `packages/runtime/src/ta/obv.ts`, `adl.ts` | Task 3 (`cum` accumulator) |
| Sub-slot composition seam | `packages/runtime/src/ta/aroonOsc.ts`, `donchian.ts` | Task 3 (`cross` sub-slots) |
| `TA_REGISTRY` + `TA_REGISTRY_METADATA` | `packages/runtime/src/ta/registry.ts` | Tasks 2, 3 |
| `filled-band` multi-value style + validation + render | `adapter-kit/src/types.ts`, `validation/validateEmission.ts` (`validateFilledBandStyle`), `canvas2d-adapter/src/render/filledBand.ts`, `createCanvas2dAdapter.ts` (`renderFilledBandSeries`) | Tasks 4, 6, 7 |
| `candle-override` / `bar-override` author + render | `core/src/plot/plot.ts:162-183`, `canvas2d-adapter/src/render/candleOverride.ts` | Tasks 5, 7 |
| `bgcolor` / `barcolor` alias precedent (fn → emission) | `core/src/plot/plot.ts`, `program.ts:857-860` | Task 5 |
| `taChange.scenario.ts` / `plotKindCandleOverride.scenario.ts` | `packages/conformance/src/scenarios/` | Tasks 2, 3, 8 |
| `unsupported-plot-kind` gate | `packages/runtime/src/emit/plot.ts:117-127` | Task 6 |

## Provenance

None. No `../invinite/` ports — these are new primitives / functions
designed against the documented Pine v6 semantics (cited per task). The
math kernels mirror **existing chartlang** primitives, not an external
source, so no provenance header is required.

## Deferred / Follow-Up Work

- **Strategy / backtesting (`strategy.*`)** — position model, fills,
  equity curve, performance report + an order-execution determinism
  contract. Large; likely `apiVersion` scope decision. Out of scope.
- **Per-bar `Series<Color>` body-color channel** for `plotcandle`
  (arbitrary per-bar color instead of bull/bear/doji) — matches the
  deferred single dynamic-color channel already noted in `SKILL.md`.
- **`ta.correlation` / `ta.percentrank` / `ta.dev` / `ta.tr`** — niche
  or trivially composable; add on demand, not speculatively.
- **Non-canvas adapters** (any additional bundled adapters) picking up
  `"candle"` / `"ohlc-bar"` — each opts in via its own `Capabilities`.

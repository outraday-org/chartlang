# T8 — Core + converter: per-plot visibility & Pine `display=`

## Overview

Add a **per-plot visibility channel** to chartlang and map Pine's
`display = cond ? display.all : display.none` onto it. Trend Wizard toggles
~20 plots on input booleans this way (every MA-slope / derivative / turnover /
distance / crossing / RSI / ATR plot). This is the **only genuine core
capability gap** in the batch — the rest are converter-side. It is cosmetic
(the trend math converts without it) but required for a faithful port.

## Current State (evidence — ran built converter)

Pine `plot(close, display = show ? display.all : display.none)` →

```ts
inputs: { show: input.bool(true) },
compute({ … }) { plot(bar.close); }   // display silently dropped → always visible
```

No diagnostic. `display=` is an unmapped named arg, so the plot is emitted
always-visible.

- chartlang `PlotOpts` (`packages/core/src/plot/plot.ts`) has **no**
  `visible`/`display` field (color, title, lineWidth, lineStyle, fill, z).
- Plot emission (`PlotEmission` wire), runtime emit, adapters, and
  `manifest.plots` (compiler) have no visibility concept.

## Target State

- A new optional plot opt, e.g. `plot(value, { visible?: boolean })`
  (a per-bar boolean is the general case; a constant covers the input-toggle
  case). Closely mirrors the **dynamic color channel** in
  `../bgcolor-barcolor-ergonomics/` (D2): an appended-optional wire field,
  omitted ⇒ byte-identical snapshots.
- Compiler threads it into `manifest.plots[*]`; runtime emits it; **every
  adapter** honors it (hidden ⇒ not drawn, without leaving a gap-in-series
  artifact — distinct from plotting `NaN`).
- Converter maps Pine `display = <expr> ? display.all : display.none` →
  `{ visible: <expr> }`; `display.none`/`display.all` constants map to
  `false`/`true`.

## Architecture Decisions (to finalize in step 2)

| Decision | Notes |
|----------|-------|
| `visible` as an appended optional wire field | Follow the bgcolor/barcolor D2 precedent exactly so `apiVersion: 1` snapshots stay byte-identical when unused. |
| Boolean vs. `Series<boolean>` | Pine `display` is per-bar capable but Trend Wizard only toggles on inputs (constant). Support `boolean` first; a per-bar series channel can mirror D2's `colorValue` approach if needed. |
| Visibility ≠ `NaN` | Hiding must suppress the mark, not introduce a series hole (which changes line continuity / fills). Define adapter contract precisely. |
| Pine `display` surface | Pine `display.all/none` (and `display.pane`/`status_line`/etc.) — map the all/none toggle; other display targets degrade-with-note. |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| Dynamic-channel precedent | `../bgcolor-barcolor-ergonomics/` (D2 color channel: core opt → wire field → adapter consume) | Architectural template across all 5 layers. |
| `PlotOpts` | `packages/core/src/plot/plot.ts` | Add `visible?`. |
| Manifest plots | `packages/compiler/CLAUDE.md` §`manifest.plots`, `callsiteIdInjection.ts` (`PlotSlotDescriptor`) | Thread the field. |
| Adapter conformance | `packages/conformance/` + adapter-kit | Per-adapter visibility scenario. |
| Converter plot emit | `src/transform/plotFamily.ts` (`emitPlot`) | Map `display=`. |

## Dependencies

- Strongly model on `../bgcolor-barcolor-ergonomics/` (consider sequencing
  T8 after that task lands so the dynamic-channel wire pattern is settled).
- Spans **core + compiler + runtime + adapters + conformance + converter** —
  the largest TX; likely the most numbered sub-tasks in step 2.

## Dependency Graph

```
Task 1 (core PlotOpts.visible + appended-optional PlotEmission.visible wire)
  |
  +----------------------------+
  v                            v
Task 2 (compiler:              Task 3 (runtime: resolve visible ->
        manifest.plots                  emission, omit-when-visible + validate)
        defaultVisible)               |
  |                            v
  |                      Task 4 (adapter-kit contract + every adapter
  |                              skips render when visible === false)
  |                            |
  |                            v
  |                      Task 5 (conformance: plot-field scenario)
  +----------------------------+
  v
Task 6 (converter: map Pine display= -> { visible } + fixtures + round-trip)
  |
  v
Task 7 (docs/skills/CLAUDE.md across core/adapter-kit/runtime/compiler/
        conformance/pine-converter)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Core `PlotOpts.visible` + wire field](./1-core-visible-opt-and-wire.md) | core, adapter-kit, compiler | None | Medium |
| 2 | [Compiler: thread into `manifest.plots`](./2-compiler-manifest-plots.md) | compiler | 1 | Medium |
| 3 | [Runtime: resolve + validate `visible`](./3-runtime-emit-visibility.md) | runtime | 1 | Medium |
| 4 | [Adapters honor `visible`](./4-adapters-honor-visibility.md) | adapter-kit, canvas2d-adapter | 1, 3 | Medium |
| 5 | [Conformance scenario](./5-conformance-scenario.md) | conformance | 1, 3, 4 | Low |
| 6 | [Converter: map Pine `display=`](./6-converter-map-display.md) | pine-converter | 1 (3–4 for round-trip) | Medium |
| 7 | [Docs / skills / CLAUDE.md](./7-docs-skills-claude.md) | docs, skills, all pkgs | 1–6 | Low |

## Acceptance Criteria

- A chartlang plot with `{ visible: false }` is not drawn (and leaves no
  series hole) on every adapter.
- Trend Wizard's `display = <bool> ? display.all : display.none` plots convert
  to `{ visible: … }` and toggle correctly.

## Deferred / Follow-Up

- Non-`all/none` Pine `display` targets (`status_line`, `price_scale`, …).
- Per-bar `Series<boolean>` visibility if a future script needs it.

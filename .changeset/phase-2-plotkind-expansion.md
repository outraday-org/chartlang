---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-conformance": minor
"chartlang-example-canvas2d-adapter": minor
---

Phase-2 Task 1 — three foundational widenings every subsequent
Phase-2 port depends on:

1. **`PlotKind` expansion (3 → 9).** Adds `histogram`, `bars`,
   `area`, `filled-band`, `label`, `marker` per PLAN.md §7.3. The
   `PlotStyle` discriminated union in
   `@invinite-org/chartlang-adapter-kit` extends in lockstep; the
   `validateEmission` switch grows matching arms with per-kind
   payload rules; the `capabilities` builder gains `histogram()` /
   `bars()` / `area()` / `filledBand()` / `label()` / `marker()` /
   `allPhase2Plots()`. The canvas2d reference adapter ships six new
   pure-on-`RenderCtx` renderers (`render/histogram.ts`, `bars.ts`,
   `area.ts`, `filledBand.ts`, `label.ts`, `marker.ts`) and flips
   `CANVAS2D_CAPABILITIES.plots` to `capabilities.allPhase2Plots()`
   (9 kinds). `RenderCtx` + `MockCanvas2DContext` extend with
   `fillText`, `globalAlpha`, `font`, `textAlign`, `textBaseline`.

2. **`Bar` derived sources.** Extends the script-facing `Bar`
   (`packages/core/src/types.ts`) with the four pre-computed derived
   sources `hl2` / `hlc3` / `ohlc4` / `hlcc4`. The runtime's
   `BarView` (`packages/runtime/src/streamState.ts`) already
   populates these on every close — Phase 2 surfaces them so authors
   can write `ta.cci(bar.hlc3, 20)` like Pine. No runtime change.

3. **`Scenario.inlineSource`.** Extends the conformance `Scenario`
   type (`packages/conformance/src/runConformanceSuite.ts`) with an
   optional `inlineSource?: string` field that is mutually exclusive
   with the existing `scriptPath?: string`. `runConformanceSuite`
   writes the inline source to the existing `.cache/` tmp file and
   compiles + imports it exactly like the `scriptPath` branch, with
   a virtual `<inline:${id}>.chart.ts` `sourcePath` so callsite-id
   injection produces stable, pinnable slot ids. Phase-2 ports use
   this to carry their `defineIndicator` source inline rather than
   spawning 80+ files in `examples/scripts/`.

The new `PLOT_KIND_COVERAGE_SCENARIO` exercises the `inlineSource`
path + the wider capability surface end-to-end (one inline
`plot(bar.close)` + `hline(50)` script; asserts no
`unsupported-plot-kind` and no `malformed-emission` diagnostics
fire). Per-port Phase-2 tasks (Tasks 21+) each add their own
scenario asserting the specific new kind's drained emissions once
the runtime acquires the matching emission path.

No runtime / host-worker source-level changes in this task —
`BarView` already carries the four derived fields, and the
`PlotKind` expansion is additive at every consumer.

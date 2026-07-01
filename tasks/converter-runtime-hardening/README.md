# Converter + runtime hardening

Two independent fixes surfaced by auditing real Pine ports (MASM Strat,
Trend Wizard) against chartlang on 2026-07-01. Neither adds a runtime
capability — both remove a **silent** footgun that makes correct code
look broken (Task 1) or makes broken wiring produce silent all-NaN
output (Task 2).

1. **Widen the `ta.*` author source type** — `ta.ema`/`ta.sma`/… declare
   `source: Series<number>`, but the compiler+runtime already accept a
   scalar `number` per-bar value (the runtime coerces via
   `readSourceValue`). So any computed source — `ta.ema((ma - ma[1]) /
   ma[1] * 100, n)`, the *defining* idiom of every slope / turnover /
   distance indicator — **compiles and runs correctly but shows a false
   `tsc` error** (`number is not assignable to Series<number>`). This is
   the single biggest polish gap in converter output and hand-written
   scalar sources. Fix: widen the core type to match the runtime it
   already lowers to.

2. **Unify the compiled manifest** — a compiled `.chart.js` exports a
   `default` whose `.manifest` is a **zeroed stub** (`maxLookback: 0`,
   no `plots`/`requestedFeeds`) plus a separate `export const __manifest`
   holding the real one. Feed `mod.default` straight into
   `createScriptRunner` and series capacity collapses to `1` → every
   `[n]` read is NaN forever, MTF feeds drop, **no error is thrown**. The
   shipped hosts merge `__manifest` over `default`; three copies of that
   merge logic exist. Fix: make the emitted `default` carry the real
   manifest, and centralize the merge behind one loader that fails loud.

## Why these are additive / low-risk

- **Task 1** only *relaxes* a parameter type (`Series<number>` →
  `number | Series<number>`); every existing series caller still
  type-checks, and the runtime already accepts both shapes. No wire
  format, golden, or manifest changes. Only the generated hover registry
  regenerates.
- **Task 2** does not change the *values* in any manifest — it makes the
  `default` export carry the manifest that `__manifest` already holds,
  and dedupes the load path. Manifest JSON is byte-identical; only the
  compiled-bundle tail and its snapshots regenerate.

See root `CLAUDE.md`, `packages/core/CLAUDE.md`,
`packages/compiler/CLAUDE.md`, and CONTRIBUTING §22.10 / §16.3.

## Current State

- **`ta.*` source type** — `TaNamespace` in
  `packages/core/src/ta/ta.ts:2370-2482` is hand-written; every numeric
  source is declared inline as `source: Series<number>` (no shared
  alias). The runtime already owns `ScalarOrSeries = number |
  Series<number>` (`packages/runtime/src/ta/lib/sourceValue.ts:20`) and
  reads every source through `readSourceValue` (`sourceValue.ts:35-38`),
  which returns a plain number as-is. The compiler passes the source arg
  through verbatim (`packages/compiler/src/transformers/callsiteIdInjection.ts:175-192`),
  no type-directed branching.
- **Compiled manifest** — `defineIndicator` builds the stub
  (`packages/core/src/define/defineIndicator.ts:68-79`: `maxLookback: 0`,
  empty `seriesCapacities`, no `plots`) because the author-eval context
  cannot know lookback/plots. The compiler computes the real manifest and
  appends it as `export const __manifest` via `formatManifestAssignment`
  (`packages/compiler/src/bundle.ts:223-230`) at
  `packages/compiler/src/api.ts:772-776`. `resolveCapacity`
  (`packages/runtime/src/createScriptRunner.ts:214-224`) turns
  `maxLookback: 0` + empty `seriesCapacities` into capacity `1`. The
  merge is re-implemented in `host-worker`
  (`createWorkerBoot.ts:95-96`), `conformance`
  (`runConformanceSuite.ts:718-723`), and `host-quickjs`.

## Task Summary Table

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|-------|-----------|--------------|-----------------|
| 1 | [Widen `ta.*` source type to `number \| Series<number>`](./1-core-ta-source-type-widening.md) | core (+ generated hover) | None | Low |
| 2 | [Unify compiled manifest + centralize module loader](./2-compiler-manifest-unification.md) | compiler, runtime, host-worker, conformance | None | Medium |

The two tasks are independent and may land in either order / in
parallel.

## Deferred / Follow-Up

- **Converter-side scalar-source slotting (Task 1, option b)** — instead
  of widening the core type, have the converter hoist a computed `ta.*`
  source into a synthesized `state.series` slot
  (`packages/pine-converter/src/transform/emitContext.ts:362`). Heavier
  (per-callsite slot synthesis) and only fixes converter output, not
  hand-written scalar sources. Not pursued; Task 1 option (a) is smaller
  and covers both. Listed here as the fallback if widening the core type
  is rejected on API-surface grounds.
- **External / non-symbol data feeds** (e.g. Pine
  `request.security("ESD_FACTSET:…;EARNINGS", …)`) — a genuine but niche
  gap (proprietary alternative-data source, computed ticker). Document as
  unsupported; not scheduled here.

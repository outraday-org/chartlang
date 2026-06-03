# Phase 1 — `0.1` Walking Skeleton

> **Plan reference:** PLAN.md §19 Phase 1, with cross-cuts into §4
> (eDSL), §5 (compiler), §6 (runtime), §7 (adapter contract), §8.2
> (worker host).
> **Prerequisite:** Phase 0 bootstrap complete (workspace + CI green).
> **Version target:** `0.1`.

## Goal

Compile and run a real `defineIndicator` script end-to-end against
the canvas2d reference adapter in a browser. EMA-cross with `plot()`
+ `alert()` should render correctly from `.chart.ts` source through
to pixels on a `<canvas>`.

## Deliverables

### `@invinite-org/chartlang-core`

- Types from §4.3: `Bar`, `Time`, `Price`, `Volume`, `Series<T>`,
  `Color`, `LineStyle`, `PlotLineStyle`, `AlertSeverity`,
  `ScriptManifest`, `IntervalDescriptor`.
- Constructors: `defineIndicator`, `defineAlert` (per §4.1).
- The **8 most-used primitives**: `ta.sma`, `ta.ema`, `ta.rsi`,
  `ta.macd`, `ta.atr`, `ta.crossover`, `ta.crossunder`, `plot`,
  `hline`, `alert`.
- Frozen `STATEFUL_PRIMITIVES` registry (§5.5) covering exactly
  these primitives.

### `@invinite-org/chartlang-compiler`

- TS-AST transformer that injects callsite ids per §5.5 (exact format
  `<path>:<line>:<col>#<callIndex>`, only for `STATEFUL_PRIMITIVES`
  callees).
- Static analysis: reject unbounded loops, `while`, recursion,
  hostile globals (`Math.random`, `Date.*`, `fetch`, `setTimeout`,
  `require`, dynamic `import`), and `stateful-call-inside-loop`.
- Manifest extraction: inputs schema, `capabilities`, `maxLookback`.
- esbuild bundling → ESM + `manifest.json` + `.d.ts`.
- `compile`, `compileFile`, `compileProject` per §5.3.

### `@invinite-org/chartlang-runtime`

- Ring-buffer `Series<T>` per §6.2 / §6.6, NaN-correct per §6.3.
- Stateful implementations of the 8 primitives.
- Execution loop (`onHistory`, `onBarClose`, `onBarTick`, `drain`,
  `dispose`) per §6.1.
- `bar`/series sync per §6.7. Determinism guarantees per §6.4.
- In-memory `StateStore` default (persistence backings deferred to
  Phase 5).

### `@invinite-org/chartlang-host-worker`

- `createWorkerHost()` per §8.2. postMessage protocol matching
  `ScriptHost` interface (§8.1).
- Boots compiled artifact in a Worker; relays bar events; drains
  emissions.

### `@invinite-org/chartlang-adapter-kit`

- `defineAdapter`, `Capabilities`, `CandleEvent` types per §7.1.
- Capability builders (`capabilities.line()`, etc.) covering the
  PlotKinds the 8 primitives emit.
- `validateEmission`, `decodeDrawing` per §7.3.
- Mock candle sources for testing.
- Base classes `PassThroughAdapter` and `BufferingAdapter`.

### `examples/canvas2d-adapter/`

- ~200-line reference adapter rendering to `<canvas>`.
- Imports only `@invinite-org/chartlang-adapter-kit` and
  `@invinite-org/chartlang-host-worker`.
- Declares minimal `Capabilities` covering the 8 primitives.

### `examples/scripts/`

- `ema-cross.chart.ts`
- `bollinger-bands.chart.ts`
- `rsi-divergence-alert.chart.ts`
- (Fourth example deferred to Phase 3 once drawings land:
  `fib-retracement.chart.ts`.)

### `@invinite-org/chartlang-cli`

- `chartlang compile <file>`
- `chartlang scaffold-adapter <name>` (creates starter package
  outside the OSS repo).

### `@invinite-org/chartlang-conformance`

- Seeded with golden outputs for the three example scripts above.
- `runConformanceSuite(adapter)` runs them and diffs emissions.

## Done criteria

- Open `examples/canvas2d-adapter/` in a browser; EMA-cross script
  renders the EMA line and fires alerts on crossovers.
- `pnpm test` passes for every package (no skipped suites).
- `pnpm conformance` passes against the canvas2d reference adapter.
- CLI compiles each example script and emits the expected
  `.chart.js` + `manifest.json` + `.d.ts` triple.
- Every primitive shipped has the §16.6 five-file test coverage
  (impl + golden + property + bench + conformance).

## Notes for `/write-tasks`

- §22.8 has an example PR sequence — useful for task granularity.
- Treat `@invinite-org/chartlang-core` as PR 2, compiler as PR 3,
  runtime as PR 4, host-worker + adapter-kit + ref adapter as PR 5,
  CLI + examples + conformance seed as PR 6. Adjust as needed.
- Indicator math here is the **first port** from invinite — set the
  port convention per §3.1 (origin header comment, behavioural
  reference, not transcribed code style).
- Defer everything tagged Phase 2+: full indicator parity, drawings,
  inputs UI, multi-timeframe, QuickJS host, state persistence.

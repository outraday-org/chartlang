# Phase 1 — `0.1` Walking Skeleton

> **Plan reference:** PLAN.md §19 Phase 1, with cross-cuts into §3
> (package responsibilities), §4 (eDSL), §5 (compiler), §6 (runtime),
> §7 (adapter contract), §8.2 (worker host), §9 (indicator
> primitives), §16 (full-coverage testing), §17 (docs).
> **Prerequisite:** Phase 0 bootstrap complete — workspace skeleton,
> scaffolded packages, gate scripts, docs stubs, and CI all green on
> the no-op bootstrap. See `tasks/phase-0-bootstrap/README.md`.
> **Version target:** `0.1` (per-package), `apiVersion: 1` (script
> manifest).

## Goal

Compile and run a real `defineIndicator` script end-to-end against
the `canvas2d` reference adapter in a browser. Three example scripts
(`ema-cross`, `bollinger-bands`, `rsi-divergence-alert`) compile via
the CLI to `.chart.js` + `manifest.json` + `.d.ts`, load into the
Worker host, run inside the runtime, and render correctly through
the canvas2d adapter to pixels on a `<canvas>` element.

This is the first phase that ships executable feature code. Every
deliverable lands with the §16.6 five-file test set (impl + golden
+ property + bench + conformance), JSDoc per §17.2, and 100%
coverage per §16.1 — these are not relaxed for the walking skeleton.

## Current State

Phase 0 left the repo at a fully-wired no-op:

- 10 published packages + `examples/canvas2d-adapter` scaffolded
  with the §22.4 template (each carries the `PACKAGE_VERSION = "0.0.0"`
  placeholder export and one passing test).
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm
  conformance && pnpm docs:check && pnpm readme:check` all pass.
- `scripts/docs-check.ts` enforces JSDoc presence + tag set but
  defers `@example` block execution to Phase 1 (TODO at
  `scripts/docs-check.ts:220` — `EXEMPT_EXPORTS` currently only
  contains `PACKAGE_VERSION`).
- `scripts/run-conformance.ts` exits 0 with `0 scenarios, 0 failures`
  when no `runConformanceSuite` export exists — Phase 1 fills that
  in.
- `examples/scripts/.gitkeep` is present, awaiting Phase 1's three
  `.chart.ts` files (the directory comment in PLAN.md §22.2 step 2
  reserves four names; the fourth — `fib-retracement.chart.ts` — is
  deferred to Phase 3 once drawings land).
- `examples/canvas2d-adapter/src/index.ts` is the placeholder
  version export.

## Target State

After all 12 tasks land:

### Core (`packages/core/src/`)

```
src/
├── index.ts                       # barrel — see §4.4 module surface
├── types.ts                       # Bar, Time, Price, Volume, Series<T>,
│                                  # ScriptManifest, IntervalDescriptor,
│                                  # Color, LineStyle, PlotLineStyle,
│                                  # AlertSeverity (+ supporting types)
├── define/
│   ├── defineIndicator.ts
│   ├── defineAlert.ts
│   └── index.ts
├── ta/
│   ├── ta.ts                      # ta.* namespace surface
│   └── index.ts
├── plot/
│   ├── plot.ts                    # plot, hline surfaces
│   └── index.ts
├── alert/
│   ├── alert.ts
│   └── index.ts
└── statefulPrimitives.ts          # frozen STATEFUL_PRIMITIVES Set
```

### Compiler (`packages/compiler/src/`)

```
src/
├── index.ts
├── api.ts                         # compile, compileFile, compileProject
├── program.ts                     # ts.Program construction + type checker
├── transformers/
│   ├── callsiteIdInjection.ts     # §5.5 — <path>:<line>:<col>#<index>
│   └── index.ts
├── analysis/
│   ├── forbiddenConstructs.ts     # while/recursion/hostile globals
│   ├── statefulCallInLoop.ts
│   ├── extractInputs.ts
│   ├── extractCapabilities.ts
│   ├── extractMaxLookback.ts
│   └── index.ts
├── manifest.ts                    # ScriptManifest assembly
├── bundle.ts                      # esbuild driver
└── diagnostics.ts                 # CompileDiagnostic codes + formatter
```

### Runtime (`packages/runtime/src/`)

```
src/
├── index.ts
├── createScriptRunner.ts          # §6.1 ScriptRunner factory
├── ringBuffer.ts                  # §6.2 / §6.6 RingBuffer<T>
├── seriesView.ts                  # Proxy wrapper around RingBuffer
├── streamState.ts                 # OHLCV + bar view + ta slots
├── stateStore.ts                  # in-memory default StateStore
├── execution/
│   ├── onHistory.ts
│   ├── onBarClose.ts              # §6.7 step 1-6
│   ├── onBarTick.ts               # §6.7 replaceHead path
│   ├── drain.ts
│   └── dispose.ts
├── ta/
│   ├── registry.ts                # name → stateful impl
│   ├── lib/                       # ported helpers (apply-offset, etc.)
│   ├── sma.ts                     # 9 primitives, each with the §16.6
│   ├── ema.ts                     #   five-file set co-located
│   ├── stdev.ts
│   ├── bb.ts
│   ├── rsi.ts
│   ├── macd.ts
│   ├── atr.ts
│   ├── crossover.ts
│   └── crossunder.ts
└── emit/
    ├── plot.ts
    ├── hline.ts
    ├── alert.ts
    └── emissionsQueue.ts
```

### Adapter-kit (`packages/adapter-kit/src/`)

```
src/
├── index.ts
├── defineAdapter.ts
├── types.ts                       # Adapter, CandleEvent, AlertChannel,
│                                  # PlotKind, DrawingKind, InputKind,
│                                  # SymInfoField
├── capabilities/
│   ├── capabilities.ts            # builders: capabilities.line(), etc.
│   └── index.ts
├── validation/
│   ├── validateEmission.ts        # §7.3 universal payload validator
│   ├── decodeDrawing.ts           # stub — no draw.* in Phase 1
│   └── index.ts
├── mocks/
│   ├── mockCandleSource.ts
│   └── index.ts
└── base/
    ├── passThroughAdapter.ts
    ├── bufferingAdapter.ts
    └── index.ts
```

### Host-worker (`packages/host-worker/src/`)

```
src/
├── index.ts
├── createWorkerHost.ts
├── workerBoot.ts                  # the bootstrap script the Worker runs
├── protocol.ts                    # postMessage message schemas
└── limits.ts                      # HostLimits + watchdog
```

### Canvas2d adapter (`examples/canvas2d-adapter/src/`)

```
src/
├── index.ts                       # ~200-line adapter (real renderer)
├── capabilities.ts                # declared Capabilities for 12 prims
└── render/                        # tiny private render helpers
    ├── line.ts
    ├── horizontalLine.ts
    └── alertBadge.ts
```

### Example scripts (`examples/scripts/`)

```
examples/scripts/
├── ema-cross.chart.ts
├── bollinger-bands.chart.ts
└── rsi-divergence-alert.chart.ts
# Deferred to Phase 3: fib-retracement.chart.ts
```

### CLI (`packages/cli/src/`)

```
src/
├── index.ts
├── bin.ts                         # #!/usr/bin/env node entry
├── commands/
│   ├── compile.ts                 # chartlang compile <file>
│   ├── scaffoldAdapter.ts         # chartlang scaffold-adapter <name>
│   └── index.ts
└── adapterTemplate/               # files copied by scaffold-adapter
```

### Conformance (`packages/conformance/`)

```
packages/conformance/
├── fixtures/
│   └── goldenBars.json            # 10 000 bars, 4 synthetic regimes (data
│                                  # lives outside `src/` so coverage doesn't
│                                  # see a JSON file as uncovered "code"; the
│                                  # generator and runner under `src/` import
│                                  # it via a relative path)
├── src/
│   ├── index.ts
│   ├── runConformanceSuite.ts
│   ├── fixtures/
│   │   └── generateGoldenBars.ts  # deterministic Mulberry32 generator;
│   │                              # writes `../../fixtures/goldenBars.json`
│   └── scenarios/
│       ├── emaCross.scenario.ts
│       ├── bollingerBands.scenario.ts
│       ├── rsiDivergenceAlert.scenario.ts
│       └── index.ts
└── vitest.config.ts               # excludes `fixtures/**` in addition to
                                   # the §16.1 defaults
```

### Repo-level changes

- `scripts/docs-check.ts` — replace the Phase-0 TODO with real
  `@example` execution via the compiler. Remove `PACKAGE_VERSION`
  from `EXEMPT_EXPORTS`.
- `scripts/run-conformance.ts` — no edit needed; it already detects
  the new export.
- Three `examples/scripts/*.chart.ts` files, golden output fixtures
  in `packages/conformance/fixtures/`.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **`apiVersion: 1` for every script** | PLAN.md §3.3 and §22.9 fix `apiVersion: 1` as the language version Phase 1 ships. Phase 7 freezes the surface; until then `0.1` package versions co-exist with `apiVersion: 1` script header. The compiler refuses scripts with any other `apiVersion`. |
| **Add `ta.stdev` + `ta.bb` to the Phase-1 primitive set (10 + 3, not 8 + 3)** | The README's `bollinger-bands.chart.ts` seed example needs `ta.bb`; `ta.bb` is one rolling-stddev away from `ta.sma`. Bumping the count from 8 to 10 keeps the three seed scripts as-is and demonstrates a multi-output primitive (BB returns `{ upper, middle, lower }`) — useful coverage for the §9.1 multi-output contract. Cheap math, high pedagogical value, no Phase-2 spillover. |
| **`STATEFUL_PRIMITIVES` for Phase 1 = exactly the 12 callable surfaces** | The frozen set is `{ "ta.sma", "ta.ema", "ta.stdev", "ta.bb", "ta.rsi", "ta.macd", "ta.atr", "ta.crossover", "ta.crossunder", "plot", "hline", "alert" }`. Every callsite the compiler injects an id into is in this set. Phase 2+ extends via the per-primitive registry — no code change to the compiler. |
| **`ta` namespace surface lives in `@invinite-org/chartlang-core`; impls live in `@invinite-org/chartlang-runtime`** | §3.2 / §4.4 — `core` declares the typed surface scripts import; `runtime` provides the stateful implementations. The compiler emits a bundle that wires script `ta.ema(...)` calls to the runtime's exported impls. `core` therefore depends on nothing; `runtime` depends on `core` for types only. |
| **`adapter-kit` is owned + tested by Phase 1, even though no real adapter is published from this repo** | Per §3.2, every consumer-repo adapter imports `@invinite-org/chartlang-adapter-kit`. The kit's `Adapter` / `Capabilities` / `CandleEvent` types and `validateEmission` are the contract the canvas2d reference adapter sits on and that future adapters extend. The kit lands in Task 4 so both runtime (Tasks 5-6) and host-worker (Task 9) can import its types without circular dependency. |
| **No `host-quickjs`, no `state.*`, no `request.security`, no `barstate.*`, no drawings, no `input.*`, no `defineDrawing` / `defineAlertCondition`** | Per the Phase-1 README and §19. Phase 4 lands editor + Tier-1 primitives (`state.*`, `barstate.*`, `syminfo.*`, `timeframe.*`, `ta.nz`, universal `opts.offset`). Phase 5 lands `host-quickjs` + server-side alerts + `defineAlertCondition`. Phase 3 lands drawings. Phase 1 ships only the surface the EMA-cross / BB / RSI-divergence examples actually exercise. |
| **`StateStore` ships as an in-memory `Map` only** | §6.1 / §6.9 — Phase 5 wires the IDB-backed store for warm restarts. Phase 1 includes the `StateStore` interface and the default `inMemoryStateStore()` factory; persistence backings come later. The runtime's contract is fixed in Phase 1 so Phase 5 is additive. |
| **Multi-stream code paths exist but stay dormant** | The runtime ships `StreamState` per §6.8 with the multi-interval shape, but `requestedIntervals` is always empty for Phase-1 scripts (the compiler rejects `request.security` calls — not part of the Phase-1 surface). This avoids a Phase-5 rewrite when `request.security` lands. |
| **`scripts/docs-check.ts` upgrade folds into the compiler-API task** | The Phase-0 `EXEMPT_EXPORTS` carve-out for `PACKAGE_VERSION` plus the `@example` block-execution TODO both come due once the compiler is callable. Task 3 (compiler API) extends the script and removes the exemption — keeps the change adjacent to its enabling code. |
| **Per-PR vs. per-task split** | The Phase-1 README's notes suggest PR boundaries 2–6 (core / compiler / runtime / host-worker+adapter-kit+ref-adapter / CLI+examples+conformance). Tasks 1, 2-3, 4-8, 9-10, 11-12 align with those PR bundles — each task is a focused session within a PR. Task numbering is execution order, not PR mapping. |
| **Runtime split into data structures (Task 5) + execution loop (Task 6)** | A single "runtime engine" task would have run over 500 spec lines. Split along the natural seam: Task 5 owns `RingBuffer` / `Float64RingBuffer` / `Series` Proxy / `StreamState` / `StateStore` / `RuntimeContext` slot; Task 6 owns `createScriptRunner` + `onHistory` / `onBarClose` / `onBarTick` / `drain` / `dispose`. The execution loop reads the data structures' contracts; the data structures don't reference the loop. |

## Dependency Graph

```
Task 1 (core types + constructors + primitive surface)
   |
   +---> Task 2 (compiler — AST transformer + static analysis)
   |        |
   |        v
   |     Task 3 (compiler — bundling + compile API + docs-check upgrade)
   |
   +---> Task 4 (adapter-kit — Adapter / Capabilities / validators)
            |
            v
         Task 5 (runtime — RingBuffer + Series + StreamState + StateStore + RuntimeContext)
            |
            v
         Task 6 (runtime — ScriptRunner + onHistory/onBarClose/onBarTick/drain/dispose)
            |
            v
         Task 7 (runtime — 9 ta.* primitives + math helpers, ported)
            |
            v
         Task 8 (runtime — plot / hline / alert + emissions queue)
            |
            v
         Task 9 (host-worker — createWorkerHost + postMessage protocol)
            |
            v
         Task 10 (canvas2d reference adapter — real renderer)
            |
            v
         Task 11 (3 example scripts + chartlang CLI: compile + scaffold-adapter)
            |
            v
         Task 12 (conformance — runConformanceSuite + scenarios + golden fixtures)
```

Each task depends only on lower-numbered tasks. Task 5 cannot land
before adapter-kit (Task 4) because the engine imports
`Capabilities` and `CandleEvent`. The execution loop (Task 6)
imports the data structures from Task 5. The ta.* primitives
(Task 7) and emission primitives (Task 8) plug into the engine via
`ACTIVE_RUNTIME_CONTEXT`. Host-worker (Task 9) needs the full
runtime — both engine and primitives — loaded inside the Worker.

## Task Summary

| # | Title | Type | Dependencies | Est. Complexity |
|---|-------|------|--------------|-----------------|
| 1 | [Core types, constructors, primitive surface](./1-core-types-and-surface.md) | Backend (core lib) | None | High |
| 2 | [Compiler — AST transformer + static analysis + manifest extraction](./2-compiler-ast-and-analysis.md) | Backend (compiler) | 1 | High |
| 3 | [Compiler — Bundling + compile API + docs-check upgrade](./3-compiler-bundling-and-api.md) | Backend (compiler) | 2 | Medium |
| 4 | [Adapter-kit — Adapter shape + Capabilities + emission validators](./4-adapter-kit.md) | Backend (lib) | 1 | High |
| 5 | [Runtime — RingBuffer + Series + StreamState + StateStore + RuntimeContext](./5-runtime-data-structures.md) | Backend (runtime) | 1, 4 | High |
| 6 | [Runtime — ScriptRunner + execution loop](./6-runtime-execution-loop.md) | Backend (runtime) | 5 | Medium |
| 7 | [Runtime — 9 ta.\* primitives + math helpers](./7-runtime-ta-primitives.md) | Backend (runtime) | 5, 6 | High |
| 8 | [Runtime — plot / hline / alert + emissions queue](./8-runtime-emission-primitives.md) | Backend (runtime) | 5, 6 | Medium |
| 9 | [Host-worker — createWorkerHost + postMessage protocol](./9-host-worker.md) | Backend (host) | 6, 7, 8 | Medium |
| 10 | [Canvas2d reference adapter](./10-canvas2d-reference-adapter.md) | Frontend (adapter) | 4, 9 | Medium |
| 11 | [Example scripts + CLI compile + scaffold-adapter](./11-examples-and-cli.md) | Frontend + CLI | 3, 7, 8 | Medium |
| 12 | [Conformance suite — runConformanceSuite + golden fixtures](./12-conformance-suite.md) | Backend (tests) | 10, 11 | Medium |

## Code Reuse

| New artefact | Location | Rationale |
|---|---|---|
| `packages/core/src/types.ts` | core package | Single source of truth for `Bar` / `Series<T>` / `ScriptManifest` / `IntervalDescriptor` — imported by every other package. |
| `packages/core/src/statefulPrimitives.ts` | core package | The frozen `STATEFUL_PRIMITIVES` Set is consumed by both compiler (callsite-id injection) and runtime (slot-store keying). Lives in core for shared dependency. |
| `packages/adapter-kit/src/types.ts` | adapter-kit package | `Adapter` / `CandleEvent` / `Capabilities` / `PlotKind` / `DrawingKind` / `InputKind` types — imported by runtime, host-worker, canvas2d adapter, conformance suite. |
| `packages/runtime/src/ta/lib/` | runtime package | Ported math helpers (`applyOffset`, `pickCandleSource`, `readSourceField`, `rollingStddev`, `trSeries`) — consumed by multiple ta.* primitives in this phase and by every Phase-2 port. |
| `packages/conformance/fixtures/goldenBars.json` | conformance package | Shared 10 000-bar fixture — imported by `*.golden.test.ts` in `packages/runtime/src/ta/` AND by conformance scenarios. Generated once in Task 12. Lives outside `src/` so vitest doesn't count it; per-package `vitest.config.ts` also explicitly excludes `fixtures/**`. |

Existing infrastructure to consume rather than recreate:

| Reuse | Source | Notes |
|---|---|---|
| `scripts/scaffold.ts` | Phase 0 | Already idempotent — rerun if any new package gets added (none in Phase 1). |
| `scripts/docs-check.ts` | Phase 0 | Extended in Task 3 to execute `@example` blocks via the compiler. Do not rewrite — extend in place. |
| `scripts/run-conformance.ts` | Phase 0 | Already auto-detects the runner. Task 12 wires the canvas2d adapter as the default + a small adapter-resolution edit; see Task 12's spec. |
| `scripts/coverage-merge.ts` | Phase 0 | Phase 1 packages plug in for free; no edit needed. |
| Per-package `vitest.config.ts` | Phase 0 (§16.1 template) | 100% coverage thresholds already enforced. The `exclude` list (`index.ts`, `types.ts`) is the only exemption — Phase-1 tasks honour it. |
| MIT header convention | Phase 0 `packages/CLAUDE.md` | Every `.ts` file in `packages/*` carries the two-line MIT header. |

## Deferred / Follow-Up Work

Anything tagged Phase 2+ in PLAN.md §19. Items consciously **not**
in Phase 1:

- **Full indicator parity (Phase 2 / §9.2).** ~80 more `ta.*`
  primitives, plus the source-of-truth `packages/runtime/src/ta/
  registry.ts` expansion.
- **Drawings (Phase 3 / §10).** `draw.*` namespace, 61
  `DrawingKind`s, `decodeDrawing` real impl, drawing
  emission paths.
- **Editor (Phase 4 / §14).** `@invinite-org/chartlang-language-service`
  and `@invinite-org/chartlang-editor` stay at the
  Phase-0 placeholder export. Their `src/index.ts` remains
  `PACKAGE_VERSION = "0.0.0"` until Phase 4.
- **Tier-1 ergonomics (Phase 4).** `state.*` / `state.tick.*`
  (§4.6), `barstate.*` (§4.7), `syminfo.*` (§4.8), `timeframe.*`
  (§4.9), `ta.nz` (§9), universal `opts.offset` (§9.1),
  `defineIndicator` overrides (`maxBarsBack`, `maxDrawings`,
  `format`, `precision`, `scale`, `requiresIntervals`,
  `shortName`).
- **Inputs UI (Phase 4).** `input.*` builders ship at the
  Phase-0 stub level — the example scripts use defaults only,
  no runtime input resolution.
- **Multi-timeframe (Phases 4-6).** `input.interval(...)`,
  `request.security({ interval })`, `request.lowerTf({ interval })`,
  `align-htf-series-to-ltf` helper.
- **QuickJS host (Phase 5 / §8.3).** `host-quickjs` stays at the
  Phase-0 placeholder. Sandbox-escape test suite (§16.2) defers
  to Phase 5.
- **State persistence (Phase 5 / §6.9).** `idbStateStore`, full
  `StateSnapshot` save/load lifecycle, warm-start determinism
  test. Phase 1 ships only the `StateStore` interface + in-memory
  default.
- **`defineAlertCondition`, `runtime.log.*`, `runtime.error()`,
  `draw.table` (Phase 5).**
- **CLI `lint` + `bench` + `docs` subcommands (Phase 2+).** Phase 1
  ships only `compile` and `scaffold-adapter`.
- **Sandbox-escape test suite (Phase 5).** Phase 1's `host-worker`
  watchdog is the structured-clone + CPU timeout pair; the QuickJS
  hardening lands with the QuickJS host.
- **VitePress build (`pnpm docs:build`).** Phase 0's stub markdown
  remains. Phase 4 adds the vitepress config + theme when there's
  enough generated content to warrant a build.
- **Auto-generated `docs/primitives/<area>/<id>.md` pages and the
  `gen-docs.ts` script.** CONTRIBUTING §4 and PLAN.md §22.10 list
  an "auto-generated docs page" as the seventh item of the per-port
  set. Phase 1 ships the JSDoc source for every primitive (with the
  `@formula` / `@warmup` / `@since` / `@example` tags `gen-docs`
  reads) but defers the generator + the generated pages to Phase 2,
  where the next-batch indicator ports drop in alongside `gen-docs.ts`
  in `packages/cli/src/`. Tasks 7 and 12 explicitly call this out so
  no reviewer chases a phantom missing requirement.

After Phase 1 the next phase ports the rest of the indicator
catalogue (§19 Phase 2).

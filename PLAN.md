# `chartlang` — Plan for an Open-Source Trading-Chart Scripting Language

> **Status:** Project plan — the bootstrap document for this repo.
> **License:** MIT.
> **Package scope:** `@invinite-org/chartlang-*`.
> **File extension:** `.chart.ts` (scripts are TypeScript modules).
> **Audience:** the engineer (or LLM agent) bootstrapping this repo from
> scratch. Read top-to-bottom before writing the first line of code.
>
> **Implementation reference.** Built-in indicator math and drawing
> schemas are ported from a working TradingView-style chart in a
> sibling repo. See §3.1 "Reference implementation paths" below for
> the exact folders to consult when porting each primitive.

---

## 1. Vision

`chartlang` is the open-source equivalent of TradingView Pine Script: a small,
typed, sandboxable scripting language for writing **indicators**, **drawings**,
and **alerts** against a candle stream — plus an **adapter contract** so any
charting library (any TradingView-style chart, Lightweight Charts, Highcharts,
plain SVG, a headless server) can render and execute scripts written in it.

Two pillars:

1. **Scripts are TypeScript modules** that import primitives from
   `@invinite-org/chartlang-core`. No bespoke parser, no new language. The `chartlang`
   compiler is a small **TS-AST transformer + bundler** that injects
   per-callsite state slots and emits a self-contained ESM module ready for a
   sandboxed runtime.
2. **Adapters declare capabilities.** A script that emits a Fibonacci wedge or
   an `alert()` runs unchanged against an adapter that doesn't support either:
   the unsupported primitives become **silent no-ops** and the rest of the
   script renders normally. This is what makes the same script useful in a
   v1 chart that doesn't support alerts yet AND in a future server-side
   alert runner.

### Non-goals

- Not a general-purpose programming language. The runtime is constrained
  (no unbounded loops, no network, no filesystem, no DOM).
- Not a strategy/backtesting engine in v1. Strategy primitives (orders, P&L,
  position sizing) are deferred; the language design must not block them.
- Not a Pine Script transpiler. We will not parse `.pine` files. We may ship a
  separate `chartlang-from-pine` translator later, but it's out of scope here.
- Not married to any specific chart. The OSS repo stays chart-agnostic;
  adapters live in consumer repos (see §15).

---

## 2. Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────────┐
│  User script (foo.chart.ts) — TypeScript module                      │
│  imports { defineIndicator, ta, plot, draw, alert, input, color }    │
│  from "@invinite-org/chartlang-core"                                              │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │  tsc + chartlang transformer
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Compiled artifact (.chart.js + .chart.d.ts + manifest.json)         │
│  - ESM module exporting a default `CompiledScript` object            │
│  - Manifest: inputs schema, declared capabilities, version pin       │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                ▼                  ▼                  ▼
       ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
       │ Worker host    │  │ QuickJS-WASM   │  │ Headless host  │
       │ (browser)      │  │ host (server)  │  │ (tests/CLI)    │
       └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
               └──────────┬────────┴───────────────────┘
                          │ ScriptHost interface
                          ▼
            ┌─────────────────────────────────┐
            │ Adapter (chart-specific)        │
            │  declares: Capabilities         │
            │  receives: Plot / Draw / Alert  │
            │  emits:    candle stream        │
            └─────────────────────────────────┘
```

The arrows are typed. Every cross-package boundary has a stable JSON-friendly
schema that survives `structuredClone` so the same payload moves through
postMessage (Worker) and through the QuickJS-WASM membrane unchanged.

---

## 3. Repo & Package Layout

Single pnpm monorepo, TypeScript-first. Every package ships ESM + types. No
CJS. No bundled runtimes — adapters bring their own.

```
chartlang/
├── package.json                       # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json                         # formatter + linter (no eslint)
├── .changeset/                        # release notes via @changesets/cli
├── LICENSE                            # MIT
├── README.md
├── docs/
│   ├── language/                      # narrative docs (Diátaxis split)
│   ├── primitives/                    # auto-generated from JSDoc
│   ├── adapters/                      # how to write an adapter
│   └── examples/                      # tutorial scripts
├── examples/
│   ├── ema-cross.chart.ts             # example scripts
│   ├── bollinger-bands.chart.ts
│   ├── fib-retracement.chart.ts
│   ├── rsi-divergence-alert.chart.ts
│   └── canvas2d-adapter/              # reference adapter, ~200 lines Canvas2D, zero chart-lib dep
└── packages/
    ├── core/                          # @invinite-org/chartlang-core
    ├── compiler/                      # @invinite-org/chartlang-compiler
    ├── runtime/                       # @invinite-org/chartlang-runtime
    ├── host-worker/                   # @invinite-org/chartlang-host-worker
    ├── host-quickjs/                  # @invinite-org/chartlang-host-quickjs
    ├── adapter-kit/                   # @invinite-org/chartlang-adapter-kit — SDK consumers import to write adapters
    ├── editor/                        # @invinite-org/chartlang-editor (CodeMirror 6 package)
    ├── cli/                           # @invinite-org/chartlang-cli (compile / lint / bench / scaffold-adapter)
    └── conformance/                   # @invinite-org/chartlang-conformance (test suite every adapter runs)
```

**No chart-specific adapter packages live in the OSS repo.** This is
load-bearing: chartlang aims to be a standard, not a TradingView/our-chart
binding. Adapters live in consumer repos (ours, TradingView's, Highcharts',
whoever). The OSS repo ships exactly one *reference* adapter under
`examples/canvas2d-adapter/` that depends on nothing except
`@invinite-org/chartlang-adapter-kit` and a `<canvas>` element — its job is to prove the
contract is implementable and serve as the canonical
copy-from-this-when-writing-yours template.

### 3.1 Reference implementation paths (sibling `invinite` repo)

Built-in indicator math and drawing schemas are **ported from a working
TradingView-style chart** that lives in a sibling repo on disk. When
implementing a primitive in `packages/runtime/src/`, consult these
folders for the canonical algorithm, parameter shapes, NaN-warmup
conventions, edge-case handling, and test fixtures.

Paths are **relative to this repo's root** (`chartlang/`). The sibling
repo is `../invinite/`. Clone both side-by-side under the same parent
directory before starting work:

```
~/code/
├── chartlang/        ← this repo
└── invinite/         ← reference implementation
```

| Reference area | Path (relative to chartlang root) | What to look at |
|---|---|---|
| **Indicator math** | `../invinite/src/components/trading-chart/indicators/` | One `<id>.ts` file per indicator. Float64Array-based math, NaN-warmup conventions, `extendCompute` tail-extend pattern. ~90 files. |
| **Indicator helpers** | `../invinite/src/components/trading-chart/indicators/lib/` | Shared math helpers — `ema-of-float64.ts`, `tr-series.ts` (True Range / ATR), `donchian-mid.ts`, `wilder-directional.ts`, `linear-regression.ts`, `format-compact.ts`, `pick-candle-source.ts`. Port these first; many indicators depend on them. |
| **Indicator contract docs** | `../invinite/src/components/trading-chart/indicators/CLAUDE.md` | Full inventory table by category, contract semantics, "How to add a new indicator" walkthrough with worked VWAP example. **Read this before porting any indicator.** |
| **Indicator tests** | `../invinite/src/components/trading-chart/indicators/<id>.test.ts` | One per indicator. Vitest tests pinning the math against `buildVisualBaselineCandles(100)` fixture. Port these alongside the implementation. |
| **Indicator benches** | `../invinite/src/components/trading-chart/indicators/<id>.bench.test.ts` | Bench tests for hot primitives (sma/ema/bb/rsi/macd/vol). Port alongside. |
| **Drawing schemas** | `../invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts` | TypeScript types for all ~60 drawing kinds (`LineDrawing`, `RectangleDrawing`, `FibRetracementDrawing`, `ElliottImpulseWaveDrawing`, …). Read this to derive the `DrawingState` discriminated union in §10. |
| **Drawing tool behavior** | `../invinite/src/components/trading-chart/tools/` | One `<name>-tool.ts` per drawing. Placement, hit-testing, edit handles, anchor semantics. Reference for `draw.*` primitive parameter shapes and `editHandles` patterns. ~60 files. |
| **Drawing system docs** | `../invinite/src/components/trading-chart/CLAUDE.md` | Trading-chart-level invariants — coordinate frames, world-point conventions, anchor semantics. Read for context. |
| **Rendering reference** | `../invinite/src/components/trading-chart/webgl/builders/` | Descriptor builders that the canvas2d reference adapter mimics at lower fidelity — `indicator-line-builder.ts`, `volume-bars-builder.ts`, `macd-histogram-bars-builder.ts`, `horizontal-threshold-builder.ts`, `filled-band-builder.ts`. Show what each `PlotKind` actually means visually. |
| **Color/style reference** | `../invinite/src/components/trading-chart/webgl/colors.ts` | Canonical palette colors. Port into `@invinite-org/chartlang-core/style`. |
| **Bar / candle types** | `../invinite/src/components/trading-chart/lib/candle-types.ts` | `ChartCandle` shape that the runtime's `Bar` type mirrors. |

**How to use these references when porting:**

1. Read `indicators/CLAUDE.md` first. Internalise the contract pattern
   (manifest fields, `compute`, `extendCompute`, NaN-warmup, primary
   series key) before touching code.
2. For each primitive, open the matching `indicators/<id>.ts` +
   `<id>.test.ts` side by side. Port the algorithm verbatim into
   `packages/runtime/src/ta/<id>.ts` against the `Series<T>` shape
   defined in §4.3.
3. For drawings, derive the `DrawingState` variant from
   `y-doc-bridge.ts`'s typedefs. The chartlang variant strips
   collab-only fields (Yjs ids, layer ids, intervals) and keeps only
   the geometry + style fields the script supplies.
4. For each ported indicator, ship the 5 test files described in
   §16.6 — the invinite `.test.ts` is one of them (retargeted at
   `Series<T>`); the other four (property / golden / bench /
   conformance) are new.

**License + provenance.** The invinite math is © Invinite, re-licensed
MIT for this repo with attribution. Every ported file carries a header
comment naming its origin. See `CONTRIBUTING.md` for the relicense note
template.

**Provenance is "look here for behavior," not "look here for code
style."** This repo's code style, type system, and primitive contract
are defined by `@invinite-org/chartlang-core`. The invinite implementations are
behavioral references — same numbers in, same numbers out — not
copy-paste targets. Where invinite's plugin shape (`IndicatorPlugin<TParams>`
with `compute` / `buildLayers` / `buildLegend` slots) differs from
chartlang's primitive shape (single function returning `Series<T>`),
chartlang's shape wins. Translate, don't transcribe.

### 3.2 Package responsibilities

| Package | Public API | Internal | Depends on |
|---|---|---|---|
| `@invinite-org/chartlang-core` | `defineIndicator`, `defineDrawing`, `defineAlert`, primitives (`ta.*`, `plot`, `draw.*`, `alert`, `input.*`, `color.*`, `style.*`), types (`Series<T>`, `Bar`, `Time`, `Price`, …) | hidden state slot helpers | nothing |
| `@invinite-org/chartlang-compiler` | `compile(source, opts) → CompiledScript`, `compileFile`, `compileProject` | TS transformer that injects callsite IDs, esbuild bundler, manifest extractor | `typescript`, `esbuild` |
| `@invinite-org/chartlang-runtime` | `createScriptRunner(compiled, ctx) → ScriptRunner`, types for `ScriptHost` / `Adapter` / `Capabilities` | series implementations (ring buffers), stateful TA functions, NaN-correct math | `@invinite-org/chartlang-core` (types only) |
| `@invinite-org/chartlang-host-worker` | `createWorkerHost() → ScriptHost` | Web Worker boot, postMessage protocol | `@invinite-org/chartlang-runtime` |
| `@invinite-org/chartlang-host-quickjs` | `createQuickJsHost() → ScriptHost` | QuickJS-WASM boot, memory caps, CPU caps | `@invinite-org/chartlang-runtime`, `quickjs-emscripten` |
| `@invinite-org/chartlang-adapter-kit` | `defineAdapter(opts) → Adapter`, `Adapter` / `Capabilities` / `CandleEvent` types, capability builders (`capabilities.line()`, `capabilities.histogram()`, etc.), `validateEmission(e)`, `decodeDrawing(e)`, mock candle sources for testing, base classes (`PassThroughAdapter`, `BufferingAdapter`) | shared bookkeeping for adapter authors | `@invinite-org/chartlang-core`, `@invinite-org/chartlang-runtime` |
| `@invinite-org/chartlang-editor` | `createChartlangEditor(opts)` — CodeMirror 6 extension bundle (syntax via TS, hover docs, autocomplete, inline diagnostics) | LSP-shaped facade over the compiler | `@invinite-org/chartlang-compiler`, `codemirror` |
| `@invinite-org/chartlang-cli` | `chartlang compile foo.chart.ts`, `chartlang lint`, `chartlang bench`, `chartlang scaffold-adapter <name>` (creates a starter adapter package outside the OSS repo) | thin wrapper around compiler + runtime + adapter-kit scaffolding | `@invinite-org/chartlang-compiler`, `@invinite-org/chartlang-runtime`, `@invinite-org/chartlang-adapter-kit` |
| `@invinite-org/chartlang-conformance` | `runConformanceSuite(adapter) → Report` — 200+ scenarios that any `Adapter` instance from any repo can run against itself | golden fixtures of (script × candles) → expected plots/drawings/alerts | `@invinite-org/chartlang-core`, `@invinite-org/chartlang-runtime`, `@invinite-org/chartlang-adapter-kit` |
| `examples/canvas2d-adapter/` | Reference adapter — not published to npm. ~200 lines. Imports `@invinite-org/chartlang-adapter-kit`, renders to a `<canvas>` element. Copy-from-this template. | demonstrates the adapter contract end-to-end | `@invinite-org/chartlang-adapter-kit`, `@invinite-org/chartlang-host-worker` |

### 3.3 Versioning

- Every package is `0.x` until the language spec stabilizes. After `1.0`,
  semver applies.
- Scripts pin a language version in their header (`apiVersion: 1`). The
  compiler refuses to compile a script whose `apiVersion` doesn't match the
  compiler's supported set. Compiler can support N..N+2.
- Adapters declare a supported `apiVersion` range; runtime rejects a script/
  adapter version mismatch with a clear error.

---

## 4. The eDSL — Language Surface

### 4.1 Script shape

A script is one TypeScript module that default-exports a `CompiledScript`-shaped
object built by one of three constructors:

```ts
import { defineIndicator, ta, plot, color, input } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA + Cross",
    apiVersion: 1,
    overlay: true,                          // paints on the price pane
    inputs: {
        length: input.int(20, { min: 1, max: 500 }),
        source: input.source("close"),
    },
    compute({ inputs, bar, ta, plot, alert }) {
        const src = bar[inputs.source];     // "close" → bar.close, etc.
        const ema = ta.ema(src, inputs.length);

        plot(ema, { color: color.purple, title: "EMA", lineWidth: 2 });

        if (ta.crossover(bar.close, ema)) {
            alert("Bullish cross", { severity: "info" });
        }
    },
});
```

Three constructor types:

| Constructor | Purpose | Capability gate |
|---|---|---|
| `defineIndicator({ … })` | Emits plots, drawings, alerts. Re-runs per bar. | `indicators` |
| `defineDrawing({ … })` | Imperatively places drawings (interactive tools). | `drawings` |
| `defineAlert({ … })` | Headless alert-only — no plot/draw side effects. | `alerts` |

A repo can contain `chartlang.config.ts` that declares default `apiVersion`,
license header, formatter rules. Optional. The compiler reads it if present.

### 4.2 The `compute` contract

`compute` is **the per-bar step function**. It is called once for every
historical bar in forward order, then once on every realtime tick of the
current bar. Inside `compute`:

- `bar` is the current bar (typed `Bar`).
- `inputs` is the resolved input bag (typed off `inputs`).
- `ta.*` primitives are **stateful across calls** at the same callsite (the
  compiler assigns stable IDs — see §5).
- `plot()` / `draw.*()` / `alert()` are **side-effectful** and tagged to the
  current bar by the runtime.
- `bar[1]` / `bar.close[1]` / `ta.ema(src, 14)[1]` are all valid: `[N]` is
  "N bars ago" on any `Series<T>`.
- All loops are bounded (`for` over fixed counts, no `while (true)`). Static
  analysis in the compiler rejects unbounded loops.
- No `Math.random`, `Date.now`, `fetch`, `setTimeout`, or any host global.
  Compiler errors on these. `bar.time` is the only clock.

### 4.3 Core types

Exported from `@invinite-org/chartlang-core/types`:

```ts
export type Time = number;            // ms since epoch (UTC)
export type Price = number;           // floating-point price
export type Volume = number;          // floating-point volume

export type Bar = {
    readonly time: Time;
    readonly open: Price;
    readonly high: Price;
    readonly low: Price;
    readonly close: Price;
    readonly volume: Volume;
};

export type Series<T> = {
    /** Current bar's value. `series[0]` is identical. */
    readonly current: T;
    /** `series[n]` = n bars ago. Returns NaN/undefined for OOR. */
    readonly [n: number]: T;
    /** Length of the series so far (bars seen). */
    readonly length: number;
};

export type Color = string;           // CSS color string ("#26a69a", "rgba(…)", named)
export type LineStyle = "solid" | "dashed" | "dotted";

export type AlertSeverity = "info" | "warning" | "critical";

export type ScriptManifest = {
    apiVersion: 1;
    kind: "indicator" | "drawing" | "alert";
    name: string;
    inputs: InputSchema;              // declared via `input.*` builders
    capabilities: ReadonlyArray<CapabilityId>;  // computed by the compiler
};
```

### 4.4 Module surface

```ts
// barrel: @invinite-org/chartlang-core
export { defineIndicator, defineDrawing, defineAlert } from "./define";
export { ta } from "./ta";            // technical analysis primitives
export { plot, hline, vline, fill } from "./plot";
export { draw } from "./draw";        // drawing primitives namespace
export { alert } from "./alert";
export { input } from "./input";      // input builders
export { color, style } from "./style";
export type { … }                     // see §4.3
```

The `ta`, `plot`, `draw`, `alert`, `input` namespaces are populated entirely
from `@invinite-org/chartlang-runtime` primitive registries (see §9 / §10) so adding a new
indicator is one entry in the registry, with the typed surface picked up
automatically by TS declaration merging.

---

## 5. The Compiler

### 5.1 Why we need a compiler

We do not parse TypeScript ourselves — `tsc` does. The compiler is a **TS-AST
transformer + bundler** that does three jobs:

1. **Callsite-ID injection.** `ta.ema(src, 20)` is stateful (it remembers its
   prior output). Pine Script uses positional identity in the source; we
   replicate that by injecting a stable `__slot` argument into every stateful
   primitive call. Without this the runtime would need stack-walk identity
   (slow, unreliable) or the user would have to declare every indicator
   instance explicitly upfront (annoying).
2. **Static analysis.** Walk the AST and extract:
   - Declared inputs schema (`input.*` calls at module scope or top of
     `compute`).
   - Set of primitive ids used → emit a `Capabilities` set into the manifest.
   - Forbidden constructs: unbounded loops, `while`, recursion, hostile
     globals (`Math.random`, `Date.*`, `fetch`, `setTimeout`, `require`,
     dynamic `import`). Hard error.
   - Max lookback `N` across all `series[N]` reads → emit `maxLookback` so
     the runtime can size ring buffers and refuse scripts whose lookback
     exceeds adapter limits.
3. **Bundling.** Resolve module imports, tree-shake, emit a single ESM module
   plus a sibling `manifest.json` plus a sibling `.d.ts`.

### 5.2 Pipeline

```
foo.chart.ts
   │
   ├─►  tsc programmatic API: typecheck against @invinite-org/chartlang-core types
   │
   ├─►  TS transformer:
   │     - inject __slot args into stateful calls (ta.*, plot keyed by title)
   │     - rewrite series-indexing to ring-buffer reads
   │     - hoist inputs to module scope
   │     - emit `__manifest` with capabilities + maxLookback
   │
   ├─►  Static analysis pass: reject forbidden constructs
   │
   ├─►  esbuild bundle: resolve imports, tree-shake, emit ESM
   │
   └─►  Output:
         foo.chart.js         (ESM, ~5–50 KB depending on script)
         foo.chart.manifest.json
         foo.chart.d.ts       (declaration mirroring the script's inputs/outputs)
```

### 5.3 Compiler API

```ts
// @invinite-org/chartlang-compiler
export type CompileOptions = {
    apiVersion: 1;
    sourcePath?: string;
    sourcemap?: boolean | "inline" | "external";
    minify?: boolean;
    target?: "es2022";       // fixed
    transformPlugins?: ReadonlyArray<TransformerPlugin>;
};

export type CompiledScript = {
    moduleSource: string;        // ESM
    sourcemap?: string;
    manifest: ScriptManifest;
    types: string;               // .d.ts source
};

export function compile(source: string, opts: CompileOptions): Promise<CompiledScript>;
export function compileFile(path: string, opts: CompileOptions): Promise<CompiledScript>;
export function compileProject(rootDir: string, opts: CompileOptions): Promise<ReadonlyArray<CompiledScript>>;
```

### 5.4 What the compiler does NOT do

- It does not optimise math. Indicator primitives ship hand-tuned reference
  implementations (see §9). The compiler doesn't try to fold constants or
  inline.
- It does not transpile to a different target. ES2022 only. The Worker host
  and QuickJS host both support it.
- It does not enforce style rules. Use Biome separately.

### 5.5 Callsite-ID Algorithm (load-bearing — pin this)

The compiler injects a stable string id into every **stateful primitive
call** so the runtime can key per-script state without runtime stack
inspection or user-managed handles. This is the load-bearing trick that
makes `const ema = ta.ema(close, 20)` work like Pine.

**ID format:**

```
<package-relative-source-path>:<line>:<column>#<callIndex>
```

- `package-relative-source-path` — POSIX-normalised, no leading `./`.
- `line`, `column` — 1-based, from the **input** TS AST (before any
  transformer touches the tree). Read from the TypeScript SourceFile via
  `ts.getLineAndCharacterOfPosition`.
- `callIndex` — 0-based counter disambiguating multiple stateful calls
  at the same source position. Always `0` for hand-written code; non-zero
  only when a macro / `defineX` helper expands to multiple stateful calls
  in one position.

**Which calls get an id:**

The runtime exports a `STATEFUL_PRIMITIVES` registry — a frozen string set
of fully-qualified call names (`"ta.ema"`, `"ta.sma"`, `"plot"`,
`"draw.line"`, `"alert"`, etc., one entry per primitive in §9 / §10 / §11).
The compiler walks the AST, uses TypeScript's type checker to resolve each
`CallExpression`'s callee, and rewrites only the calls whose resolved
fully-qualified name is in the set.

```ts
// User writes:
const ema = ta.ema(series.close, 20);

// Compiler emits:
const ema = ta.ema("examples/ema-cross.chart.ts:7:21#0", series.close, 20);
```

The slot id is **always a string literal** (no symbol references, no
template strings). esbuild's minifier preserves string literals byte-for-
byte, so `minify: true` does not change ids. Sourcemaps preserve original
positions so the literal's value remains deterministic across rebuilds.

**State lifetime:**

Per-`ScriptRunner` instance. The runtime owns a single
`Map<slotId, unknown>` per script mount. Two mounts of the same script —
e.g. SMA(20) overlaying lane 1 and SMA(20) overlaying lane 2 — get
independent state maps. State is cleared on `dispose()` and on the
runtime's "seek to history bar 0" reset path (after a candle refetch).

**Loops:**

Every iteration of a loop hits the same source position → same slot id →
shared state → wrong results. To prevent silent corruption, the compiler's
static-analysis pass **rejects every stateful primitive call inside a
loop body** with the diagnostic
`stateful-call-inside-loop`. Mirrors Pine's identical restriction. Users
that genuinely need N indicators write N calls or use a manifest-time
helper (`maRibbon` is built-in).

**Custom primitives (post-v1):**

A user library that wants to ship its own stateful primitive registers it
via `@invinite-org/chartlang-core/extend` and the compiler picks it up through the
project's `chartlang.config.ts`. v1 ships with the registry frozen; this
escape hatch lands in v1.1.

---

## 6. The Runtime

`@invinite-org/chartlang-runtime` owns the **per-bar execution loop** and the **stateful
primitive implementations**. It does not know about Workers, QuickJS, or
specific adapters — those are pluggable.

### 6.1 The execution loop

```ts
// @invinite-org/chartlang-runtime
export type ScriptRunner = {
    /** Append historical bars in bulk (initial backfill). */
    onHistory(bars: ReadonlyArray<Bar>): Promise<void>;
    /** Append one new closed bar (live or replay). */
    onBarClose(bar: Bar): Promise<void>;
    /** Update the currently-forming bar (realtime tick). */
    onBarTick(bar: Bar): Promise<void>;
    /** Drain emissions (plots/drawings/alerts) since the last drain. */
    drain(): RunnerEmissions;
    /** Free buffers, terminate worker, etc. */
    dispose(): void;
};

export type RunnerEmissions = {
    plots: ReadonlyArray<PlotEmission>;
    drawings: ReadonlyArray<DrawingEmission>;
    alerts: ReadonlyArray<AlertEmission>;
    diagnostics: ReadonlyArray<RuntimeDiagnostic>;
};

export function createScriptRunner(args: {
    compiled: CompiledScript;
    host: ScriptHost;
    capabilities: Capabilities;
    /** Where the runner gets state slots from. Default: in-memory Map. */
    stateStore?: StateStore;
}): ScriptRunner;
```

### 6.2 The `Series<T>` implementation

A `Series<T>` is backed by a **ring buffer** sized to the script's
`maxLookback + 1`. `series[0]` is the current value, `series[N]` reads the
buffer at `(head - N) mod capacity`. Out-of-range reads return `NaN` for
`number`, `undefined` for objects. Writes happen exactly once per `step` per
callsite.

Stateful primitives (`ta.ema`, `ta.rsi`, …) read their hidden state slot from
the runtime's per-script `StateStore` keyed by the compiler-assigned slot id,
update it, and write the new value into their own output series. The output
series identity is stable across calls so consumers (`ta.crossover`,
`plot`) keep their references.

### 6.3 NaN correctness

Every primitive returns `NaN` during its warmup period. `crossover` /
`crossunder` ignore NaN comparisons. `plot` skips NaN slots cleanly. This
mirrors TradingView's NaN-warmup convention exactly, so existing Pine
intuition transfers.

### 6.4 Determinism

Same input → same output, always. The runtime forbids non-deterministic
host calls. The execution order inside `compute` is the source order. No
async. No threads. This is what makes alerts trustworthy.

### 6.5 No unbounded growth

The runtime accumulates ring-buffer state up to `maxLookback + 1` per series,
which is bounded by static analysis. Drawings and alerts are drained by the
host every bar (see §7). Long-running scripts have stable memory.

### 6.6 `Series<T>` Runtime Contract (pin this)

The plan declares `Series<T>` as a type in §4.3. This subsection pins the
runtime behaviour every host implementation must match.

**Backing storage:**

Every `Series<T>` is one `RingBuffer<T>`. For `T = number` the buffer is a
`Float64Array`; for object types it's `Array<T>`.

```ts
class RingBuffer<T> {
    private buf: T[];                  // or Float64Array for T = number
    private head = -1;                 // index of most recent slot, -1 when empty
    private filled = 0;

    constructor(public readonly capacity: number) {
        this.buf = new Array(capacity);
    }

    append(v: T): void {
        this.head = (this.head + 1) % this.capacity;
        this.buf[this.head] = v;
        if (this.filled < this.capacity) this.filled += 1;
    }

    /** Replace the head slot in place — used by `onBarTick`. */
    replaceHead(v: T): void {
        if (this.head === -1) { this.append(v); return; }
        this.buf[this.head] = v;
    }

    /** Read N bars ago. N = 0 is current; N >= filled returns OOR sentinel. */
    at(n: number): T | undefined {
        if (n < 0 || n >= this.filled) return undefined;
        return this.buf[(this.head - n + this.capacity) % this.capacity];
    }

    get length(): number { return this.filled; }
}
```

**User-facing Proxy:**

The `Series<T>` exposed to script code is a `Proxy` wrapping the buffer:

```ts
function makeSeriesView<T>(buf: RingBuffer<T>): Series<T> {
    return new Proxy({} as Series<T>, {
        get(_, prop) {
            if (prop === "current") return buf.at(0);
            if (prop === "length")  return buf.length;
            if (typeof prop === "string") {
                const n = Number(prop);
                if (Number.isInteger(n) && n >= 0) return buf.at(n);
            }
            return undefined;
        },
    });
}
```

The Proxy is **created once per series** when the script mounts and
re-used across bars. Its identity is stable, which lets users
`const ema = ta.ema(…)` once at the top of `compute` and reference `ema`
the same way every bar.

For `T = number`, out-of-range reads return `NaN` (Float64Array OOR is
`undefined` → coerced to `NaN` by the Proxy). For object `T` they return
`undefined`.

**Capacity sizing:**

`maxLookback` is the largest `N` the compiler sees in any
`series.X[N]` or `someIndicator[N]` expression. The compiler picks
this per-series at compile time and emits it into `manifest.seriesCapacities`:

```jsonc
{
    "seriesCapacities": {
        "ohlcv": 11,                  // largest index across all OHLCV reads
        "ta:ema:slot42#0": 21,        // 20-bar EMA: needs 20 to settle + 1 for current
        "ta:macd:slot61#0:macd": 27,  // 26 (slow) + 1
        "ta:macd:slot61#0:signal": 10
    }
}
```

A primitive's own `maxLookback` requirement (e.g. EMA needs `length`
slots before the recurrence settles) takes `max` with the user-observed
lookback. The runtime sizes each ring buffer to `maxLookback + 1`.

Computed indices like `series.close[i]` where `i` is not a literal fall
back to `manifest.seriesCapacities.dynamicFallback` (a separate field,
default 5000) — the compiler emits a warning and asks the user to
provide a `pragma maxLookback 1000` hint at the top of the script.

### 6.7 `bar` / `series` Synchronisation

The plan declares `bar.X` as scalar sugar for `series.X[0]`. This
subsection pins **when** they're written so they never disagree.

Per-bar step in pseudocode (every host implements this loop):

```ts
function onBarClose(rawBar: Bar): RunnerEmissions {
    // 1. Append to every OHLCV ring buffer FIRST.
    ohlcv.time.append(rawBar.time);
    ohlcv.open.append(rawBar.open);
    ohlcv.high.append(rawBar.high);
    ohlcv.low.append(rawBar.low);
    ohlcv.close.append(rawBar.close);
    ohlcv.volume.append(rawBar.volume);
    ohlcv.hl2.append((rawBar.high + rawBar.low) / 2);
    ohlcv.hlc3.append((rawBar.high + rawBar.low + rawBar.close) / 3);
    ohlcv.ohlc4.append((rawBar.open + rawBar.high + rawBar.low + rawBar.close) / 4);
    ohlcv.hlcc4.append((rawBar.high + rawBar.low + rawBar.close + rawBar.close) / 4);

    // 2. Mutate the shared `bar` view. Identity stable across bars.
    bar.time   = rawBar.time;
    bar.open   = rawBar.open;
    bar.high   = rawBar.high;
    bar.low    = rawBar.low;
    bar.close  = rawBar.close;
    bar.volume = rawBar.volume;
    bar.hl2    = ohlcv.hl2.at(0)!;
    // ... etc

    // 3. INVARIANT (must hold here): bar.X === series.X[0] for every field.

    // 4. Reset per-bar emission queues.
    emissions.plots.length = 0;
    emissions.drawings.length = 0;
    emissions.alerts.length = 0;

    // 5. Run user's compute. Stateful ta.* primitives advance their own
    //    ring buffers inside this call.
    userScript.compute({ bar, series, ta, plot, draw, alert, inputs });

    // 6. Drain.
    return emissions;
}
```

**Tick path (`onBarTick`):**

```ts
function onBarTick(rawBar: Bar): RunnerEmissions {
    // Replace head — do NOT advance. Same bar, new values.
    ohlcv.close.replaceHead(rawBar.close);
    ohlcv.high.replaceHead(rawBar.high);
    ohlcv.low.replaceHead(rawBar.low);
    ohlcv.volume.replaceHead(rawBar.volume);
    // ... derived sources recomputed for the head slot

    // Mutate bar view to match.
    bar.close = rawBar.close;
    bar.high  = rawBar.high;
    // ... etc

    // Stateful ta.* primitives must support a "replaceHead" mode that
    // recomputes their head slot from the PREVIOUS state, not append a
    // new one. Canonical realtime-tick incremental-compute pattern.
    emissions.plots.length = 0;
    emissions.drawings.length = 0;
    emissions.alerts.length = 0;

    userScript.compute({ bar, series, ta, plot, draw, alert, inputs });

    return emissions;
}
```

**Invariants (assertable in tests):**

- After `onBarClose` step 3 and before user `compute` runs:
  `bar.X === series.X[0]` for every field.
- After `compute` returns: every series referenced by the script has the
  same `.length`. Lockstep advancement is the runtime's responsibility,
  not the user's.
- Two consecutive `onBarTick` calls without an intervening `onBarClose`
  must not advance `series.X.length`.
- Emission queues are cleared at the start of every step. Adapters that
  miss a `drain()` lose those emissions — they're not retained.

The `@invinite-org/chartlang-runtime` test suite pins all four invariants as
property tests (`fast-check` over arbitrary bar sequences) — see §16.2.

---

## 7. The Adapter Contract

An **adapter** is any code that wants to run a script against its own candle
source and render the results. An interactive TradingView-style chart is one
adapter; a server-side alert runner is another; a unit-test harness is a
third.

### 7.1 `Adapter` shape

```ts
// @invinite-org/chartlang-adapter-kit
export type Adapter = {
    /** Stable id (kebab-case). E.g. "tldraw-trading-chart". */
    readonly id: string;
    /** Human label. */
    readonly name: string;
    /** Declares what the adapter actually does. Unsupported primitives no-op. */
    readonly capabilities: Capabilities;
    /** Yields bars in order. May be infinite (realtime feed). */
    candles(): AsyncIterable<CandleEvent>;
    /** Receives renderable output. Unsupported categories: pass-through no-op. */
    onEmissions(emissions: RunnerEmissions): void;
    /** Lifecycle. */
    dispose(): void;
};

export type CandleEvent =
    | { kind: "history"; bars: ReadonlyArray<Bar> }
    | { kind: "close"; bar: Bar }
    | { kind: "tick"; bar: Bar };
```

### 7.2 `Capabilities`

A capability bag declares **which primitive families an adapter supports**.
Primitives outside the declared set become **silent no-ops** at runtime. The
emission goes into `diagnostics` with a `dropped: "unsupported"` reason so the
editor can surface it as a hint, but the script does not crash.

```ts
export type Capabilities = {
    /** Indicator plot styles this adapter can render. */
    readonly plots: ReadonlySet<PlotKind>;
    /** Drawing primitives this adapter can render. */
    readonly drawings: ReadonlySet<DrawingKind>;
    /** Alert delivery. If empty, alert() is a silent no-op. */
    readonly alerts: ReadonlySet<AlertChannel>;
    /** Inputs the adapter can prompt the user for at runtime. */
    readonly inputs: ReadonlySet<InputKind>;
    /** Max bars of lookback the adapter promises to keep available. */
    readonly maxLookback: number;
    /** Max realtime tick rate the adapter will deliver. */
    readonly maxTickHz: number;
};

export type PlotKind =
    | "line" | "step-line" | "area" | "histogram" | "bars"
    | "horizontal-line" | "vertical-line" | "filled-band"
    | "label" | "marker" | "cursors";

export type DrawingKind =                // see §10 — full list
    | "line" | "ray" | "extended-line" | "horizontal-line" | "horizontal-ray"
    | "vertical-line" | "cross-line"
    | "rectangle" | "rotated-rectangle" | "triangle" | "circle" | "ellipse" | "arc"
    | "polyline" | "path" | "pen" | "highlighter" | "brush" | "curve" | "double-curve"
    | "text" | "marker" | "arrow" | "arrow-marker" | "arrow-mark-up" | "arrow-mark-down"
    | "trend-channel" | "regression-trend" | "flat-top-bottom" | "disjoint-channel"
    | "trend-angle" | "sine-line"
    | "fib-retracement" | "fib-trend-extension" | "fib-channel" | "fib-time-zone"
    | "fib-speed-fan" | "fib-speed-arcs" | "fib-spiral" | "fib-circles"
    | "fib-wedge" | "fib-trend-time"
    | "gann-box" | "gann-fan" | "gann-square" | "gann-square-fixed"
    | "pitchfork" | "schiff-pitchfork" | "modified-schiff-pitchfork"
    | "inside-pitchfork" | "pitchfan"
    | "elliott-impulse-wave" | "elliott-correction-wave"
    | "elliott-triangle-wave" | "elliott-double-combo" | "elliott-triple-combo"
    | "head-and-shoulders" | "triangle-pattern" | "abcd-pattern" | "xabcd-pattern"
    | "cypher-pattern" | "three-drives-pattern"
    | "cyclic-lines" | "time-cycles"
    | "group" | "frame";

export type AlertChannel =
    | "log"            // console
    | "toast"          // in-app notification
    | "webhook"        // POST JSON
    | "email" | "sms" | "push";

export type InputKind =
    | "int" | "float" | "bool" | "string" | "enum"
    | "color" | "source" | "time" | "price" | "symbol";
```

### 7.3 Emission Wire Schemas (canonical)

Every emission crosses at least one structured-clone boundary (Worker
`postMessage`) or one WASM membrane (QuickJS). The schemas are pinned
here so the Worker host, the QuickJS host, and every adapter agree
byte-for-byte. This file is the load-bearing reference for adapter
authors — `docs/spec/emissions.md` in the new repo is a verbatim copy of
this subsection.

**Universal payload rules.** All emissions are JSON-friendly objects.
Forbidden: `Map`, `Set`, `Date`, `Function`, `Symbol`, `bigint`, class
instances, `undefined` values. `NaN` / `Infinity` / `-Infinity` are
forbidden — serialise as `null` and the consumer treats `null` as
"skip this slot." Hosts and adapters MUST validate every emission at
the boundary via `validateEmission(e)` exported from
`@invinite-org/chartlang-adapter-kit` (a hand-rolled validator — no `zod` / `valibot`
dependency, to keep the package small).

#### `PlotEmission`

```ts
type PlotEmission = {
    readonly kind: "plot";
    readonly slotId: string;             // compiler-injected callsite id
    readonly title: string;              // user-supplied or auto-derived
    readonly style: PlotStyle;
    readonly bar: number;                // 0-based bar index this lands on
    readonly time: number;               // bar.time at emit, in ms UTC
    readonly value: number | null;       // null = NaN, "skip slot"
    readonly color: string | null;       // CSS color, or null = adapter default
    readonly meta: Readonly<Record<string, JsonValue>>;
};

type PlotStyle =
    | { kind: "line" | "step-line" | "area";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "histogram" | "bars"; baseline: number }
    | { kind: "horizontal-line" | "vertical-line";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "filled-band";
        upper: number | null; lower: number | null; alpha: number }
    | { kind: "label"; text: string;
        position: "above" | "below" | "anchor" }
    | { kind: "marker";
        shape: "circle" | "triangle-up" | "triangle-down" | "square" | "diamond";
        size: number }
    | { kind: "cursors"; radius: number };
```

`PlotStyle.kind` is the value compared against `Capabilities.plots`.
Unknown / missing → drop with diagnostic `unsupported-plot-kind`.

#### `DrawingEmission`

```ts
type DrawingEmission = {
    readonly kind: "drawing";
    readonly handleId: string;           // compiler-injected callsite id
    readonly drawingKind: DrawingKind;   // 60+ kinds — see §7.2
    readonly op: "create" | "update" | "remove";
    readonly state: DrawingState;        // discriminated on drawingKind
    readonly bar: number;
    readonly time: number;
};

type WorldPoint = { readonly time: number; readonly price: number };

// DrawingState is a discriminated union — one variant per DrawingKind.
// Full schema lives in packages/core/src/drawings/schema.ts and is
// the single source of truth; adapters import it and switch exhaustively.
type DrawingState =
    | { kind: "line";            a: WorldPoint; b: WorldPoint; style: LineStyle; color: string }
    | { kind: "ray";             origin: WorldPoint; direction: WorldPoint; style: LineStyle; color: string }
    | { kind: "extended-line";   a: WorldPoint; b: WorldPoint; style: LineStyle; color: string }
    | { kind: "horizontal-line"; price: number; style: LineStyle; color: string }
    | { kind: "horizontal-ray";  origin: WorldPoint; style: LineStyle; color: string }
    | { kind: "vertical-line";   time: number; style: LineStyle; color: string }
    | { kind: "cross-line";      at: WorldPoint; style: LineStyle; color: string }
    | { kind: "rectangle";       a: WorldPoint; b: WorldPoint; fillColor: string | null; strokeColor: string; strokeStyle: LineStyle }
    | { kind: "polyline";        points: ReadonlyArray<WorldPoint>; style: LineStyle; color: string }
    | { kind: "text";            at: WorldPoint; body: string; alignH: "left" | "center" | "right"; alignV: "top" | "middle" | "bottom" }
    // ... 50+ more variants, one per DrawingKind in §7.2 — full listing in
    //     packages/core/src/drawings/schema.ts (auto-generated typescript from a
    //     single TOML source-of-truth that the docs site also consumes).
    ;
```

The compiler statically requires that `op: "update"` and `op: "remove"`
reference a `handleId` previously seen as `op: "create"` in the same
script instance. Out-of-order ops → diagnostic
`drawing-handle-out-of-order`, dropped silently.

#### `AlertEmission`

```ts
type AlertEmission = {
    readonly kind: "alert";
    readonly slotId: string;
    readonly severity: AlertSeverity;    // "info" | "warning" | "critical"
    readonly message: string;
    readonly bar: number;
    readonly time: number;
    readonly meta: Readonly<Record<string, JsonValue>>;
    readonly channels: ReadonlyArray<AlertChannel>;
    readonly dedupeKey: string;          // slotId + bar + hash(message + meta)
};
```

`dedupeKey` is computed by the runtime, not the user. Adapters that
dispatch via async channels (webhook, push) MUST use `dedupeKey` for
idempotency — two retries of the same alert have the same key.

#### `RuntimeDiagnostic`

Surfaced to the editor and to error reporters. Never user-visible toast
on its own:

```ts
type RuntimeDiagnostic = {
    readonly kind: "diagnostic";
    readonly severity: "info" | "warning" | "error";
    readonly code: DiagnosticCode;        // stable, machine-readable
    readonly message: string;             // human-readable
    readonly slotId: string | null;       // origin callsite if known
    readonly bar: number | null;
};

// Pinned set — additive only. New codes bump apiVersion's minor.
type DiagnosticCode =
    | "unsupported-plot-kind"
    | "unsupported-drawing-kind"
    | "unsupported-alert-channel"
    | "lookback-exceeded"
    | "drawing-handle-out-of-order"
    | "dropped-by-policy"
    | "stateful-call-inside-loop"        // compile-time only, never runtime
    | "input-coercion-failed"
    | "alert-rate-limited"
    | "runtime-cpu-budget-exceeded"
    | "runtime-memory-budget-exceeded";
```

#### `RunnerEmissions`

The top-level drain payload:

```ts
type RunnerEmissions = {
    readonly plots: ReadonlyArray<PlotEmission>;
    readonly drawings: ReadonlyArray<DrawingEmission>;
    readonly alerts: ReadonlyArray<AlertEmission>;
    readonly diagnostics: ReadonlyArray<RuntimeDiagnostic>;
    /** Bar index range covered by this drain. */
    readonly fromBar: number;
    readonly toBar: number;
};
```

#### `JsonValue`

```ts
type JsonValue =
    | null
    | boolean
    | number                              // finite only; NaN/Inf forbidden
    | string
    | ReadonlyArray<JsonValue>
    | { readonly [k: string]: JsonValue };
```

Validator rejects any non-conforming shape at the boundary with a
`malformed-emission` diagnostic and drops the offending emission.

#### Versioning

The schemas above are frozen at `apiVersion: 1`. Adding new
`PlotStyle.kind` / `DrawingKind` / `DiagnosticCode` values is **additive
only** — they land in `apiVersion: 1.x` minor bumps. Removing or
renaming any field is a major version bump (no `apiVersion: 1`
adapter has to handle it).

### 7.4 Silent no-op semantics

Drop policy by category:

| Category | Adapter missing capability | Outcome |
|---|---|---|
| `plot` | `plotKind` ∉ `plots` | Drop emission; record diagnostic. Other plots in the same script still render. |
| `drawing` | `drawingKind` ∉ `drawings` | Drop emission; diagnostic. Other drawings still render. |
| `alert` | adapter's `alerts` empty | Drop alert; diagnostic only. Script still produces plots/drawings. |
| `input` | `inputKind` ∉ `inputs` | Substitute the input's `defaultValue`; diagnostic. |

The script does NOT know whether an emission was dropped. This is intentional:
the script is portable. The editor surfaces dropped categories as
warnings.

---

## 8. Sandbox Hosts

Two reference hosts, same `ScriptHost` interface. Adapters pick one.

### 8.1 `ScriptHost` interface

```ts
// @invinite-org/chartlang-runtime
export type ScriptHost = {
    /** Boot the host and load the compiled script module. */
    load(compiled: CompiledScript): Promise<void>;
    /** Forward a candle event to the script. */
    push(event: CandleEvent): Promise<void>;
    /** Drain emissions accumulated since last call. */
    drain(): Promise<RunnerEmissions>;
    /** Free the host. */
    dispose(): void;
    /** Resource caps the host enforces (read-only). */
    readonly limits: HostLimits;
};

export type HostLimits = {
    readonly maxHeapBytes: number;
    readonly maxCpuMsPerStep: number;
    readonly maxRingBufferBars: number;
};
```

### 8.2 `@invinite-org/chartlang-host-worker` (browser default)

- Boots a Web Worker with `type: "module"`.
- `postMessage` protocol over a structured-clone-safe schema.
- CPU caps via a watchdog: a `step` that exceeds `maxCpuMsPerStep` terminates
  the worker; the runtime reports a fatal diagnostic and the adapter can
  decide whether to restart.
- Memory caps via `performance.measureUserAgentSpecificMemory()` when
  available; otherwise heuristic.
- One worker per script instance. Multiple scripts → multiple workers.
- Fast path: no QuickJS overhead, native V8 speed.

### 8.3 `@invinite-org/chartlang-host-quickjs` (untrusted / server)

- Embeds [`quickjs-emscripten`](https://github.com/sebastianwessel/quickjs)
  WASM build.
- Hard memory cap (default 64 MB) via QuickJS's built-in `setMaxMemory`.
- Hard CPU cap via `setInterruptHandler` polling instruction count.
- No host bindings exposed except the candle pump and the emission channel.
- Throughput: ~10–100× slower than V8 for tight loops, but tolerable for
  alert-class workloads (one step per bar at minute resolution).
- This is what you run **server-side for alerts** against untrusted user
  scripts.

### 8.4 Picking a host

- Browser, your own code: `host-worker`.
- Browser, third-party scripts you don't fully trust: `host-quickjs` (slower,
  iron-clad).
- Server, alerts against user scripts: `host-quickjs`. No exceptions.
- Tests / CLI: a third `host-vm` could run in the same JS context for speed,
  but only against scripts you authored. Not shipped in v1.

---

## 9. Built-in Indicator Primitives (full parity)

Every indicator in the full-parity inventory below ships as a primitive
under `ta.*`. Each primitive is a stateful function with a stable name,
typed params, and reference math ported from a canonical TradingView-
conforming implementation (provenance documented in CONTRIBUTING.md).

### 9.1 Naming convention

```ts
ta.ema(source: Series<number>, length: number, opts?: EmaOpts): Series<number>;
ta.macd(source: Series<number>, opts?: MacdOpts): { macd: Series<number>; signal: Series<number>; hist: Series<number> };
```

Multi-output indicators return a typed record. Optional knobs flow through
`opts`. The compiler injects the callsite id.

### 9.2 Full primitive list (id → `ta.*` name)

Source-of-truth file: `packages/runtime/src/ta/registry.ts`. Categories
follow TradingView's canonical nine-category catalogue.

**Moving averages (13).** `sma`, `ema`, `wma`, `vwma`, `hma`, `dema`, `tema`,
`smma`, `kama`, `alma`, `lsma`, `mcginley`, `maRibbon`.

**Oscillators (15).** `rsi`, `cci`, `stoch`, `williamsR`, `macd`, `ppo`, `dpo`,
`connorsRsi`, `stochRsi`, `ultimateOsc`, `coppock`, `kst`, `fisher`, `klinger`,
`rvgi`.

**Momentum (7).** `ao`, `cmo`, `momentum`, `roc`, `pmo`, `smi`, `tsi`.

**Trend (8).** `aroon`, `aroonOsc`, `adx`, `dmi`, `trix`, `vortex`,
`trendStrengthIndex`, `ichimoku`.

**Volatility (12).** `atr`, `bb`, `bbPercentB`, `bbw`, `donchian`, `keltner`,
`envelope`, `chop`, `historicalVolatility`, `rvi`, `volatilityStop`,
`massIndex`.

**Volume (19).** `vol`, `vwap`, `anchoredVwap`, `obv`, `adl`, `bop`, `cmf`,
`chaikinOsc`, `mfi`, `netVolume`, `pvo`, `pvt`, `eom`, `nvi`, `pvi`,
`visibleRangeVolumeProfile`, `anchoredVolumeProfile`, `sessionVolumeProfile`,
`fixedRangeVolumeProfile`.

**Support / resistance (8).** `psar`, `supertrend`, `chandelier`,
`chandeKrollStop`, `williamsFractal`, `zigZag`, `pivotsHighLow`,
`pivotsStandard`.

**Statistical (5).** `correlationCoeff`, `linearRegression`, `median`,
`ulcerIndex`, `adr`.

**Cross-functional helpers** (not in the registry but used by scripts):

- `ta.crossover(a, b)` / `ta.crossunder(a, b)` — boolean series.
- `ta.highest(src, length)` / `ta.lowest(src, length)` — running extrema.
- `ta.change(src, n)` — `src[0] − src[n]`.
- `ta.valuewhen(condition, src, n)` — "value of `src` the n-th most recent
  time `condition` was true".
- `ta.barssince(condition)` — bars since `condition` last true.

### 9.3 Source-field helpers

Match the 8 canonical sources from `indicators/lib/read-source-field.ts`:
`open` / `high` / `low` / `close` / `hl2` / `hlc3` / `ohlc4` / `hlcc4`. Exposed
as `bar.open`, `bar.high`, …, `bar.hl2`, etc. — derived sources computed
lazily by the runtime.

### 9.4 Ports

The math implementations port 1:1 from
`../invinite/src/components/trading-chart/indicators/` (see §3.1).
Each port lands with its existing `<id>.test.ts` retargeted at the
`Series<T>` shape, plus the four new test files mandated by §16.6
(property / golden / bench / conformance). See `CONTRIBUTING.md` for
the per-file relicense header.

**Helpers first.** Port `../invinite/src/components/trading-chart/
indicators/lib/*` before any indicator that depends on them — most
notably `ema-of-float64.ts` (used by DEMA, TEMA, MACD, PPO, PMO, SMI,
TSI), `tr-series.ts` (used by ATR, Keltner, Chop, Supertrend,
Chandelier, Volatility Stop), `wilder-directional.ts` (ADX, DMI, RVI),
and `donchian-mid.ts` (Ichimoku, Donchian).

### 9.5 External-data primitives

Three indicators in the reference implementation read non-OHLC reactive
data (`transactionMarkers`, `correlationCoeff`, and the trade-narrative
family — see `../invinite/src/components/trading-chart/indicators/
external-data-registry.ts` for the side-channel pattern). In
`chartlang`, these are not built-ins of `ta.*` — they're **adapter-
provided primitives**. The script declares a dependency via
`input.externalSeries({ name: "transactions", schema: … })` and the
adapter chooses how to deliver. If the adapter doesn't supply the
series, the primitive returns an all-NaN series and emits a diagnostic.

---

## 10. Built-in Drawing Primitives (full parity)

`draw.*` namespace mirrors every drawing kind in the reference
implementation. Each primitive returns a `DrawingHandle` the script can
update later (move, delete, restyle) within the same `compute` run —
implementations are imperative inside the per-bar step.

**Reference paths (relative to this repo's root — see §3.1):**

- **Schema source-of-truth:** `../invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts`
  — every drawing kind's full TypeScript type (60+ exported types).
  Derive the `DrawingState` discriminated union for §10.4 from here.
  Strip collab-only fields (Yjs ids, layer ids, interval visibility)
  and keep only geometry + style.
- **Behavior source-of-truth:** `../invinite/src/components/trading-chart/tools/`
  — one `<name>-tool.ts` per drawing. Look here for: number of
  anchors, anchor semantics, edit-handle layout, hit-test rules,
  snap-to-OHLC behavior. The `draw.*` primitive's parameter shape
  comes from this folder; its rendered output comes from
  `y-doc-bridge.ts`.
- **Context:** `../invinite/src/components/trading-chart/CLAUDE.md`
  — coordinate-frame contract (world `(time, price)` vs bar-center
  frame vs CSS-px vs device-px) that every drawing implementation
  must honour.

### 10.1 Coordinate system

All drawings carry `(time, price)` world coordinates. The adapter is
responsible for projecting to its own pixel space. Time is `ms since epoch`,
price is the unit of the candle's `close` (USD, basis points, whatever).

### 10.2 `draw` namespace

```ts
namespace draw {
    // Lines and rays
    function line(a: WorldPoint, b: WorldPoint, style?: LineStyle): DrawingHandle;
    function ray(origin: WorldPoint, direction: WorldPoint, style?: LineStyle): DrawingHandle;
    function extendedLine(a: WorldPoint, b: WorldPoint, style?: LineStyle): DrawingHandle;
    function horizontalLine(price: Price, style?: LineStyle): DrawingHandle;
    function horizontalRay(origin: WorldPoint, style?: LineStyle): DrawingHandle;
    function verticalLine(time: Time, style?: LineStyle): DrawingHandle;
    function crossLine(at: WorldPoint, style?: LineStyle): DrawingHandle;

    // Boxes & polygons
    function rectangle(a: WorldPoint, b: WorldPoint, style?: ShapeStyle): DrawingHandle;
    function rotatedRectangle(a: WorldPoint, b: WorldPoint, c: WorldPoint, style?: ShapeStyle): DrawingHandle;
    function triangle(a: WorldPoint, b: WorldPoint, c: WorldPoint, style?: ShapeStyle): DrawingHandle;
    function circle(center: WorldPoint, radiusPrice: Price, style?: ShapeStyle): DrawingHandle;
    function ellipse(a: WorldPoint, b: WorldPoint, style?: ShapeStyle): DrawingHandle;
    function arc(a: WorldPoint, b: WorldPoint, c: WorldPoint, style?: LineStyle): DrawingHandle;

    // Multi-point curves
    function polyline(points: ReadonlyArray<WorldPoint>, style?: LineStyle): DrawingHandle;
    function path(points: ReadonlyArray<WorldPoint>, opts?: PathOpts): DrawingHandle;
    function pen(points: ReadonlyArray<WorldPoint>, style?: LineStyle): DrawingHandle;
    function highlighter(points: ReadonlyArray<WorldPoint>, style?: HighlighterStyle): DrawingHandle;
    function brush(points: ReadonlyArray<WorldPoint>, style?: BrushStyle): DrawingHandle;
    function curve(a: WorldPoint, b: WorldPoint, c: WorldPoint, style?: LineStyle): DrawingHandle;
    function doubleCurve(points: ReadonlyArray<WorldPoint>, style?: LineStyle): DrawingHandle;

    // Annotations
    function text(at: WorldPoint, body: string, opts?: TextOpts): DrawingHandle;
    function marker(at: WorldPoint, opts?: MarkerOpts): DrawingHandle;
    function arrow(a: WorldPoint, b: WorldPoint, opts?: ArrowOpts): DrawingHandle;
    function arrowMarker(at: WorldPoint, opts?: ArrowMarkerOpts): DrawingHandle;
    function arrowMarkUp(at: WorldPoint, opts?: ArrowMarkerOpts): DrawingHandle;
    function arrowMarkDown(at: WorldPoint, opts?: ArrowMarkerOpts): DrawingHandle;

    // Channel / trend tools
    function trendChannel(a: WorldPoint, b: WorldPoint, height: Price): DrawingHandle;
    function regressionTrend(start: Time, end: Time, opts?: RegressionTrendOpts): DrawingHandle;
    function flatTopBottom(a: WorldPoint, b: WorldPoint, c: WorldPoint, d: WorldPoint): DrawingHandle;
    function disjointChannel(points: ReadonlyArray<WorldPoint>): DrawingHandle;
    function trendAngle(a: WorldPoint, b: WorldPoint): DrawingHandle;
    function sineLine(a: WorldPoint, b: WorldPoint, period: number): DrawingHandle;

    // Fibonacci family
    namespace fib {
        function retracement(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
        function trendExtension(a: WorldPoint, b: WorldPoint, c: WorldPoint, opts?: FibOpts): DrawingHandle;
        function channel(a: WorldPoint, b: WorldPoint, height: Price, opts?: FibOpts): DrawingHandle;
        function timeZone(at: WorldPoint, span: Time): DrawingHandle;
        function speedFan(a: WorldPoint, b: WorldPoint): DrawingHandle;
        function speedArcs(a: WorldPoint, b: WorldPoint): DrawingHandle;
        function spiral(a: WorldPoint, b: WorldPoint): DrawingHandle;
        function circles(a: WorldPoint, b: WorldPoint): DrawingHandle;
        function wedge(a: WorldPoint, b: WorldPoint, c: WorldPoint): DrawingHandle;
        function trendTime(a: WorldPoint, b: WorldPoint): DrawingHandle;
    }

    // Gann family
    namespace gann {
        function box(a: WorldPoint, b: WorldPoint): DrawingHandle;
        function fan(origin: WorldPoint, scale: WorldPoint): DrawingHandle;
        function square(a: WorldPoint, b: WorldPoint): DrawingHandle;
        function squareFixed(at: WorldPoint, sizePrice: Price): DrawingHandle;
    }

    // Pitchforks
    function pitchfork(a: WorldPoint, b: WorldPoint, c: WorldPoint): DrawingHandle;
    function schiffPitchfork(a: WorldPoint, b: WorldPoint, c: WorldPoint): DrawingHandle;
    function modifiedSchiffPitchfork(a: WorldPoint, b: WorldPoint, c: WorldPoint): DrawingHandle;
    function insidePitchfork(a: WorldPoint, b: WorldPoint, c: WorldPoint): DrawingHandle;
    function pitchfan(a: WorldPoint, b: WorldPoint, c: WorldPoint): DrawingHandle;

    // Elliott waves
    namespace elliott {
        function impulse(points: readonly [W, W, W, W, W, W]): DrawingHandle;          // 6 pts
        function correction(points: readonly [W, W, W, W]): DrawingHandle;             // 4 pts
        function triangle(points: readonly [W, W, W, W, W, W]): DrawingHandle;         // 6 pts
        function doubleCombo(points: readonly [W, W, W, W, W, W, W]): DrawingHandle;   // 7 pts
        function tripleCombo(points: readonly [W, W, W, W, W, W, W, W, W, W]): DrawingHandle; // 10
    }

    // Patterns (harmonic + classical)
    namespace pattern {
        function headAndShoulders(points: readonly [W, W, W, W, W, W, W]): DrawingHandle; // 7 pts
        function triangle(points: readonly [W, W, W, W]): DrawingHandle;
        function abcd(points: readonly [W, W, W, W]): DrawingHandle;
        function xabcd(points: readonly [W, W, W, W, W]): DrawingHandle;
        function cypher(points: readonly [W, W, W, W, W]): DrawingHandle;
        function threeDrives(points: readonly [W, W, W, W, W, W, W]): DrawingHandle;
    }

    // Cycles
    function cyclicLines(origin: WorldPoint, periodTime: Time, count?: number): DrawingHandle;
    function timeCycles(origin: WorldPoint, radiusTime: Time): DrawingHandle;

    // Containers
    function group(children: ReadonlyArray<DrawingHandle>): DrawingHandle;
    function frame(a: WorldPoint, b: WorldPoint, opts?: FrameOpts): DrawingHandle;
}
```

### 10.3 `DrawingHandle`

```ts
type DrawingHandle = {
    readonly id: string;
    update(patch: Partial<DrawingState>): void;   // restyle, move anchors
    remove(): void;
};
```

The handle is **stable across bars** (the runtime keys it by the
compiler-assigned callsite id), so scripts can do:

```ts
const support = draw.horizontalLine(supportLevel, { color: color.green });
// next bar:
support.update({ price: newSupportLevel });
```

This matches Pine's `line.set_xy()` / `label.set_text()` ergonomics.

### 10.4 Drawing schema serialisation

Every drawing emission flattens to a JSON-friendly `DrawingEmission`:

```ts
type DrawingEmission = {
    readonly id: string;
    readonly kind: DrawingKind;
    readonly state: DrawingState;     // discriminated on kind
    readonly bar: number;             // emitted on bar index N
};
```

Adapter authors don't deserialise this themselves — `@invinite-org/chartlang-adapter-kit`
provides `decodeDrawing()` typed against `kind`.

---

## 11. Alert Primitives

```ts
namespace alert {
    function fire(message: string, opts?: {
        severity?: AlertSeverity;
        channels?: ReadonlyArray<AlertChannel>;
        meta?: Record<string, JsonValue>;
        /** Coalesce duplicate alerts within this window. Default: 1 bar. */
        dedupeWindowMs?: number;
    }): void;

    /** Conditional helper — only fires on rising edge. */
    function on(condition: boolean, message: string, opts?: ...): void;
}
```

Server-side, the adapter consumes `RunnerEmissions.alerts` and routes each
via the channels declared in `Capabilities.alerts`. Webhook channel posts:

```jsonc
{
    "scriptId": "user/foo",
    "scriptVersion": "1.2.3",
    "symbol": "AAPL",
    "interval": "5m",
    "bar": { "time": 1717070100000, "open": 191.2, "high": 191.5, "low": 191.0, "close": 191.4, "volume": 12345 },
    "alert": {
        "severity": "info",
        "message": "Bullish cross",
        "meta": { "ema": 191.32 }
    }
}
```

Alert deduplication is enforced inside the runtime, not the adapter, so
behaviour is consistent across hosts.

---

## 12. Input Primitives

`input.*` builders declare typed, persistable inputs. The adapter renders a
form (or pulls saved values) and passes them to the script.

```ts
namespace input {
    function int(defaultValue: number, opts?: { min?: number; max?: number; step?: number; title?: string }): InputDescriptor<number>;
    function float(defaultValue: number, opts?: { min?: number; max?: number; step?: number; title?: string }): InputDescriptor<number>;
    function bool(defaultValue: boolean, opts?: { title?: string }): InputDescriptor<boolean>;
    function string(defaultValue: string, opts?: { title?: string; multiline?: boolean }): InputDescriptor<string>;
    function enum<T extends string>(defaultValue: T, options: ReadonlyArray<T>, opts?: { title?: string }): InputDescriptor<T>;
    function color(defaultValue: Color, opts?: { title?: string }): InputDescriptor<Color>;
    function source(defaultValue: "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4" | "hlcc4", opts?: { title?: string }): InputDescriptor<SourceField>;
    function time(defaultValue: Time, opts?: { title?: string }): InputDescriptor<Time>;
    function price(defaultValue: Price, opts?: { title?: string }): InputDescriptor<Price>;
    function symbol(defaultValue: string, opts?: { title?: string }): InputDescriptor<string>;
    function externalSeries<T>(opts: { name: string; schema: Schema<T>; title?: string }): InputDescriptor<Series<T>>;
}
```

The compiler walks `inputs` at module scope and serialises them into
`manifest.inputs` so the adapter UI can render the form without booting the
script.

---

## 13. Style Primitives

```ts
namespace color {
    const red: Color;
    const green: Color;
    const blue: Color;
    const purple: Color;
    const orange: Color;
    const yellow: Color;
    // … a default 10-color named palette (overridable per adapter)
    function rgba(r: number, g: number, b: number, a?: number): Color;
    function hex(s: string): Color;
    function alpha(c: Color, a: number): Color;
}

namespace style {
    const solid: LineStyle;
    const dashed: LineStyle;
    const dotted: LineStyle;
}
```

Mirrors our `webgl/colors.ts` and the 6-color `groupTag` palette.

---

## 14. Editor Package

`@invinite-org/chartlang-editor` ships a CodeMirror 6 extension bundle:

- Syntax highlighting and incremental parsing via Lezer's TypeScript grammar.
- Hover docs for every primitive, sourced from JSDoc on `@invinite-org/chartlang-core`.
- Autocomplete for `ta.*`, `draw.*`, `input.*`, `color.*`.
- Inline diagnostics from `@invinite-org/chartlang-compiler` — type errors, forbidden
  constructs, unsupported-by-adapter warnings (when the editor is given the
  target adapter's `Capabilities`).
- A peek panel for emitted plots/drawings/alerts using the conformance
  fixtures as input.

Mounted as:

```tsx
<ChartlangEditor
    source={source}
    onSourceChange={setSource}
    targetCapabilities={adapterCapabilities}
    onCompiled={(compiled) => previewRunner.load(compiled)}
/>
```

---

## 15. Adapters Live in Consumer Repos

**No chart-binding adapter ships from the `chartlang` repo.** This section
is the load-bearing architectural rule that keeps `chartlang` a standard
rather than a one-chart binding library.

### 15.1 What ships in the OSS repo

Exactly one adapter: **`examples/canvas2d-adapter/`**. ~200 lines, zero
chart-library dependency, renders to a `<canvas>` via Canvas2D. Its jobs:

1. Prove the `Adapter` contract from `@invinite-org/chartlang-adapter-kit` is
   implementable end-to-end (line plots, area plots, horizontal-line
   plots, line drawings, rectangle drawings, console-logged alerts).
2. Be the canonical **template** new adapter authors copy. `pnpm
   chartlang scaffold-adapter my-adapter` clones this folder structure
   into a sibling directory with the chart-specific bindings stubbed.
3. Be the smoke-test target for the OSS repo's own CI — every PR runs
   `pnpm conformance examples/canvas2d-adapter` to verify the contract
   the package describes is the contract the runtime actually emits.

It is **not** published to npm. It does not aim for completeness — it
covers ~10 of the 60 `DrawingKind`s and ~5 of the `PlotKind`s. That's
enough to validate the contract. Production adapters cover everything
their target chart supports and declare unsupported kinds honestly via
`Capabilities`.

### 15.2 What ships in a consumer repo

A consumer who wants chartlang scripts to run on their chart does the
following:

1. `pnpm add @invinite-org/chartlang-adapter-kit @invinite-org/chartlang-host-worker @invinite-org/chartlang-conformance`
2. `pnpm chartlang scaffold-adapter` (or copy `examples/canvas2d-adapter/`)
3. Implement `Adapter` against their chart's primitives.
4. Declare `Capabilities` honestly (don't claim a `PlotKind` you can't
   render — silent no-op is the whole point of the contract).
5. Run `pnpm chartlang conformance` against their adapter in their CI.
6. Publish to npm under their own scope (`@tv-charts/chartlang-adapter`,
   `@highcharts/chartlang-adapter`, etc.) — or keep it private if their
   chart is internal.
7. Optionally publish their conformance report; it's a public,
   comparable signal across adapters but not required for the OSS
   project to acknowledge their adapter exists.

There is no central registry of adapters in the OSS repo. There is no PR
process to "list your adapter." The whole point of a standard is that
the contract is sufficient — anyone implementing it interoperates with
every script ever written.

### 15.3 The conformance suite — the unifying signal

`@invinite-org/chartlang-conformance` ships 200+ scenarios:

```ts
type ConformanceScenario = {
    id: string;
    script: string;                         // source
    candles: ReadonlyArray<Bar>;
    expected: {
        plots?: ReadonlyArray<PlotEmission>;
        drawings?: ReadonlyArray<DrawingEmission>;
        alerts?: ReadonlyArray<AlertEmission>;
    };
};

function runConformanceSuite(adapter: Adapter): Promise<Report>;
```

Three things `runConformanceSuite` checks for every adapter, regardless of
where it lives:

1. **Capability honesty.** Every emission the adapter accepts must be
   one its declared `Capabilities` covers; every emission outside
   `Capabilities` must be dropped with the matching `unsupported-*`
   diagnostic — not silently rendered, not loudly thrown.
2. **Wire-schema compliance.** Every emission the adapter receives
   passes `validateEmission`. No bigints, no NaN, no class instances.
3. **Determinism.** Two runs of the same scenario against the same
   adapter produce identical reports.

The suite emits a markdown `CONFORMANCE.md` table per adapter. Adapter
authors check this file into their own repo. Comparing two adapters is
just diffing two markdown files.

### 15.4 Why this matters (the standard story)

A consumer reading "chartlang is the open scripting standard for charts"
must be able to verify, in 30 seconds, that the OSS repo doesn't secretly
bind to one chart. The §3 package list does that — no chart-named
package exists. The Canvas2D reference proves the contract is
shape-of-anything. Every production adapter is one data point, not the
privileged data point.

---

## 16. Testing — Full Coverage Requirement

**The project ships at 100% test coverage. There are no exceptions and no
ratchets. A PR that drops coverage below 100% does not merge.**

This is not a stylistic preference. `chartlang` is the math engine *and* the
sandbox surface for untrusted scripts that may eventually drive alerts and
financial decisions. Every uncovered line is a place where a regression can
silently change indicator output, drop an alert, or escape the sandbox.
Full coverage is the only meaningful posture.

### 16.1 What "full coverage" means

Coverage is measured per package by `vitest run --coverage` (V8 provider).
All four metrics must be 100%, with the exemptions listed in §16.4:

| Metric | Threshold | Why |
|---|---|---|
| `lines` | 100% | Every executable line ran in at least one test. |
| `statements` | 100% | Catches dead-after-return branches the lines metric misses. |
| `branches` | 100% | Both sides of every `if`, every `case`, every short-circuit. |
| `functions` | 100% | No silently-untested overload, no orphaned export. |

Threshold is enforced in `vitest.config.ts` per package:

```ts
// packages/<pkg>/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "json-summary", "lcov"],
            thresholds: { lines: 100, statements: 100, branches: 100, functions: 100 },
            include: ["src/**/*.ts"],
            exclude: [
                "src/**/*.test.ts",
                "src/**/*.bench.test.ts",
                "src/**/__fixtures__/**",
                "src/**/index.ts",        // pure re-export barrels
                "src/**/types.ts",         // type-only modules (no runtime)
            ],
        },
    },
});
```

The root `pnpm test` runs `vitest run --coverage` in every package and fails
the build on any threshold breach. Local dev uses `vitest` (watch, no
coverage) for speed.

### 16.2 What tests we write

Each package's tests fall into one of these layers. New primitives MUST
ship every layer that applies before merge.

**Unit tests (`<file>.test.ts`, co-located).**
Required for every source file with executable code. Cover every branch,
every NaN-warmup case, every numerical edge (zero range, zero volume,
empty arrays, single-bar input, divide-by-zero, integer overflow).

**Property-based tests (`<file>.property.test.ts`).**
Required for every `ta.*` primitive. Use `fast-check` to assert invariants
that hold for any candle stream:

- Length invariance: `compute(N).series.length === N` for every output.
- Warmup contract: the first `warmupBars` slots are NaN, the rest are
  finite.
- Determinism: running the same script against the same bars yields the
  same emissions.
- Reference-equivalence: when `extendCompute` is implemented, a full
  recompute over `N` bars must equal `extendCompute(prev[0..N-1], +1
  bar)` for every `N` in `[warmupBars, 1000]`.
- Monotonicity / range invariants where the math implies them (RSI ∈
  [0, 100], stochastic ∈ [0, 100], correlation ∈ [-1, 1], chop ∈ [0, 100]).

**Golden tests (`<file>.golden.test.ts`).**
Required for every `ta.*` primitive. Run the primitive against the shared
fixture candle set (`packages/conformance/fixtures/golden-bars.json`,
10 000 bars across 4 synthetic regimes — trend, range, high-vol, low-vol)
and snapshot the output Float64Array hashes. Math changes that alter
numerical output MUST update the golden hashes in the same commit and
trigger a `BREAKING:` changeset.

**Conformance scenarios (`packages/conformance/scenarios/`).**
Each scenario is a `(script, candles, expected_emissions)` triple
exercised against every adapter via `runConformanceSuite(adapter)`. New
language features land with at least one conformance scenario. New
primitives land with at least one scenario that uses them in a script
(not just in isolation).

**Sandbox-escape tests (`packages/host-quickjs/src/escape.test.ts`).**
Required for the QuickJS host. The test suite tries every known sandbox-
escape pattern against the host (Promise callback abuse, prototype
pollution, regex DoS, infinite loops, memory exhaustion, host-global
exfiltration). All must terminate cleanly with a diagnostic, not crash
the host process.

**Determinism tests (`packages/runtime/src/determinism.test.ts`).**
A 500-bar script compiled under N=1000 random RNG seeds must produce
byte-identical emissions every run. Any host-introduced nondeterminism
fails this test.

**Performance regression tests (`<file>.bench.test.ts`).**
Required for every primitive and every hot runtime path (ring-buffer
read/write, callsite-id dispatch, emission serialisation). Each bench
declares a `THRESHOLD_MS = Math.ceil(median × 3)` against the post-port
median. Bench tests fail the build on threshold breach. The bench files
participate in the per-package coverage metrics, so the bench harness
itself stays exercised.

**Type tests (`<file>.types.test.ts`).**
Use `expect-type` to assert the public type surface of every primitive.
`ta.ema(closeSeries, 20)` must resolve to `Series<number>`; `ta.macd(...)`
must resolve to the typed record. Type regressions are coverage failures
even when the JS coverage is 100%.

### 16.3 Per-package coverage matrix

| Package | Unit | Property | Golden | Conformance | Type | Sandbox | Bench |
|---|---|---|---|---|---|---|---|
| `@invinite-org/chartlang-core` | ✓ | — | — | — | ✓ | — | — |
| `@invinite-org/chartlang-compiler` | ✓ | ✓ (AST round-trip) | ✓ (compiled output) | — | ✓ | — | ✓ |
| `@invinite-org/chartlang-runtime` | ✓ | ✓ (every `ta.*`) | ✓ (every `ta.*`) | ✓ | ✓ | — | ✓ |
| `@invinite-org/chartlang-host-worker` | ✓ | — | — | ✓ (via canvas2d adapter) | ✓ | ✓ | ✓ |
| `@invinite-org/chartlang-host-quickjs` | ✓ | — | — | ✓ (via canvas2d adapter) | ✓ | ✓ (mandatory) | ✓ |
| `@invinite-org/chartlang-adapter-kit` | ✓ | — | — | ✓ | ✓ | — | — |
| `@invinite-org/chartlang-editor` | ✓ | — | — | — | ✓ | — | — |
| `@invinite-org/chartlang-cli` | ✓ | — | — | — | ✓ | — | — |
| `@invinite-org/chartlang-conformance` | ✓ | — | — | — | ✓ | — | — |
| `examples/canvas2d-adapter/` | ✓ | — | ✓ (visual) | ✓ (full suite) | ✓ | — | — |

Consumer-repo adapters run their own conformance suite in their own CI,
against their own coverage gate. The OSS repo's CI does not gate consumer
adapters.

### 16.4 Documented coverage exemptions

The exclude list in §16.1 is the **only** allowed exemption set. Adding a
new exemption requires a PR comment explaining why and a `@coverage-exempt`
JSDoc tag on the file. Reviewers reject any other exemption.

The exemptions:

- **`index.ts` barrels** — pure re-export files (`export * from "./foo"`).
  These contribute nothing executable. A barrel that contains any logic is
  a smell; split it.
- **`*.test.ts` / `*.bench.test.ts`** — test files don't cover themselves.
- **`__fixtures__/`** — static test fixtures (golden bars, expected
  emissions).
- **`types.ts`** — type-only modules (`export type … from "./shape"`). A
  file mixing types and runtime code is a smell; split it.

There is no `/* istanbul ignore */` allowlist. There is no per-line
exemption. If a line is genuinely unreachable, delete it.

### 16.5 PR gate

CI runs four mandatory jobs on every PR. All must pass to merge:

1. **`pnpm -r test`** — unit + property + golden + type tests, every
   package, with `--coverage --reporter=verbose`. Fails on any threshold
   breach.
2. **`pnpm conformance`** — full conformance suite against the
   `examples/canvas2d-adapter/` reference adapter. Consumer-repo
   adapters (ours, TradingView's, …) run the same suite in their own CI
   under their own gate — the OSS repo does not gate them.
3. **`pnpm bench --ci`** — bench suite, fails on threshold breach.
4. **`pnpm coverage:report`** — uploads the merged LCOV to the PR as a
   comment showing per-file deltas; the comment must show `100.00%` across
   all four metrics or the build is red.

No `--no-verify`. No `[skip ci]`. A coverage drop is not a "follow-up
cleanup" — it's the change that doesn't merge.

### 16.6 Coverage of math ports

The 90+ indicator primitives port 1:1 from the reference math library
(provenance documented in CONTRIBUTING.md). Each port lands together with:

- a `<id>.test.ts` retargeted at the `Series<T>` shape,
- a `<id>.bench.test.ts`,
- a `<id>.property.test.ts` (property-based invariants),
- a `<id>.golden.test.ts` against `golden-bars.json`,
- at least one conformance scenario in `packages/conformance/scenarios/`
  that uses the primitive in a real script.

A port PR that doesn't ship all five files for that primitive is not
mergeable.

### 16.7 Coverage of the compiler

The compiler is the highest-stakes package. Beyond 100% line/branch
coverage, the test suite must include:

- **Round-trip AST tests:** every transformer pass must be tested against a
  hand-curated set of input programs covering every syntactic shape the
  language supports.
- **Negative tests:** every forbidden construct (unbounded `while`,
  `Math.random()`, dynamic `import`, host globals) must have a dedicated
  test asserting the compiler rejects it with a specific error code.
- **Capability-extraction tests:** every primitive used in a fixture
  produces the expected `Capabilities` set in the emitted manifest.
- **Determinism tests:** compiling the same source twice produces a
  byte-identical bundle (modulo the sourcemap path).

### 16.8 Why this is achievable

The runtime math is pure functions over `Float64Array`. The hardest piece
to cover (the sandbox host) is small in surface area — boot, message
dispatch, drain, dispose. The compiler is mechanical: every AST shape we
accept has a fixed transformation. The adapter contract is data-in
data-out. None of these surfaces are "hundreds of branches deep" in the
way a UI codebase is. 100% is the natural state of the project, and
maintaining it is cheaper than the bug-hunting cost of letting it slip.

The single hardest test to write is the QuickJS sandbox escape suite —
that's also the test we most need.

---

## 17. Documentation — Required for Every Public Surface

**Documentation is not optional.** A PR that adds a new primitive, package,
adapter, or public type without the matching docs does not merge. Same posture
as the coverage rule: docs are how `chartlang` becomes a standard rather than
a private library.

### 17.1 Required documentation surfaces

Every package and every public symbol must carry the following. CI enforces it
(see §17.6).

**Root `README.md` (the project front page).** Must contain, in this order:

1. One-paragraph elevator pitch (≤ 80 words).
2. A 10-line runnable example — the smallest indicator that compiles, runs,
   and renders. Copy-paste-runnable.
3. Status & version badges (npm, build, coverage, license).
4. "Why" — 3 bullets on what `chartlang` does that nothing else does
   (open, portable across charts, sandboxable for alerts).
5. "Install" — exact pnpm/npm/yarn one-liners per role: script author,
   adapter author, embedder.
6. "Quickstart in 60 seconds" — three commands that end in a rendered
   chart.
7. Architecture diagram (ASCII or `mermaid`) — mirror the one in §2.
8. Links to: docs site, language spec, primitive reference, adapter list,
   conformance reports, examples, CONTRIBUTING, CODE_OF_CONDUCT, LICENSE.

Hard length cap: 300 lines. Anything longer moves into `docs/`.

**Per-package `README.md`.** Every package in `packages/*` ships its own
README:

1. One-sentence purpose.
2. Install (`pnpm add @invinite-org/chartlang-<pkg>`).
3. The minimum-viable API call (5–15 lines of code).
4. Link to the package's API reference in `docs/`.
5. Stability label: `experimental` / `stable` / `frozen`.

Hard length cap: 100 lines per package README.

**`docs/` site.** Lives in the repo, deployed to `chartlang.dev` via
Vitepress (or similar; pick at v0.2). Structure mirrors §3:

```
docs/
├── index.md                       # landing — same elevator pitch + CTAs
├── getting-started/
│   ├── write-your-first-script.md
│   ├── embed-in-our-chart.md
│   └── write-your-first-adapter.md
├── language/
│   ├── overview.md
│   ├── series-and-indexing.md     # §4.3 of the plan, expanded
│   ├── inputs.md
│   ├── alerts.md
│   ├── version-pinning.md
│   └── forbidden-constructs.md
├── primitives/                    # auto-generated from JSDoc
│   ├── ta/                        # one page per ta.* function
│   ├── plot/
│   ├── draw/                      # one page per draw.* function
│   ├── alert/
│   └── input/
├── adapters/
│   ├── contract.md                # §7 of the plan
│   ├── capabilities.md
│   ├── writing-an-adapter.md
│   ├── conformance.md
│   └── reference/                 # per-adapter pages
├── hosts/
│   ├── worker.md
│   ├── quickjs.md
│   └── writing-a-host.md
├── spec/                          # the canonical language spec
│   ├── grammar.md                 # "TS + this library + these analyses"
│   ├── semantics.md               # execution model, per-bar contract, NaN
│   ├── manifest.md                # ScriptManifest schema
│   ├── emissions.md               # Plot / Draw / Alert payload schemas
│   └── versioning.md              # apiVersion: 1 contract
├── examples/                      # narrative-paired example walkthroughs
└── reference/
    ├── glossary.md
    └── faq.md
```

The `docs/spec/` folder is the **canonical language specification** — the
document a future adapter author or alternate-implementation team reads to
build a new front-end. It must be self-contained: no "see the source code"
references.

### 17.2 JSDoc on every public symbol

Every exported symbol in every package carries a JSDoc block. No exceptions.
The block must include:

- A one-line description.
- `@example` block with a runnable snippet (the `docs:examples` script in
  CI executes every `@example` block via the compiler — broken examples
  fail the build).
- For `ta.*` primitives: `@formula` block with the math in LaTeX or plain
  notation, `@warmup` line stating the warmup bar count, `@stable` /
  `@experimental` marker.
- For `draw.*` primitives: `@anchors` line describing the world-point
  semantics, `@capability` line naming the `DrawingKind` capability the
  adapter must declare.
- For input builders: `@uiHint` block describing how an adapter should
  render the input.
- `@since` tag with the `apiVersion` the symbol landed in.
- `@deprecated` tag when applicable, with the replacement.

Example:

```ts
/**
 * Exponential moving average of `source` over `length` bars.
 *
 * @formula  ema[i] = src[i] * k + ema[i-1] * (1 - k)  where k = 2 / (length + 1)
 * @warmup   `length` bars (returns NaN before then)
 * @capability  plot kind: "line"
 * @since 1
 * @stable
 *
 * @example
 *   const ema = ta.ema(series.close, 20);
 *   plot(ema, { color: color.purple });
 */
export function ema(source: Series<number>, length: number, opts?: EmaOpts): Series<number>;
```

The `docs/primitives/` site is **auto-generated** from these JSDoc blocks by
a script in `packages/cli/src/gen-docs.ts`. The CI build regenerates and
commits diffs back to the docs site on every release.

### 17.3 Spec documents

Two artefacts live in `docs/spec/` and are versioned independently of the
implementation. They're the single source of truth for what `apiVersion: N`
means.

- **`grammar.md`.** What syntactic subset of TypeScript a script may use,
  what library surface it must import from, what static analyses the
  compiler runs, what's rejected and why. Includes the formal forbidden-
  constructs list (`while(true)`, `Math.random`, `Date.now`, `fetch`,
  `setTimeout`, dynamic `import`, `eval`, `Function`, host globals,
  recursion, etc.).
- **`semantics.md`.** The execution model: per-bar step contract, series
  warmup, NaN propagation rules, callsite-id stability, emission ordering,
  determinism guarantees, lookback bound resolution, drawing handle
  lifecycle, alert deduplication, capability fallback ("silent no-op")
  behaviour.

A change to either document is a language version bump and gets called out
in the changeset.

### 17.4 Adapter-author guide

`docs/adapters/writing-an-adapter.md` is a tutorial that walks a developer
from `pnpm create chartlang-adapter` (the scaffolding command in
`@invinite-org/chartlang-cli`) through a runnable Lightweight-Charts adapter in ~200
lines. Mirrors `docs/getting-started/write-your-first-adapter.md` but
deeper. Covers:

- Implementing `Adapter`.
- Declaring `Capabilities` honestly (don't claim a kind you can't render).
- Plumbing candle events.
- Translating `PlotEmission` / `DrawingEmission` into the host chart's
  primitives.
- Running the conformance suite locally.
- Publishing the conformance report.

### 17.5 Conformance reports as docs

Each adapter publishes a generated `CONFORMANCE.md` at its package root.
The conformance suite emits this file as part of `pnpm conformance` —
table of scenario id × pass/fail, with diff snippets on fail. The file is
checked into the repo. A PR that breaks a previously-passing scenario must
either fix it or get explicit "intentional break" sign-off in the
changeset.

### 17.6 CI enforcement of docs

Three CI jobs gate docs:

1. **`pnpm docs:check`** — fails if any exported symbol in any package
   lacks a JSDoc block, lacks `@example`, lacks `@since`, or has an
   `@example` block that fails to compile. Uses `typedoc` + a small custom
   linter (`packages/cli/src/doc-lint.ts`).
2. **`pnpm docs:build`** — builds the `docs/` site. Broken links between
   pages fail the build. Auto-generated `primitives/` pages are
   regenerated and the build fails if the regenerated output differs from
   committed (the dev must commit the regenerated files).
3. **`pnpm readme:check`** — verifies every package has a `README.md`, the
   root README has the required sections (regex-matched against the §17.1
   checklist), and length caps are not exceeded.

No `--no-verify`. Same posture as coverage: a docs gap is the change that
doesn't merge.

### 17.7 Documentation for scripts the user writes

Two surfaces help end-users (non-contributors) document their own scripts:

- Every script's `defineIndicator({ description: string })` field is
  serialised into the manifest and rendered in the adapter's UI. Required;
  the compiler warns when empty.
- The `@invinite-org/chartlang-cli` ships a `chartlang docs <script>` command that
  emits a markdown page describing the script's inputs, outputs, declared
  capabilities, and alert payloads — generated from the manifest. Users
  paste this into their own README.

### 17.8 What this protects

A new contributor lands a primitive: tests pin the math (§16), docs pin
the contract (§17). A new adapter author lands an adapter: tests pin
correctness against fixtures, docs pin the capability claims. A new
script author reads `docs/spec/` and writes a script that will run on any
conformant adapter forever.

This is the missing layer that turns the package into a *standard*. The
coverage gate keeps it correct; the docs gate keeps it portable.

---

## 18. Build, Publish, Release

- **Tooling.** pnpm workspaces. `tsc` for types. `esbuild` for runtime
  bundles. `vitest` for tests (we already use it). `biome` for
  format + lint. `@changesets/cli` for release notes and versioning.
- **CI.** GitHub Actions matrix on Node 20 / 22, Linux + macOS. Mandatory
  jobs per §16.5. `pnpm install --frozen-lockfile`, `pnpm -r build`,
  `pnpm -r test`, `pnpm conformance`, `pnpm bench --ci`.
- **Publish.** All packages published to npm under `@invinite-org/chartlang-*` with
  `provenance` enabled. A release requires a green coverage report
  attached to the GitHub Release notes.
- **Browser build.** `@invinite-org/chartlang-host-worker` exports a `worker.js` URL via
  Vite's `?worker&url` syntax. `@invinite-org/chartlang-host-quickjs` ships its WASM
  blob via `?url` so bundlers handle copying.
- **Node build.** All packages have a Node 20 ESM entrypoint. QuickJS works
  there out of the box.

---

## 19. Phase Roadmap

Every phase's "Done" definition includes **tests + docs landed in the same
PR**. A phase is not complete until §16 (full coverage) and §17 (docs +
README) both pass for everything touched. There is no "ship it now,
backfill tests/docs later" lane.

### Phase 0 — Spec (this document)

Land this file. Open a discussion issue. Solicit feedback.

### Phase 1 — `0.1` Walking skeleton

**Goal:** Compile + run an EMA-cross script end-to-end against the
canvas2d reference adapter.

- `@invinite-org/chartlang-core` types and the **8 most-used primitives**: `ta.sma`,
  `ta.ema`, `ta.rsi`, `ta.macd`, `ta.atr`, `ta.crossover`, `ta.crossunder`,
  `plot`, `hline`, `alert`.
- `@invinite-org/chartlang-compiler` with callsite-id transformer, static analysis,
  esbuild bundling. Reject unbounded loops.
- `@invinite-org/chartlang-runtime` with ring-buffer `Series`, NaN-correct math, the
  per-bar step loop, emission drain.
- `@invinite-org/chartlang-host-worker` for browser.
- `@invinite-org/chartlang-adapter-kit` (the SDK consumers import).
- `examples/canvas2d-adapter/` reference adapter — proves the contract
  works end-to-end.
- Three example scripts. Conformance suite seeded with their golden output.
- `@invinite-org/chartlang-cli compile foo.chart.ts` + `chartlang scaffold-adapter`.

### Phase 2 — `0.2` Full indicator parity

Port every indicator from the reference math library into
`packages/runtime/src/ta/`. Each port comes with the five files from §16.6.
Update the primitive registry. Update the canvas2d reference adapter's
`Capabilities.plots` to include any new plot kinds the ports need (so the
conformance suite covers them). Consumer adapters update their own
`Capabilities.plots` in their own repos — additive only, never breaking.

### Phase 3 — `0.3` Full drawing parity

Add the full `draw.*` namespace from §10. The canvas2d reference adapter
adds rendering support for each new `DrawingKind` so the conformance suite
covers them. Consumer adapters add support at their own pace; unsupported
kinds remain silent no-ops with diagnostics.

### Phase 4 — `0.4` Editor + inputs

`@invinite-org/chartlang-editor` ships. Inline diagnostics. Inputs UI generated from
manifest. First-class developer experience for end-users writing scripts in
our app.

### Phase 5 — `0.5` Alerts (server-side hosts)

`@invinite-org/chartlang-host-quickjs` ships. The host runs in any Node-class
environment (Node 20, Deno, Bun, Cloudflare Workers via WASM) with hard
CPU and memory caps. Consumer repos build their own server-side runners
on top — load compiled scripts, push candles from their market-data feed,
route emitted `AlertEmission`s through their preferred notification
channels (webhook, email, in-app inbox, push). No server runner lives in
the OSS repo.

### Phase 6 — `1.0` Standardisation

- Freeze `apiVersion: 1`.
- Publish the language spec (this doc, expanded) at `chartlang.dev/spec`.
- Ship the Lightweight Charts adapter to prove portability.
- Public conformance reports.
- Migration guide from Pine for the most common patterns.

### Beyond `1.0`

- Strategy primitives (`strategy.entry()`, `strategy.exit()`, P&L
  accounting). Requires a new `Capabilities.strategy` flag.
- Multi-timeframe (`request.security()` equivalent).
- Library scripts that other scripts can import.
- Marketplace metadata format.

---

## 20. Open Questions To Resolve Before Phase 1

1. **State persistence across sessions.** Pine recomputes from history every
   load. We can do the same in v1. Persisting partial state to IDB (as our
   chart's indicator cache does) is a v2 optimisation, not a contract
   change.
2. **Symbol / interval primitives.** Should `bar.symbol` and `bar.interval`
   be readable inside `compute`? Probably yes — many scripts branch on them.
   Add to `Bar` as `readonly symbol: string` / `readonly interval: string`.
3. **Multi-pane scripts.** A single script that emits to both an overlay
   pane and a new sub-pane. Pine handles this via `display = …` per plot.
   We follow the same convention: `plot(value, { pane: "new" })`.
4. **Time zones.** Bar times are UTC ms. Display TZ is the adapter's
   problem. Scripts that need NY session boundaries import a helper from
   `@invinite-org/chartlang-core/time` (port of our `nyDayKey`).
5. **Numeric precision.** Float64 everywhere. No `Decimal`. Document the
   rounding implications for cumulative indicators (VWAP, OBV).

These are flagged for resolution in the first PR landing in the new repo —
not decided in this plan.

---

## 21. What This Plan Is Deliberately Not Doing

- Not adopting `vm2` or any AST-rewriting sandbox. CVEs make these dead
  ends.
- Not building a custom parser. `tsc` is good enough and is the user's
  TypeScript editor experience for free.
- Not designing for arbitrary host extensibility in v1. Adapters extend the
  set of *renderable* primitives but cannot extend the *language*. User-
  defined indicators that compose existing primitives are fine; user-defined
  primitives that introduce new state machines are deferred to v2.
- Not promising backward compatibility before `1.0`. The header pin
  (`apiVersion: 1`) is the migration boundary.

---

## 22. Starting the Repo

Concrete bootstrap for a fresh repo. **Every step below ships with tests
and README in the same commit — they are not "to be added later."**

### 22.1 Prerequisites

- **Node.js ≥ 20.** Pin via `.nvmrc` (see §22.3).
- **pnpm ≥ 9.** Enable via `corepack enable && corepack prepare pnpm@9 --activate`.
- **git ≥ 2.40.**
- **gh CLI** (optional, for repo creation).
- A clone of the sibling `invinite` repo next to this one — see §3.1
  for the reference paths.

### 22.2 One-shot bootstrap commands

Run these in order from an empty directory. Every command is idempotent
and runs in under a minute combined.

```bash
# 1. Create the repo
gh repo create chartlang --public --license=MIT --clone
cd chartlang
echo "20" > .nvmrc
nvm use            # or: corepack use node@20

# 2. Lay out the workspace
mkdir -p packages/{core,compiler,runtime,host-worker,host-quickjs,adapter-kit,editor,cli,conformance}/src
mkdir -p examples/canvas2d-adapter/src
mkdir -p docs/{language,primitives,adapters,hosts,spec,getting-started,reference}
mkdir -p scripts .github/workflows .changeset

# 3. Write every file listed in §22.3 — root configs.
#    (Each is < 30 lines. Copy verbatim from this plan.)

# 4. Initialise pnpm + install dev deps.
pnpm install
pnpm dlx @changesets/cli init   # generates .changeset/config.json — overwrite with §22.3 version

# 5. Scaffold every package.
#    scripts/scaffold.ts iterates the packages/* + examples/canvas2d-adapter
#    directories and writes package.json + tsconfig.json + vitest.config.ts +
#    README.md + src/index.ts for each. See §22.4.
pnpm tsx scripts/scaffold.ts

# 6. Sanity check.
pnpm typecheck
pnpm lint
pnpm test           # all packages have a placeholder test that passes
pnpm build          # all packages build to dist/

# 7. First commit.
git add -A
git commit -m "chore: bootstrap workspace + tooling"
git push -u origin main
```

After step 7 the repo is fully wired: lint/format/typecheck/test/coverage/
docs/bench/conformance gates are all live in CI, every package has a
stub README, and the next PR (PR 2 in §22.8) drops `@invinite-org/chartlang-core`
types into `packages/core/src/`.

### 22.3 Root configuration files (copy verbatim)

Every file below lives at the repo root unless the path says otherwise.
The agent writes these once at bootstrap and they almost never change
afterwards.

**`package.json`** (root, workspace manager — note `"private": true`):

```json
{
    "name": "chartlang",
    "private": true,
    "version": "0.0.0",
    "type": "module",
    "packageManager": "pnpm@9.12.0",
    "engines": { "node": ">=20" },
    "scripts": {
        "build": "pnpm -r --parallel build",
        "typecheck": "pnpm -r --parallel typecheck",
        "test": "vitest run --coverage",
        "test:watch": "vitest",
        "bench": "vitest bench",
        "bench:ci": "vitest bench --run",
        "lint": "biome lint .",
        "format": "biome format --write .",
        "format:check": "biome format .",
        "conformance": "pnpm tsx scripts/run-conformance.ts",
        "docs:check": "pnpm tsx scripts/docs-check.ts",
        "docs:build": "vitepress build docs",
        "readme:check": "pnpm tsx scripts/readme-check.ts",
        "coverage:report": "pnpm tsx scripts/coverage-merge.ts",
        "scaffold": "pnpm tsx scripts/scaffold.ts",
        "changeset": "changeset",
        "release": "pnpm build && changeset publish"
    },
    "devDependencies": {
        "@biomejs/biome": "^1.9.0",
        "@changesets/cli": "^2.27.0",
        "@vitest/coverage-v8": "^2.1.0",
        "tsx": "^4.19.0",
        "typescript": "^5.6.0",
        "vitest": "^2.1.0",
        "vitepress": "^1.4.0",
        "expect-type": "^1.0.0"
    }
}
```

**`pnpm-workspace.yaml`:**

```yaml
packages:
    - "packages/*"
    - "examples/canvas2d-adapter"
```

**`tsconfig.base.json`** (every package extends this):

```jsonc
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "lib": ["ES2022", "DOM", "DOM.Iterable"],
        "strict": true,
        "noImplicitAny": true,
        "noImplicitOverride": true,
        "noImplicitReturns": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noFallthroughCasesInSwitch": true,
        "exactOptionalPropertyTypes": true,
        "isolatedModules": true,
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true,
        "skipLibCheck": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "verbatimModuleSyntax": true,
        "resolveJsonModule": true,
        "noEmit": false
    }
}
```

**`biome.json`** (formatter + linter; replaces ESLint + Prettier):

```jsonc
{
    "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
    "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
    "files": {
        "ignoreUnknown": true,
        "ignore": ["dist/**", "coverage/**", "**/*.tsbuildinfo"]
    },
    "formatter": {
        "enabled": true,
        "indentStyle": "space",
        "indentWidth": 4,
        "lineWidth": 100,
        "lineEnding": "lf"
    },
    "linter": {
        "enabled": true,
        "rules": {
            "recommended": true,
            "suspicious": {
                "noExplicitAny": "error",
                "noConsoleLog": "warn"
            },
            "style": {
                "noNonNullAssertion": "error",
                "useImportType": "error"
            }
        }
    },
    "javascript": {
        "formatter": {
            "quoteStyle": "double",
            "semicolons": "always",
            "trailingCommas": "all",
            "arrowParentheses": "always"
        }
    }
}
```

**`.gitignore`:**

```gitignore
node_modules/
dist/
coverage/
*.tsbuildinfo
.vitest-cache/
.DS_Store
.env
.env.local
.env.*.local
docs/.vitepress/cache/
docs/.vitepress/dist/
```

**`.npmrc`** (committed at repo root — token resolved from `$NPM_TOKEN`
at publish time, never written to the file):

```
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
@invinite-org:registry=https://registry.npmjs.org/
access=public
```

**`.env.example`** (committed; copy to `.env` and fill in locally):

```bash
# Granular Access Token from npmjs.com, scoped to @invinite-org/*
# with "Read and write" permission. Used by `pnpm release` (§22.11).
# Never committed — `.env` is in .gitignore.
NPM_TOKEN=npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**`.nvmrc`:**

```
20
```

**`.editorconfig`:**

```ini
root = true

[*]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

**`.changeset/config.json`:**

```json
{
    "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
    "changelog": "@changesets/cli/changelog",
    "commit": false,
    "fixed": [],
    "linked": [],
    "access": "public",
    "baseBranch": "main",
    "updateInternalDependencies": "patch",
    "ignore": []
}
```

**`LICENSE`** — MIT, with the standard text. `gh repo create
--license=MIT` generated this; leave it.

**`README.md`** — see §17.1 for the required structure. Hard-cap 300
lines.

**`CONTRIBUTING.md`** — must cover:

1. Setup commands (mirror §22.2 step 1–6).
2. Test + coverage gate (§16).
3. Documentation requirements (§17).
4. Provenance + relicense note for math ported from `../invinite/`
   (§3.1).
5. Changeset workflow (`pnpm changeset` before pushing).
6. PR checklist (auto-injected via `.github/pull_request_template.md`).

**`CODE_OF_CONDUCT.md`** — Contributor Covenant 2.1, copy verbatim from
the upstream template.

### 22.4 Per-package templates

`scripts/scaffold.ts` generates these files for each package in
`packages/*` and for `examples/canvas2d-adapter`. The agent runs
`pnpm scaffold` once at bootstrap; afterwards new packages get the
same files via the same command.

**Per-package `package.json`** (template, replace `<NAME>` and
`<DESCRIPTION>`):

```jsonc
{
    "name": "@invinite-org/chartlang-<NAME>",
    "version": "0.0.0",
    "type": "module",
    "license": "MIT",
    "description": "<DESCRIPTION>",
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
        ".": {
            "types": "./dist/index.d.ts",
            "import": "./dist/index.js"
        }
    },
    "files": ["dist", "README.md", "CHANGELOG.md"],
    "scripts": {
        "build": "tsc -p tsconfig.json",
        "typecheck": "tsc -p tsconfig.json --noEmit",
        "test": "vitest run --coverage"
    },
    "publishConfig": { "access": "public" },
    "engines": { "node": ">=20" },
    "repository": { "type": "git", "url": "https://github.com/<OWNER>/chartlang.git", "directory": "packages/<NAME>" }
}
```

> **Note on `provenance`.** npm's `provenance: true` flag (sigstore
> signatures linking a published package to a GitHub Actions build)
> requires CI with OIDC. Since this repo publishes manually (see
> §22.11), `provenance` stays off. To enable it later, flip the
> publish flow to CI per §22.6's `release` job block (commented out
> by default) and add `"provenance": true` back into `publishConfig`.

**Per-package `tsconfig.json`:**

```jsonc
{
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
        "outDir": "./dist",
        "rootDir": "./src"
    },
    "include": ["src/**/*"],
    "exclude": ["**/*.test.ts", "**/*.bench.test.ts", "**/__fixtures__/**"]
}
```

**Per-package `vitest.config.ts`** (already shown in §16.1 — the
`thresholds: { lines: 100, ... }` block is mandatory):

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "json-summary", "lcov"],
            thresholds: { lines: 100, statements: 100, branches: 100, functions: 100 },
            include: ["src/**/*.ts"],
            exclude: [
                "src/**/*.test.ts",
                "src/**/*.bench.test.ts",
                "src/**/__fixtures__/**",
                "src/**/index.ts",
                "src/**/types.ts",
            ],
        },
    },
});
```

**Per-package `README.md`** — see §17.1 (≤ 100 lines, sections fixed).

**Per-package `src/index.ts`** — initial placeholder:

```ts
export const PACKAGE_VERSION = "0.0.0";
```

Replaced in PR 2+ as each package lands real exports.

**Per-package `src/index.test.ts`** — initial placeholder so the
coverage gate doesn't fail on a package with no tests:

```ts
import { describe, expect, it } from "vitest";

import { PACKAGE_VERSION } from "./index";

describe("placeholder", () => {
    it("exports a version constant", () => {
        expect(PACKAGE_VERSION).toBe("0.0.0");
    });
});
```

### 22.5 `scripts/scaffold.ts`

A small TypeScript script that walks `packages/*` + `examples/canvas2d-
adapter`, writes the five template files above for any package missing
them, and is idempotent (existing files are not overwritten). ~120 lines.
Skeleton:

```ts
#!/usr/bin/env tsx
/**
 * One-shot scaffolding for @invinite-org/chartlang-* packages.
 * Idempotent — existing files are not overwritten.
 * Usage:  pnpm tsx scripts/scaffold.ts
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const PACKAGE_DIRS = [
    "packages/core",
    "packages/compiler",
    "packages/runtime",
    "packages/host-worker",
    "packages/host-quickjs",
    "packages/adapter-kit",
    "packages/editor",
    "packages/cli",
    "packages/conformance",
    "examples/canvas2d-adapter",
];

const DESCRIPTIONS: Record<string, string> = {
    "packages/core": "Types and primitives for chartlang scripts",
    "packages/compiler": "TypeScript transformer + bundler for .chart.ts files",
    "packages/runtime": "Execution engine, Series ring buffers, ta.* math primitives",
    "packages/host-worker": "Web Worker ScriptHost for the browser",
    "packages/host-quickjs": "QuickJS-WASM ScriptHost for untrusted / server-side execution",
    "packages/adapter-kit": "SDK for writing chartlang adapters in consumer repos",
    "packages/editor": "CodeMirror 6 bundle for editing .chart.ts files",
    "packages/cli": "chartlang CLI — compile, lint, bench, scaffold-adapter",
    "packages/conformance": "Adapter conformance test suite",
    "examples/canvas2d-adapter": "Reference adapter — renders to a <canvas> element",
};

async function write(path: string, content: string): Promise<void> {
    if (existsSync(path)) return;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
    console.log(`  wrote ${path}`);
}

async function scaffold(dir: string): Promise<void> {
    const name = dir.replace(/^packages\//, "").replace(/^examples\//, "");
    const pkgName = dir.startsWith("examples/") ? `chartlang-example-${name}` : `@invinite-org/chartlang-${name}`;
    console.log(`\n→ ${pkgName}`);
    // … write package.json, tsconfig.json, vitest.config.ts, README.md,
    //   src/index.ts, src/index.test.ts using the templates in §22.4.
}

for (const dir of PACKAGE_DIRS) {
    await scaffold(join(ROOT, dir));
}
console.log("\nScaffolding complete.");
```

Full templates inlined into the script body — the agent writes the
constant strings from §22.3 / §22.4 once and the rest is iteration.

### 22.6 CI workflow

**`.github/workflows/ci.yml`:**

```yaml
name: CI

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]

permissions:
    contents: read
    id-token: write
    pull-requests: write

concurrency:
    group: ci-${{ github.ref }}
    cancel-in-progress: true

jobs:
    test:
        name: Test (${{ matrix.os }} / Node ${{ matrix.node }})
        runs-on: ${{ matrix.os }}
        strategy:
            fail-fast: false
            matrix:
                os: [ubuntu-latest, macos-latest]
                node: [20, 22]
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v4
              with: { version: 9 }
            - uses: actions/setup-node@v4
              with:
                  node-version: ${{ matrix.node }}
                  cache: pnpm
            - run: pnpm install --frozen-lockfile
            - run: pnpm typecheck
            - run: pnpm lint
            - run: pnpm format:check
            - run: pnpm build
            - run: pnpm test
            - run: pnpm conformance
            - run: pnpm bench:ci
            - run: pnpm docs:check
            - run: pnpm readme:check
            - if: matrix.os == 'ubuntu-latest' && matrix.node == 20
              uses: codecov/codecov-action@v4
              with:
                  files: ./coverage/lcov.info
                  fail_ci_if_error: true

    # ──────────────────────────────────────────────────────────────────
    # Release job intentionally OMITTED.
    # Releases are published manually from a maintainer's machine — see
    # §22.11 "Manual release workflow." To switch to CI-driven releases
    # later, uncomment the block below, add NPM_TOKEN to repo secrets,
    # and re-enable `provenance: true` in the per-package template
    # (§22.4).
    # ──────────────────────────────────────────────────────────────────
    #
    # release:
    #     name: Release
    #     needs: test
    #     if: github.ref == 'refs/heads/main'
    #     runs-on: ubuntu-latest
    #     steps:
    #         - uses: actions/checkout@v4
    #           with: { fetch-depth: 0 }
    #         - uses: pnpm/action-setup@v4
    #           with: { version: 9 }
    #         - uses: actions/setup-node@v4
    #           with: { node-version: 20, cache: pnpm, registry-url: "https://registry.npmjs.org" }
    #         - run: pnpm install --frozen-lockfile
    #         - run: pnpm build
    #         - uses: changesets/action@v1
    #           with:
    #               publish: pnpm release
    #           env:
    #               GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    #               NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

CI matrix covers the two supported Node majors and both major developer
OSes. CI **gates** every PR but does not publish — publishing is manual
per §22.11. No `NPM_TOKEN` secret needs to exist in the repo.

### 22.7 `.github/pull_request_template.md`

```markdown
## Summary

<!-- 1–3 bullets describing the change. -->

## Checklist

- [ ] Tests added / updated (§16 — coverage stays at 100%).
- [ ] Docs added / updated (§17 — JSDoc on new exports, package
      README, `docs/` page if a new concept).
- [ ] Changeset added (`pnpm changeset`).
- [ ] For new `ta.*` primitives: all 5 files from §16.6.
- [ ] For new drawing kinds: schema variant added to
      `packages/core/src/drawings/schema.ts` AND canvas2d-adapter
      render support AND conformance scenario.
- [ ] CI green (test, lint, coverage, conformance, bench, docs).
```

### 22.8 Per-package landing checklist

Every package PR ships **all of the following** in the same commit. CI rejects
the PR if any item is missing.

1. **Source code** — the implementation.
2. **Tests** — per the §16.3 matrix for the package (unit + property +
   golden + type, plus sandbox-escape / bench / conformance where the
   matrix requires them). 100% line/statement/branch/function coverage.
3. **`README.md`** at the package root — purpose, install line, minimal
   API example, link to docs, stability label. ≤ 100 lines.
4. **JSDoc on every exported symbol** — including `@example`, `@since`,
   stability marker, primitive-specific tags from §17.2.
5. **`docs/` pages** — at minimum a generated `docs/primitives/<area>/*.md`
   page per public symbol. Narrative docs (`docs/language/*`,
   `docs/adapters/*`) when the package introduces new concepts.
6. **`CHANGELOG.md` entry** via `pnpm changeset` — every PR creates one.

### 22.9 Phase 1 PR order

Each step below is one PR. Each PR is "green" only when source + tests +
README + docs + CI all pass.

| # | PR scope | Source | Tests required (§16.3) | Docs required (§17) |
|---|---|---|---|---|
| 1 | Root scaffold + CI | tooling | CI smoke (lint, type) | Root README + LICENSE + CONTRIBUTING + spec stubs |
| 2 | `@invinite-org/chartlang-core` types | type-only module | type tests (`expect-type`) | Package README + JSDoc on every type + `docs/language/series-and-indexing.md` |
| 3 | `@invinite-org/chartlang-runtime` skeleton | Series + ring buffer | unit + property (Series invariants) + bench | Package README + JSDoc + `docs/spec/semantics.md` expanded |
| 4 | `@invinite-org/chartlang-runtime` first 8 primitives (sma, ema, rsi, macd, atr, crossover, crossunder, valuewhen) | math ports | unit + property + golden + bench, one file per primitive | Package README + JSDoc with `@formula` + auto-generated `docs/primitives/ta/*.md` |
| 5 | `@invinite-org/chartlang-runtime` `plot`, `hline`, `alert` | emission primitives | unit + property + type | Package README + JSDoc + `docs/language/alerts.md` |
| 6 | `@invinite-org/chartlang-compiler` | TS transformer + bundler | unit + property (AST round-trip) + golden (compiled output) + negative (forbidden constructs) + bench | Package README + `docs/spec/grammar.md` finalised + `docs/language/forbidden-constructs.md` |
| 7 | `@invinite-org/chartlang-host-worker` | Web Worker boot | unit + sandbox-escape + bench + conformance | Package README + `docs/hosts/worker.md` |
| 8 | `@invinite-org/chartlang-adapter-kit` | Adapter contract types + helpers (`defineAdapter`, `validateEmission`, `decodeDrawing`, capability builders, base classes) | unit + type + conformance (via canvas2d reference) | Package README + `docs/adapters/contract.md` + `docs/adapters/capabilities.md` + `docs/adapters/writing-an-adapter.md` |
| 9 | `examples/canvas2d-adapter/` (reference, **not published**) | renders to Canvas2D, ~200 lines, covers ~10 DrawingKinds + 5 PlotKinds | unit + conformance (full suite) + golden visual | README inside the example folder + `docs/adapters/reference/canvas2d.md` walkthrough |
| 10 | First example script + 1 golden fixture | `examples/ema-cross.chart.ts` | conformance scenario (runs against canvas2d-adapter) | Walkthrough in `docs/getting-started/write-your-first-script.md` referencing the example |
| 11 | `@invinite-org/chartlang-cli` (`compile`, `lint`, `bench`, `scaffold-adapter`) | CLI entrypoint | unit + integration | Package README + `docs/getting-started/*` updated with CLI flow + `chartlang scaffold-adapter` documented |

That's Phase 1 in roughly two engineer-weeks — and the deliverable is
**not just** "a working EMA-cross demo." The deliverable is "a working
EMA-cross demo running against the canvas2d reference adapter, plus the
SDK any third-party can use to write their own adapter, plus everything a
second contributor would need to add the ninth primitive without reading
the original author's mind." Tests and README are how that's enforced.

**Nothing chart-specific lands in the OSS repo.** Consumer adapters (for
any chart library — TradingView Lightweight Charts, Highcharts,
ECharts, plain SVG, a bespoke WebGL renderer, anything) are built in the
consumer's own repo, importing `@invinite-org/chartlang-adapter-kit` from npm, under
the consumer's own PR + CI process. See §15.2.

### 22.10 Phase 2+ landing rule

Every primitive port from the reference math library lands as a single
PR with all five files from §16.6:

1. The port itself (`packages/runtime/src/ta/<id>.ts`).
2. Unit test (`<id>.test.ts`).
3. Property test (`<id>.property.test.ts`).
4. Golden test (`<id>.golden.test.ts`).
5. Bench test (`<id>.bench.test.ts`).

Plus:

6. JSDoc on the export with `@formula`, `@warmup`, `@example`, `@since`,
   stability marker.
7. At least one conformance scenario in `packages/conformance/scenarios/`
   that uses the primitive in a real script.
8. Package README and `docs/primitives/ta/<id>.md` auto-generation
   re-run and committed.
9. Changeset entry.

A port PR missing any of the above does not merge. There is no "land the
port now, add tests/docs in a follow-up" allowance. The follow-up never
happens.

### 22.11 Manual release workflow

Releases are published from a maintainer's local machine, not from CI.
CI gates every PR (typecheck, lint, test, coverage, conformance, bench,
docs) but never publishes. This keeps `NPM_TOKEN` out of GitHub secrets
entirely.

**One-time setup (per maintainer):**

```bash
# 1. Create a Granular Access Token at npmjs.com:
#    npm Profile → Access Tokens → Generate New → Granular
#    Packages:    @invinite-org/* (all packages and scopes I own)
#    Permission:  Read and write
#    Expiration:  365 days (rotate yearly)
#    Copy the token.

# 2. Locally:
cp .env.example .env
# Edit .env, paste the token after NPM_TOKEN=

# 3. Verify the token is recognised (does NOT publish):
set -a && source .env && set +a
npm whoami --registry=https://registry.npmjs.org/
#   → should print your npm username
```

Once set up, the `.env` file lives on your machine indefinitely. Rotate
the token at most yearly.

**Releasing — every time a set of changesets is ready to ship:**

```bash
# 1. Make sure main is clean and up to date.
git checkout main && git pull && pnpm install --frozen-lockfile

# 2. Run the gates locally (mirror of CI — fail fast before publishing).
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm conformance
pnpm bench:ci
pnpm docs:check
pnpm readme:check
pnpm build

# 3. Bump versions from accumulated changesets.
#    Reads .changeset/*.md, updates package.json versions + CHANGELOG.md,
#    and removes the consumed changeset files.
pnpm changeset version
git add -A
git commit -m "chore: release"
git push origin main

# 4. Publish to npm.
#    Source the token, then run `pnpm release` (which is `pnpm build && changeset publish`).
set -a && source .env && set +a
pnpm release

# 5. Push the release tags changesets created.
git push --follow-tags
```

**What `pnpm release` does:**

The root `package.json` (§22.3) defines `"release": "pnpm build && changeset publish"`.
`changeset publish` walks every package whose version was bumped in step
3, runs `npm publish` against the npm registry, and creates a git tag
`<package>@<version>` for each. Packages already at the registry version
are skipped — the command is idempotent.

**If publish fails halfway:**

- `changeset publish` is per-package atomic. A failure on package N+1
  leaves N packages already published — those versions are permanent
  per npm policy.
- Recover by running `pnpm release` again. Already-published packages
  are skipped; only the remaining ones publish.
- If a package was published incorrectly (wrong contents, broken
  build), bump the patch version in a new release rather than running
  `npm unpublish` — npm's unpublish window is 72 hours and breaks
  consumers.

**Why this works without CI:**

- The four CI gates (test / lint / coverage / docs) are mirrored by the
  local commands in step 2 — the maintainer can't accidentally ship a
  broken release without seeing the failure on their own machine.
- `pnpm changeset version` is deterministic — same changeset inputs
  produce same version bumps, so a release-after-rebase doesn't
  surprise.
- The `.env` approach keeps the token on the maintainer's disk only.
  No GitHub secrets to leak, no CI runner to compromise, no
  third-party Action with `permissions: write-all`.

**When to flip back to CI-driven releases:**

When the team grows past 2–3 maintainers OR when sigstore provenance
becomes a hard requirement (some downstream consumers require it for
supply-chain audits). Switch path:

1. Uncomment the `release` job in `.github/workflows/ci.yml` (§22.6).
2. Add `NPM_TOKEN` to repo secrets (Settings → Secrets and variables →
   Actions).
3. Flip `"provenance": true` back into `publishConfig` in §22.4's
   per-package template (and run `pnpm scaffold` or update each
   `package.json`).
4. Delete `.env` from your machine — you no longer need a local
   token.

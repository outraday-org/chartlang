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
    ├── language-service/              # @invinite-org/chartlang-language-service (headless: hover, completions, diagnostics)
    ├── editor/                        # @invinite-org/chartlang-editor (CodeMirror 6 shell over language-service)
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
| **Indicator helpers** | `../invinite/src/components/trading-chart/indicators/lib/` | Shared math helpers. Port the **chained-MA family first** — `sma-of-float64.ts`, `ema-of-float64.ts`, `wma-of-float64.ts`, `smma-of-float64.ts`, `vwma-of-float64.ts`, `compute-ma-of-float64.ts` (the chained-MA dispatcher; excludes `vwma` at the type level), `compute-ma.ts`, `ma-types.ts`. Then volatility / statistics: `tr-series.ts` (True Range / ATR), `donchian-mid.ts`, `wilder-directional.ts`, `linear-regression.ts`, `rolling-stddev.ts`, `pearson.ts` (Pearson correlation — powers `trendStrengthIndex`). Universal helpers used by nearly every indicator: `apply-offset.ts` (Pine-parity bar shift), `pick-candle-source.ts` + `read-source-field.ts` (source-field resolution), `smoothing-block.ts` / `smoothing-overlay.ts` (post-compute smoothing), `format-compact.ts` (K/M/B labels), `read-numeric-param.ts` / `read-color-param.ts` (param canonicalisers). Multi-timeframe: `align-htf-series-to-ltf.ts` is the kernel for §6.8 — port it before any HTF work. |
| **Indicator contract docs** | `../invinite/src/components/trading-chart/indicators/CLAUDE.md` | Full inventory table by category, contract semantics, "How to add a new indicator" walkthrough with worked VWAP example. **Read this before porting any indicator.** |
| **Indicator tests** | `../invinite/src/components/trading-chart/indicators/<id>.test.ts` | One per indicator. Vitest tests pinning the math against `buildVisualBaselineCandles(100)` fixture. Port these alongside the implementation. |
| **Indicator benches** | `../invinite/src/components/trading-chart/indicators/<id>.bench.test.ts` | Bench tests for hot primitives (sma/ema/bb/rsi/macd/vol). Port alongside. |
| **Drawing schemas** | `../invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts` | TypeScript types for **61 drawing kinds** (`LineDrawing`, `RectangleDrawing`, `FibRetracementDrawing`, `ElliottImpulseWaveDrawing`, …). Read this to derive the `DrawingState` discriminated union in §10. Note: the 4 pitchfork tools (`pitchfork`, `schiff-pitchfork`, `modified-schiff-pitchfork`, `inside-pitchfork`) all emit one `PitchforkDrawing` with a `variant` discriminator; `ray` / `extendedLine` collapse into `LineDrawing` with `extendLeft` / `extendRight` flags; `cypherPattern` is a kind without a standalone tool. Drawing kind strings are camelCase (`horizontalLine`) — chartlang emissions use kebab-case (`horizontal-line`) and `decodeDrawing()` normalises. |
| **Drawing tool behavior** | `../invinite/src/components/trading-chart/tools/` | One `<name>-tool.ts` per drawing — **67 tool files** total. Of these, 4 are non-drawing (`select-tool.ts`, `rectangle-select-tool.ts`, `eraser-tool.ts`, `comment-tool.ts`), leaving 63 drawing tools emitting 61 unique kinds. Placement, hit-testing, edit handles, anchor semantics. Reference for `draw.*` primitive parameter shapes and `editHandles` patterns. |
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
| `@invinite-org/chartlang-language-service` | `getHoverDoc(target)`, `getCompletions(pos, source)`, `compileToDiagnostics(source) → LspDiagnostic[]`, `getSignatureHelp`, `getDefinition` — headless, no editor dependency. Editor-agnostic intelligence layer that any host (CM6, Monaco, JetBrains plugin, headless CLI) consumes. | hover-doc registry sourced from JSDoc on `@invinite-org/chartlang-core`, completion source for `ta.*` / `draw.*` / `input.*` / `color.*`, diagnostic mapper from compiler errors to LSP-shaped `{ range, severity, code, message }` | `@invinite-org/chartlang-compiler`, `@invinite-org/chartlang-core` |
| `@invinite-org/chartlang-editor` | `createChartlangEditor(opts)` — CodeMirror 6 extension bundle + `<ChartlangEditor />` React component. Reference editor implementation; thin shell over `@invinite-org/chartlang-language-service`. | Lezer TS grammar wiring, CM6 hover/autocomplete extension bindings that delegate to the language service | `@invinite-org/chartlang-language-service`, `codemirror` |
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
| `defineAlertCondition({ … })` | User-wired alert (script declares a named condition; user manually creates the alert in the adapter UI from it). Distinct from `defineAlert` — see §11. | `alerts` |

A repo can contain `chartlang.config.ts` that declares default `apiVersion`,
license header, formatter rules. Optional. The compiler reads it if present.

**Indicator options (script-author overrides).** Beyond `name`, `apiVersion`,
`overlay`, and `inputs`, `defineIndicator` accepts:

```ts
defineIndicator({
    // ...
    /** Lookback override — script declares it needs N bars even if the compiler
     *  can't statically infer that. Capped by Capabilities.maxLookback. */
    maxBarsBack: 1000,
    /** Per-script drawing budget — script's self-imposed cap. Runtime takes the
     *  min of this and Capabilities.maxDrawingsPerScript. */
    maxDrawings: { lines: 200, labels: 200, boxes: 50, polylines: 50, other: 100 },
    /** Y-axis display format hint. Adapter renders the indicator's pane scale
     *  accordingly. "inherit" = same as price; "percent" = "%" suffix;
     *  "volume" = compact notation (K/M/B); "mintick" = round to syminfo.mintick. */
    format: "inherit" | "percent" | "volume" | "mintick",
    /** Decimal places for y-axis labels. Default: adapter-decided. */
    precision: 2,
    /** Y-axis placement. "right" (default) | "left" | "none" (no axis). */
    scale: "right" | "left" | "none",
    /** Required intervals. Script load fails if current bar's interval ∉ this set.
     *  Empty / omitted = any. See §4.5. */
    requiresIntervals: ["1D", "1W"],
})
```

All script-side options are optional. Defaults match Pine: `format: "inherit"`,
`scale: "right"`, no precision pin, no lookback override, no drawing budget
(adapter's `maxDrawingsPerScript` applies as-is).

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
    /** Adapter-defined symbol id this bar belongs to (e.g. "AAPL", "BTC-USD"). */
    readonly symbol: string;
    /** Adapter-defined interval id this bar belongs to (e.g. "1m", "5m", "1D"). */
    readonly interval: string;
};

// Differences from invinite's `ChartCandle` (`lib/candle-types.ts`):
//   - invinite carries `index: number` per bar (0..N-1) so its renderer
//     can compress non-trading time. chartlang scripts access the
//     equivalent through `series.length` and `series[N]` — the bar's
//     position in the stream is implicit, not stored on the bar.
//   - invinite makes `volume` optional. chartlang requires it: scripts
//     that need volume can rely on it being a number (adapters that
//     genuinely lack volume emit NaN, which propagates harmlessly
//     through `ta.*` like every other NaN warmup).

/**
 * Adapter-defined timeframe descriptor. The `value` is the canonical string id
 * scripts use in `request.security` and `input.interval`; `label` and `group` are
 * editor-facing only. chartlang itself does not enumerate intervals — each
 * adapter ships its own list.
 */
export type IntervalDescriptor = {
    readonly value: string;       // "1D" — opaque adapter-defined id
    readonly label: string;       // "1 day" — human-readable
    readonly group: string;       // "daily" — for picker grouping
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
/** Stroke style for **drawings** (lines, rectangles, fibs, etc). */
export type LineStyle = "solid" | "dashed" | "dotted";

/**
 * Line style for **indicator plots** (the `plot()` primitive). Distinct from
 * `LineStyle` — invinite renders indicator strokes with a wider vocabulary
 * (`circles` / `cross` for sparse markers, `step` for staircase plots) that
 * the drawing-stroke enum doesn't need. Cf. `indicators/lib/line-style.ts` in
 * the invinite reference. Adapters that don't support a given variant fall
 * back to `"line"` with `unsupported-plot-style` diagnostic (§7.4).
 */
export type PlotLineStyle = "line" | "step" | "dashed" | "circles" | "cross";

export type AlertSeverity = "info" | "warning" | "critical";

export type ScriptManifest = {
    apiVersion: 1;
    kind: "indicator" | "drawing" | "alert";
    name: string;
    inputs: InputSchema;              // declared via `input.*` builders
    capabilities: ReadonlyArray<CapabilityId>;  // computed by the compiler
    /**
     * Distinct interval ids referenced by `request.security({ interval })` calls
     * in this script. String-literal-only — see §5.4. Empty if the script never
     * calls request.security.
     */
    requestedIntervals: ReadonlyArray<string>;
    /**
     * True if the script declares an `input.interval(...)` input — meaning the
     * end-user picks the main timeframe per-instance. The host uses this to
     * decide whether to render a timeframe picker in the script-settings UI.
     */
    userPickableInterval: boolean;
};
```

### 4.4 Module surface

```ts
// barrel: @invinite-org/chartlang-core
export { defineIndicator, defineDrawing, defineAlert, defineAlertCondition } from "./define";
export { ta } from "./ta";            // technical analysis primitives + ta.nz
export { plot, hline, vline, fill, bgcolor, barcolor,
         plotshape, plotchar, plotcandle, plotbar, plotarrow } from "./plot";
export { draw } from "./draw";        // drawing primitives namespace + draw.table
export { alert } from "./alert";
export { input } from "./input";      // input builders + input.interval
export { request } from "./request";  // multi-timeframe primitives + request.lowerTf
export { state } from "./state";      // var/varip equivalent (§4.6)
export { barstate } from "./barstate"; // barstate.* (§4.7)
export { syminfo } from "./syminfo";  // symbol metadata (§4.8)
export { timeframe } from "./timeframe"; // timeframe.* helpers (§4.9)
export { runtime } from "./runtime";  // runtime.log.*, runtime.error()
export { color, style } from "./style"; // + color.fromGradient, color.withAlpha
export type { … }                     // see §4.3

// subpath: @invinite-org/chartlang-core/time
// Time-zone and session helpers — bar times are UTC ms always; display TZ
// is the adapter's problem. Bundled helpers:
//   import { nyDayKey, nySessionBounds, weekKey, session, weekday } from "@invinite-org/chartlang-core/time";
// Ported from invinite's existing `src/components/trading-chart/indicators/lib/ny-day-key.ts`
// + `session-boundaries.ts` (see §3.1).
//
//   session.regular(tz: string, t: Time): { open: Time; close: Time };  // regular trading hours
//   session.extended(tz: string, t: Time): { open: Time; close: Time }; // pre + after hours
//   session.isOpen(tz: string, t: Time, type: "regular" | "extended"): boolean;
//   weekday(tz: string, t: Time): 0-6;                                  // 0 = Sunday
//   nyDayKey(t: Time): string;                                          // "2026-05-29"
//   nySessionBounds(t: Time): { open: Time; close: Time };              // 9:30-16:00 ET
//   weekKey(tz: string, t: Time): string;                               // "2026-W22"
```

The `ta`, `plot`, `draw`, `alert`, `input` namespaces are populated entirely
from `@invinite-org/chartlang-runtime` primitive registries (see §9 / §10) so adding a new
indicator is one entry in the registry, with the typed surface picked up
automatically by TS declaration merging.

### 4.5 Timeframe primitives

Two orthogonal concepts. Scripts can use either, both, or neither.

**Main timeframe — `input.interval(default, opts?)`.** The end-user picks the
script's main timeframe per-instance in the script-settings UI. The set of
pickable values comes from `Capabilities.intervals` (§7.2). Default
`"chart"` means "follow the chart pane's current interval and re-bind when
the user changes it." A concrete adapter-defined string like `"1D"` means
"always pin to that interval, regardless of chart pane." Only one
`input.interval()` per script.

```ts
defineIndicator({
    inputs: {
        timeframe: input.interval("chart"),        // user can override
        length: input.int(20),
    },
    compute({ inputs, bar, ta, plot }) {
        const ema = ta.ema(bar.close, inputs.length);
        plot(ema);                                  // bar comes from inputs.timeframe's stream
    },
});
```

**Secondary timeframes — `request.security({ interval })`.** Read additional
candle streams at script-author-fixed intervals, alongside the main stream.
Pine's `request.security()` equivalent. Returns a `Bar`-shaped object whose
fields are `Series<number>` reads from the requested interval, time-aligned
to the current main-stream bar (§6.8). Multiple calls per script allowed.

```ts
defineIndicator({
    name: "Intraday with daily anchor",
    compute({ bar, ta, plot, color, request }) {
        // Main stream — chart's interval (e.g. 5m).
        const intraEma = ta.ema(bar.close, 20);
        plot(intraEma, { color: color.blue, title: "EMA (chart)" });

        // Secondary stream — daily, regardless of chart.
        const daily = request.security({ interval: "1D" });
        const dailyEma = ta.ema(daily.close, 20);
        plot(dailyEma, { color: color.purple, title: "EMA (daily)" });

        if (ta.crossover(bar.close, dailyEma)) {
            alert("Intraday crossed above daily EMA", { severity: "info" });
        }
    },
});
```

The `interval` arg to `request.security` MUST be a string literal or an
`input.enum` value — never a dynamic expression. The compiler enforces this
(§5.4) so the set of secondary streams is statically known at compile time
and the host can open them upfront. Mirrors Pine's identical restriction.

Both primitives gate against `Capabilities.intervals`. If a script
references an interval the target adapter doesn't list, the editor emits
`unsupported-interval` at compile time and the runtime drops the call with
a NaN-series fallback (§7.4). `request.security` additionally gates against
`Capabilities.multiTimeframe`: when `false`, the call returns an all-NaN
secondary bar and the runtime emits `multi-timeframe-not-supported`.

**Lower-timeframe arrays — `request.lowerTf({ interval })`.** Pine's
`request.security_lower_tf()` equivalent. Read N **lower-timeframe**
bars contained inside the current main bar. Returns a `Series<ReadonlyArray<Bar>>` —
each main-bar slot holds an array of secondary bars whose times fall
within the main bar's window.

```ts
defineIndicator({
    name: "5m volume histogram on 1h chart",
    compute({ bar, request, plot, color }) {
        // Returns array of 5m bars contained in each 1h bar (typically 12).
        const lower = request.lowerTf({ interval: "5m" });
        const totalVol = lower.current.reduce((s, b) => s + b.volume, 0);
        plot(totalVol, { color: color.cyan, pane: "vol-sub" });
    },
});
```

Gated by `Capabilities.multiTimeframe` (same flag as `request.security`).
Additionally requires the lower-timeframe value to be **smaller** than
the main interval — `request.lowerTf({ interval: "1D" })` on a `5m`
chart fails compilation with `lower-tf-not-lower`. Compile-time check
uses `IntervalDescriptor` ordering (§7.2). When supported, the adapter
delivers the lower-timeframe stream just like a secondary in
`request.security`, but the runtime buckets emissions by main-bar
containment instead of taking the most-recent.

### 4.6 User-defined persistent state — `state.*` / `state.tick.*`

Equivalent of Pine's `var` / `varip` keywords. Lets a script declare
cross-bar mutable state without writing a custom stateful primitive.
Without this, common idioms ("highest close since session open", "last
crossover bar index", "accumulated VWAP numerator") force authors into
`ta.*` workarounds or input misuse — same gap Pine fills with `var`.

```ts
import { defineIndicator, state, bar, ta, plot, alert, color } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Session-high alert",
    apiVersion: 1,
    compute({ bar, state, alert, plot, color, ta, barstate }) {
        // var float sessionHigh = na
        const sessionHigh = state.float(NaN);

        // Reset on new session day.
        if (barstate.isfirst || bar.time % 86_400_000 === 0) {
            sessionHigh.value = bar.high;
        } else if (Number.isNaN(sessionHigh.value) || bar.high > sessionHigh.value) {
            sessionHigh.value = bar.high;
        }

        plot(sessionHigh.value, { color: color.orange, title: "Session high" });

        if (ta.crossover(bar.close, sessionHigh.value)) {
            alert("Crossed session high", { severity: "info" });
        }
    },
});
```

**Two flavours.**

| API | Pine equivalent | Tick semantics |
|---|---|---|
| `state.float(init)` / `state.int(init)` / `state.bool(init)` / `state.string(init)` | `var` | Writes during a `tick` event are **tentative** — discarded if a later tick replaces the head bar. Committed when the bar closes. Reads see the committed value. |
| `state.tick.float(init)` / `state.tick.int(init)` / `state.tick.bool(init)` / `state.tick.string(init)` | `varip` | Writes during a `tick` event are **committed immediately**. No tentative phase. Use for "running per-tick counter" kinds of state. |

**Why two.** Pine's `var` vs `varip` distinction exists because some
state ("last confirmed swing high") should only advance when a bar
closes — otherwise an intraday wick that gets retraced corrupts the
state. Other state ("tick counter for this bar") should advance every
tick. Same reasoning applies here.

**API shape.**

```ts
// @invinite-org/chartlang-core
export namespace state {
    export function float(init: number): MutableSlot<number>;
    export function int(init: number): MutableSlot<number>;
    export function bool(init: boolean): MutableSlot<boolean>;
    export function string(init: string): MutableSlot<string>;

    export namespace tick {
        export function float(init: number): MutableSlot<number>;
        export function int(init: number): MutableSlot<number>;
        export function bool(init: boolean): MutableSlot<boolean>;
        export function string(init: string): MutableSlot<string>;
    }
}

export type MutableSlot<T> = {
    /** Current committed value. */
    get value(): T;
    /**
     * Assign the slot. In `state.*`, writes are tentative during ticks and
     * committed at bar close. In `state.tick.*`, writes commit immediately.
     */
    set value(v: T);
};
```

The `MutableSlot<T>` interface is intentionally minimal — no
`.history()`, no `.previous()`, no `[N]` indexing. If a script needs the
previous bar's value, it stores it explicitly in a second slot, or uses
the `ta.*` series-indexing primitives. This keeps the slot lifecycle
trivially auditable.

**Compiler treatment.** `state.float()`, `state.int()`, etc. and their
`state.tick.*` variants land in the `STATEFUL_PRIMITIVES` registry
(§5.5). The compiler injects a callsite slot id, identical to how
`ta.ema(...)` is handled. Same loop restriction applies: a `state.*`
call inside a loop body fails compilation with
`stateful-call-inside-loop`. Writers who need N slots write N
declarations or build an indexable structure outside `state.*`.

**Runtime: committed vs tentative.** Every `state.*` (non-`.tick`) slot
holds two values: `committed` and `tentative`. Reads return
`tentative`. Writes update `tentative`. On `onBarClose`,
`tentative → committed` for every slot. On `onBarTick`, the slot's
`tentative` is reset to `committed` at the START of the tick step so
within-bar tick assignments don't leak. `state.tick.*` slots have only
`committed`; reads and writes both touch it directly.

```ts
// Inside the runtime, per state slot.
class StateSlot<T> {
    private committed: T;
    private tentative: T;
    private readonly tickPersistent: boolean;

    constructor(init: T, tickPersistent: boolean) {
        this.committed = init;
        this.tentative = init;
        this.tickPersistent = tickPersistent;
    }

    get(): T { return this.tickPersistent ? this.committed : this.tentative; }
    set(v: T): void {
        if (this.tickPersistent) { this.committed = v; }
        else { this.tentative = v; }
    }

    onBarClose(): void {
        if (!this.tickPersistent) { this.committed = this.tentative; }
    }
    onBarTick(): void {
        if (!this.tickPersistent) { this.tentative = this.committed; }
    }
}
```

**Persistence.** `state.*` slot values are part of the `StateSnapshot`
(§6.9 — `slots: Record<string, JsonValue>`). Both `committed` and
`tentative` survive snapshot/restore; the slot id key for snapshot
storage is `${slotId}:state` with `value: { committed, tentative }`.
`state.tick.*` slots store only `committed`. Warm-start determinism
applies the same way as for `ta.*` — same script same bars produces
byte-identical emissions whether cold or warm.

**Initialisation lifetime.** The `init` argument is evaluated **once per
script mount**, at slot construction. Subsequent calls to
`state.float(init)` on the same callsite return the **existing** slot
with its existing value — `init` is ignored. This matches Pine's
"initialise once" semantics. Authors who want to reset on a condition
do `if (cond) { slot.value = newInit; }` explicitly.

**Out of scope.** `state.array(...)` / `state.map(...)` — collections
of persistent state. v1 ships only scalar slots; collections work via
JS arrays whose identity is held in a `state.*` slot but with no
chartlang-level persistence guarantee. Land in v1.x once a clear
collection-serialisation policy is agreed.

### 4.7 Bar state — `barstate.*`

Equivalent of Pine's `barstate.*`. Lets `compute` distinguish the
runtime mode it's running in. Without this, scripts that emit alerts
can't tell "fire on every tick" from "fire only on bar close" — a real
bug magnet.

```ts
defineIndicator({
    name: "Confirmed crossover only",
    compute({ bar, ta, alert, barstate }) {
        if (!barstate.isconfirmed) return;        // skip ticks
        const sma = ta.sma(bar.close, 50);
        if (ta.crossover(bar.close, sma)) {
            alert("Close confirmed cross", { severity: "info" });
        }
    },
});
```

**API.** Read-only object whose fields the runtime mutates each step.
Identity is stable across bars.

```ts
// @invinite-org/chartlang-core
export const barstate: {
    /** True on the first historical bar of this script mount. */
    readonly isfirst: boolean;
    /** True on the most recent bar (live or replay). */
    readonly islast: boolean;
    /** True if a new bar opened on this step. (false on ticks within a bar.) */
    readonly isnew: boolean;
    /** True if the runtime is in the historical-replay phase. */
    readonly ishistory: boolean;
    /** True if the runtime is processing a realtime feed. */
    readonly isrealtime: boolean;
    /** True if this step is a `kind: "close"` event (bar finalised). False on ticks. */
    readonly isconfirmed: boolean;
};
```

**Derivation, not a new event channel.** All six fields are derived
from the runtime's existing event-type discrimination (`kind: "history"
| "close" | "tick"`) and bar-index bookkeeping. No new adapter contract
surface. The runtime updates the `barstate` view at the same point it
updates `bar` (§6.7 step 2).

**Cross-stream behavior.** `barstate.*` reflects the **main stream's**
state. Secondary streams from `request.security` have their own
implicit close/tick semantics governed by the time-alignment policy
(§6.8) — scripts can't see those directly. If a use case needs it, a
future `barstate.security(handle)` could expose secondary-stream state,
but v1 ships main-stream-only.

**No `barstate.isconfirmed` for ticks-as-confirmed.** Some Pine
scripts abuse `barstate.isconfirmed` as "is this a finalised bar I'm
seeing." We expose it the same way: `true` only on `kind: "close"`
events. Authors who want "always treat as confirmed" simply don't gate
on it.

### 4.8 Symbol info — `syminfo.*`

Pine's `syminfo.*` exposes per-symbol metadata: tick size, currency,
exchange, session times. Scripts that round entries to tick size,
filter by exchange, or check session boundaries need this. Without it,
"round to mintick" is impossible.

```ts
defineIndicator({
    name: "Tick-snapped entry",
    compute({ bar, syminfo, plot, color }) {
        const target = bar.close * 1.02;
        const snapped = Math.round(target / syminfo.mintick) * syminfo.mintick;
        plot(snapped, { color: color.green, title: "Entry +2% (ticked)" });
    },
});
```

**API.** Read-only object, identity stable across bars. Fields filled
by the adapter at script load.

```ts
// @invinite-org/chartlang-core
export const syminfo: {
    /** Adapter-defined ticker id. Matches bar.symbol. */
    readonly ticker: string;
    /** Symbol type: equity, futures, forex, crypto, index, fund, custom. */
    readonly type: SymbolType;
    /** Smallest price increment. NaN if adapter doesn't supply it. */
    readonly mintick: number;
    /** Quote currency code (ISO-4217 or adapter-defined). Empty string if unknown. */
    readonly currency: string;
    /** Base currency for FX pairs, empty otherwise. */
    readonly basecurrency: string;
    /** Adapter-defined exchange id ("NASDAQ", "BINANCE", "OANDA"). Empty if N/A. */
    readonly exchange: string;
    /** IANA TZ name for the symbol's primary trading session ("America/New_York"). Empty if unknown. */
    readonly timezone: string;
    /** Session regular-hours descriptor, opaque adapter-defined string ("0930-1600:23456"). */
    readonly session: string;
    /** Free-form metadata bag for adapter-specific fields. JsonValue-clean. */
    readonly meta: Readonly<Record<string, JsonValue>>;
};

export type SymbolType =
    | "equity" | "futures" | "forex" | "crypto"
    | "index" | "fund" | "bond" | "commodity"
    | "custom";
```

**Capability gate.** Not every adapter has every field. We expose the
shape always (script source is portable) but declare what's actually
populated via:

```ts
readonly symInfoFields: ReadonlySet<keyof SymInfoView>;
// e.g. new Set(["ticker", "type", "mintick", "currency", "exchange"])
```

(Added to `Capabilities` in §7.2 alongside `intervals`.) Unsupplied
fields evaluate to their type's empty sentinel: empty string for
`string`, `NaN` for `number`, `{}` for `meta`. No diagnostic — scripts
gate their own logic on `Number.isFinite(syminfo.mintick)` etc.

**Why not throw on missing fields.** Same posture as
`Capabilities.plots` — silent degradation keeps scripts portable. A
script using `syminfo.mintick` for tick-snapping works on adapters that
supply it and produces NaN (which propagates harmlessly) on those that
don't.

### 4.9 Timeframe helpers — `timeframe.*`

Convenience helpers that derive from `bar.interval` and the adapter's
`IntervalDescriptor.group` (§7.2). Without these, scripts that branch
on intraday-vs-daily hardcode interval strings, which doesn't port
across adapters.

```ts
defineIndicator({
    name: "Daily-only RSI divergence",
    compute({ bar, ta, timeframe, plot, color }) {
        if (!timeframe.isdaily) return;          // skip intraday
        const rsi = ta.rsi(bar.close, 14);
        plot(rsi, { color: color.purple, title: "RSI", pane: "rsi" });
    },
});
```

**API.**

```ts
// @invinite-org/chartlang-core
export const timeframe: {
    /** Same as bar.interval. */
    readonly period: string;
    /** True iff IntervalDescriptor.group is "second" or "minute" or "hour". */
    readonly isintraday: boolean;
    /** True iff IntervalDescriptor.group is "daily". */
    readonly isdaily: boolean;
    /** True iff IntervalDescriptor.group is "weekly". */
    readonly isweekly: boolean;
    /** True iff IntervalDescriptor.group is "monthly" or longer. */
    readonly ismonthly: boolean;
    /** Approximate seconds per bar at this interval. Used for time-budget math. */
    readonly inSeconds: number;
};
```

**Group→helper mapping.** The runtime derives `isintraday`/`isdaily`/
etc. from the matching `IntervalDescriptor.group` value at script
mount. Adapters that use custom group names (`"weekly-friday"`,
`"quarterly"`) get `isweekly: false` and `ismonthly: false` unless
they map to the canonical groups documented for chartlang.

**Canonical group names.** Adapters SHOULD use the documented set
(`"second"`, `"minute"`, `"hour"`, `"daily"`, `"weekly"`, `"monthly"`,
`"quarterly"`, `"yearly"`) for portability. Custom groups are allowed
but won't trigger `timeframe.*` helpers — scripts that need a custom
group check on `bar.interval` directly.

**`inSeconds` for time-budget math.** The runtime computes
`inSeconds` from `IntervalDescriptor.group` plus a numeric prefix in
`value` ("5m" → 300, "1D" → 86400). Adapters can override by adding
`intervalSeconds: number` to `IntervalDescriptor` — useful for
non-standard intervals like "3D" or "1Q" where the group inference
isn't precise.

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
     `compute`). Set `userPickableInterval = true` iff any `input.interval()`
     call is present.
   - Set of primitive ids used → emit a `Capabilities` set into the manifest.
   - Set of distinct interval string literals referenced inside
     `request.security({ interval })` calls → emit `requestedIntervals` so
     the host can open the right candle streams upfront and the editor can
     gate against `Capabilities.intervals` at compile time.
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
   │                              + requestedIntervals + userPickableInterval
   │
   ├─►  Static analysis pass: reject forbidden constructs
   │     - reject dynamic `interval` arg to request.security (must be literal)
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
`"draw.line"`, `"alert"`, `"state.float"`, `"state.int"`, `"state.bool"`,
`"state.string"`, `"state.tick.float"`, `"state.tick.int"`,
`"state.tick.bool"`, `"state.tick.string"`, etc., one entry per primitive
in §4.6 / §9 / §10 / §11).
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

### 5.6 `request.security` Interval-Literal Pass

`request.security({ interval })` opens a secondary candle stream. The host
needs to know which intervals to fetch *before* the script's `compute` runs,
so the runtime can hand the script a pre-warmed `Bar`-shaped view per
secondary interval. That means the set of secondary intervals must be
statically discoverable.

The compiler's static-analysis pass rejects any `request.security` call
whose `interval` argument is not one of:

- A **string literal**: `request.security({ interval: "1D" })`.
- A reference to an **`input.enum`** input whose `values` are all string
  literals: `request.security({ interval: inputs.tf })` where
  `inputs.tf = input.enum("1D", ["1D", "1W"])`. In this case the compiler
  unions the enum values into `requestedIntervals`.

Anything else — a variable, a template string, a function-call result, a
ternary — fails compilation with diagnostic
`request-security-interval-not-literal`. Mirrors Pine's identical
restriction.

Discovered intervals land in `manifest.requestedIntervals` deduplicated.
The host iterates that array to call `Adapter.candles({ interval })` once
per distinct value at script load.

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
    /**
     * Where the runner gets state slots from. Default: in-memory Map (no
     * persistence). Hosts that want warm restarts pass an IDB- or
     * server-backed implementation. See §6.9 for the persistence contract.
     */
    stateStore?: StateStore;
}): ScriptRunner;

/** Persistence contract — see §6.9. */
export type StateStore = {
    /**
     * Identity of the in-flight script instance. The runtime computes this from
     * the compiled script, capabilities, intervals, symbol, and main timeframe.
     * Stores use it as the persistence key.
     */
    readonly key: StateStoreKey;
    /** Load a snapshot if one exists. Called once at script load. */
    load(): Promise<StateSnapshot | null>;
    /** Persist the current snapshot. Called on `dispose()` and on cadence (see §6.9). */
    save(snapshot: StateSnapshot): Promise<void>;
    /** Drop the snapshot — explicit invalidation. */
    clear(): Promise<void>;
};

export type StateStoreKey = {
    readonly scriptHash: string;          // sha256(compiled.moduleSource)
    readonly compilerVersion: string;
    readonly apiVersion: number;
    readonly capabilitiesHash: string;    // sha256 of normalised capabilities
    readonly symbol: string;
    readonly mainInterval: string;        // resolved value of input.interval, not "chart"
    readonly requestedIntervals: ReadonlyArray<string>;
};

export type StateSnapshot = {
    /** Last main-bar time reflected in this snapshot. Resume bar = lastBarTime + 1 step. */
    readonly lastBarTime: number;
    /** Per-stream ring buffer contents at head, one set per interval. JsonValue-clean. */
    readonly streams: Readonly<Record<string, StreamSnapshot>>;
    /** Slot id → opaque state value. Stateful primitive payloads. */
    readonly slots: Readonly<Record<string, JsonValue>>;
    readonly savedAt: number;             // wall-clock ms, advisory only
    readonly snapshotVersion: 1;
};

export type StreamSnapshot = {
    readonly interval: string;
    readonly headIndex: number;
    readonly filled: number;
    /** OHLCV ring buffer contents at the head — JSON arrays, NaN→null. */
    readonly buffers: Readonly<Record<"time" | "open" | "high" | "low" | "close" | "volume", ReadonlyArray<number | null>>>;
};
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

**Numeric precision: Float64 everywhere.** All prices, volumes, and
indicator outputs are IEEE 754 doubles. No `Decimal`, no fixed-point.
This matches Pine, matches every JS chart in production, and survives
JSON / structuredClone / QuickJS membranes without conversion. The
trade-off: cumulative indicators (`vwap`, `obv`, `adl`, `cmf`) accumulate
floating-point rounding error proportional to bar count. Each cumulative
primitive's docstring documents the expected error envelope at typical
lookbacks (e.g. `obv`: ~1e-9 relative error per 10⁶ bars). Adapter-side
display formatting (currency rounding, tick-size snapping) is the
adapter's problem, not the runtime's.

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

### 6.8 Multi-Stream Time Alignment

When `manifest.requestedIntervals` is non-empty, the runtime owns one
ring-buffer set per distinct interval, not one. Streams advance
independently because secondary candles close at their own cadence
(a `"1D"` bar closes once per chart day; the `"chart"` 5m bars close 78
times per chart day).

**Per-stream state.** For every interval in
`{ mainInterval } ∪ requestedIntervals`, the runtime owns a
`StreamState` with:

```ts
type StreamState = {
    readonly interval: string;                    // "1D"
    readonly ohlcv: OhlcvRingBufferSet;           // ring buffers per source field
    readonly bar: BarView;                        // mutable scalar view, identity stable
    readonly taSlots: Map<string, unknown>;       // ta.* state keyed by slotId
};
```

The main stream's `bar`/`series` view is what `compute` sees as `bar` and
the OHLC series. Secondary streams are exposed only through the proxy
returned by `request.security({ interval })`:

```ts
function makeSecondaryBarView(state: StreamState): SecondaryBarView {
    return {
        get time()     { return state.ohlcv.time.at(0); },
        get open()     { return state.ohlcv.open.at(0); },
        get high()     { return state.ohlcv.high.at(0); },
        get low()      { return state.ohlcv.low.at(0); },
        get close()    { return state.ohlcv.close.at(0); },
        get volume()   { return state.ohlcv.volume.at(0); },
        // Series accessors — daily.close[N] reads daily ring buffer.
        get series()   { return { open: ..., high: ..., low: ..., close: ..., volume: ... }; },
        // Sugar identical to the main bar.
        symbol:        state.bar.symbol,
        interval:      state.interval,
    };
}
```

`request.security` is **stateless from the script's perspective** — it
returns the same `SecondaryBarView` instance every call within the same
`compute` run, identified by the compiler-injected slot id. The runtime
caches it.

**Time-alignment policy (pin this — adapters depend on it).**

The script's `compute` runs on the **main stream's** cadence. On every main
step at chart-time `T`, the runtime guarantees:

- Every secondary `StreamState.bar` reflects the **most recent secondary
  bar whose `[start, end)` window contains `T`** — i.e. the secondary bar
  the chart would draw "behind" the current main bar.
- Until a secondary bar closes, its `bar.close` / `bar.high` / `bar.low` /
  `bar.volume` are **the running values inside the in-progress secondary
  bar**, not the prior closed bar's values. This is how Pine works and
  matches user intuition ("the daily high so far" while the trading day is
  open).
- `secondary.close[1]` reads the **most recent closed secondary bar before
  the current in-progress one**, regardless of how many main bars
  accumulated inside the current secondary bar.

The runtime advances secondary ring buffers exactly when a secondary bar
closes (the adapter signals this on its secondary `candles({ interval })`
stream via `{ kind: "close", bar }`). The "in-progress" head slot is
mutated in place by `{ kind: "tick", bar }` events — same `replaceHead`
mechanism as the main stream's tick path.

**No look-ahead.** A script reading `daily.close[0]` on a chart bar at
14:00 sees the daily high-water close as of 14:00 — NOT the daily close
that will be printed at the day's end. This is enforced by the host: it
never delivers a secondary `close` event with a `bar.time` greater than
the main-stream cursor. Adapters that fetch secondary streams in bulk
ahead of time must hold them back and release them in time order.

**Adapter contract:** the adapter delivers candles for each requested
interval through independent `AsyncIterable<CandleEvent>` instances — one
per `candles({ interval })` call. The host multiplexes them and feeds the
runtime in time order. See §7.1 for the multi-stream `candles()` shape.

**Invariants (assertable in tests):**

- After `compute` on a main bar at `T`, every secondary stream's
  `bar.time + intervalDuration > T >= bar.time`. (Containment.)
- `secondary.series.close[1]` never changes value within a single main bar
  step. (Closed-history immutability.)
- Sum of secondary bars seen since the first main bar equals the count of
  `kind: "close"` events the adapter delivered on that stream. (Lockstep
  with adapter signals.)

### 6.9 State Persistence

Pine recomputes the entire script from history on every load. chartlang
supports the same fallback — and *also* an opt-in persistence path that
skips the warmup. Same script source either way; the difference is
whether the runtime restores prior state or starts from scratch.

**The contract.** `StateStore` (§6.1) is the persistence boundary. If
the runtime is constructed without one, behaviour is Pine-identical:
every load replays full history. If a `stateStore` is supplied, the
runtime tries to restore on load and writes back on dispose and on a
write-cadence policy (see below). The script does **not** know which
mode is active — same `compute`, same outputs, same emissions.

**Cache key.** `StateStoreKey` (§6.1) is the canonical identity tuple.
The runtime computes it at script-mount; the store treats it opaquely as
a string key (typical implementation: `JSON.stringify(key)` with sorted
fields). Any change in any field invalidates the snapshot — a script
edit (`scriptHash`), compiler bump (`compilerVersion`), capability
change (`capabilitiesHash`), symbol switch, interval change, or new
secondary stream all force a full replay. This is deliberate: the
keying mirrors the actual state-dependence surface so a stale snapshot
can never produce wrong outputs.

**Restore + gap-replay flow.**

```
mount(compiled, capabilities, stateStore, currentMainBarTime):
  key  = computeKey(compiled, capabilities, symbol, mainInterval, requestedIntervals)
  snap = await stateStore.load()                 // null if absent or key mismatch
  if (snap == null || snap.lastBarTime >= currentMainBarTime):
    fall through to full-history replay (Pine fallback)
    return
  for stream in snap.streams:
    rehydrate ring buffer from buffers[]         // O(maxLookback)
  for slotId, value in snap.slots:
    seed primitive state slot                    // O(slots)
  warmStartBarTime = snap.lastBarTime + 1 step
  fetch and feed bars from warmStartBarTime → currentMainBarTime
  (typically <100 bars vs 5000 cold)
```

**Future-snapshot guard.** `snap.lastBarTime >= currentMainBarTime`
means the snapshot is ahead of the bar cursor — happens when the user
rewinds the chart, replays history, or jumps to a past time. The
runtime cannot apply a future snapshot to a past cursor, so it falls
back to full replay (and overwrites the snapshot on next save).

**Write cadence.**

- Always on `dispose()`. The host calls dispose on unmount, page hide,
  worker termination — every snapshot write is a "last good state."
- On every `kind: "close"` main-bar event when the snapshot is
  >`PERSISTENCE_INTERVAL_MS` (default 60s wall-clock) stale. Crash-
  resilience: a tab kill mid-session loses at most one minute of warm
  cache, not the whole session.
- Never on `kind: "tick"`. Realtime tick state is reconstructable from
  the most recent `close` snapshot + the live tick stream.

**No partial snapshots.** Either the whole snapshot is written or none
of it. A torn write that loses one stream's buffer but keeps another
would produce stale-vs-fresh lockstep violations on the next load. The
runtime serialises the snapshot in one `StateStore.save(snapshot)`
call; the store implementation guarantees atomicity (IDB transactions,
Convex single-document writes, server-side write-temp-then-rename, etc.).

**Determinism guarantee.** A warm-started script produces **byte-identical
emissions** to a cold-started one for every bar from `warmStartBarTime`
forward. This is testable: the conformance suite runs every script
twice — once cold, once with a snapshot taken at bar 4000 of 5000 —
and asserts every emission past bar 4000 matches. A determinism failure
fails the conformance gate.

**JsonValue purity.** Slot payloads MUST be `JsonValue` (§7.3) for
serialisation. Primitive authors who keep `Float64Array` or `Map`
internal state are responsible for marshalling to/from JSON in their
serialise/deserialise hooks — a primitive registers
`{ serialiseState, deserialiseState }` callbacks alongside its
compute function. The runtime drops snapshots that fail
`validateEmission`-shaped checks at save time with diagnostic
`state-snapshot-malformed`, and falls back to cold replay.

**Storage backings.**

- **Browser, `host-worker`:** `idbStateStore({ dbName })` (shipped from
  `@invinite-org/chartlang-host-worker`). One IDB record per `StateStoreKey`.
  Auto-evicts oldest snapshots when total store exceeds 50 MB; the
  cap is configurable. Reads on mount, writes on dispose + 60s cadence.
- **Server, `host-quickjs`:** the host accepts a caller-supplied
  `StateStore`. The OSS repo ships **no** server backing — host
  consumers wire their own. Typical implementations: Convex document
  per key (idiomatic for our cron alert-eval — cf. the consumer-side
  `chartlangStateSnapshots` table sketched in invinite's
  `CHARTLANG_INTEGRATION.md` §7, keyed by `(scriptId, symbol, interval)`
  with the snapshot stored under `v.any()`), R2 / S3 blob, Postgres
  row, in-memory LRU for one-shot evaluations. See §15 for why this
  responsibility lives outside the OSS package.
- **Tests / CLI:** `inMemoryStateStore()` (shipped from
  `@invinite-org/chartlang-runtime`). Identity-keyed Map. Used by the
  conformance suite's warm-start determinism test.

**Why this matters for server-side alerts.** Without persistence, every
cron tick re-runs the script from 500-bar history (per the §11 alert
eval action). With persistence, the prior tick's snapshot loads, the
runtime fetches only the 1–N bars since the last evaluation, and the
script computes incrementally. For a script evaluated every minute on
1m bars, that's 1 bar of work per tick vs 500. Same answer, ~500×
less Convex compute. Bills proportionally.

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
    /**
     * Yields bars for the requested interval. May be infinite (realtime feed).
     *
     * - `interval: "chart"` — the chart pane's current interval. Adapter resolves to
     *   whatever its current timeframe is and re-emits if the user changes it.
     * - `interval: <adapter-defined string>` — bars at exactly that interval, regardless
     *   of chart pane. Must be a member of `capabilities.intervals`; the host validates
     *   before calling.
     *
     * The host calls this once per distinct interval the loaded script needs
     * (main timeframe + every `manifest.requestedIntervals` entry). Adapters that
     * cannot serve a particular `interval` should throw at the first iteration; the
     * host converts that into a load-time error.
     */
    candles(opts: { interval: string | "chart" }): AsyncIterable<CandleEvent>;
    /**
     * Optional external-series feed (§9.5). The adapter pushes adapter-supplied
     * data (transaction markers, P&L tape, secondary-symbol OHLCV for
     * `correlationCoeff`, etc.) keyed by the compiler-assigned slot id of the
     * matching `input.externalSeries(...)` call. The runtime owns the slot →
     * script mapping; the adapter never sees script internals. Adapters that
     * don't supply any external series omit this method, and any
     * `input.externalSeries` call in a loaded script returns an all-NaN series
     * with diagnostic `external-series-not-supplied`.
     */
    feedExternalSeries?(slotId: string, rows: ReadonlyArray<JsonValue>): void;
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

Note: each `Bar` carries its own `interval` field (§4.3), so the host can
sanity-check that the stream really yields bars at the requested interval.
A mismatch is a hard error — not a silent diagnostic.

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
    /**
     * Whether the adapter can route `defineAlertCondition` user-wired alerts
     * (§11.2). When `false`, `signal()` is a silent no-op + `alert-conditions-not-supported`.
     */
    readonly alertConditions: boolean;
    /**
     * Whether the adapter renders `runtime.log.*` messages (§11.3). When `false`,
     * logs are silently dropped — no diagnostic, logs are debug-only.
     */
    readonly logs: boolean;
    /** Inputs the adapter can prompt the user for at runtime. */
    readonly inputs: ReadonlySet<InputKind>;
    /**
     * Timeframes this adapter can deliver candles for. Order is meaningful — drives
     * the editor's timeframe picker order. Each descriptor's `value` is the canonical
     * id scripts use in `request.security` and `input.interval`. chartlang does NOT
     * enumerate intervals; each adapter ships its own set with adapter-defined strings.
     */
    readonly intervals: ReadonlyArray<IntervalDescriptor>;
    /**
     * Whether the adapter can deliver more than one parallel candle stream per script
     * load. When `false`, `request.security` is a silent no-op (returns all-NaN
     * secondary bars + `multi-timeframe-not-supported` diagnostic); `input.interval`
     * still works because it's single-stream. Adapters typically ship `false` first
     * and flip to `true` once multi-stream fetching is wired.
     */
    readonly multiTimeframe: boolean;
    /**
     * Max number of sub-panes (below the price pane) this adapter can render
     * concurrently for one script. `0` = overlay-only; any `plot({ pane: "new" })`
     * or `plot({ pane: <id> })` call falls back to overlay with an
     * `unsupported-pane` diagnostic. Adapters that support unlimited sub-panes
     * declare a sentinel like `Number.MAX_SAFE_INTEGER`.
     */
    readonly subPanes: number;
    /**
     * Which `syminfo.*` fields this adapter populates (§4.8). Fields not in the
     * set evaluate to their type's empty sentinel — empty string for `string`,
     * `NaN` for `number`. Scripts gate logic on `Number.isFinite(syminfo.mintick)`
     * rather than presence-checking the capability — silent degradation, same
     * posture as `plots`/`drawings`.
     */
    readonly symInfoFields: ReadonlySet<SymInfoField>;
    /**
     * Per-script drawing-emission budget. Excess `draw.*` calls beyond these
     * caps fall back to no-op with `drawing-budget-exceeded` diagnostic. Mirrors
     * Pine's `max_lines_count` / `max_labels_count` / `max_boxes_count` /
     * `max_polylines_count`. Scripts can request a smaller budget per-script via
     * `defineIndicator({ maxDrawings: ... })`; the runtime takes the min of
     * script-requested and adapter-supplied.
     */
    readonly maxDrawingsPerScript: {
        readonly lines: number;
        readonly labels: number;
        readonly boxes: number;
        readonly polylines: number;
        readonly other: number;        // catch-all for fib/gann/elliott/etc.
    };
    /** Max bars of lookback the adapter promises to keep available. */
    readonly maxLookback: number;
    /** Max realtime tick rate the adapter will deliver. */
    readonly maxTickHz: number;
};

export type SymInfoField =
    | "ticker" | "type" | "mintick" | "currency" | "basecurrency"
    | "exchange" | "timezone" | "session" | "meta";

export type PlotKind =
    | "line" | "step-line" | "area" | "histogram" | "bars"
    | "horizontal-line" | "vertical-line" | "filled-band"
    | "label" | "marker" | "cursors"
    | "horizontal-histogram"                   // volume profile family — horizontal bar
                                               //   histograms keyed by price-bucket; used
                                               //   by `visibleRangeVolumeProfile`,
                                               //   `anchoredVolumeProfile`,
                                               //   `sessionVolumeProfile`,
                                               //   `fixedRangeVolumeProfile`. Cf.
                                               //   invinite `webgl/builders/horizontal-volume-bars-builder.ts`.
    | "shape"                                  // plotshape — geometric symbol at bar
    | "character"                              // plotchar — single character/emoji at bar
    | "arrow"                                  // plotarrow — directional indicator (long/short magnitude)
    | "candle-override"                        // plotcandle — override main candle rendering
    | "bar-override"                           // plotbar — override main bar rendering
    | "bg-color"                               // bgcolor — paint vertical band behind bar
    | "bar-color";                             // barcolor — recolor the bar/candle itself

// `DrawingKind` is the canonical wire-level enumeration of every distinct
// drawing schema. **61 kinds** total. Drawing kind strings on the wire are
// kebab-case (`horizontal-line`); invinite's internal source-of-truth uses
// camelCase (`horizontalLine`). `decodeDrawing()` (§7.1, §10.4) normalises
// in both directions.
//
// Variants collapsed into one kind:
//   - The 4 pitchfork tools (`pitchfork`, `schiff-pitchfork`,
//     `modified-schiff-pitchfork`, `inside-pitchfork`) all emit
//     `kind: "pitchfork"` with a `variant` field. invinite stores the same
//     shape (`PitchforkDrawing { variant: "standard" | "schiff" |
//     "modifiedSchiff" | "inside" }`).
//   - `ray` / `extended-line` / `horizontal-ray` are not separate schemas at
//     the invinite level — they collapse into `LineDrawing` /
//     `HorizontalLineDrawing` with `extendLeft` / `extendRight` flags.
//     chartlang keeps them as distinct `DrawingKind` strings for script
//     ergonomics (`draw.ray(a, b)` reads better than
//     `draw.line(a, b, { extendRight: true })`), and the runtime maps them
//     into the invinite shape on emission.
//   - `cypher-pattern` has no standalone invinite tool but is a real
//     `CypherPatternDrawing` kind in `y-doc-bridge.ts`; chartlang keeps it
//     for portability.
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
    | "fib-wedge" | "fib-trend-time" | "fib-gann"
    | "gann-box" | "gann-fan" | "gann-square" | "gann-square-fixed"
    | "pitchfork"                                    // 4 variants behind one kind
    | "pitchfan"
    | "elliott-impulse-wave" | "elliott-correction-wave"
    | "elliott-triangle-wave" | "elliott-double-combo" | "elliott-triple-combo"
    | "head-and-shoulders" | "triangle-pattern" | "abcd-pattern" | "xabcd-pattern"
    | "cypher-pattern" | "three-drives-pattern"
    | "cyclic-lines" | "time-cycles"
    | "group" | "frame"
    | "table";                                     // §10.2 — dashboard/status panel

export type AlertChannel =
    | "log"            // console
    | "toast"          // in-app notification
    | "webhook"        // POST JSON
    | "email" | "sms" | "push";

export type InputKind =
    | "int" | "float" | "bool" | "string" | "enum"
    | "color" | "source" | "time" | "price" | "symbol"
    | "interval"                       // §4.5 — user-pickable main timeframe
    | "external-series";               // §9.5 — adapter-supplied custom feed
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
    /**
     * Target pane. "overlay" = price pane (default for indicators marked
     * `overlay: true`). "new" = open a fresh sub-pane keyed by `slotId`.
     * A literal string id like "rsi" = explicit named sub-pane shared across
     * plots that use the same id. Capability-gated: see Capabilities.subPanes.
     */
    readonly pane: "overlay" | "new" | string;
};

type PlotStyle =
    // === Shipped in 0.2 ===
    | { kind: "line";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "step-line";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "horizontal-line";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "histogram" | "bars"; baseline: number }
    | { kind: "area";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted";
        fillAlpha: number }
    | { kind: "filled-band";
        upper: number | null; lower: number | null; alpha: number }
    | { kind: "label"; text: string;
        position: "above" | "below" | "anchor" }
    | { kind: "marker";
        shape: "circle" | "triangle-up" | "triangle-down" | "square" | "diamond";
        size: number }
    // === Phase 5 — not in 0.2 surface ===
    | { kind: "vertical-line";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "cursors"; radius: number }
    | { kind: "shape";
        shape: "circle" | "triangle-up" | "triangle-down" | "square"
             | "diamond" | "cross" | "x" | "flag" | "arrow-up" | "arrow-down";
        size: "tiny" | "small" | "normal" | "large" | "huge";
        location: "above-bar" | "below-bar" | "at-price" }
    | { kind: "character";
        character: string;                       // single code point — character or emoji
        size: "tiny" | "small" | "normal" | "large" | "huge";
        location: "above-bar" | "below-bar" | "at-price" }
    | { kind: "arrow";
        direction: number;                       // signed magnitude — sign = direction, abs = arrow length
        baseline?: number }
    | { kind: "candle-override";
        open: number; high: number; low: number; close: number;
        wickColor?: string; borderColor?: string }
    | { kind: "bar-override";
        open: number; high: number; low: number; close: number }
    | { kind: "bg-color"; alpha: number }
    | { kind: "bar-color"; replaceCandleColor: boolean };
```

**Phase-2 update (`0.2`).** The union above is the long-term shape.
Code shipped in `0.2` covers the 8 kinds above the `Phase 5` line.
The split of `area` into its own variant with `fillAlpha` and the
separation of `horizontal-line` from the still-deferred
`vertical-line` happened in `tasks/phase-2-indicator-parity/X-1-plotkind-expansion.md`.
The runtime emit paths for `histogram` and `marker` land in their
consuming-port tasks
(`X-21-volume-vol-vwap-anchoredvwap.md`,
`X-26-sr-chandelier-chandekrollstop-fractal.md`) via the
`PlotOpts.style` widening — see `packages/core/src/plot/plot.ts`
for the script-author-facing `PlotOptsStyle` at lines 63-71
(narrower than this wire union; only the kinds whose runtime emit
path is wired).
The canonical type source is `packages/adapter-kit/src/types.ts`;
this section is a narrative copy.

`PlotStyle.kind` is the value compared against `Capabilities.plots`.
Unknown / missing → drop with diagnostic `unsupported-plot-kind`.

#### `DrawingEmission`

```ts
type DrawingEmission = {
    readonly kind: "drawing";
    readonly handleId: string;           // compiler-injected callsite id
    readonly drawingKind: DrawingKind;   // 61 kinds — see §7.2
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
    | "unsupported-pane"                           // plot requested sub-pane beyond subPanes budget
    | "unsupported-interval"                       // adapter doesn't list this interval value
    | "interval-not-supported-by-script"           // current bar's interval not in script's set
    | "multi-timeframe-not-supported"              // adapter's multiTimeframe = false
    | "lower-tf-not-lower"                          // request.lowerTf interval >= main interval (compile-time)
    | "request-security-interval-not-literal"     // compile-time only, never runtime
    | "lookback-exceeded"
    | "drawing-handle-out-of-order"
    | "drawing-budget-exceeded"                    // §4.6 / §7.2 maxDrawingsPerScript
    | "dropped-by-policy"
    | "stateful-call-inside-loop"        // compile-time only, never runtime
    | "input-coercion-failed"
    | "alert-rate-limited"
    | "runtime-cpu-budget-exceeded"
    | "runtime-memory-budget-exceeded"
    | "runtime-log-budget-exceeded"                // §11.3 — log volume cap hit
    | "alert-conditions-not-supported"             // §11.2 — adapter alertConditions = false
    | "runtime-error"                              // §11.3 — user-thrown via runtime.error()
    | "state-snapshot-malformed";                  // §6.9 — snapshot dropped, cold-replay fallback
```

#### `RunnerEmissions`

The top-level drain payload:

```ts
type RunnerEmissions = {
    readonly plots: ReadonlyArray<PlotEmission>;
    readonly drawings: ReadonlyArray<DrawingEmission>;
    readonly alerts: ReadonlyArray<AlertEmission>;
    readonly alertConditions: ReadonlyArray<AlertConditionEmission>;
    readonly logs: ReadonlyArray<LogEmission>;
    readonly diagnostics: ReadonlyArray<RuntimeDiagnostic>;
    /** Bar index range covered by this drain. */
    readonly fromBar: number;
    readonly toBar: number;
};

type AlertConditionEmission = {
    readonly kind: "alert-condition";
    readonly conditionId: string;            // matches a key in defineAlertCondition.conditions
    readonly fired: boolean;                  // edge — true only on the bar the signal flipped
    readonly bar: number;
    readonly time: number;
    readonly meta: Readonly<Record<string, JsonValue>>;
};

type LogEmission = {
    readonly kind: "log";
    readonly level: "info" | "warn" | "error";
    readonly message: string;
    readonly slotId: string | null;
    readonly bar: number;
    readonly time: number;
    readonly meta: Readonly<Record<string, JsonValue>>;
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
| `plot.pane` | distinct sub-panes used > `subPanes` | Fall back to overlay for the excess pane; record `unsupported-pane` diagnostic. Plot still renders, just in the price pane. |
| `drawing` | `drawingKind` ∉ `drawings` | Drop emission; diagnostic. Other drawings still render. |
| `alert` | adapter's `alerts` empty | Drop alert; diagnostic only. Script still produces plots/drawings. |
| `input` | `inputKind` ∉ `inputs` | Substitute the input's `defaultValue`; diagnostic. |
| `interval` (literal) | value ∉ `intervals` | Script load fails — caught at compile time by the editor, never reaches runtime if the editor's `targetCapabilities` is set. If the runtime sees it anyway, the offending `request.security` returns an all-NaN secondary bar; `input.interval` falls back to its default; diagnostic emitted. |
| `multi-timeframe` | `request.security` called when `multiTimeframe: false` | Return all-NaN secondary bar; diagnostic. Script's main-stream emissions still render normally. |

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
- **Ships `idbStateStore({ dbName })`** — IndexedDB-backed `StateStore`
  (§6.9) for warm restarts across page reloads. One IDB record per
  `StateStoreKey`; LRU eviction at 50 MB (configurable). Callers pass
  the store into the runner; the host doesn't enforce its use.

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
- **No bundled `StateStore`.** Server consumers wire their own (Convex
  document per key, R2/S3 blob, Postgres row — see §6.9). The host is
  a runtime, not an opinion about persistence.

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

**Universal `opts` fields.** Every `ta.*` primitive accepts:

- `opts.offset?: number` — Pine-parity bar shift. Defaults to `0`. A positive
  value shifts the plot forward by N bars; a negative value shifts it
  backward. Every invinite indicator already accepts this (`sma.ts:38,86`;
  `bb-percent-b.ts`; `bbw.ts`; `chop.ts`; `rvi.ts`), so the runtime
  applies the shift uniformly at the `Series<T>` boundary.
- `opts.lineStyle?: PlotLineStyle` — `"line" | "step" | "dashed" |
  "circles" | "cross"` (§4.3). Adapter-rendered hint; the runtime
  forwards it on `PlotEmission` without semantic effect.

Multi-output primitives carry these per-output via `opts.outputs[name]`,
e.g. `ta.macd(src, { outputs: { signal: { lineStyle: "dashed" } } })`.

**Multi-output contract.** A primitive that returns more than one
`Series<number>` (BB, MACD, Ichimoku, Donchian, Bollinger, Keltner,
stochastic, …) MUST declare:

- `primarySeriesKey: string` — the output the selection halo and
  click-target gravitate to. Mirrors invinite's
  `IndicatorPlugin.primarySeriesKey` (cf. `sma.ts:397`).
- `getVisibleSeriesKeys(params): ReadonlyArray<string>` — outputs the
  legend chip should display for these params. Cf. invinite
  `getVisibleSeriesKeys` (`sma.ts:407`). For most primitives this is the
  full key set; for BB the upper / lower bands hide when `multiplier === 0`.
- `yDomain: { kind: "auto" } | { kind: "fixed"; min: number; max: number }`
  — natural Y-axis range for the sub-pane. `chop` returns `{ kind:
  "fixed", min: 0, max: 100 }`; most return `{ kind: "auto" }`. Adapters
  use this to size the sub-pane axis without script involvement.

**`shortName` on the definition.** `defineIndicator({ shortName: "SMA" })`
seeds the default `plot.title` and the legend chip text. Invinite plugins
carry this (`sma.ts:431`); chartlang scripts that omit it fall back to
the `name` field's first word.

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

**Volatility (11).** `atr`, `bb`, `bbPercentB`, `bbw`, `donchian`, `keltner`,
`envelope`, `chop`, `historicalVolatility`, `rvi`, `massIndex`.

**Volume (19).** `vol`, `vwap`, `anchoredVwap`, `obv`, `adl`, `bop`, `cmf`,
`chaikinOsc`, `mfi`, `netVolume`, `pvo`, `pvt`, `eom`, `nvi`, `pvi`,
`visibleRangeVolumeProfile`, `anchoredVolumeProfile`, `sessionVolumeProfile`,
`fixedRangeVolumeProfile`. The four `*VolumeProfile` primitives emit
`PlotKind = "horizontal-histogram"` (§7.2). Each gets its range a different
way: `visibleRange` reads the chart viewport; `anchored` reads a user-picked
`input.time` anchor (§10.1.1); `session` reads `bar.time` against the
adapter's session descriptor (§4.8 `syminfo.session`); `fixedRange` reads a
two-time-anchor `input` pair.

**Support / resistance (9).** `psar`, `supertrend`, `chandelier`,
`chandeKrollStop`, `williamsFractal`, `zigZag`, `pivotsHighLow`,
`pivotsStandard`, `volatilityStop`.

**Statistical (4).** `correlationCoeff`, `median`, `ulcerIndex`, `adr`.
(There is no `linearRegression` indicator — the linear-regression-as-MA
primitive is `lsma`, already covered under moving-averages. The
`lib/linear-regression.ts` helper powers `lsma` but is not a directly
exposed `ta.*` primitive.)

**Cross-functional helpers** (not in the registry but used by scripts):

- `ta.crossover(a, b)` / `ta.crossunder(a, b)` — boolean series.
- `ta.highest(src, length)` / `ta.lowest(src, length)` — running extrema.
- `ta.change(src, n)` — `src[0] − src[n]`.
- `ta.valuewhen(condition, src, n)` — "value of `src` the n-th most recent
  time `condition` was true".
- `ta.barssince(condition)` — bars since `condition` last true.
- `ta.nz(value, replacement?)` — NaN-to-default. Returns `replacement`
  (default `0`) if `value` is NaN, else `value`. Mirrors Pine's `nz()`.
  One of the most common idioms in real scripts; without it, authors
  scatter `Number.isNaN(x) ? 0 : x` everywhere.

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
indicators/lib/*` before any indicator that depends on them. Consumer
relationships:

- `sma-of-float64.ts` / `ema-of-float64.ts` / `wma-of-float64.ts` /
  `smma-of-float64.ts` / `vwma-of-float64.ts` — chained-MA backbone.
  `compute-ma-of-float64.ts` is the typed dispatcher (excludes `vwma` at
  the type level — VWMA needs volume, dispatch via `compute-ma.ts`).
- `ema-of-float64.ts` is consumed by `dema`, `tema`, `pmo`, `smi`, `tsi`,
  `trix`, `chaikinOsc`, `massIndex`, `median`, `rvi`. **Important:**
  `macd.ts` and `ppo.ts` keep private copies of identical EMA math in
  invinite — fold those onto the helper during the port.
- `tr-series.ts` (True Range / ATR) — consumed by `atr`, `keltner`,
  `chop`, `supertrend`, `chandelier`, `volatilityStop`.
- `wilder-directional.ts` — consumed by `adx`, `dmi` (not `rvi`; `rvi`
  uses EMA).
- `donchian-mid.ts` — consumed by `ichimoku`, `donchian`.
- `rolling-stddev.ts` — consumed by `bb`, `bbPercentB`, `bbw`,
  `historicalVolatility`.
- `pearson.ts` — consumed by `trendStrengthIndex`, `correlationCoeff`.
- `linear-regression.ts` — consumed by `lsma`, `regressionTrend` drawing.
- `apply-offset.ts` — consumed by **every** indicator (universal
  `opts.offset` from §9.1).
- `read-source-field.ts` / `pick-candle-source.ts` — source resolution
  for every indicator.
- `align-htf-series-to-ltf.ts` — multi-timeframe alignment kernel
  (§6.8); port before any HTF / `request.security` work.

### 9.5 External-data primitives

Eight invinite plugins read non-OHLC reactive data that the chart pane
supplies as a side-channel: `transactionMarkers`, `riskLevels`,
`tradeMaeMfeMarkers`, `tradeCostBasis`, `tradeEquityCurve`, `tradeRMultiple`,
`tradeDistanceToStop` (the trade-narrative family), plus `correlationCoeff`
(reads a `secondarySymbol` OHLCV stream). See `../invinite/src/components/
trading-chart/indicators/external-data-registry.ts` for the registry
pattern. In `chartlang`, these are not built-ins of `ta.*` — they're
**adapter-provided primitives**. The script declares a dependency via
`input.externalSeries({ name: "transactions", schema: … })` and the
adapter chooses how to deliver. If the adapter doesn't supply the
series, the primitive returns an all-NaN series and emits a diagnostic.

**Adapter delivery channel.** External series are delivered through the
runtime's existing emission/ingestion membrane, keyed by the compiler-
assigned slot id of the `input.externalSeries(...)` call. Mirrors
invinite's `${laneId}:${pluginId}:${instance}` keying (cf.
`external-data-registry.ts`). The adapter calls
`runner.feedExternalSeries(slotId, rows)` (§7.1) — the runtime owns the
slot-to-script mapping, the adapter never sees script internals. Ref-
identity caches bust when the adapter resubmits a new array under the
same slot id.

---

## 10. Built-in Drawing Primitives (full parity)

`draw.*` namespace mirrors every drawing kind in the reference
implementation. Each primitive returns a `DrawingHandle` the script can
update later (move, delete, restyle) within the same `compute` run —
implementations are imperative inside the per-bar step.

**Reference paths (relative to this repo's root — see §3.1):**

- **Schema source-of-truth:** `../invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts`
  — every drawing kind's full TypeScript type (**61 exported types**).
  Derive the `DrawingState` discriminated union for §10.4 from here.
  Strip collab-only fields (Yjs ids, layer ids, interval visibility,
  `parentGroupId`, `parentFrameId`, `createdAt`, `authorId`) and keep
  only geometry + style.
- **Behavior source-of-truth:** `../invinite/src/components/trading-chart/tools/`
  — **67 `*-tool.ts` files** total. Subtract 4 non-drawing tools
  (`select-tool.ts`, `rectangle-select-tool.ts`, `eraser-tool.ts`,
  `comment-tool.ts`) → 63 drawing tools. The count gap to 61 kinds:
  the 4 pitchfork tools (`pitchfork`, `schiff-pitchfork`,
  `modified-schiff-pitchfork`, `inside-pitchfork`) all emit one
  `PitchforkDrawing` with a `variant` discriminator; `cypher-pattern`
  is a kind with no standalone tool. Look here for: number of anchors,
  anchor semantics, edit-handle layout, hit-test rules, snap-to-OHLC
  behavior. The `draw.*` primitive's parameter shape comes from this
  folder; its rendered output comes from `y-doc-bridge.ts`.
- **Context:** `../invinite/src/components/trading-chart/CLAUDE.md`
  — coordinate-frame contract (world `(time, price)` vs bar-center
  frame vs CSS-px vs device-px) that every drawing implementation
  must honour.

**Wire-format invariant — kebab-case kinds.** chartlang emits drawing
kinds as kebab-case strings (`horizontal-line`, `fib-retracement`,
`elliott-impulse-wave`). invinite's source-of-truth in `y-doc-bridge.ts`
uses camelCase (`horizontalLine`, `fibRetracement`,
`elliottImpulseWave`). `decodeDrawing()` (§10.4) normalises both
directions; adapter authors never compare against invinite's raw strings.

**Drawing metadata invariants.** Scripts may set `name` and `visible`
on emitted drawings via the `DrawingHandle` (mirrors Pine's
`label.set_text()` and `label.set_visible()`). Everything else
(`locked`, `parentGroupId`, `parentFrameId`, `visibleIntervals`,
`createdAt`, `authorId`, layer assignment) is host-controlled and
script-immutable — the synthetic chartlang sublayer is locked to user
edits by definition.

### 10.1 Coordinate system

All drawings carry `(time, price)` world coordinates. The adapter is
responsible for projecting to its own pixel space. Time is `ms since epoch`,
price is the unit of the candle's `close` (USD, basis points, whatever).

#### 10.1.1 Anchored indicators — user-pickable chart anchors

Anchored primitives (`anchoredVwap`, `anchoredVolumeProfile`,
`fixedRangeVolumeProfile`) need a user-pickable chart point that survives
across re-renders. Wire this through `input.time({ pickFromChart: true })`
(§12): the adapter UI lets the user click the chart to set the anchor;
the chart pane persists the picked `Time` in its own state (Convex doc,
Yjs map, local storage, whatever the consumer uses for normal anchored
indicators); the script reads it as a plain `Time` value through
`inputs.anchor`. `fixedRangeVolumeProfile` declares two such inputs
(`anchorStart`, `anchorEnd`); `sessionVolumeProfile` derives its window
from `bar.time` + `syminfo.session` and needs no `input`. Cf. invinite
`anchored-vwap.ts` / `anchored-volume-profile.ts`.

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
    /**
     * `marker` matches invinite's `MarkerDrawing` shape (`from`/`to` plus
     * `markerKind`+`value`). Use `markerKind: "emoji"` with `value: "🎯"` for
     * emoji markers; `markerKind: "icon"` with `value: "warning"` for the
     * adapter's icon registry.
     */
    function marker(
        from: WorldPoint,
        to: WorldPoint,
        opts: { markerKind: "emoji" | "icon"; value: string; color?: Color }
    ): DrawingHandle;
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

    // Pitchforks — one primitive, 4 variants. Invinite's `PitchforkDrawing`
    // carries a `variant` field ("standard" | "schiff" | "modifiedSchiff" |
    // "inside") and chartlang mirrors that shape on the wire.
    function pitchfork(
        a: WorldPoint, b: WorldPoint, c: WorldPoint,
        opts?: { variant?: "standard" | "schiff" | "modifiedSchiff" | "inside" }
    ): DrawingHandle;
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

    // Cycles — both are two-endpoint drawings in invinite (CyclicLinesDrawing
    // and TimeCyclesDrawing both carry `from`/`to` anchors). The visual
    // is a periodic line family (cyclic) or concentric arcs (time-cycles)
    // rendered between the two anchors.
    function cyclicLines(from: WorldPoint, to: WorldPoint, style?: LineStyle): DrawingHandle;
    function timeCycles(from: WorldPoint, to: WorldPoint, style?: ShapeStyle): DrawingHandle;

    // Containers
    function group(children: ReadonlyArray<DrawingHandle>): DrawingHandle;
    function frame(a: WorldPoint, b: WorldPoint, opts?: FrameOpts): DrawingHandle;

    // Tables — dashboard / status panel
    function table(opts: {
        position: "top-left" | "top-center" | "top-right"
                | "middle-left" | "middle-center" | "middle-right"
                | "bottom-left" | "bottom-center" | "bottom-right";
        cells: ReadonlyArray<ReadonlyArray<TableCell>>;
        borderColor?: Color;
        borderWidth?: number;
        frame?: { color: Color; width: number };
    }): DrawingHandle;
}

export type TableCell = {
    readonly text: string;
    readonly bgColor?: Color;
    readonly textColor?: Color;
    readonly textHalign?: "left" | "center" | "right";
    readonly textValign?: "top" | "middle" | "bottom";
    readonly textSize?: "tiny" | "small" | "normal" | "large" | "huge";
};
```

`table` drawings position absolutely in the chart's CSS-pixel viewport
(NOT in world space) — they're status panels, not chart objects. Same
DrawingHandle ergonomics for updates: `tableHandle.update({ cells: [[…]] })`.
Capability-gated via `DrawingKind = "table"` in `Capabilities.drawings`.
Common Pine pattern (status dashboards, P&L panels, trade ledgers) we
shouldn't make users hand-roll.

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

Two distinct paths — same Pine reasoning. **`alert()` fires immediately**;
the runtime emits, the adapter routes through declared channels. Useful
when the script knows the right time to alert.
**`defineAlertCondition` declares a named condition the user wires up
manually** in the adapter's alert-creation UI; the alert metadata, target
channels, and message template all come from the user. Useful when the
script just provides signals.

`defineAlert(...)` (referenced from §4.1's constructor table) is a thin
sugar over `defineIndicator(...)` with `overlay: false` and a runtime
guard that rejects any `plot()` / `draw.*()` calls at compile time — it
exists so the script's intent ("this module only fires alerts") is
declarative, and adapters can skip mounting plot-rendering machinery
entirely. The `compute` contract is identical to `defineIndicator`; the
only added capability gate is `alerts` (no `indicators` gate needed).

### 11.1 Immediate-fire — `alert()`

The `alert` export is a **callable namespace**. The bare call
`alert("Bullish cross", { severity: "info" })` and the explicit
`alert.fire("Bullish cross", { severity: "info" })` are equivalent and
typecheck identically. Examples elsewhere in this plan (§4.1, §4.5, §4.6,
§4.7) use the bare form for brevity; either is fine in user scripts.

```ts
type AlertFireOpts = {
    severity?: AlertSeverity;
    channels?: ReadonlyArray<AlertChannel>;
    meta?: Record<string, JsonValue>;
    /** Coalesce duplicate alerts within this window. Default: 1 bar. */
    dedupeWindowMs?: number;
};

interface AlertFn {
    /** Bare call — fires unconditionally. */
    (message: string, opts?: AlertFireOpts): void;
    /** Explicit form, identical semantics to the bare call. */
    fire(message: string, opts?: AlertFireOpts): void;
    /** Conditional helper — fires only on rising edge of `condition`. */
    on(condition: boolean, message: string, opts?: AlertFireOpts): void;
}

declare const alert: AlertFn;
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

### 11.2 User-wired — `defineAlertCondition`

Pine's `alertcondition()` equivalent. The script declares one or more
named conditions. The adapter's alert-creation UI lists every declared
condition for the loaded script; users select a condition, configure
delivery channels and message themselves, and the runtime fires the
alert when the condition becomes true on a confirmed bar.

```ts
import { defineAlertCondition } from "@invinite-org/chartlang-core";

export default defineAlertCondition({
    name: "EMA cross signals",
    apiVersion: 1,
    inputs: {
        length: input.int(20),
    },
    conditions: {
        bullishCross: {
            title: "Bullish EMA cross",
            description: "Close crossed above the EMA",
            defaultMessage: "{{ticker}} bullish cross at {{close}}",
        },
        bearishCross: {
            title: "Bearish EMA cross",
            description: "Close crossed below the EMA",
            defaultMessage: "{{ticker}} bearish cross at {{close}}",
        },
    },
    compute({ inputs, bar, ta, signal }) {
        const ema = ta.ema(bar.close, inputs.length);
        signal("bullishCross", ta.crossover(bar.close, ema));
        signal("bearishCross", ta.crossunder(bar.close, ema));
    },
});
```

**Emission shape** (new `AlertConditionEmission` in §7.3, additive):

```ts
type AlertConditionEmission = {
    readonly kind: "alert-condition";
    readonly conditionId: string;
    readonly fired: boolean;
    readonly bar: number;
    readonly time: number;
};
```

The adapter consumes these via `RunnerEmissions.alertConditions` and
routes to whatever destinations the user has wired in their UI.
Capability-gated: `Capabilities.alertConditions: boolean`. When `false`,
`defineAlertCondition` scripts load but `signal()` is a silent no-op
with `alert-conditions-not-supported` diagnostic.

**Why two modes.** `alert()` fires through script-declared channels
(`{ channels: ["webhook"] }`) on the script's own schedule. Users have
no input. `defineAlertCondition` is the inverse: the script declares
the signal; the user chooses delivery. Pine ships both because real
users want both — backtest-style scripts auto-fire, signal-broadcast
scripts give the user the picker.

### 11.3 Logging — `runtime.log.*`

Pine's `runtime.log.info/warn/error()` equivalent. Lets scripts emit
debug-grade messages surfaced in the editor's log pane. Without this,
authors misuse `alert()` for debugging and pollute their inbox.

```ts
import { runtime } from "@invinite-org/chartlang-core";

defineIndicator({
    compute({ bar, runtime, ta }) {
        const ema = ta.ema(bar.close, 20);
        runtime.log.info(`ema=${ema.current} close=${bar.close}`, { ema: ema.current });
        if (Number.isNaN(ema.current)) {
            runtime.log.warn("EMA still NaN — warmup not complete");
        }
    },
});
```

**API.**

```ts
// @invinite-org/chartlang-core
export namespace runtime {
    export namespace log {
        export function info(message: string, meta?: Record<string, JsonValue>): void;
        export function warn(message: string, meta?: Record<string, JsonValue>): void;
        export function error(message: string, meta?: Record<string, JsonValue>): void;
    }

    /**
     * Script-throwable error. Halts compute for the current bar (subsequent
     * primitives are no-ops), emits a fatal RuntimeDiagnostic, and surfaces in
     * the script-settings UI as a red banner. Use for "input invariant violated"
     * states where the script genuinely can't continue. Pine's runtime.error().
     */
    export function error(message: string): never;
}
```

**LogEmission shape** — pinned in §7.3. Capability-gated:
`Capabilities.logs: boolean`. When `false`, `runtime.log.*` calls are
silent no-ops (no diagnostic — logs are debugging, not signal). Browser
host's reference editor (§14.2) displays the log pane unconditionally
when present.

**Volume cap.** The runtime caps logs at 1000 per `compute` step. The
1001th log is dropped with `runtime-log-budget-exceeded` diagnostic.
Same posture as drawing budget — prevents pathological scripts from
flooding the host with strings.

### 11.4 Color helpers — `color.*` extensions

Mirror Pine's dynamic-color idioms.

```ts
// @invinite-org/chartlang-core/style
export namespace color {
    // Existing static palette: color.red, color.green, color.blue, etc.

    /**
     * Dynamic color from a normalised position. `t` in [0, 1] interpolates
     * linearly between stops; out-of-range clamps. Pine's color.from_gradient().
     */
    export function fromGradient(
        t: number,
        stops: ReadonlyArray<{ at: number; color: Color }>
    ): Color;

    /**
     * Take an existing color and override its alpha (transparency). `alpha` in
     * [0, 1] — 0 = fully transparent, 1 = fully opaque. Pine's color.new(c, transp).
     */
    export function withAlpha(c: Color, alpha: number): Color;

    /** Construct from RGB(A) components. */
    export function rgb(r: number, g: number, b: number, alpha?: number): Color;
    /** Construct from HSL(A) components. */
    export function hsl(h: number, s: number, l: number, alpha?: number): Color;
}
```

All return CSS-string-clean `Color` values (existing `Color = string`
contract — no new type). Adapters that downstream-parse colors get
nothing new to do.

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
    /**
     * Main timeframe input. Defaults to `"chart"` (follow the host pane's current
     * interval). Concrete values like `"1D"` pin the script to that interval.
     * Only one `input.interval(...)` per script. Wire-tagged `kind: "interval"`
     * in `InputKind` (§7.2). See §4.5 for full semantics.
     */
    function interval(defaultValue: string, opts?: { title?: string }): InputDescriptor<string>;
    /**
     * Time input. Set `pickFromChart: true` to wire the adapter UI's
     * "click chart to set anchor" picker — anchored indicators
     * (`anchoredVwap`, `anchoredVolumeProfile`, `fixedRangeVolumeProfile`)
     * declare their anchor inputs this way. See §10.1.1.
     */
    function time(defaultValue: Time, opts?: { title?: string; pickFromChart?: boolean }): InputDescriptor<Time>;
    function externalSeries<T>(opts: { name: string; schema: Schema<T>; title?: string }): InputDescriptor<Series<T>>;
}
```

The compiler walks `inputs` at module scope and serialises them into
`manifest.inputs` so the adapter UI can render the form without booting the
script. The wire-format `kind` strings line up with `InputKind` (§7.2):
`int`, `float`, `bool`, `string`, `enum`, `color`, `source`, `time`,
`price`, `symbol`, `interval`, `external-series`.

---

## 13. Style Primitives

```ts
namespace color {
    // The default 6-color named palette — mirrors invinite's
    // `groupTag` palette (`src/components/trading-chart/grid/url-search.ts:36`).
    // Adapters may extend with additional named colors but these 6 are
    // guaranteed to resolve to a non-empty CSS string on every adapter.
    const red: Color;
    const green: Color;
    const blue: Color;
    const purple: Color;
    const orange: Color;
    const yellow: Color;
    function rgba(r: number, g: number, b: number, a?: number): Color;
    function hex(s: string): Color;
    function alpha(c: Color, a: number): Color;
}

namespace style {
    // Stroke styles for `draw.*` drawings — matches the invinite
    // `LineStrokeStyle` enum at `y-doc-bridge.ts` (solid / dashed / dotted).
    const solid: LineStyle;
    const dashed: LineStyle;
    const dotted: LineStyle;

    // Line styles for `plot()` indicators — disjoint from drawing strokes
    // because invinite renders indicators with a wider vocabulary
    // (`indicators/lib/line-style.ts`: line / step / dashed / circles / cross).
    // Exposed under `style.plot.*` so they're discoverable without colliding
    // with the drawing-stroke names. Cf. `PlotLineStyle` in §4.3.
    namespace plot {
        const line: PlotLineStyle;
        const step: PlotLineStyle;
        const dashed: PlotLineStyle;
        const circles: PlotLineStyle;
        const cross: PlotLineStyle;
    }
}
```

The 6-color palette mirrors invinite's `groupTag` palette (the same set
the multi-series legend chip cycles through). Drawing strokes mirror
`y-doc-bridge.ts`'s `LineStrokeStyle`; plot lines mirror
`indicators/lib/line-style.ts`'s `LineStyle`. `webgl/colors.ts` owns the
bull/bear/wick semantic resolvers but not a named palette — those live in
`grid/url-search.ts`.

---

## 14. Editor: Language Service + Reference Editor

Two packages, one responsibility each. Mirrors §15's "contract first, one
reference impl" philosophy: editor intelligence lives in a headless
package that any host can consume; the OSS repo ships exactly one
editor on top of it.

### 14.1 `@invinite-org/chartlang-language-service` (headless)

Editor-agnostic language intelligence. No CM6 dependency, no React, no
DOM. The contract every chartlang-aware editor — CM6, Monaco, a
JetBrains plugin, a headless CLI linter — runs against.

Public API:

```ts
// @invinite-org/chartlang-language-service
export type LspRange = { startLine: number; startColumn: number; endLine: number; endColumn: number };
export type LspSeverity = "error" | "warning" | "info" | "hint";

export type LspDiagnostic = {
    range: LspRange;
    severity: LspSeverity;
    code: DiagnosticCode;          // reuses the runtime's frozen set from §7.3
    message: string;
    relatedCallsite?: string;       // slotId when the diagnostic originates at a stateful call
};

export type HoverDoc = {
    title: string;                  // e.g. "ta.ema(source, length, opts?)"
    summary: string;                // first JSDoc paragraph
    paramTable?: ReadonlyArray<{ name: string; type: string; doc: string }>;
    examples?: ReadonlyArray<string>;
};

export type CompletionItem = {
    label: string;                  // "ta.ema"
    kind: "function" | "namespace" | "property" | "enumMember" | "keyword";
    insertText: string;
    detail?: string;                // short signature
    doc?: HoverDoc;
};

export type LanguageServiceOptions = {
    /** Adapter capabilities to drive "unsupported-by-adapter" hints. Optional. */
    targetCapabilities?: Capabilities;
};

export function createLanguageService(opts?: LanguageServiceOptions): {
    /** Compile-and-map: full diagnostic pass against the current source. */
    compileToDiagnostics(source: string): Promise<ReadonlyArray<LspDiagnostic>>;
    /** Position-cursored completions. Cheap; called on every keystroke. */
    getCompletions(source: string, offset: number): ReadonlyArray<CompletionItem>;
    /** Hover docs for the symbol under offset. */
    getHoverDoc(source: string, offset: number): HoverDoc | null;
    /** Signature help inside a stateful call. */
    getSignatureHelp(source: string, offset: number): SignatureHelp | null;
    /** Jump-to-definition for primitives — points into the core package's .d.ts. */
    getDefinition(source: string, offset: number): DefinitionLocation | null;
    /**
     * Adapter's full interval list — drives the editor's timeframe picker, the
     * inputs UI's `input.interval` dropdown, and string-literal autocomplete inside
     * `request.security({ interval: "…" })`. Empty array if no `targetCapabilities`
     * was supplied.
     */
    getAvailableIntervals(): ReadonlyArray<IntervalDescriptor>;
};
```

Where the data comes from:

- **Hover docs** are extracted from JSDoc on `@invinite-org/chartlang-core` at
  build time via a TS AST pass — one `HoverDoc` per exported primitive,
  keyed by fully-qualified name (`"ta.ema"`). The registry is a generated
  TS module shipped inside `@invinite-org/chartlang-language-service/dist/hover-registry.js`.
- **Completions** read from the same registry plus the live source's
  in-scope identifiers (resolved via the TS LanguageService API). When the
  cursor is inside a `request.security({ interval: "▮" })` literal or an
  `input.interval("▮")` literal, the completion source returns one
  `CompletionItem` per `targetCapabilities.intervals` entry with the
  descriptor's `label` as the doc string and `group` as the grouping hint.
- **Diagnostics** call `@invinite-org/chartlang-compiler`'s `compile()` and map
  every emitted error to an `LspDiagnostic`. When
  `targetCapabilities` is supplied, the service also lints for
  `unsupported-plot-kind` / `unsupported-drawing-kind` /
  `unsupported-alert-channel` / `unsupported-interval` /
  `multi-timeframe-not-supported` against that bag — so the editor can
  warn "this won't render on your target adapter" before the script ever
  runs.

### 14.2 `@invinite-org/chartlang-editor` (reference CodeMirror 6 shell)

The thin glue that turns the headless language service into a working
editor. Same role as `examples/canvas2d-adapter/` plays for the adapter
contract: prove the language service is consumable end-to-end, and be
the canonical "copy this when wiring your own host" template.

Ships:

- Syntax highlighting and incremental parsing via Lezer's TypeScript
  grammar.
- A CM6 hover extension that calls `getHoverDoc(source, offset)`.
- A CM6 autocomplete source that calls `getCompletions(source, offset)`.
- A CM6 linter that calls `compileToDiagnostics(source)` and maps
  `LspDiagnostic` → CM6 `Diagnostic`.
- A peek panel for emitted plots/drawings/alerts using the conformance
  fixtures as input.
- A `<ChartlangEditor />` React component for app integration.

Mounted as:

```tsx
<ChartlangEditor
    source={source}
    onSourceChange={setSource}
    targetCapabilities={adapterCapabilities}
    onCompiled={(compiled) => previewRunner.load(compiled)}
/>
```

The component holds a `createLanguageService({ targetCapabilities })`
instance and wires its methods into the CM6 extensions. Swapping CM6
for Monaco is a different shell against the same language service —
no fork of the intelligence layer.

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
   — plus `@invinite-org/chartlang-host-quickjs` if running server-side
   alert evaluation (Convex action, AWS Lambda, etc.); plus
   `@invinite-org/chartlang-compiler` if compiling user-authored scripts
   at runtime instead of build-time.
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
| `@invinite-org/chartlang-language-service` | ✓ | — | ✓ (hover/completion fixtures) | — | ✓ | — | — |
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

**Note on the multiplier vs the provenance source.** The invinite
reference ships only `<id>.ts` + `<id>.test.ts` per indicator (plus an
optional `<id>.bench.test.ts` for hot primitives like sma/ema/bb/rsi/
macd/vol). The other three test layers — property, golden,
conformance — are net-new in this repo. Across 90+ indicators that's
270+ new test files that didn't exist upstream. This is intentional:
chartlang is the standardisation surface, not a re-publish of the
invinite tests. Reviewers should not block a port PR on grounds that
"invinite only ships one test file" — the gap is the whole point.

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

### Phase 4 — `0.4` Editor + inputs + timeframes + Tier-1 Pine parity

Editor:
- `@invinite-org/chartlang-language-service` ships first (headless: hover,
  completions, diagnostics, signature help, `getAvailableIntervals`).
  `@invinite-org/chartlang-editor` ships on top as the reference CodeMirror 6
  shell. Inline diagnostics. Inputs UI generated from manifest.

Multi-timeframe (Pine `request.security` parity):
- The `request.security({ interval })` API lands as part of apiVersion 1
  (the type and the runtime call are present). Adapters typically light
  up the **single-stream** path in 0.4 (user-pickable main timeframe via
  `input.interval`) and flip `multiTimeframe: true` in 0.5 once their
  candle plumbing can fetch >1 stream per script. Scripts written against
  `request.security` on a 0.4 adapter with `multiTimeframe: false` see an
  all-NaN secondary bar plus a `multi-timeframe-not-supported` diagnostic
  (§7.4).
- Adapters declare the full `Capabilities` triad for timeframes in 0.4:
  `Capabilities.intervals` (their adapter-defined `IntervalDescriptor[]`),
  `Capabilities.multiTimeframe` (boolean — typically `false` in 0.4),
  and `Capabilities.subPanes` (max sub-panes per script). Editor hover /
  completions consume all three.

Tier-1 author-facing primitives — these are real Pine ergonomics our
script authors would otherwise hit immediately:

- `state.*` / `state.tick.*` — user cross-bar state (Pine `var`/`varip`, §4.6)
- `barstate.*` — confirmed-vs-tick mode discrimination (§4.7)
- `syminfo.*` — mintick / currency / exchange / session metadata (§4.8)
- `timeframe.*` — isintraday / isdaily / inSeconds helpers (§4.9)
- `ta.nz(value, replacement)` — NaN-to-default (§9)
- Universal `opts.offset` on every `ta.*` primitive (§9.1)
- `defineIndicator({ maxDrawings: {...}, maxBarsBack, format, precision, scale, requiresIntervals, shortName })` — script-author overrides
- `Capabilities.maxDrawingsPerScript` + `Capabilities.symInfoFields` +
  `Capabilities.intervals` + `Capabilities.multiTimeframe` +
  `Capabilities.subPanes` — adapter declarations

Done definition: a user can rewrite the median Pine indicator in
chartlang without reaching for unmodelled features.

### Phase 5 — `0.5` Server-side alerts + Tier-2 ergonomics

`@invinite-org/chartlang-host-quickjs` ships. Server-side eval. State
persistence (`StateStore` + `idbStateStore` for browser + caller-supplied
backings for server, §6.9) — the alert eval cron's per-tick compute drops
~500×.

Multi-timeframe streaming flips on in this phase — consumer adapters
that finished single-stream `input.interval` in 0.4 wire their
multi-stream candle fetch and flip `Capabilities.multiTimeframe: true`,
unblocking `request.security({ interval })`.

Plus the Tier-2 surface — nice-to-haves that aren't blocking but make
real-world scripts cleaner:

- `defineAlertCondition` + `Capabilities.alertConditions` — user-wired alerts (§11.2)
- `runtime.log.*` + `Capabilities.logs` — editor log pane (§11.3)
- `runtime.error()` — script-throwable halt (§11.3)
- `draw.table` + `DrawingKind = "table"` — dashboard/status panels (§10.2)
- New `PlotKind`s: `shape`, `character`, `arrow`, `candle-override`,
  `bar-override`, `bg-color`, `bar-color`, `horizontal-histogram` (§7.2)
- Volume-profile primitives (`visibleRangeVolumeProfile`,
  `anchoredVolumeProfile`, `sessionVolumeProfile`,
  `fixedRangeVolumeProfile`) emitting `horizontal-histogram` (§9.2,
  §10.1.1)
- `color.fromGradient` / `color.withAlpha` / `color.rgb` / `color.hsl` (§11.4)

### Phase 6 — `0.6` Tier-3 ergonomics + lower-timeframe

- `request.lowerTf({ interval })` — Pine `request.security_lower_tf`
  equivalent (§4.5). Returns `Series<ReadonlyArray<Bar>>` of contained
  lower-tf bars. Requires `Capabilities.multiTimeframe: true`.
- Session helpers in `@invinite-org/chartlang-core/time` — `session.regular`,
  `session.extended`, `session.isOpen`, `weekday`, ported from invinite's
  `src/components/trading-chart/indicators/lib/ny-day-key.ts` +
  `session-boundaries.ts` (§4.4 subpath).
- Pine-to-chartlang migration guide draft.

### Phase 7 — `1.0` Standardisation

- Freeze `apiVersion: 1`.
- Publish the language spec (this doc, expanded) at `chartlang.dev/spec`.
- Ship the Lightweight Charts adapter to prove portability.
- Public conformance reports.
- Finalise migration guide from Pine for the most common patterns.

### Beyond `1.0`

- Strategy primitives (`strategy.entry()`, `strategy.exit()`, P&L
  accounting, equity curve). Requires a new `Capabilities.strategy` flag.
- Library scripts that other scripts can import (`library()` /
  exported helpers).
- Marketplace metadata format.
- Persistent collections (`state.array(...)` / `state.map(...)`) once a
  serialisation policy is agreed (§4.6 out-of-scope note).
- Multi-pane secondary-stream `barstate.security(handle)` (§4.7
  cross-stream extension).

---

## 20. Open Questions — Resolved

All five questions originally flagged here are now decided in-plan. None
are deferred to a follow-up PR.

1. ~~**State persistence across sessions.**~~ **Resolved.** First-class
   contract: `StateStore` interface (§6.1), full persistence flow with
   cache key + restore + gap-replay + write cadence (§6.9). Browser host
   ships an IDB backing; server hosts wire their own (§8.2 / §8.3). Warm
   start produces byte-identical emissions to cold start — gated by the
   conformance suite. Most impactful for server-side alert eval: ~500×
   less compute per cron tick.
2. ~~**Symbol / interval primitives.**~~ **Resolved.** `bar.symbol` and
   `bar.interval` are readable on every `Bar` (§4.3). The main timeframe is
   pickable per-instance by the end-user via `input.interval(default)` (§4.5);
   secondary timeframes are author-fixed via `request.security({ interval })`
   (§4.5, §6.8). Adapter-defined timeframe set lives on `Capabilities.intervals`
   (§7.2); `Capabilities.multiTimeframe` gates `request.security` support so
   adapters can land single-stream first and multi-stream later.
3. ~~**Multi-pane scripts.**~~ **Resolved.** `plot(value, { pane })` accepts
   `"overlay"` (default), `"new"` (fresh sub-pane keyed by callsite id), or
   a literal string id for explicit shared sub-panes (§7.3 `PlotEmission`).
   `Capabilities.subPanes: number` declares the adapter's sub-pane budget;
   excess panes fall back to overlay with `unsupported-pane` diagnostic
   (§7.4).
4. ~~**Time zones.**~~ **Resolved.** Bar times are UTC ms throughout. Display
   TZ is the adapter's problem. Scripts needing session helpers import from
   the `@invinite-org/chartlang-core/time` subpath (§4.4) — `nyDayKey`,
   `nySessionBounds`, `weekKey`, ported from invinite's existing
   `src/components/trading-chart/indicators/lib/ny-day-key.ts` +
   `session-boundaries.ts` (§3.1).
5. ~~**Numeric precision.**~~ **Resolved.** Float64 everywhere (§6.4). No
   `Decimal`, no fixed-point. Each cumulative primitive (`vwap`, `obv`,
   `adl`, `cmf`) documents its rounding-error envelope in its JSDoc.

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
- **Not shipping `request.financial()` / `request.dividends()` /
  `request.splits()` / `request.earnings()`** built-ins. Pine bakes these
  in because TradingView hosts the data; chartlang stays data-source-
  neutral. Scripts that need fundamentals declare an external-series
  dependency via `input.externalSeries({ name: "earnings", schema })`
  (§9.5) and the adapter supplies the data. Same posture as everything
  else: the contract describes the request; the adapter answers.

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
mkdir -p packages/{core,compiler,runtime,host-worker,host-quickjs,adapter-kit,language-service,editor,cli,conformance}/src
mkdir -p examples/canvas2d-adapter/src
mkdir -p examples/scripts            # seed §19 Phase 1's example scripts here:
                                     #   ema-cross.chart.ts,
                                     #   bollinger-bands.chart.ts,
                                     #   fib-retracement.chart.ts,
                                     #   rsi-divergence-alert.chart.ts
                                     # Conformance scenarios reference these by path.
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
        "build": "pnpm -r build",
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
        "release": "pnpm build && changeset publish",
        "publish:release": "pnpm release"
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
# with "Read and write" permission. Used by the manual
# `pnpm publish:release` fallback (§22.11).
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
    "publishConfig": { "access": "public", "provenance": true },
    "engines": { "node": ">=20" },
    "repository": { "type": "git", "url": "https://github.com/<OWNER>/chartlang.git", "directory": "packages/<NAME>" }
}
```

> **Note on `provenance`.** npm's `provenance: true` flag (sigstore
> signatures linking a published package to a GitHub Actions build)
> requires CI with OIDC. The §22.6 release job grants `id-token: write`
> and publishes from GitHub Actions, so every publishable package keeps
> `"provenance": true` in `publishConfig`.

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
    "packages/language-service",
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
    "packages/language-service": "Headless editor intelligence — hover, completions, diagnostics, signature help",
    "packages/editor": "CodeMirror 6 reference editor over @invinite-org/chartlang-language-service",
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
            - uses: actions/setup-node@v4
              with:
                  node-version: ${{ matrix.node }}
                  cache: pnpm
            - run: pnpm install --frozen-lockfile
            - run: pnpm build
            - run: pnpm typecheck
            - run: pnpm lint
            - run: pnpm format:check
            - run: pnpm test
            - run: pnpm conformance
            - run: pnpm bench:ci
            - run: pnpm docs:check
            - run: pnpm readme:check
            - if: matrix.os == 'ubuntu-latest' && matrix.node == 20
              uses: codecov/codecov-action@v4
              with:
                  files: ./coverage/lcov.info
                  fail_ci_if_error: false

    # ──────────────────────────────────────────────────────────────────
    # Release job.
    # Maintainers must add NPM_TOKEN to repo secrets before merging a
    # release PR. Manual fallback: `pnpm publish:release` from a
    # maintainer machine.
    # ──────────────────────────────────────────────────────────────────
    release:
        name: Release
        needs: test
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        runs-on: ubuntu-latest
        permissions:
            contents: write
            pull-requests: write
            id-token: write
        steps:
            - uses: actions/checkout@v4
              with: { fetch-depth: 0 }
            - uses: pnpm/action-setup@v4
            - uses: actions/setup-node@v4
              with: { node-version: 20, cache: pnpm, registry-url: "https://registry.npmjs.org" }
            - run: pnpm install --frozen-lockfile
            - run: pnpm build
            - uses: changesets/action@v1
              with:
                  publish: pnpm release
                  version: pnpm changeset:version
                  title: "chore(release): version packages"
              env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
                  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
                  # setup-node's registry-url writes an .npmrc that reads
                  # auth from NODE_AUTH_TOKEN — without it every publish
                  # PUT is unauthenticated and npm replies E404.
                  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

CI matrix covers the two supported Node majors and both major developer
OSes. CI **gates** every PR and publishes only from pushes to `main`
after the Version Packages PR merges. `NPM_TOKEN` must exist in repo
secrets before a release PR is merged.

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

### 22.11 Release workflow

Releases are CI-driven via `changesets/action@v1`. CI gates every PR
(typecheck, lint, test, coverage, conformance, bench, docs). On pushes
to `main`, the release job opens or updates the "Version Packages" PR
while pending changesets exist. Merging that PR publishes all changed
`@invinite-org/chartlang-*` packages to npm and creates GitHub releases.

**One-time setup (repository):**

1. Create a Granular Access Token at npmjs.com scoped to
   `@invinite-org/*` with read/write permission.
2. Add it as the `NPM_TOKEN` GitHub Actions secret.
3. Keep per-package `publishConfig.provenance: true`; the release job
   grants `id-token: write` for npm provenance.

**Releasing — every time a set of changesets is ready to ship:**

```bash
# 1. Ensure the feature PRs with changesets are merged to main.
#    changesets/action opens or updates:
#    chore(release): version packages

# 2. Review the generated package.json / CHANGELOG.md changes.

# 3. Merge the Version Packages PR after CI is green.
#    The push to main publishes from GitHub Actions.
```

**Manual fallback:**

Maintainers can publish from a local machine if GitHub Actions is
unavailable. Run the normal gates first, source `NPM_TOKEN`, then use
the alias that mirrors CI's publish command:

```bash
set -a && source .env && set +a
pnpm publish:release
git push --follow-tags
```

Local fallback publishes do not get CI provenance. npm will warn because
`publishConfig.provenance` is true; use the fallback only for an
incident where CI cannot publish.

**What `pnpm release` does:**

The root `package.json` (§22.3) defines
`"release": "pnpm build && changeset publish"` and
`"publish:release": "pnpm release"`. `changeset publish` walks every
package whose version was bumped by the Version Packages PR, runs
`npm publish` against the npm registry, and creates a git tag
`<package>@<version>` for each. Packages already at the registry version
are skipped — the command is idempotent.

**If publish fails halfway:**

- `changeset publish` is per-package atomic. A failure on package N+1
  leaves N packages already published — those versions are permanent
  per npm policy.
- Recover by rerunning the failed GitHub Actions job or by using the
  manual fallback. Already-published packages are skipped; only the
  remaining ones publish.
- If a package was published incorrectly (wrong contents, broken
  build), bump the patch version in a new release rather than running
  `npm unpublish` — npm's unpublish window is 72 hours and breaks
  consumers.

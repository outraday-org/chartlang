# Glossary

Project vocabulary, in alphabetical order. Pages that fully define a
term link to it; this page is the compact lookup.

## Adapter

The integration layer between chartlang and a concrete chart library.
Declares its `Capabilities`, supplies a `candles(opts)` async iterable,
and receives drained `RunnerEmissions` batches via `onEmissions`. See
[Adapter contract](../adapters/contract.md).

## Alert

A `RunnerEmissions.alerts[]` entry. Emitted by `alert(message, opts?)`
from inside `compute`. De-duped by `(slotId, bar)` within one drained
batch. Carries a stable `dedupeKey` adapters use for async-delivery
idempotency. See [Alerts](../language/alerts.md).

## Alert condition

A named, user-wireable condition declared by `defineAlertCondition`
with a literal `title` / `description` / `defaultMessage`. The script
emits `signal(id, fired)`; the host wires each condition to a delivery
channel through its own UI. See
[Alerts § user-wireable conditions](../language/alerts.md#user-wireable-conditions-definealertcondition).

## apiVersion

The frozen integer that selects the chartlang language contract. Today
the only value is `1`. Orthogonal to npm package semver. See
[Version pinning](../language/version-pinning.md) and the
[apiVersion contract](../spec/versioning.md).

## Bar

The OHLCV record `compute` receives each step. Read-only.
Pre-computed derived sources (`hl2`, `hlc3`, `ohlc4`, `hlcc4`) are
present on every bar. See `Bar` in
`packages/core/src/types.ts` and the
[grammar source-form rules](../spec/grammar.md#defineindicator).

## Bundle

The compiled output of `pnpm chartlang compile <file>.chart.ts`. A
self-contained ESM module that default-exports a frozen
`CompiledScriptObject`. Loaded by a [host](#host) into a sandbox.

## Callsite id

The deterministic slot id the compiler injects into every stateful call.
Format: `<sourcePath>:<line>:<col>#<callIndex>`. Lines and columns are
1-based and read from the input source before any rewrite. Hand-authored
scripts always carry `callIndex = 0`. See
[grammar § callsite identity](../spec/grammar.md#callsite-identity).

## Capability

A field on the `Capabilities` bag that lets the adapter declare what it
can render. Unsupported emissions drop with a documented diagnostic.
See [Capabilities](../adapters/capabilities.md).

## Compute

The per-bar function the script's `define*` constructor takes as its
`compute` field. The runtime calls it once per main-stream `history`,
`close`, or `tick` event in delivery order, with a frozen
`ComputeContext` argument.

## Conformance scenario

A pinned `(script, candle stream, capability bag, assertion set)`
fixture in `@invinite-org/chartlang-conformance`. The adapter passes
the suite when every scenario's assertions hold. See
[Conformance](../adapters/conformance.md).

## Dep local id

The JavaScript identifier of the `const` binding that holds a dep
instance — `fastTrend` in `const fastTrend = baseTrend.withInputs({})`.
The compiler keys the runtime's per-dep state slot section by this id;
the slot ids of every primitive call inside the dep's compute carry
the `dep:<localId>/` prefix. See
[Indicator composition](../language/indicator-composition.md#multi-export-files).

## Dependency

A `CompiledScriptObject` bound to a local `const` and consumed via
`<binding>.output("title")` from another script's `compute`. The
compiler statically resolves every `.output(...)` call; the runtime
mounts each unique dep instance once per bar and forwards its titled
outputs to its consumers. See
[Indicator composition](../language/indicator-composition.md).

## Drawing budget

The per-bucket cap on `draw.*` emissions per script per bar. The
runtime enforces `min(manifest.maxDrawings, capabilities.maxDrawingsPerScript)`
per bucket. Overflow creates drop with `drawing-budget-exceeded`.

## Drawn indicator

A `defineIndicator(...)` result that's part of the module's exported
surface — either the default export or any named `export const`. The
host mounts and renders every drawn indicator; a single `.chart.ts`
file MAY ship multiple drawn indicators side-by-side. Contrast with
[private dep](#private-dep). See
[Indicator composition](../language/indicator-composition.md).

## Drawing handle

The `DrawingHandle` returned by every `draw.*` call. Carries an
opaque handle id `<callsite-id>#<sub-id>`. The script can `update(...)`
or `remove()` the handle within the current compute step and across
bars; the runtime emits create / update / remove records.

## Emission

One payload the runtime hands the adapter in a drained
`RunnerEmissions` batch — plot, drawing, alert, alert-condition, log,
or diagnostic. Wire shapes are normative in
[Emission payloads](../spec/emissions.md).

## Golden bars

The deterministic 10 000-bar candle fixture
(`packages/conformance/fixtures/goldenBars.json`) the conformance suite
runs every scenario against. The hashes pinned in each scenario assert
the runtime's emissions against this exact stream.

## Host

The sandbox that runs a compiled bundle. Implements the `ScriptHost`
interface (`load` / `push` / `drain` / `dispose`). Two ship today:
[`host-worker`](../hosts/worker.md) (browser Web Worker) and
[`host-quickjs`](../hosts/quickjs.md) (QuickJS-WASM membrane). Third
hosts may exist; see [Writing a host](../hosts/writing-a-host.md).

## Input

A user-tunable parameter declared by the script via an `input.*`
builder. Defaults and descriptor options are literals; the compiler
writes them into `manifest.inputs`. See [Inputs](../language/inputs.md).

## Manifest

The JSON-clean sidecar the compiler emits next to each bundle. Hosts
and adapters use it to size buffers, register secondary streams, render
settings UIs, and check `apiVersion` support. See
[Script manifest](../spec/manifest.md).

## Output

A producer's named `plot(value, { title })` call, consumable by other
scripts as a `Series<number>` view via `<binding>.output("title")`.
Output titles are the consumer's stable handle; an untitled `plot(...)`
in a producer disables consumption via that call and triggers
`dep-output-not-titled` when a consumer references it. See
[Indicator composition](../language/indicator-composition.md#output-title-reads).

## Pane

Where a plot renders: `"overlay"` (on the main chart), `"new"` (a fresh
sub-pane), or a named pane id. If `capabilities.subPanes` cannot
satisfy the request, the runtime folds to `"overlay"` with
`unsupported-pane`.

## Plot

A `RunnerEmissions.plots[]` entry. Emitted by `plot(value, opts?)` or
`hline(price, opts?)`. Carries a `style` discriminated union the
adapter inspects to pick the rendering path. Gaps are wired as
`value: null`. See [Emission payloads § PlotEmission](../spec/emissions.md#plotemission).

## Private dep

A non-exported `const` binding holding a `CompiledScriptObject`. The
host mounts the dep as a data feed only — its compute runs every bar
and its titled outputs flow to consumers, but its renderable emissions
(plots / drawings / alerts / logs) are dropped before they reach the
adapter. Slot ids carry the `dep:<localId>/` prefix in diagnostics.
Contrast with [drawn indicator](#drawn-indicator). See
[Indicator composition](../language/indicator-composition.md).

## Script

A `.chart.ts` module that default-exports one call to `defineIndicator`,
`defineDrawing`, `defineAlert`, or `defineAlertCondition`. Compiled
into a bundle plus manifest plus `.d.ts` triple. See the
[grammar source-form rules](../spec/grammar.md#source-form).

## Series

The read-only view over a ring-buffered history of values. `current` is
the latest value; `series[n]` for positive integer `n` is the value `n`
bars ago; `series.length` is the count of filled slots. Out-of-range
reads return `NaN` for numeric series. See
[Series and indexing](../language/series-and-indexing.md).

## Slot

The runtime state cell keyed by a [callsite id](#callsite-id). Every
stateful primitive call owns one slot; the slot survives bar-to-bar
for the lifetime of the runner.

## State (`state.*`, `state.tick.*`)

Mutable script slots exposed via the `state` namespace. `state.*`
commits on a successful close compute and rolls back on tick;
`state.tick.*` commits on every step. See
[Execution semantics § Callsite-id stability and state slots](../spec/semantics.md#callsite-id-stability-and-state-slots).

## Stateful primitive

A primitive whose call site allocates runtime state — `ta.*` calls that
hold history, `state.*` slots, `request.security`, `request.lowerTf`,
`plot`, `hline`, `draw.*`, `alert`, ... The 172-entry registry is frozen
for `apiVersion: 1`. See
[apiVersion contract § STATEFUL_PRIMITIVES](../spec/versioning.md#stateful_primitives).

## Warmup

The number of bars a `ta.*` primitive must consume before its output is
defined. `ta.ema(_, n)` warms over `n - 1` bars, then emits a real
value at bar `n - 1`. During warmup, numeric outputs are `NaN` and
plots render as gaps. Each primitive page surfaces its warmup window
via the `@warmup` JSDoc tag.

## Wire schema

The structured-clone-safe shape of every payload that crosses the host
membrane: candle events going in, emission batches coming out. See the
normative [Emission payloads](../spec/emissions.md) page.

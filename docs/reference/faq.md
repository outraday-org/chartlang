# FAQ

Answers to the questions consumers hit most often. For a deeper
reference, follow the cross-link on each answer.

## Why TypeScript instead of a Pine-style DSL?

Three reasons:

- **One language for the script, the host, and the adapter.** Authors
  write `.chart.ts`, embedders write TS adapters, and types flow
  end-to-end without a separate grammar to maintain.
- **A real type system for `Series<T>`.** `ta.crossover(fast, slow)`
  knows the operands are series, `inputs.length` narrows via `as
  number`, and missing fields show up as TS errors before the compiler
  runs.
- **Plain editors work.** VS Code, JetBrains, vim — anything that
  speaks TypeScript shows completions, signatures, and inline
  diagnostics for chartlang scripts without a dedicated plugin.

The compiler enforces the subset (see
[Forbidden constructs](../language/forbidden-constructs.md)); inside
that subset, scripts behave like ordinary TS modules.

## Is the script sandboxed?

Yes, at two layers:

- **Static.** The compiler rejects every non-deterministic and
  side-effecting construct (`Date`, `Math.random`, `fetch`,
  `setTimeout`, dynamic `import()`, `eval`, recursion, unbounded
  loops, ...). The diagnostic codes are pinned —
  [grammar § forbidden constructs](../spec/grammar.md#forbidden-constructs).
- **Runtime.** The compiled bundle runs inside a [host](../hosts/worker.md)
  sandbox — a Web Worker in the browser, or a QuickJS-WASM membrane on
  the server. The [QuickJS host](../hosts/quickjs.md) enforces hard
  memory and CPU caps; the worker host enforces measurement-based CPU
  caps and relies on the static layer for the rest.

## Can a script make network calls?

No. `fetch`, dynamic `import(...)`, and `new Function(...)` are all
compile-time errors (`hostile-global`). External data only reaches a
script through the candle stream (`bar`, `request.security`,
`request.lowerTf`) and through `input.externalSeries` feeds supplied by
the adapter.

## How are alerts delivered?

Two paths:

- **`alert(message, opts?)`** fires immediately when the script reaches
  the call. The runtime drains it in the next `RunnerEmissions` batch
  with a stable `dedupeKey` the adapter uses for async-delivery
  idempotency. The set of supported `AlertChannel`s is the adapter's
  `Capabilities.alerts` declaration.
- **`defineAlertCondition` + `signal(id, fired)`** declares named
  conditions the host can wire into its own alert-creation UI. The
  host picks the delivery channel, supplies a message template, and
  routes the channel. The script just calls `signal("up", true)` /
  `signal("down", false)` per bar.

For server-side alert delivery, mount the script in the
[QuickJS host](../hosts/quickjs.md), pump candles in, drain emissions,
and route the `alerts[]` and `alertConditions[]` queues to your
delivery layer. See [Alerts](../language/alerts.md).

## What charts are supported?

Any chart for which someone has shipped an adapter. The chartlang repo
publishes the
[adapter contract](../adapters/contract.md), the
[capabilities model](../adapters/capabilities.md), and the
[conformance suite](../adapters/conformance.md). Adapters live in
consumer repositories under their own scope and publish their own
conformance report. The contract is the interoperability signal;
there is no central registry.

Use [Writing an adapter](../adapters/writing-an-adapter.md) to build
one against a chart library that does not have one yet.

## How big are compiled bundles?

A compiled bundle is a self-contained ESM module plus a JSON manifest
plus a `.d.ts` declaration. The bundle size scales with the primitives
used: a few hundred bytes for a one-line EMA, kilobytes for a script
that pulls a handful of TA primitives and emits plots. The compiler
does not strip the embedded `__manifest` JSON — hosts and adapters
recover the manifest by dynamic `import(...)` so the bundle plus
manifest is everything they need at load time.

## Why does my plot start late?

`ta.*` primitives warm over their window. `ta.ema(_, n)` returns `NaN`
for the first `n - 1` bars; `ta.rsi(_, n)` warms over its `n`-bar
window. During warmup the runtime emits `value: null` and adapters
render it as a gap, not a zero. The warmup window is documented in the
`@warmup` line of each primitive's reference page under
[TA primitives](../primitives/ta/).

If your plot starts later than expected, look for a chain of longer-
warmup primitives (`ta.macd(_, 12, 26)` warms over 26 bars even though
the signal line draws after another 9). The
[series-and-indexing guide](../language/series-and-indexing.md#warmup-and-nan)
has more examples.

## What is `apiVersion: 1` and why is the number so small?

`apiVersion: 1` is the frozen language contract — the set of accepted
constructs, the runtime semantics, the manifest schema, the emission
wire shapes, and the stateful-primitive registry. Today's compiler
implements exactly version `1` and rejects anything else. A future
language change is `apiVersion: 2`, not a semver bump on a package.
The two axes are orthogonal; see
[Version pinning](../language/version-pinning.md) and the
[apiVersion contract](../spec/versioning.md).

## What's the difference between `state.*` and `state.tick.*`?

`state.*` slots are tentative during a compute step and commit only on
a successful close compute. On a tick step, the slot resets to the last
committed close value at the start of the step. Use `state.*` for
"on-close" persistence — values that should not survive a tick rollback.

`state.tick.*` slots commit immediately on every step (close or tick).
Use them for values that must survive intra-bar updates — for example a
running max across a session.

The normative rules are in
[Execution semantics § State Persistence](../spec/semantics.md#state-persistence).

## My adapter declared a capability but emissions never arrive — why?

Either:

- The script does not call the corresponding primitive. The runtime
  only emits what the script generates; an empty drainable queue is
  normal.
- The compiler dropped the call as a forbidden construct. Check the
  compile diagnostics from `pnpm chartlang compile`.
- The capability declaration disagrees with what the script asks for.
  For example, a script that emits `pane: "new"` against an adapter
  with `subPanes: 0` lands as overlay with `unsupported-pane`. The
  diagnostic appears in `RunnerEmissions.diagnostics`.

In every case, the diagnostic queue tells you which gate fired. See
[Execution semantics § Capability Fallback](../spec/semantics.md#capability-fallback)
for the full per-surface fallback table.

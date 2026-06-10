---
title: "Execution semantics"
since: "1.0"
status: "stable"
---

# Execution Semantics

This document normatively specifies the `apiVersion: 1` runtime contract. A
conforming runtime MUST produce the same observable script behavior, queue
shape, diagnostics, and warm-start result for the same compiled script,
inputs, candle events, and adapter capabilities.

Compiler-facing source restrictions are specified in
[Grammar and static analyses](./grammar.md). The frozen compatibility policy is
specified in [apiVersion contract](./versioning.md).

## Execution Model

A compiled script exposes one `compute(ctx)` function. The runtime invokes
`compute` once for each main-stream bar event that reaches script execution.
Secondary-stream events update request buffers and do not invoke `compute` by
themselves.

The supported candle event kinds are:

| Event kind | Runtime behavior |
| --- | --- |
| `history` | A batch of finalised main-stream bars. The runtime processes each bar as a close event in source order. |
| `close` | A finalised main-stream bar. The runtime appends it to every main OHLCV series, refreshes runtime views, runs `compute`, commits close-persistent state, then advances the bar index. |
| `tick` | An in-progress update for the current main-stream bar. The runtime replaces the current head values for close, high, low, volume, and derived sources, refreshes runtime views, and runs `compute` without advancing the bar index. |

Events MUST be processed in delivery order. Script execution is
single-threaded and non-reentrant: one `compute` call MUST finish before the
next `compute` call begins. Runtime namespaces such as `plot`, `draw`,
`alert`, `state`, and `request` are valid only during the active `compute`
call.

At the start of every close or tick compute step, the runtime MUST reset the
per-step emission queues, request alignment caches, drawing sub-id counters,
and log budget. A runtime error raised through the script runtime namespace
MUST clear renderable emissions from the active step and emit one
`runtime-error-thrown` diagnostic.

## Series and Indexing

`Series<T>` is the script-visible view over bounded runtime history:

- `series.current` and `series[0]` are the current bar value.
- `series[n]`, where `n` is a positive integer, is the value `n` bars ago.
- `series.length` is the number of filled slots currently available, capped by
  the runtime buffer capacity.
- Negative indices are out of range.

Numeric market and TA series MUST use IEEE-754 double values and MUST return
`NaN` for out-of-range reads. Object-valued series MAY use `undefined` as the
out-of-range sentinel when the script-visible surface is not numeric. The
`request.lowerTf` series is object-valued and uses an empty frozen array for
unsupported or unfilled bucket reads.

The compiler records the maximum literal series index in the manifest's
`maxLookback`. The runtime MUST size main numeric ring buffers to at least
`maxLookback + 1`, unless a larger manifest `seriesCapacities` entry is
present. A script that never looks back still has capacity for the current bar.

Dynamic series indices are a compile-time diagnostic under the grammar spec.
For `apiVersion: 1`, the shipped compiler emits `dynamic-series-index` as a
warning and records a `dynamicFallback` capacity of 5000. A conforming runtime
MUST treat manifest capacities as hard bounds: it MUST NOT grow a series
unboundedly at runtime to satisfy a dynamic index.

## Warmup and NaN

Every `ta.*` primitive declares its own warmup window. The primitive reference
pages surface that window from the primitive JSDoc `@warmup` tag. During
warmup, numeric outputs MUST be `NaN` unless the primitive's own page defines a
more specific seed behavior.

All numeric calculation uses JavaScript `number` semantics, i.e. IEEE-754
binary64. There is no decimal or fixed-point arithmetic layer in
`apiVersion: 1`.

The default numeric rules are:

- Arithmetic with `NaN` follows IEEE-754 propagation.
- Equality and ordering comparisons involving `NaN` evaluate according to
  JavaScript number semantics.
- Boolean TA helpers that define special NaN behavior, such as crossover-style
  comparisons, MUST follow their primitive pages.
- Plot emissions carry numeric gaps as `value: null` when the script value is
  not finite. Adapters MUST render those as gaps, not as zeroes and not by
  dropping neighboring points.
- Cumulative primitives MAY accumulate normal binary64 rounding error. Any
  tighter error envelope belongs on the primitive's reference page.

## Determinism

For the same compiled script, same candle event stream, same input overrides,
same symbol metadata, same initial state, and same adapter capabilities, a
conforming runtime MUST produce byte-identical drained emissions.

The determinism preconditions are:

- The script grammar excludes wall-clock reads, randomness, network I/O,
  timers, dynamic imports, and host globals.
- The runtime processes events in delivery order and runs only one `compute`
  call at a time.
- Adapter capabilities are immutable for the lifetime of one script runner.
- Input overrides are resolved once at mount and then frozen for every compute
  step.
- Secondary streams are delivered in deterministic order by their
  `streamKey`.
- A persistent snapshot, when used, has already been validated before restore.

The conformance suite's determinism check runs equivalent streams more than
once and diffs the resulting emissions. Warm-start determinism is checked by
running a cold stream and comparing its suffix with a stream restored from a
saved snapshot.

## Callsite-Id Stability and State Slots

Every stateful primitive call site owns one stable callsite id assigned by the
compiler. The id is derived from source position and is stable across
recompiles of identical source with the same source path. Stateful primitive
calls include TA calls that allocate history, `state.*`, `state.tick.*`,
`request.security`, `request.lowerTf`, plotting, drawing, alerting, and other
entries in the frozen stateful-primitive registry.

The runtime treats callsite ids as opaque strings. Each slot-allocating
primitive uses its callsite id as the key for its own state. Slots survive from
bar to bar inside one runner.

`state.*` and `state.tick.*` expose mutable script slots:

| Slot family | Close behavior | Tick behavior |
| --- | --- | --- |
| `state.*` | Writes are tentative during `compute` and commit after a successful close compute. | Before each tick compute, tentative values reset to the last committed close value. Tick writes do not commit. |
| `state.tick.*` | Writes update the committed value immediately. | Tick writes update the committed value immediately and survive subsequent ticks of the same bar. |

If a close compute halts through a runtime error, renderable emissions for that
step are cleared and close-persistent state does not commit for that failed
step.

## State Persistence

The runtime has two state layers:

- The per-run `StateStore` stores live state-slot payloads for the active
  runner.
- The cross-mount persistent store saves and restores whole runner snapshots.

A persistent store key MUST contain these identity fields:

| Field | Meaning |
| --- | --- |
| `scriptHash` | Hash of the compiled script source or equivalent compiled identity. |
| `compilerVersion` | Compiler version that produced the compiled script. |
| `apiVersion` | Script language version; for this spec it is `1`. |
| `capabilitiesHash` | Hash of normalised adapter capabilities. |
| `symbol` | Main-stream symbol. |
| `mainInterval` | Main stream interval. |
| `requestedIntervals` | Ordered list of secondary intervals requested by the manifest. |

A snapshot contains:

- `snapshotVersion`, currently `1`.
- `lastBarTime`, the latest restored main-stream bar time.
- `streams`, including main and registered secondary stream ring-buffer state.
- `slots`, including script state slots and TA state slots.
- `savedAt`, the host-provided save timestamp.

On warm start, the runtime MUST load a snapshot, validate its JSON-clean shape,
reject unsupported snapshot versions, and ignore malformed snapshots. A
snapshot whose `lastBarTime` is at or after the requested warm-start cursor is
future-dated; the runtime MUST diagnose `state-snapshot-future-dated`, clear
the store if possible, and continue cold.

When a valid past snapshot is restored, the runtime restores stream buffers and
slot payloads, then processes subsequently delivered events normally. The host
is responsible for replaying any gap between `lastBarTime` and the live cursor
if byte-identical continuity requires it.

The guarantee is: a warm-started run followed by the same replayed gap and
live suffix MUST produce byte-identical emissions to a cold run over the full
stream, excluding informational persistence diagnostics that are explicitly
about restore/save operations.

Snapshots are saved on runner disposal and on the configured close-event save
cadence. Snapshot validation or save failures MUST be converted into
diagnostics, not thrown through script code.

## Multi-Stream Alignment

Secondary streams are keyed by interval value. The manifest's
`requestedIntervals` declares which stream keys a runner knows. Main-stream
events invoke `compute`; secondary `history`, `close`, and `tick` events only
mutate secondary buffers.

If a secondary event names an unknown `streamKey`, the runtime MUST emit
`unknown-secondary-stream` and ignore that event.

### Higher-Timeframe `request.security`

`request.security({ interval })` returns a bar-shaped object whose numeric
fields are series aligned onto the main stream. For each main bar time `T`, the
value is the most recent higher-timeframe bar value whose time is less than or
equal to `T`. Main bars before the first secondary bar receive `NaN`.

This alignment deliberately exposes the in-progress higher-timeframe bar. A
secondary tick replaces the secondary head, and the next main compute sees the
latest head value when that secondary bar is the most recent bar at or before
the main time.

Fallback behavior is:

| Condition | Result |
| --- | --- |
| `Capabilities.multiTimeframe` is `false` | Return an all-`NaN` security bar and diagnose `multi-timeframe-not-supported`. |
| Requested interval is absent from `Capabilities.intervals` | Return an all-`NaN` security bar and diagnose `unsupported-interval`. |
| Manifest did not register the secondary stream | Return an all-`NaN` security bar and diagnose `unknown-secondary-stream`. |

Each request diagnostic is deduplicated per diagnostic code, callsite id,
interval, and request kind.

### Lower-Timeframe `request.lowerTf`

`request.lowerTf({ interval })` returns a `Series<ReadonlyArray<Bar>>`. Each
main bar bucket contains every lower-timeframe bar whose time falls in:

```txt
[mainBar.time, nextMainBar.time)
```

The final main bar has no successor, so its bucket contains every available
lower-timeframe bar with `time >= mainBar.time`. This exposes the current
in-progress lower-timeframe bar in the current main bucket when a secondary
tick has updated the lower-timeframe stream head.

Fallback behavior is:

| Condition | Result |
| --- | --- |
| `Capabilities.multiTimeframe` is `false` | Return an empty bucket and diagnose `multi-timeframe-not-supported`. |
| Requested interval is absent from `Capabilities.intervals` | Return an empty bucket and diagnose `unsupported-interval`. |
| Manifest did not register the secondary stream | Return an empty bucket and diagnose `unknown-secondary-stream`. |

The compiler owns the static rule that a lower-timeframe interval must be
strictly lower than the main interval. The runtime owns the bounded bucket
series behavior and capability fallback.

## Emission Ordering

Within one compute step, primitive calls execute in script order, but drained
emissions are grouped by queue. The `RunnerEmissions` payload MUST expose
queues in this order:

1. `plots`
2. `drawings`
3. `alerts`
4. `alertConditions`
5. `logs`
6. `diagnostics`
7. `fromBar`
8. `toBar`

Adapters MUST process a drain payload as one atomic batch for the covered bar
range. The runtime clears queues at the start of every close/tick compute step
and after each drain. A second drain before another compute step returns empty
queues with the previous `fromBar` and `toBar`.

Plots and alerts dedupe within their own queues by `(slotId, bar)`;
last-write-wins. Drawings dedupe within the drawing queue by
`(handleId, bar)`; last-write-wins. Alert-condition emissions and logs preserve
append order and are not queue-deduped.

## Drawing Handle Lifecycle

Every `draw.*` call returns a drawing handle. The runtime constructs the
handle id from:

```txt
<callsite-id>#<sub-id>
```

The sub-id is allocated per callsite within the current bar. The first drawing
created at a callsite in a bar uses sub-id `0`, the next uses `1`, and so on.
Sub-id counters reset at the start of every close and tick compute step, so the
same loop iteration or call order across bars produces the same handle id.

Lifecycle rules:

| Operation | Semantics |
| --- | --- |
| First `draw.*` call for a handle id | Allocates a drawing slot and emits `op: "create"` with the full initial drawing state. |
| Later `draw.*` call for the same handle id | Merges the new initial state into the stored state, clears the removed flag, and emits `op: "update"` with the full merged state. |
| `handle.update(patch)` during compute | Merges the patch into the stored state and emits `op: "update"` with the full merged state, not a patch. |
| `handle.remove()` during compute | Emits `op: "remove"` with the last-known full state and marks the slot removed. |
| `update` or `remove` outside compute | No-op. |
| `update` or `remove` after removal | No-op until a later `draw.*` call at the same handle id resurrects the slot. |

Capability and budget gates apply before an emission reaches the drawing
queue:

- If the adapter does not declare the drawing kind, the emission is dropped
  with `unsupported-drawing-kind`.
- If the emission fails wire validation, it is dropped with the validation
  diagnostic.
- On `op: "create"`, the runtime checks the bucket budget. The effective
  budget is the minimum of the script's `maxDrawings` bucket and the adapter's
  `maxDrawingsPerScript` bucket. If the bucket is exhausted, the create is
  dropped with `drawing-budget-exceeded`.
- Successful creates increment the bucket counter. Removes decrement it,
  clamped at zero. Updates are free.

The conformance budget-overflow scenario requires that only the
budget-respecting subset survives and that overflow creates diagnose
`drawing-budget-exceeded`.

## Alert Deduplication

`alert(message, opts)` emits at most one alert per `(slotId, bar)` in a single
drained queue. If a script calls `alert` more than once from the same callsite
for the same bar before drain, the later alert replaces the earlier one.

The emitted `dedupeKey` is stable and includes the callsite id, bar index, and
a stable hash of the message plus JSON metadata. Adapters MAY use this key for
downstream idempotency across asynchronous delivery channels.

Ticks share the current in-progress bar index. Therefore repeated alerts from
the same callsite across ticks of the same bar use the same bar component in
their dedupe key. Because each tick is a separate compute step and can be
drained separately, a host that drains every tick can observe repeated alert
emissions for the same bar. A host or adapter that needs once-per-bar external
dispatch MUST use `dedupeKey` for idempotency.

If the adapter declares no alert channels, `alert` drops with
`unsupported-alert-channel`.

`defineAlertCondition` scripts use `signal(conditionId, fired)`. Signal
emissions are gated by `Capabilities.alertConditions`. If the capability is
false, the runtime drops signals and diagnoses
`alert-conditions-not-supported` once per condition id. If a condition id is
not declared in the manifest, the runtime diagnoses `unknown-alert-condition`.
Both `fired: true` and `fired: false` transitions are emitted when supported;
they are not queue-deduped.

## Capability Fallback

Adapters declare their capability set up front. A conforming runtime MUST NOT
throw from script code merely because an adapter lacks an optional rendering
capability. It MUST either drop the unsupported emission with the matching
runtime diagnostic or use the documented no-op fallback for that surface.

Required fallback behavior:

| Surface | Missing capability behavior |
| --- | --- |
| Plot kind | Drop the plot and diagnose `unsupported-plot-kind`. |
| Requested pane | Fold to `overlay` and diagnose `unsupported-pane`. |
| Drawing kind | Drop the drawing and diagnose `unsupported-drawing-kind`. |
| Drawing budget | Drop overflow creates and diagnose `drawing-budget-exceeded`. |
| Alert channels | Drop the alert and diagnose `unsupported-alert-channel`. |
| Alert conditions | Drop signals and diagnose `alert-conditions-not-supported`. |
| Multi-timeframe requests | Return all-`NaN` security bars or empty lower-timeframe buckets and diagnose `multi-timeframe-not-supported`, `unsupported-interval`, or `unknown-secondary-stream`. |
| Runtime logs | If `Capabilities.logs` is false, drop the log without rendering. |

This is capability honesty from the runtime perspective: unsupported work is
never secretly rendered as if supported, never promoted to a hard script
exception, and never allowed to grow runtime state without bounds.

## Conformance Checklist

- `compute(ctx)` runs once per main-stream close/tick execution step, in event
  delivery order, with no re-entrancy.
- Numeric series implement `current`, numeric lookback indexing, bounded
  length, and `NaN` out-of-range behavior.
- Manifest `maxLookback` and `seriesCapacities` bound every ring buffer; no
  runtime path grows history unboundedly.
- Every TA primitive follows its documented warmup window and numeric
  `NaN` behavior.
- Repeated runs over the same script, events, inputs, metadata, capabilities,
  and initial state produce byte-identical drained emissions.
- Stateful callsite ids map to stable runtime slots across bars.
- `state.*` and `state.tick.*` implement the close/tick commit rules above.
- Persistent snapshots validate shape, restore streams and slots, reject
  future-dated snapshots, and produce byte-identical warm-start suffixes when
  the host replays the gap.
- `request.security` aligns the most recent secondary bar at or before each
  main time and exposes in-progress secondary heads.
- `request.lowerTf` buckets lower-timeframe bars by main-bar containment and
  exposes the current in-progress lower-timeframe bucket.
- Drained emissions expose plots, drawings, alerts, alert conditions, logs,
  diagnostics, and bar range fields in the specified grouping.
- Drawing handles create, update, remove, resurrect, allocate sub-ids, and
  enforce budgets exactly as specified.
- Alerts use stable dedupe keys; alert-condition signals are capability gated
  and preserve true/false transitions.
- Unsupported capabilities fall back through documented drops, no-ops, and
  diagnostics rather than throwing through script code.

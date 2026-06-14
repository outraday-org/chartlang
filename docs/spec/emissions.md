---
title: "Emission payloads"
since: "1.0"
status: "stable"
---

# Emission Payloads

This document specifies the `apiVersion: 1` wire payloads a runtime sends
across the adapter boundary. The schemas are self-contained so an adapter can
validate and render chartlang output without reading runtime internals.

Runtime execution order, queue reset rules, and drawing handle lifecycle are
specified in [Execution semantics](./semantics.md). This page defines the
wire shapes and the adapter-facing capability fallbacks.

## Wire-Safety Invariant

Every emission MUST be JSON-friendly and `structuredClone`-safe. The same data
MUST cross a Worker `postMessage` boundary or QuickJS membrane unchanged.

A conforming validator MUST reject:

- `bigint`
- `symbol`
- functions
- class instances and non-plain objects
- `Date`, `Map`, `Set`, `RegExp`, and similar host objects
- `undefined`
- `NaN`, `Infinity`, and `-Infinity` in any field whose schema requires a
  finite number
- throwing getters needed to traverse `meta` or drawing metadata

`validateEmission(e)` returns `{ ok: true }` for valid payloads. Invalid
payloads return `{ ok: false, code, message }`, where shape errors use
`malformed-emission` unless a schema has a more specific diagnostic code.

## Common Types

| Type | Schema |
| --- | --- |
| `JsonValue` | `null`, boolean, finite number, string, array of `JsonValue`, or plain object with `JsonValue` properties. |
| `WorldPoint` | `{ time: finite number, price: finite number }`. |
| `LineStyle` | `"solid"` \| `"dashed"` \| `"dotted"`. |
| `AlertSeverity` | `"info"` \| `"warning"` \| `"critical"`. |
| `AlertChannel` | `"log"` \| `"toast"` \| `"webhook"` \| `"email"` \| `"sms"` \| `"push"`. |
| `LogLevel` | `"info"` \| `"warn"` \| `"error"`. |

`meta` records, when present, MUST be plain objects whose values are
`JsonValue`. Arrays are allowed inside `meta`; the top-level `meta` itself is
a record, not an array.

## PlotEmission

`PlotEmission` represents one plotted value or chart visual override for the
current bar.

| Field | Type | Meaning |
| --- | --- | --- |
| `kind` | literal `"plot"` | Emission discriminator. |
| `slotId` | non-empty string | Compiler-issued callsite id. |
| `title` | string | Legend/title text; may be empty. |
| `style` | `PlotStyle` | Plot style object; its `kind` is the plot kind. |
| `bar` | non-negative integer | Main-stream bar index. |
| `time` | finite number | UTC milliseconds for the bar. |
| `value` | finite number or `null` | Numeric value. `null` is the gap marker for non-finite script output. |
| `color` | string or `null` | CSS color override or `null` for adapter default. May be overwritten by a host plot override. |
| `meta` | record of `JsonValue` | Reserved metadata record. Runtime plot emitters currently use `{}`. |
| `pane` | string | `"overlay"`, `"new"`, or a named pane id. Current runtime folds non-overlay requests to `"overlay"` with `unsupported-pane`. |
| `visible` | optional boolean | Omitted ⇒ visible. Only ever present as `false`, set by the runtime when a host [plot override](../adapters/contract.md#plot-overrides) hides the slot. An adapter MUST skip rendering and scale inclusion for a `visible: false` plot while keeping the slot listed. |

Hiding a plot via an override is presentation state, not a diagnostic: a
`visible: false` emission is a deliberate host instruction, so no
`RuntimeDiagnostic` accompanies it (the same silent-no-op spirit as the
[capability fallbacks](#capability-gating)). Because `visible` is omitted unless
a slot is explicitly hidden, every no-override emission is byte-identical to a
run with no override channel at all.

### Plot Kinds

The v1 `PlotKind` set has 17 members:

| Kind | Style fields |
| --- | --- |
| `"line"` | `lineWidth: positive finite number`, `lineStyle: LineStyle`. |
| `"step-line"` | `lineWidth: positive finite number`, `lineStyle: LineStyle`. |
| `"horizontal-line"` | `lineWidth: positive finite number`, `lineStyle: LineStyle`. |
| `"histogram"` | `baseline: finite number`. |
| `"area"` | `lineWidth: positive finite number`, `lineStyle: LineStyle`, `fillAlpha: finite number in [0, 1]`. |
| `"filled-band"` | `upper: finite number or null`, `lower: finite number or null`, `alpha: finite number in [0, 1]`; at least one bound must be non-null. |
| `"label"` | `text: non-empty string up to 128 characters`, `position: "above" \| "below" \| "anchor"`. |
| `"marker"` | `shape: "circle" \| "triangle-up" \| "triangle-down" \| "square" \| "diamond"`, `size: positive finite number`. |
| `"shape"` | `shape: "circle" \| "triangle-up" \| "triangle-down" \| "square" \| "diamond" \| "cross" \| "xcross" \| "flag"`, `size: positive finite number`, optional `location: "above" \| "below" \| "absolute"`. |
| `"character"` | `char: non-empty string`, `size: positive finite number`, optional `location: "above" \| "below" \| "absolute"`. |
| `"arrow"` | `direction: "up" \| "down"`, `size: positive finite number`. |
| `"candle-override"` | `bull: non-empty color string`, `bear: non-empty color string`, optional `doji: non-empty color string`. |
| `"bar-override"` | `color: non-empty color string`. |
| `"bg-color"` | `color: non-empty color string`, optional `transp: finite number in [0, 100]`. |
| `"bar-color"` | `color: non-empty color string`. |
| `"horizontal-histogram"` | `buckets: array` of `{ price: finite number, volume: finite non-negative number, color?: non-empty string }`. |

Adapters gate plots with `Capabilities.plots`. If `style.kind` is absent from
that set, the runtime drops the plot and emits `unsupported-plot-kind`.

## DrawingEmission

`DrawingEmission` represents one drawing handle operation. `create` carries
the initial full state, `update` carries the full merged state after a patch,
and `remove` carries the last-known full state.

| Field | Type | Meaning |
| --- | --- | --- |
| `kind` | literal `"drawing"` | Emission discriminator. |
| `handleId` | non-empty string | `<slotId>#<subId>`, where `subId` is allocated per callsite within the current compute step. |
| `drawingKind` | `DrawingKind` | Kebab-case drawing discriminator. |
| `op` | `"create"` \| `"update"` \| `"remove"` | Handle operation. |
| `state` | `DrawingState` | Full state object. `state.kind` MUST equal `drawingKind`. |
| `bar` | non-negative integer | Main-stream bar index. |
| `time` | finite number | UTC milliseconds for the bar. |

Every drawing state may include common metadata:

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string | Optional editor/display label. |
| `visible` | boolean | Optional visibility flag. `false` hides without removing. |

Drawing anchors use world coordinates. A `WorldPoint` is a finite `time` plus
finite `price`. Variants use one of these forms: `anchor`, `anchors` tuple or
array, `price`, `time`, `position`, or container child ids. Style payloads are
plain objects with kind-specific optional fields such as `color`, `lineWidth`,
`lineStyle`, `text`, fill colors, labels, levels, or table cell styling. Style
fields MUST be JSON-compatible and finite where numeric.

### Drawing Kinds

The v1 `DrawingKind` set has 62 members, grouped in canonical order:

| Group | Kinds |
| --- | --- |
| Lines / Rays | `"line"`, `"horizontal-line"`, `"horizontal-ray"`, `"vertical-line"`, `"cross-line"`, `"trend-angle"` |
| Boxes / Shapes | `"rectangle"`, `"rotated-rectangle"`, `"triangle"`, `"polyline"`, `"circle"`, `"ellipse"`, `"path"`, `"marker"` |
| Curves | `"arc"`, `"curve"`, `"double-curve"` |
| Freehand | `"pen"`, `"highlighter"`, `"brush"` |
| Annotations | `"text"`, `"arrow"`, `"arrow-marker"`, `"arrow-mark-up"`, `"arrow-mark-down"` |
| Channels | `"trend-channel"`, `"flat-top-bottom"`, `"disjoint-channel"`, `"regression-trend"` |
| Fibonacci | `"fib-retracement"`, `"fib-trend-extension"`, `"fib-channel"`, `"fib-time-zone"`, `"fib-wedge"`, `"fib-speed-fan"`, `"fib-speed-arcs"`, `"fib-spiral"`, `"fib-circles"`, `"fib-trend-time"` |
| Gann | `"gann-box"`, `"gann-square-fixed"`, `"gann-square"`, `"gann-fan"` |
| Pitchforks | `"pitchfork"`, `"pitchfan"` |
| Harmonic Patterns | `"xabcd-pattern"`, `"cypher-pattern"`, `"head-and-shoulders"`, `"abcd-pattern"`, `"triangle-pattern"`, `"three-drives-pattern"` |
| Elliott Waves | `"elliott-impulse-wave"`, `"elliott-correction-wave"`, `"elliott-triangle-wave"`, `"elliott-double-combo"`, `"elliott-triple-combo"` |
| Cycles | `"cyclic-lines"`, `"time-cycles"`, `"sine-line"` |
| Containers | `"group"`, `"frame"` |
| Viewport Overlays | `"table"` |

### Drawing State Families

The validator checks each kind's state shape:

| Family | Required geometry |
| --- | --- |
| `line`, `trend-angle`, `regression-trend`, many fib/gann/cycle states | `anchors` pair of `WorldPoint` values. |
| `horizontal-line` | `price: finite number`. |
| `vertical-line` | `time: finite number`. |
| `horizontal-ray`, `cross-line`, `marker`, `text`, `arrow-marker`, `arrow-mark-up`, `arrow-mark-down`, `gann-square-fixed` | `anchor: WorldPoint`. |
| `triangle`, channel states, pitchforks, some fib states, `pitchfan`, `elliott-correction-wave`, `triangle-pattern` | `anchors` triple. |
| `rotated-rectangle`, `disjoint-channel`, `abcd-pattern` | `anchors` quad. |
| Harmonic patterns and several Elliott waves | `anchors` quint. |
| `three-drives-pattern`, `elliott-double-combo`, `elliott-triple-combo` | `anchors` hept. |
| `polyline` and freehand/path-like states | Variable `anchors` array with finite `WorldPoint` entries. |
| `group` | `childHandleIds: string[]` with at most 100 entries. |
| `frame` | `anchors` pair plus `childHandleIds`. |
| `table` | `position`, non-empty 2D `cells`, optional border/frame styling. |

Adapters gate drawings with `Capabilities.drawings`. Unsupported kinds drop
with `unsupported-drawing-kind`. Drawing create operations are also gated by
the effective bucket budget; overflow creates drop with
`drawing-budget-exceeded`.

## AlertEmission

`AlertEmission` represents one call to `alert(...)`.

| Field | Type | Meaning |
| --- | --- | --- |
| `kind` | literal `"alert"` | Emission discriminator. |
| `slotId` | non-empty string | Compiler-issued callsite id. |
| `severity` | `AlertSeverity` | `"info"`, `"warning"`, or `"critical"`. |
| `message` | non-empty string | Alert message. |
| `bar` | non-negative integer | Main-stream bar index. |
| `time` | finite number | UTC milliseconds for the bar. |
| `meta` | record of `JsonValue` | Script-supplied metadata snapshot. |
| `channels` | `AlertChannel[]` | Snapshot of supported adapter channels chosen by the runtime. |
| `dedupeKey` | non-empty string | Stable idempotency key derived from slot id, bar, message, and metadata. |

Adapters gate alerts with `Capabilities.alerts`. If the set is empty, the
runtime drops the alert and emits `unsupported-alert-channel`. If an adapter
supports only a subset of downstream delivery channels, it MUST dispatch only
the channels it honestly declared.

## AlertConditionEmission

`AlertConditionEmission` represents one `signal(conditionId, fired)` state.

| Field | Type | Meaning |
| --- | --- | --- |
| `kind` | literal `"alert-condition"` | Emission discriminator. |
| `conditionId` | non-empty string | Must match a manifest `alertConditions[].id`. |
| `title` | string | Copied from the manifest descriptor. |
| `description` | string | Copied from the manifest descriptor. |
| `defaultMessage` | string | Copied from the manifest descriptor. |
| `fired` | boolean | Current condition state. `false` is emitted deliberately. |
| `bar` | non-negative integer | Main-stream bar index. |
| `time` | finite number | UTC milliseconds for the bar. |

Adapters gate condition emissions with `Capabilities.alertConditions`. When
false, the runtime drops signals and emits `alert-conditions-not-supported`
once per condition id. Unknown ids drop with `unknown-alert-condition`.

## LogEmission

`LogEmission` represents one `runtime.log.info`, `runtime.log.warn`, or
`runtime.log.error` call.

| Field | Type | Meaning |
| --- | --- | --- |
| `kind` | literal `"log"` | Emission discriminator. |
| `level` | `LogLevel` | `"info"`, `"warn"`, or `"error"`. |
| `message` | non-empty string | Log message. |
| `meta` | optional record of `JsonValue` | Optional metadata snapshot. |
| `bar` | non-negative integer | Main-stream bar index. |
| `time` | finite number | UTC milliseconds for the bar. |

Adapters gate logs with `Capabilities.logs`. When false, `runtime.log.*` is a
silent no-op and no diagnostic is emitted. When true, more than 1000 log
emissions in one compute step are dropped after one
`runtime-log-budget-exceeded` diagnostic. Non-JSON metadata drops with
`malformed-log-meta`.

## RuntimeDiagnostic

Diagnostics are non-rendered payloads for editors, hosts, logs, and adapter
debugging.

| Field | Type | Meaning |
| --- | --- | --- |
| `kind` | literal `"diagnostic"` | Emission discriminator. |
| `severity` | `"info"` \| `"warning"` \| `"error"` | Diagnostic severity. |
| `code` | `DiagnosticCode` | Stable machine-readable code. |
| `message` | string | Human-readable message. |
| `slotId` | string or `null` | Related callsite id, when there is one. |
| `bar` | non-negative integer or `null` | Related main-stream bar index, when there is one. |

### Diagnostic Codes

| Code | When it fires |
| --- | --- |
| `unsupported-plot-kind` | A plot or hline style kind is not in `Capabilities.plots`. |
| `unsupported-drawing-kind` | A drawing kind is not known or is not in `Capabilities.drawings`. |
| `unsupported-alert-channel` | An alert cannot be routed because the adapter declares no alert channel. |
| `unsupported-pane` | A plot requests `"new"` or a named pane that the current runtime folds back to `"overlay"`. |
| `unsupported-interval` | A requested interval is absent from `Capabilities.intervals`. |
| `multi-timeframe-not-supported` | `request.security` or `request.lowerTf` needs secondary streams but `Capabilities.multiTimeframe` is false. |
| `unknown-secondary-stream` | A request or candle event names an interval not registered from the manifest. |
| `lookback-exceeded` | Runtime history access exceeds the allowed lookback capacity. |
| `drawing-budget-exceeded` | A drawing create would exceed the effective per-bucket drawing budget. |
| `dropped-by-policy` | Host or adapter policy intentionally drops an otherwise well-formed payload. |
| `input-coercion-failed` | A host or adapter input override cannot be coerced to the manifest descriptor kind. |
| `alert-conditions-not-supported` | A script signals an alert condition while `Capabilities.alertConditions` is false. |
| `unknown-alert-condition` | A script signals a condition id not declared in the manifest. |
| `alert-rate-limited` | Alert delivery is throttled by host or adapter policy. |
| `runtime-cpu-budget-exceeded` | Host/runtime execution exceeds the configured CPU budget. |
| `runtime-memory-budget-exceeded` | Host/runtime execution exceeds the configured memory budget. |
| `runtime-log-budget-exceeded` | `runtime.log.*` exceeds 1000 messages in one compute step. |
| `malformed-log-meta` | `runtime.log.*` metadata is not JSON-compatible. |
| `runtime-error-thrown` | Script code calls the runtime error primitive or throws through runtime execution. |
| `session-info-missing` | Session metadata needed by a runtime feature is missing. |
| `fixed-range-inverted` | A fixed visible range or anchored range has invalid ordering. |
| `state-snapshot-restored` | A persistent state snapshot was restored successfully. |
| `state-snapshot-future-dated` | A persistent snapshot is newer than the requested warm-start cursor. |
| `state-snapshot-malformed` | A persistent snapshot fails shape or JSON validation. |
| `state-snapshot-save-failed` | Saving a persistent state snapshot fails. |
| `malformed-emission` | A payload fails wire-schema validation. |

## RunnerEmissions

The runtime drains emissions as one batch:

| Field | Type | Meaning |
| --- | --- | --- |
| `plots` | `PlotEmission[]` | Plot queue. |
| `drawings` | `DrawingEmission[]` | Drawing queue. |
| `alerts` | `AlertEmission[]` | Alert queue. |
| `alertConditions` | `AlertConditionEmission[]` | Alert-condition queue. |
| `logs` | `LogEmission[]` | Log queue. |
| `diagnostics` | `RuntimeDiagnostic[]` | Diagnostic queue. |
| `fromBar` | non-negative integer | First main bar covered by the batch. |
| `toBar` | non-negative integer | Last main bar covered by the batch. |

Adapters MAY assume a drain payload is an atomic batch for the covered bar
range. Within one batch, plots and alerts have already been deduped by
`(slotId, bar)` with last-write-wins. Drawings have been deduped by
`(handleId, bar)` with last-write-wins. Alert conditions and logs preserve
append order. Detailed execution ordering is specified in
[Execution semantics](./semantics.md#emission-ordering).

## Capability Gating

| Emission family | Capability key | Missing capability behavior |
| --- | --- | --- |
| Plot styles | `Capabilities.plots` | Drop the plot; emit `unsupported-plot-kind` with `slotId` and `bar`. |
| Plot panes | `Capabilities.subPanes` | Current runtime folds to `"overlay"`; emit `unsupported-pane`. |
| Drawings | `Capabilities.drawings` | Drop the drawing; emit `unsupported-drawing-kind`. |
| Drawing budgets | `Capabilities.maxDrawingsPerScript` plus manifest `maxDrawings` | Drop overflow creates; emit `drawing-budget-exceeded`. |
| Alerts | `Capabilities.alerts` | Drop the alert when no channel is declared; emit `unsupported-alert-channel`. |
| Alert conditions | `Capabilities.alertConditions` | Drop the signal; emit `alert-conditions-not-supported`. |
| Logs | `Capabilities.logs` | Silent no-op; no diagnostic. |
| Request-driven secondary streams | `Capabilities.intervals` and `Capabilities.multiTimeframe` | Return fallback request values and emit `unsupported-interval`, `multi-timeframe-not-supported`, or `unknown-secondary-stream`. |

The full capability bag has these 13 keys: `plots`, `drawings`, `alerts`,
`alertConditions`, `logs`, `inputs`, `intervals`, `multiTimeframe`,
`subPanes`, `symInfoFields`, `maxDrawingsPerScript`, `maxLookback`, and
`maxTickHz`.

## Conformance Hooks

`runConformanceSuite` exercises the adapter contract in three ways:

| Hook | Required behavior |
| --- | --- |
| Capability honesty | An adapter accepts only emissions covered by its declared capabilities and drops unsupported families with the matching diagnostic or documented no-op. |
| Wire-schema compliance | Every payload crossing the adapter boundary satisfies the schemas on this page and validates through the common wire validator. |
| Determinism | Equivalent runs produce byte-identical emissions, including identical diagnostics and batch grouping. |

Adapter conformance reporting is described in
[Adapter conformance](../adapters/conformance.md). Runtime determinism and
the §15.3 conformance trio are described in
[Execution semantics](./semantics.md#determinism).

## Mechanical Verification

This page was checked by extracting the current exported inventories and
comparing them to the tables above:

- `PlotKind`: 17 members.
- `DrawingKind`: 62 members.
- `DiagnosticCode`: 26 members.
- `Capabilities`: 13 keys in the current type, including `maxTickHz`.

No membership drift was found between the extracted unions and the lists in
this page.

## Conformance Checklist

- Every emission is a plain JSON-compatible object and passes the
  wire-safety invariant.
- `PlotEmission` fields match the schema and `style.kind` is one of the 17
  plot kinds listed above.
- `DrawingEmission` fields match the schema, `state.kind === drawingKind`, and
  `drawingKind` is one of the 62 listed kinds.
- `AlertEmission`, `AlertConditionEmission`, and `LogEmission` fields match
  their tables and use only JSON-compatible metadata.
- `RuntimeDiagnostic.code` is one of the 26 listed diagnostic codes.
- `RunnerEmissions` batches expose plots, drawings, alerts, alert conditions,
  logs, diagnostics, and bar range fields.
- Unsupported capability families drop or no-op exactly as specified.
- Adapters validate payloads at structured-clone boundaries and never treat an
  unsupported additive kind as schema corruption when it can be handled as a
  capability fallback.
- Adding optional fields or additive kinds is allowed in `1.x`; removing or
  retyping existing fields requires `apiVersion: 2`.

---
title: "Script manifest"
since: "1.0"
status: "stable"
---

# Script Manifest

The script manifest is the JSON sidecar a compiler emits beside a compiled
chartlang bundle. Hosts and adapters use it to render settings UI, register
secondary streams, size history buffers, route alert conditions, and gate
capabilities without executing user code.

A conforming `apiVersion: 1` manifest MUST be a JSON-compatible object. It
MUST round-trip through `JSON.stringify` and `structuredClone` unchanged.

## Schema

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `apiVersion` | Yes | literal `1` | The frozen script-language version. Every v1 manifest uses numeric `1`. |
| `kind` | Yes | `"indicator"` \| `"drawing"` \| `"alert"` \| `"alertCondition"` | The script constructor used by the source module. |
| `name` | Yes | string | Human-readable script name. |
| `inputs` | Yes | record of input descriptors | Static settings schema. Keys are script-authored input ids. |
| `capabilities` | Yes | `CapabilityId[]` | Capability families the script may use: `"indicators"`, `"drawings"`, `"alerts"`, `"alertConditions"`. Values are deduplicated. |
| `requestedIntervals` | Yes | string array | Secondary interval ids the runtime must register, sorted and deduplicated from request primitives plus `requiresIntervals`. Empty when no secondary stream is needed. |
| `userPickableInterval` | Yes | boolean | `true` when the input schema contains one `input.interval(...)`; otherwise `false`. |
| `seriesCapacities` | Yes | record of non-negative integers | Extra per-series history capacities inferred by the compiler. The v1 dynamic-index fallback key is `dynamicFallback: 5000`. |
| `maxLookback` | Yes | non-negative integer | Largest literal numeric series lookback the compiler found. Runtime main-series capacity is at least `maxLookback + 1`. |
| `maxDrawings` | No | drawing-count object | Per-bucket drawing budget requested by `defineIndicator` or `defineDrawing`. Buckets are `lines`, `labels`, `boxes`, `polylines`, and `other`. |
| `maxBarsBack` | No | non-negative integer | Author-declared historical lookback override. Alerts and indicators may declare it; drawing scripts do not use it. |
| `format` | No | `"price"` \| `"volume"` \| `"percent"` \| `"compact"` | Value-formatting hint for axis labels, legends, and cursors. Alert scripts do not use it. |
| `precision` | No | integer | Decimal precision hint. Missing means the adapter should use the symbol default. |
| `scale` | No | `"price"` \| `"left"` \| `"right"` \| `"new"` | Indicator scale-axis request. Missing means adapter default. |
| `requiresIntervals` | No | string array | Author-declared interval ids that must exist in adapter `Capabilities.intervals`. Sorted and deduplicated in compiled sidecars. |
| `shortName` | No | string | Compact legend or chip label. Missing means hosts derive a short label from `name`. |
| `alertConditions` | No | alert-condition descriptor array | Static condition list for `defineAlertCondition` scripts. |

`maxDrawings` is part of the public `ScriptManifest` type and of manifests
returned by the script constructors. The current compiler sidecar builder does
not yet carry it through compiled output; a conforming v1 sidecar SHOULD emit
it when present in source so runtime drawing budgets can be applied before any
drawing reaches an adapter.

### Script Kinds

| `kind` | Source constructor | Base capability |
| --- | --- | --- |
| `"indicator"` | `defineIndicator(...)` | `"indicators"` |
| `"drawing"` | `defineDrawing(...)` | `"drawings"` |
| `"alert"` | `defineAlert(...)` | `"alerts"` |
| `"alertCondition"` | `defineAlertCondition(...)` | `"alertConditions"` |

Additional capability ids may appear when a script uses another family, such
as an indicator that calls `alert(...)`.

### Drawing Counts

`maxDrawings` has this shape:

| Field | Type | Meaning |
| --- | --- | --- |
| `lines` | non-negative integer | Budget for line-like drawings. |
| `labels` | non-negative integer | Budget for label/text-like drawings. |
| `boxes` | non-negative integer | Budget for box/shape-like drawings. |
| `polylines` | non-negative integer | Budget for polyline/path-like drawings. |
| `other` | non-negative integer | Budget for every drawing kind outside the first four buckets. |

The runtime effective budget for a bucket is the minimum of the manifest
bucket and `Capabilities.maxDrawingsPerScript` for that bucket. If
`maxDrawings` is omitted, the adapter capability alone is the limit.

### Alert Conditions

Each `alertConditions` entry has this shape:

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `id` | Yes | non-empty string | Condition id. It is the source object key normalised into data. |
| `title` | Yes | string | Display title for an alert-creation UI. |
| `description` | Yes | string | Human-readable condition explanation. |
| `defaultMessage` | Yes | string | Message template hosts use when the user has not supplied one. |

`AlertConditionEmission.conditionId` MUST match one manifest
`alertConditions[].id`. Unknown ids are invalid runtime signals and produce
`unknown-alert-condition`.

## Input Descriptors

`inputs` is a record whose keys are input ids and whose values are one of the
descriptor shapes below. Every descriptor is JSON-compatible.

All input descriptors except `external-series` share these fields:

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `kind` | Yes | input kind literal | Discriminator. |
| `defaultValue` | Yes | kind-specific JSON value | Default used when the host or adapter provides no override. |
| `title` | No | string | Display label. Missing means the host may derive a label from the input id. |

There is no generic `uiHint` field in v1. UI hints are the explicit optional
fields in the descriptor tables below. A future generic hint field must be
optional and additive under the [versioning rules](./versioning.md).

| `kind` | `defaultValue` | Additional fields |
| --- | --- | --- |
| `"int"` | finite number | Optional `min`, `max`, and `step` finite numbers. Hosts SHOULD render integer controls. |
| `"float"` | finite number | Optional `min`, `max`, and `step` finite numbers. |
| `"bool"` | boolean | None. Hosts SHOULD render a toggle or checkbox. |
| `"string"` | string | Optional `multiline: boolean`. |
| `"enum"` | string | Required `options: string[]`. `defaultValue` MUST be one of the options. |
| `"color"` | string | CSS color string. Hosts SHOULD render a color picker when available. |
| `"source"` | `"open"` \| `"high"` \| `"low"` \| `"close"` \| `"hl2"` \| `"hlc3"` \| `"ohlc4"` \| `"hlcc4"` | Source series picker. |
| `"time"` | finite number | Optional `pickFromChart: boolean`; value is UTC milliseconds. |
| `"price"` | finite number | Price picker. |
| `"symbol"` | string | Symbol picker. |
| `"interval"` | string | Adapter interval picker. Only one `input.interval(...)` may appear per script. |

`external-series` is different because it describes a named external feed:

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `kind` | Yes | `"external-series"` | Discriminator. |
| `name` | Yes | string | Adapter feed id. |
| `schema` | Yes | `{ "kind": "external-series-schema" }` | Opaque v1 schema placeholder. |
| `title` | No | string | Display label. |

## Construction Guarantees

A conforming compiler MUST construct a manifest deterministically for
identical source, compiler options, and source path:

- Callsite ids used to derive capacities and capability use are stable for
  identical source and source path, as specified in
  [Grammar and static analyses](./grammar.md#callsite-identity).
- Arrays in the produced manifest are fresh copies, not aliases of compiler
  working arrays.
- Nested records and arrays are recursively frozen before the compiler returns
  the manifest object.
- Re-running compilation over identical inputs produces the same manifest data
  and the same JSON representation, excluding object key ordering not
  guaranteed by JSON consumers.

Hosts and adapters MUST treat manifests as immutable. They may clone them, but
must not depend on mutating them.

## JSON Compatibility

Every manifest value MUST be one of:

- `null`
- boolean
- finite number
- string
- array of JSON-compatible values
- plain object with string keys and JSON-compatible values

The manifest MUST NOT contain functions, class instances, `Date`, `Map`,
`Set`, `RegExp`, `bigint`, symbols, `undefined`, `NaN`, `Infinity`, or
accessor properties whose getters are needed to read the value.

`JSON.stringify(manifest)` followed by `JSON.parse(...)` MUST preserve the
same data. `structuredClone(manifest)` MUST preserve the same data.

## Versioning Hook

The manifest schema is frozen for `apiVersion: 1`.

Within the `1.x` line, implementations MAY add optional fields that older
runtimes and adapters can ignore. Removing a field, renaming a field, changing
a field type, changing a discriminator, making an optional field required, or
changing the meaning of existing data requires `apiVersion: 2`.

The compatibility policy is defined in [apiVersion contract](./versioning.md).

## Mechanical Verification

This page was checked against the current exported manifest and compiler
builder inventories by extracting the `ScriptManifest` field names and the
compiler sidecar builder's returned keys, then comparing both sets to the
schema table above. The only recorded drift is `maxDrawings`: it exists in the
public `ScriptManifest` type and script-constructor manifests, but is not yet
emitted by the compiler sidecar builder.

Input descriptor kind membership was checked against the v1 input descriptor
union: `int`, `float`, `bool`, `string`, `enum`, `color`, `source`, `time`,
`price`, `symbol`, `interval`, and `external-series`.

## Conformance Checklist

- Manifest is a JSON-compatible plain object with `apiVersion: 1`.
- Required fields are present: `apiVersion`, `kind`, `name`, `inputs`,
  `capabilities`, `requestedIntervals`, `userPickableInterval`,
  `seriesCapacities`, and `maxLookback`.
- Optional fields, when present, use the exact names and value domains listed
  above.
- `inputs` contains only the twelve v1 descriptor kinds and only
  JSON-compatible descriptor values.
- `input.interval(...)` contributes `userPickableInterval: true`; no other
  input kind does.
- `requestedIntervals` is the sorted, deduplicated union of static request
  intervals and `requiresIntervals`.
- `alertConditions` ids match the ids that runtime `signal(...)` may emit.
- Arrays and nested records are copied and recursively frozen by the compiler
  before returning the manifest.
- The manifest round-trips through `JSON.stringify` and `structuredClone`
  without data changes.
- Additive optional fields are allowed in `1.x`; removals or type changes are
  rejected as `apiVersion: 2` work.

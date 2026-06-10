---
title: "Grammar and static analyses"
since: "1.0"
status: "stable"
---

# Grammar and static analyses

This document normatively specifies the portable `apiVersion: 1` chartlang
source form, the TypeScript subset a conforming compiler accepts, and the
static analyses that turn non-portable scripts into compile diagnostics.

## Source Form

A chartlang script MUST be a single TypeScript module with a `.chart.ts`
source name. The module MUST default-export exactly one call to one of these
constructors imported from `@invinite-org/chartlang-core`:

- `defineIndicator`
- `defineDrawing`
- `defineAlert`
- `defineAlertCondition`

The default export's first argument MUST be an object literal. That literal
MUST include `name` as a string literal and `apiVersion: 1` as a numeric
literal. A conforming compiler MUST reject a missing default export, a default
export that is not one of the four constructors, a non-object first argument,
or any `apiVersion` value other than the numeric literal `1`.

Scripts MAY import runtime-visible values and types from
`@invinite-org/chartlang-core` and time helpers from
`@invinite-org/chartlang-core/time`. No other runtime import is portable
chartlang v1.

### `defineIndicator`

`defineIndicator` describes a per-bar indicator script. It MAY emit plots,
drawings, and alerts.

```ts
import { defineIndicator, input, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Close Plot",
    apiVersion: 1,
    overlay: true,
    inputs: {
        enabled: input.bool(true, { title: "Enabled" }),
    },
    shortName: "Close",
    format: "price",
    precision: 2,
    scale: "price",
    requiresIntervals: ["1D"],
    maxBarsBack: 200,
    maxDrawings: { lines: 50, labels: 50, boxes: 10, polylines: 10, other: 10 },
    compute({ bar, inputs }) {
        if (inputs.enabled === true) {
            plot(bar.close, { title: "Close" });
        }
    },
});
```

Recognised fields are:

| Field | Requirement |
| --- | --- |
| `name` | Required string literal. |
| `apiVersion` | Required numeric literal `1`. |
| `overlay` | Optional boolean hint for indicator placement. |
| `inputs` | Optional object literal whose properties are `input.*` descriptors. |
| `compute` | Required function called once per bar by the runtime. |
| `maxDrawings` | Optional drawing-budget object with `lines`, `labels`, `boxes`, `polylines`, and `other` numeric fields. |
| `maxBarsBack` | Optional numeric literal lookback override. |
| `format` | Optional literal `"price"`, `"volume"`, `"percent"`, or `"compact"`. |
| `precision` | Optional numeric literal. |
| `scale` | Optional literal `"price"`, `"left"`, `"right"`, or `"new"`. |
| `requiresIntervals` | Optional array literal of string interval ids. |
| `shortName` | Optional string literal. |

### `defineDrawing`

`defineDrawing` describes a drawing-oriented script. Its shape matches
`defineIndicator` except that it has no `overlay`, `maxBarsBack`, or `scale`
field. It accepts `name`, `apiVersion`, `inputs`, `compute`, `maxDrawings`,
`format`, `precision`, `requiresIntervals`, and `shortName`.

### `defineAlert`

`defineAlert` describes a headless alert script. It accepts `name`,
`apiVersion`, `inputs`, `compute`, `maxBarsBack`, `requiresIntervals`, and
`shortName`. It has no plot-format fields and no drawing budget field.

### `defineAlertCondition`

`defineAlertCondition` describes alert conditions that a host can expose in an
alert-creation UI. It accepts `name`, `apiVersion`, optional `inputs`,
required `conditions`, and required `compute`.

`conditions` MUST be an object literal. Each property key becomes the
condition id. Each value MUST be an object literal with string-literal
`title`, `description`, and `defaultMessage` fields.

## TypeScript Subset

Portable chartlang v1 scripts MAY use these TypeScript constructs:

- Static `import` declarations from the two allowed chartlang core module
  specifiers, including type-only imports.
- `const` and `let` bindings.
- Object, array, numeric, string, boolean, `null`, and template literals.
- Property access and calls against the script-visible core API.
- Function declarations, function expressions, and arrow functions, provided
  they are not self-recursive.
- `if` / `else`, `switch`, `return`, `break`, and `continue`.
- Conditional expressions, logical operators, arithmetic operators, comparison
  operators, nullish coalescing, and optional chaining.
- Bounded `for` loops of the form `for (let i = <number>; i < <number>; i++)`
  or the same shape with `<=`, `>`, or `>=`.
- Series indexing with a numeric literal on values typed as `Series<T>`,
  including `ta.*` series results.
- Non-substitution template literals where a literal value is required, such
  as an input default.
- Type annotations, type aliases, interfaces, and `as const` assertions that
  do not change runtime behavior.

Features outside this subset are not part of the portable v1 grammar. In
particular, a script MUST NOT depend on host globals, wall-clock time, network
I/O, dynamic module loading, unbounded iteration, dynamic stateful-call names,
or runtime-discovered manifest metadata.

## Forbidden Constructs

A conforming compiler MUST emit stable diagnostic codes for rejected source.
The following table is the complete `apiVersion: 1` compile-diagnostic code
set.

| Diagnostic code | A conforming compiler emits it when... |
| --- | --- |
| `unbounded-loop` | The script uses `while`, `do...while`, `for...of`, `for...in`, or a `for` loop that does not have literal numeric bounds. |
| `recursion-not-allowed` | A function directly calls itself. |
| `hostile-global` | The script references nondeterministic or host-owned globals, including `Date`, `Math.random`, `fetch`, `setTimeout`, `setInterval`, `queueMicrotask`, `Promise`, `requestAnimationFrame`, `eval`, `Function`, `require`, or dynamic `import(...)`. |
| `stateful-call-inside-loop` | A stateful primitive call appears inside any loop body. |
| `stateful-call-element-access` | A stateful namespace is called through element access, such as `ta["ema"](...)`, instead of property access. |
| `request-security-interval-not-literal` | `request.security({ interval })` is neither a string literal nor a reference to an extracted string-valued `input.enum`. |
| `dynamic-series-index` | A series is indexed with a non-literal expression; this is a warning and requires the dynamic fallback buffer. |
| `callsite-id-conflict` | Two stateful calls resolve to the same deterministic slot id. |
| `missing-default-export` | The module has no default export or the default export is not one of the four `define*` calls from core. |
| `api-version-mismatch` | The `define*` object is missing `apiVersion: 1`, uses another value, or is not an object literal. |
| `input-default-not-literal` | An `input.*` default or descriptor option that must be serialised into the manifest is not literal. |
| `unknown-input-kind` | The script uses an `input.*` builder that is not part of chartlang v1. |
| `multiple-input-interval` | More than one `input.interval(...)` appears in the script's input schema. |
| `requires-intervals-not-literal` | `requiresIntervals` is not an array literal of string literals. |
| `alert-condition-not-literal` | `defineAlertCondition({ conditions })` is missing or not an object literal. |
| `alert-condition-field-not-literal` | An alert-condition descriptor, id, `title`, `description`, or `defaultMessage` is not literal. |
| `lower-tf-not-lower` | `request.lowerTf({ interval })` requests an interval that is not strictly lower than the declared main interval set. |
| `request-lower-tf-interval-not-literal` | `request.lowerTf({ interval })` is neither a string literal nor a reference to an extracted string-valued `input.enum`. |

## Static Analyses

### Structural Checks

The structural pass verifies the module-level default export and reads the
script kind, name, `apiVersion`, and literal display overrides. It guarantees
that later passes operate on a recognised `define*` shape. It rejects missing
or invalid default exports and rejects every language version except
`apiVersion: 1`.

### Forbidden Constructs

The forbidden-construct pass rejects unbounded loops, direct recursion, and
hostile globals. A conforming implementation MUST run this before producing a
runnable bundle so nondeterministic behavior cannot reach the host.

### Stateful Calls In Loops

The loop-state pass rejects every stateful primitive call nested in a loop.
Every loop iteration would otherwise reuse the same callsite slot, which would
merge independent state updates into one runtime slot.

### Callsite-Id Injection

The callsite transformer rewrites every stateful primitive call by inserting a
string-literal slot id as the first argument. It also rejects element-access
calls on stateful namespaces and duplicate slot ids. Stateless entries in the
stateful registry are not rewritten, but they still participate in loop
diagnostics when the registry marks them as language-level stateful calls.

### Input Extraction

The input pass serialises the literal `inputs` object from the default
`define*` call into the manifest. It recognises `input.int`, `input.float`,
`input.bool`, `input.string`, `input.enum`, `input.color`, `input.source`,
`input.time`, `input.price`, `input.symbol`, `input.interval`, and
`input.externalSeries`. Defaults and descriptor options that become manifest
data MUST be literal. Only one `input.interval` is allowed; its presence sets
the manifest's user-pickable interval flag.

### Requested Intervals

The requested-interval pass extracts static interval ids from
`request.security` and `request.lowerTf`. A string literal contributes one
interval. A reference to an extracted `input.enum` contributes every string
option from that enum. Other expressions are rejected.

### Required Intervals

The required-interval pass extracts `requiresIntervals` from the default
`define*` object. The value MUST be an array literal of string literals. The
compiler unions this set with intervals requested by request primitives and
deduplicates the result for manifest output.

### Capabilities

The capability pass derives the manifest capabilities from the script kind and
from alert calls. Indicator scripts start with `indicators`, drawing scripts
with `drawings`, alert scripts with `alerts`, and alert-condition scripts with
`alertConditions`. A call to the core `alert` primitive adds `alerts`.
Capabilities are deduplicated and sorted.

### Max Lookback

The lookback pass inspects series element access and records the largest
numeric literal index. It recognises direct bar series fields, direct
`ta.*(...)` series results, and variables initialised from `ta.*(...)`.
Non-literal series indices produce a warning and require a 5000-slot dynamic
fallback buffer.

### Alert Conditions

The alert-condition pass extracts the literal condition descriptors declared
by `defineAlertCondition`. Dynamic condition maps, computed ids, non-object
descriptors, and non-string descriptor fields are rejected and omitted from
manifest output.

### Lower-Timeframe Interval Validation

When the compiler is given the target adapter's declared main intervals, the
lower-timeframe pass validates literal `request.lowerTf` intervals against
the smallest parseable main interval. The requested interval MUST be strictly
lower. Interval comparisons use declared second counts when present and
standard chart interval parsing otherwise.

## Callsite Identity

Every stateful call site that allocates runtime state gets a deterministic
slot id:

```txt
<source-path>:<line>:<column>#<call-index>
```

`source-path` is the compiler's source path for the script, `line` and
`column` are one-based positions in the input TypeScript module, and
`call-index` is `0` for hand-authored v1 scripts. The id MUST be a string
literal in emitted JavaScript. Recompiling identical source with the same
source path MUST produce identical ids.

The frozen `apiVersion: 1` stateful registry contains 172 entries. Adding,
removing, or renaming an entry changes which calls receive slot ids and is a
language change; see [Versioning](./versioning.md).

## Not Specified

This grammar does not specify the output bundle format, sourcemap shape,
minifier behavior, generated declaration text, byte ordering of emitted
JavaScript, or private compiler APIs. Those are implementation details. A
conforming implementation is judged by accepted source, rejected source,
diagnostics, manifest semantics, runtime semantics, and the public wire
schemas specified elsewhere in the spec.

## Conformance Checklist

- The compiler accepts a single `.chart.ts` module with exactly one default
  `defineIndicator`, `defineDrawing`, `defineAlert`, or
  `defineAlertCondition` call.
- The first `define*` argument is required to be an object literal containing
  string-literal `name` and numeric-literal `apiVersion: 1`.
- Imports are limited to `@invinite-org/chartlang-core` and
  `@invinite-org/chartlang-core/time`.
- The TypeScript subset above is accepted, and features outside it are not
  required for portable v1 scripts.
- Every diagnostic in the forbidden-constructs table is implemented with the
  exact stable code string shown there.
- Stateful primitive call sites receive deterministic slot ids that are stable
  for identical source and source path.
- Bundle format, sourcemaps, minification, and declaration emit are not used
  as conformance criteria.

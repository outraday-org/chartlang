# Task 9 — Transform: `input.*` primitives

> **Status: TODO**

## Goal

Translate every Pine `input.int` / `input.float` / `input.bool` /
`input.string` / `input.color` / `input.source` / `input.symbol` /
`input.timeframe` / `input.time` / `input.price` call into the
corresponding chartlang `input.*` declaration inside the script
scaffold's `inputs` array. Inputs in chartlang live as a typed `inputs:
{ ... }` field on the `defineIndicator` options object, not as inline
calls — the transform also rewrites every Pine `input(...) → <name>`
declaration site to a chartlang `inputs.<name>` reference inside the
generated `compute` body.

## Prerequisites

Task 8 (declaration scaffold ready).

## Current Behavior

`InputDeclarationIR[]` on the scaffold is empty. Pine `input.*` calls
exist in the annotated AST as `CallExpression` nodes.

## Desired Behavior

A package-internal `transformInputs(analysis: SemanticResult, scaffold:
ScriptScaffold, diagnostics: DiagnosticCollector): void` API in
`src/transform/inputs.ts` mutates `scaffold.inputs` to contain one
`InputDeclarationIR` per Pine `input.*` declaration site, and adds an
entry to `scaffold.identifierRewrites` mapping each Pine input
identifier (e.g. `len` in `len = input.int(20)`) to the chartlang
expression `inputs.len`.

## Requirements

### 1. `InputDeclarationIR` shape (add to `src/transform/ir.ts`)

```ts
export type InputDeclarationIR = Readonly<{
    name: string;             // chartlang field name (Pine identifier, lower-snake-cased to camelCase)
    kind: "int" | "float" | "bool" | "string" | "enum" | "color" | "source" | "time" | "price" | "symbol" | "interval";
    defaultValue: string;     // chartlang TS expression
    titleLiteral: string | null;
    options?: readonly string[];   // for enum
    min?: number;
    max?: number;
    step?: number;
    multiline?: boolean;
    span: SourceSpan;
}>;

export type ScriptScaffold = ... & {
    readonly identifierRewrites: Map<string, string>;
};
```

### 2. Translation rules (lookup via `INPUT_MAP` from Task 6)

For each detected Pine input declaration:

```pinescript
len = input.int(20, title="Length", minval=1, maxval=200, step=1)
src = input.source(close, title="Source")
tf  = input.timeframe("60", title="Higher TF")
```

Emit:

```ts
inputs: {
    len: input.int(20, { title: "Length", min: 1, max: 200, step: 1 }),
    src: input.source("close", { title: "Source" }),
    tf:  input.interval("1h", { title: "Higher TF" }),
}
```

Mapping details:

- Pine `minval` → chartlang `min`, `maxval` → `max`, `step` → `step`.
- Pine `title` → chartlang `title` (literal string required).
- Pine `tooltip`, `group`, `inline`, `confirm` → not modeled; emit
  warning `input-arg-not-mapped` once per occurrence.
- Pine `input.source(close, ...)` → chartlang `input.source("close",
  ...)` (note the literal string conversion). Map `close`→`"close"`,
  `high`→`"high"`, `low`→`"low"`, `open`→`"open"`, `volume`→`"volume"`,
  `hl2`→`"hl2"`, `hlc3`→`"hlc3"`, `ohlc4`→`"ohlc4"`,
  `hlcc4`→`"hlcc4"`. Any other source expression → error
  `non-literal-source-input`.
- Pine `input.timeframe("60")` → chartlang `input.interval("1h")`.
  The conversion `"60"` → `"1h"` lives in
  `src/transform/timeframeConvert.ts` (see §3).
- Pine `input.text_area(...)` → chartlang `input.string(...)` with
  `multiline: true`.
- Pine `input.enum(value, options)` → REJECT for v1 (`input-enum-
  rejected` error; option list is UDT-typed in v6).

### 3. Pine timeframe ↔ chartlang interval string

`src/transform/timeframeConvert.ts` handles bidirectional conversion:

| Pine | chartlang |
|---|---|
| `"1S"` | `"1s"` |
| `"15S"` | `"15s"` |
| `"1"` | `"1m"` |
| `"5"` | `"5m"` |
| `"60"` | `"1h"` |
| `"240"` | `"4h"` |
| `"D"` / `"1D"` | `"1d"` |
| `"W"` / `"1W"` | `"1w"` |
| `"M"` / `"1M"` | `"1M"` |

The helper is also re-used by Task 15 (when MTF `request.security`
gets its v1 partial support).

### 4. Name normalization

Pine identifiers are snake_case by convention; chartlang prefers
camelCase. The transform leaves the identifier as-is if it's already
valid TS (no reserved word collision); if it's a TS reserved word or
contains `$`, prefix with `_`.

### 5. Inline input declarations

Pine permits inline use: `ta.ema(close, input.int(20))`. For v1, the
converter:

1. Detect the inline `input.*` call (not assigned to a name).
2. Synthesize a name (`__input_${counter}` plus the call's slot id).
3. Promote to a top-level input.
4. Replace the inline use with the rewritten `inputs.<name>` reference.

Emit info `inline-input-promoted` per occurrence so the user knows the
promotion happened.

### 6. Default values

Pine input defaults must be compile-time-evaluable in chartlang.
Allowed default forms: literal int/float/string/bool/color, enum
constant (resolves via `ENUM_VALUE_MAP`), the OHLCV identifiers for
`input.source`. Anything else (e.g. `input.int(syminfo.mintick)`) →
error `non-literal-input-default`.

### 7. Tests (§16.3)

| File | Purpose |
|------|---------|
| `inputs.test.ts` | One fixture per input kind (int/float/bool/string/color/source/symbol/timeframe/time/price). |
| `inputs.property.test.ts` | Property: every detected Pine input → exactly one `InputDeclarationIR` + one entry in `identifierRewrites`. |
| `timeframeConvert.test.ts` | Round-trip every entry in the conversion table. |
| `input-rejects.test.ts` | `input.enum`, `non-literal-source-input`, `non-literal-input-default` each emit the right error. |
| `inline-input.test.ts` | Inline `input.int(20)` inside `ta.ema(close, …)` promotes correctly. |

Coverage 100% on `src/transform/inputs.ts`,
`src/transform/timeframeConvert.ts`.

### 8. JSDoc

Every exported function/type carries `@since 0.1`, `@experimental`,
and an `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/inputs.ts` | Create | Input transform. |
| `packages/pine-converter/src/transform/timeframeConvert.ts` | Create | Pine/chartlang interval string conversion. |
| `packages/pine-converter/src/transform/ir.ts` | Modify | Add `InputDeclarationIR` + `identifierRewrites` to scaffold. |
| `packages/pine-converter/src/transform/index.ts` | Modify | Re-export. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Add Task-9 codes. |
| `packages/pine-converter/src/transform/inputs.test.ts` | Create | Per-kind unit tests. |
| `packages/pine-converter/src/transform/inputs.property.test.ts` | Create | Property tests. |
| `packages/pine-converter/src/transform/timeframeConvert.test.ts` | Create | Round-trip tests. |
| `packages/pine-converter/src/transform/input-rejects.test.ts` | Create | Reject tests. |
| `packages/pine-converter/src/transform/inline-input.test.ts` | Create | Inline-input promotion test. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-transform-inputs.md` — patch bump.

## Acceptance Criteria

- `len = input.int(20, title="Length", minval=1)` produces an
  `InputDeclarationIR { name: "len", kind: "int", defaultValue: "20",
  titleLiteral: "Length", min: 1 }` and an entry
  `identifierRewrites.set("len", "inputs.len")`.
- `tf = input.timeframe("60")` produces `kind: "interval",
  defaultValue: '"1h"'`.
- `input.enum(...)` emits `input-enum-rejected` error.
- Inline `ta.ema(close, input.int(20))` promotes the inline call.
- 100% coverage on the listed files.
- JSDoc + lint + typecheck gates green.
- Changeset committed.

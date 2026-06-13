# Task 7 — Compiler: `input.*` extraction + ambient shim updates

> **Status: TODO**

## Goal

Replace the Phase-1 stub in
`packages/compiler/src/analysis/extractInputs.ts` with a real
walker that finds `defineIndicator({ inputs: { key: input.kind
(...) } })` call sites, serialises every descriptor into
`manifest.inputs`, and sets `userPickableInterval: true` when any
`input.interval(...)` is present. Extend the ambient shim in
`packages/compiler/src/program.ts` with the `input.*` / `state.*`
/ `barstate` / `syminfo` / `timeframe` declarations so symbol
resolution matches the new core surface. Wire the result into
`buildManifest`.

## Prerequisites

- Task 6 (the typed adapter-kit `Capabilities` makes the
  downstream `manifest.requestedIntervals` flow well-typed).

## Current Behavior

- `extractInputs()` is a stub returning `{ inputs: {},
  userPickableInterval: false }`.
- The ambient shim in `program.ts` mirrors Phase-1/2/3 core but
  has no `input.*`, `state.*`, `barstate`, `syminfo`,
  `timeframe`, or `request` declarations.
- `buildManifest({ ..., inputs })` accepts the empty record.

## Desired Behavior

- Walking a script's AST, `extractInputs(sourceFile, checker)`
  returns:
  ```ts
  {
      inputs: {
          length: { kind: "int", defaultValue: 14, title: "Length" },
          tf:     { kind: "interval", defaultValue: "chart" },
      },
      userPickableInterval: true,  // because `tf` is an input.interval
  }
  ```
  The descriptor literal is reconstructed from the AST — defaults
  + opts copied verbatim. Frozen on return.
- Unknown `input.kind` calls fail compilation with
  `unknown-input-kind` diagnostic.
- Non-literal default values (e.g.
  `input.int(someVariable)`) fail with
  `input-default-not-literal`.
- Ambient shim mirrors core's `input.*` / `state.*` / `barstate`
  / `syminfo` / `timeframe` / `request.security` exports.
- `compile()` updates `manifest.inputs` + `manifest.
  userPickableInterval` per the extraction.

## Requirements

### 1. `packages/compiler/src/analysis/extractInputs.ts` — real impl

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import { resolveCalleeName } from "../transformers/resolveCallee";

export type ExtractedDescriptor = Readonly<Record<string, unknown>>;

export type ExtractInputsResult = Readonly<{
    inputs: Readonly<Record<string, ExtractedDescriptor>>;
    userPickableInterval: boolean;
}>;

/** Names the walker recognises as `input.*` calls. */
const INPUT_KINDS = new Set([
    "int", "float", "bool", "string", "enum",
    "color", "source", "time", "price", "symbol",
    "interval", "externalSeries",
]);

/** Wire-tag mapping — camelCase builder → kebab-case wire kind. */
const KIND_TO_WIRE: Readonly<Record<string, string>> = Object.freeze({
    int: "int", float: "float", bool: "bool", string: "string",
    enum: "enum", color: "color", source: "source", time: "time",
    price: "price", symbol: "symbol", interval: "interval",
    externalSeries: "external-series",
});

/**
 * Walk a script's AST and serialise every `input.*` call inside
 * `defineIndicator({ inputs: { ... } })` (or `defineAlert` /
 * `defineDrawing`) into the manifest's `inputs` record. PLAN §12.
 *
 * @since 0.4
 * @example
 *     // const r = extractInputs(sourceFile, checker);
 *     // r.inputs.length === { kind: "int", defaultValue: 14, ... }
 *     const fn: typeof extractInputs = extractInputs;
 *     void fn;
 */
export function extractInputs(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
): ExtractInputsResult {
    const inputs: Record<string, ExtractedDescriptor> = {};
    let userPickableInterval = false;

    const visit = (node: ts.Node): void => {
        if (
            ts.isCallExpression(node) &&
            isDefineCall(node, checker)
        ) {
            const inputsObj = readInputsArg(node);
            if (inputsObj !== null) {
                for (const prop of inputsObj.properties) {
                    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
                    const key = prop.name.text;
                    const call = prop.initializer;
                    if (!ts.isCallExpression(call)) continue;
                    const callee = resolveCalleeName(call, checker);
                    // callee = "input.int" / "input.interval" / ...
                    if (callee === null || !callee.startsWith("input.")) continue;
                    const kind = callee.slice("input.".length);
                    if (!INPUT_KINDS.has(kind)) {
                        // unknown-input-kind diagnostic reported by caller
                        continue;
                    }
                    const wireKind = KIND_TO_WIRE[kind] ?? kind;
                    const descriptor = serialiseDescriptor(wireKind, call);
                    inputs[key] = descriptor;
                    if (wireKind === "interval") userPickableInterval = true;
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);

    return Object.freeze({ inputs: Object.freeze(inputs), userPickableInterval });
}

/** Tightly-scoped helpers — see `extractInputs.test.ts` for the full surface. */
function isDefineCall(node: ts.CallExpression, checker: ts.TypeChecker): boolean { /* … */ return false; }
function readInputsArg(node: ts.CallExpression): ts.ObjectLiteralExpression | null { /* … */ return null; }
function serialiseDescriptor(wireKind: string, call: ts.CallExpression): ExtractedDescriptor { /* … */ return Object.freeze({ kind: wireKind }); }
```

`serialiseDescriptor` walks the call args:

- Arg 0 = `defaultValue` literal (number / string / boolean / `as const` array for `enum.options`).
- Arg 1 = `opts` object literal (title / min / max / step / pickFromChart / multiline / options for enum).
- `externalSeries` is a single object arg — destructure
  `{ name, schema, title }`.

Non-literal `defaultValue` adds `input-default-not-literal` to the
compiler's diagnostic list. Unknown `input.kind` adds
`unknown-input-kind`.

### 2. `packages/compiler/src/diagnostics.ts` — new diagnostic codes

Append three codes to the `CompileDiagnosticCode` literal union:

- `"input-default-not-literal"` — message: `"input.{kind}
  default must be a literal (number / string / boolean), not a
  variable reference"`.
- `"unknown-input-kind"` — message: `"input.{kind} is not a
  recognised input builder"`.
- `"multiple-input-interval"` — message: `"Only one
  input.interval() per script (PLAN §4.5)"`. (Edge-case enforcer
  — see Edge Cases below.)

### 3. `packages/compiler/src/program.ts` — ambient shim updates

Append to the `CORE_AMBIENT_SHIM` string the declarations for:

- `input.*` namespace (12 builders) — see Task 1.
- `state.*` + `state.tick.*` (8 builders) — see Task 2.
- `barstate` / `syminfo` / `timeframe` (3 consts) — see Task 3.
- `request.security` + `RequestSecurityOpts` + `SecurityBar` —
  see Task 5.
- `ScriptOverrides` / `ValueFormat` / `ScaleAxis` — see Task 4.

Keep the shim deterministic — declarations land in a stable order
matching the core barrel order. The shim's role is symbol
resolution; runtime bodies are not required (sentinel throws are
fine).

### 4. `packages/compiler/src/manifest.ts` — typed inputs

Tighten the `inputs` parameter from `InputSchema` to
`Readonly<Record<string, Readonly<Record<string, unknown>>>>`
matching `ExtractInputsResult.inputs`. Freeze on the way out
(already does).

### 5. `packages/compiler/src/api.ts` — wire extraction

Find the `buildManifest({ ..., inputs: {}, userPickableInterval:
false })` call (Phase-1 stub). Replace with the live extraction
result from `extractInputs(sourceFile, checker)`.

### 6. Tests

- **`extractInputs.test.ts`** — replace the stub test. Add
  golden-input fixtures for each of the 12 builders:
  ```ts
  const src = `
      import { defineIndicator, input } from "@invinite-org/chartlang-core";
      export default defineIndicator({
          name: "x", apiVersion: 1,
          inputs: { len: input.int(14, { title: "Length" }) },
          compute() {},
      });
  `;
  const r = run(src);
  expect(r.inputs.len).toEqual({ kind: "int", defaultValue: 14, title: "Length" });
  ```
  Cover negative paths (non-literal default; unknown
  `input.foo` call; missing `defineIndicator` outer call).
- **`extractInputs.property.test.ts`** — fast-check property:
  every random `input.int(N, { min: A, max: B })` round-trips
  through `extractInputs` losslessly.
- **`program.test.ts`** — extend with assertions that the ambient
  shim resolves `input.int(0)`, `state.float(0)`,
  `barstate.isfirst`, `syminfo.mintick`, `timeframe.isdaily`,
  `request.security({ interval: "1D" })` without errors.
- **`api.test.ts`** — extend the existing compile fixture coverage
  (`transformAndAnalyse(...)`) to walk a script with inputs and
  verify `manifest.inputs` shape + `manifest.userPickableInterval`.

### 7. JSDoc gate

`extractInputs` carries an `@example` showing the descriptor
shape; the ambient shim block is internal-only (no JSDoc gate
requirement).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/analysis/extractInputs.ts` | Replace | Real AST walker |
| `packages/compiler/src/analysis/extractInputs.test.ts` | Replace | Per-builder coverage |
| `packages/compiler/src/analysis/extractInputs.property.test.ts` | Create | fast-check round-trip |
| `packages/compiler/src/program.ts` | Modify | Append shim declarations |
| `packages/compiler/src/program.test.ts` | Modify | Resolve new symbols |
| `packages/compiler/src/diagnostics.ts` | Modify | Add 3 codes |
| `packages/compiler/src/diagnostics.test.ts` | Modify | Cover new codes |
| `packages/compiler/src/manifest.ts` | Modify | Tighten `inputs` param type |
| `packages/compiler/src/manifest.test.ts` | Modify | Verify typed pass-through |
| `packages/compiler/src/api.ts` | Modify | Wire `extractInputs` into `transformAndAnalyse` |
| `packages/compiler/src/api.test.ts` | Modify | Verify manifest extraction end-to-end |

## Edge Cases

- **`input.*` calls outside `defineIndicator({ inputs: { ... } })`
  are ignored** — e.g. a script that hands `input.int(20)` into
  a helper is not surfaced in the manifest. This matches Pine
  semantics; the editor warns separately.
- **`input.interval` only counts when nested in `inputs:`** — a
  bare `input.interval("1D")` inside `compute()` does not set
  `userPickableInterval`.
- **Multiple `input.interval` calls fail compile** —
  PLAN §4.5 says "Only one `input.interval()` per script." Add
  `multiple-input-interval` diagnostic in this task; verify
  in tests.
- **`enum` options must be an `as const` array of strings** —
  fail with `input-default-not-literal` when not.
- **`externalSeries` is shape-only in Phase 4** — the `schema`
  argument is a `Schema<T>` opaque token; the walker passes
  through the AST shape (name + the schema reference is left
  as `{ kind: "external-series-schema" }`).
- **Determinism** — descriptor keys land in source-order (the
  same order the script declares them). Freeze ordering for
  byte-identical manifest output across runs (`pnpm
  compile.bench` golden invariant).

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`
  (`@invinite-org/chartlang-compiler` 100% coverage),
  `pnpm docs:check`, `pnpm readme:check`,
  `pnpm bench:ci` (compile bench threshold).

## Changeset

`.changeset/phase-4-task-07-compiler-inputs-extraction.md` —
**minor** on `@invinite-org/chartlang-compiler`. Adds 3 new
diagnostic codes + real extraction; manifest shape is unchanged.

## Acceptance Criteria

- `extractInputs(src, checker)` returns the descriptor + the
  `userPickableInterval` flag.
- Negative paths emit the documented diagnostics.
- Ambient shim resolves `input.*`, `state.*`, `barstate`,
  `syminfo`, `timeframe`, `request.security` without errors.
- `compile(src)` produces a manifest whose `inputs` matches the
  script's declaration.
- Property test passes 100 generated inputs.
- 100% coverage on touched files.
- Phase-1/2/3 example scripts still compile end-to-end.
- Changeset committed.

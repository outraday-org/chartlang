# Task 8 — Compiler: `request.security` literal-only pass + `STATEFUL_PRIMITIVES` additions

> **Status: TODO**

## Goal

Land the §5.6 literal-only enforcement pass for
`request.security({ interval })` and the `manifest.
requestedIntervals` extraction. Union the extracted set with the
author-declared `requiresIntervals` from
`defineIndicator`. Append the `request.security` and the 8
`state.*`/`state.tick.*` entries to `STATEFUL_PRIMITIVES` so
their callsite-id injection rides the existing transformer (the
cardinality goes **162 → 163**). Update the ambient shim's
`STATEFUL_PRIMITIVES` mirror in lockstep.

## Prerequisites

- Task 7 (compiler ambient shim already extended with `request`
  + `state.*`; this task wires the analysis passes that consume
  them).

## Current Behavior

- `STATEFUL_PRIMITIVES` cardinality is **162** after Task 2.
- `packages/compiler/src/diagnostics.ts` already declares
  `"request-security-interval-not-literal"` in the
  `CompileDiagnosticCode` union (added pre-emptively in Phase 1).
  No code path emits it yet — Task 8 wires the §5.6 walker that
  produces it.
- `extractCapabilities` walks for `alert(...)` calls only.
- `manifest.requestedIntervals` is always `[]`.

## Desired Behavior

- `STATEFUL_PRIMITIVES.size === 163`. Test asserts cardinality
  + presence of every new name.
- `extractRequestedIntervals(sourceFile, checker)` returns the
  deduped + sorted set of literal `interval` arguments from
  every `request.security({ interval: "1D" })` call site in the
  script. Non-literal arguments emit
  `request-security-interval-not-literal`.
- Author-declared `requiresIntervals` from `defineIndicator`
  unions into the extracted set; the union populates
  `manifest.requestedIntervals`.
- `state.*`/`state.tick.*` and `request.security` callsites get
  slot-id injection via the existing
  `transformers/callsiteIdInjection.ts` (no new transformer).
- `analysis/statefulCallInLoop.ts` flags `state.*` calls in
  loop bodies with the existing `stateful-call-inside-loop`
  diagnostic; `request.security` is similarly flagged.
- The compiler's `manifest.userPickableInterval` from Task 7 +
  the new `requestedIntervals` from this task end up in the
  final `ScriptManifest`.

## Requirements

### 1. `packages/core/src/statefulPrimitives.ts` — append 1 entry

Append:

```ts
    { name: "request.security", slot: true },
```

Bump the cardinality assertion in
`statefulPrimitives.test.ts` from **162** (Task 2's bump) to
**163**. The `slot: true / false` breakdown becomes **162
`slot: true` + 1 `slot: false`** (`ta.nz` is still the only
`slot: false` entry).

### 2. `packages/compiler/src/program.ts` — shim mirror

The compiler's ambient shim carries an inline `STATEFUL_PRIMITIVES`
mirror (referenced by `callsiteIdInjection` for symbol lookups
during AST walk). Append the 9 new entries (8 `state.*` from Task
2 + 1 `request.security`) to keep the shim in lockstep with core.

### 3. `packages/compiler/src/analysis/extractRequestedIntervals.ts` — new

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import { resolveCalleeName } from "../transformers/resolveCallee";

/**
 * Walk a script's AST and collect every literal `interval`
 * argument to `request.security({ interval: "…" })`. PLAN §5.6.
 *
 * Non-literal arguments (variable refs, template strings,
 * computed property names) emit
 * `request-security-interval-not-literal` and are excluded from
 * the returned set.
 *
 * @since 0.4
 * @example
 *     // const intervals = extractRequestedIntervals(sf, checker);
 *     // intervals === ["1D", "5m"]
 *     const fn: typeof extractRequestedIntervals = extractRequestedIntervals;
 *     void fn;
 */
export function extractRequestedIntervals(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    diagnostics: ts.Diagnostic[],
): ReadonlyArray<string> {
    const set = new Set<string>();
    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            const callee = resolveCalleeName(node, checker);
            if (callee === "request.security") {
                const arg = node.arguments[0];
                if (arg && ts.isObjectLiteralExpression(arg)) {
                    const intervalProp = arg.properties
                        .filter(ts.isPropertyAssignment)
                        .find((p) => ts.isIdentifier(p.name) && p.name.text === "interval");
                    if (intervalProp && ts.isStringLiteral(intervalProp.initializer)) {
                        set.add(intervalProp.initializer.text);
                    } else if (intervalProp) {
                        // Non-literal interval — push diagnostic
                        // implementation: use diagnostics.push(...) with
                        // category Error + code "request-security-interval-not-literal"
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
    return Object.freeze(Array.from(set).sort());
}
```

### 4. `packages/compiler/src/analysis/extractRequiresIntervals.ts` — new

Walk the `defineIndicator({ requiresIntervals: ["1D", "1W"] })`
opt and return the static array. Non-literal entries fail with
`requires-intervals-not-literal`.

### 5. `packages/compiler/src/api.ts` — wire union

```ts
const fromRequest = extractRequestedIntervals(sf, checker, diagnostics);
const fromRequires = extractRequiresIntervals(sf, checker, diagnostics);
const union = Array.from(new Set([...fromRequest, ...fromRequires])).sort();
const manifest = buildManifest({
    ...,
    requestedIntervals: union,
    requiresIntervals: fromRequires.length > 0 ? fromRequires : undefined,
    userPickableInterval: extractedInputs.userPickableInterval,
    ...
});
```

`ScriptManifest.requiresIntervals` lands here (Task 4 declared
the field).

### 6. `packages/compiler/src/diagnostics.ts` — new code

`"request-security-interval-not-literal"` is **already** declared
in `CompileDiagnosticCode` — verify the message text matches
`"request.security({ interval }) must be a string literal or
input.enum value"` and adjust if not.

Append one new code:

- `"requires-intervals-not-literal"` — message:
  `"defineIndicator({ requiresIntervals }) must be a static
  string-literal array"`.

### 7. `packages/compiler/src/analysis/statefulCallInLoop.ts` — extend

The existing pass walks every `STATEFUL_PRIMITIVES` entry. With
Tasks 2 + 8 the set now includes `state.*` + `request.security`
— no code change needed; the test fixture grows. Add unit tests
that a `state.float(0)` inside a `for` loop fires
`stateful-call-inside-loop`, same for `request.security`.

### 8. `packages/compiler/src/transformers/callsiteIdInjection.ts` — coverage extend

The existing transformer already injects slot ids for every
`STATEFUL_PRIMITIVES` entry. Tasks 2 + 8 expand the set; the
transformer needs no behavioural change. Extend its tests:

- A `state.float(0)` call site gets a slot id injected as arg 0.
- A `request.security({ interval: "1D" })` call site gets a slot
  id injected as arg 0; the existing opts argument shifts to arg
  1. Verify the injection preserves the structural-clone path.

### 9. Tests

- **`extractRequestedIntervals.test.ts`** — three fixtures: one
  with two distinct intervals; one with a dynamic interval
  (verify diagnostic); one with no `request.security` calls.
- **`extractRequiresIntervals.test.ts`** — one fixture with the
  `requiresIntervals` opt; one with a non-literal entry.
- **`statefulCallInLoop.test.ts`** — extend with `state.float`
  + `request.security` in-loop cases.
- **`callsiteIdInjection.test.ts`** — extend with `state.float`
  + `request.security` injection verification.
- **`statefulPrimitives.test.ts`** (core) — cardinality 162 →
  **163**; `STATEFUL_PRIMITIVES_BY_NAME.get("request.security")?.
  slot === true`.
- **`api.test.ts`** — extend with a fixture exercising the
  request.security union path; assert `manifest.requestedIntervals
  === ["1D", "5m"]` (sorted).
- **`program.test.ts`** — verify shim mirror cardinality matches
  core (`mirror.size === 163`).

### 10. JSDoc gate

`extractRequestedIntervals` + `extractRequiresIntervals` carry
JSDoc with `@since 0.4` + compileable `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/statefulPrimitives.ts` | Modify | Append 1 entry (`request.security`) |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality 162 → 163 |
| `packages/compiler/src/program.ts` | Modify | Shim mirror appends 9 entries |
| `packages/compiler/src/program.test.ts` | Modify | Shim cardinality test |
| `packages/compiler/src/analysis/extractRequestedIntervals.ts` | Create | §5.6 literal-only walker |
| `packages/compiler/src/analysis/extractRequestedIntervals.test.ts` | Create | Unit tests |
| `packages/compiler/src/analysis/extractRequiresIntervals.ts` | Create | `requiresIntervals` opt walker |
| `packages/compiler/src/analysis/extractRequiresIntervals.test.ts` | Create | Unit tests |
| `packages/compiler/src/analysis/statefulCallInLoop.test.ts` | Modify | Cover new entries |
| `packages/compiler/src/transformers/callsiteIdInjection.test.ts` | Modify | Cover new injection sites |
| `packages/compiler/src/api.ts` | Modify | Wire union into manifest |
| `packages/compiler/src/api.test.ts` | Modify | Cover union path |
| `packages/compiler/src/diagnostics.ts` | Modify | Add `requires-intervals-not-literal`; verify message text on existing `request-security-interval-not-literal` |
| `packages/compiler/src/diagnostics.test.ts` | Modify | Cover both codes |

## Edge Cases

- **Empty `requestedIntervals` is `[]`**, never `null` —
  downstream JSON serialisers prefer the empty array.
- **`input.interval` does NOT contribute to
  `requestedIntervals`** — that's a user-pickable main timeframe,
  not a script-author-locked secondary stream. Only
  `request.security` interval literals + `requiresIntervals` opt
  contribute.
- **Sort + dedup** — the union is sorted lexicographically (NOT
  by `IntervalDescriptor` ordering, since the compiler doesn't
  see the adapter's intervals at compile time). The runtime
  re-sorts by descriptor ordering for the editor's picker.
- **Slot-id injection on `request.security`** — the injected slot
  id is the slotId of the call site. The runtime uses it to key
  the secondary-stream ring buffer in Task 11. Verify the
  manifest's `seriesCapacities` enumerates the slot-id (existing
  Phase-1 `extractMaxLookback` already handles this kind of
  injection).
- **`state.float(0)` inside an `if` branch** is fine —
  `statefulCallInLoop` only flags `for` / `while` / `do` /
  array-method bodies, not conditional. Existing pass covers
  this distinction.
- **Determinism** — `requestedIntervals` is sorted; same script
  produces byte-identical manifest output across compiles.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`,
  `pnpm readme:check`, `pnpm bench:ci`.

## Changeset

`.changeset/phase-4-task-08-compiler-request-security-pass.md` —
**minor** on `@invinite-org/chartlang-compiler` + `@invinite-org/
chartlang-core` (cardinality bump). Adds 1 new diagnostic code
(`requires-intervals-not-literal`); wires emission for the
pre-declared `request-security-interval-not-literal`.

## Acceptance Criteria

- `STATEFUL_PRIMITIVES.size === 163`.
- `state.*` + `request.security` call sites get slot ids
  injected.
- `extractRequestedIntervals` extracts the literal set + fires
  the diagnostic for dynamic args.
- `manifest.requestedIntervals` carries the union; sorted +
  deduped.
- 100% coverage on touched files.
- Phase-1/2/3 example scripts still compile end-to-end.
- `pnpm bench:ci` thresholds hold (compile time unaffected).
- Changeset committed.

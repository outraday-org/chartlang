# Task 1 — Parse `break`/`continue`, no-unroll loops, fix loop-body `+=`

> **Status: TODO**

## Goal

Make `for` loops that contain `break`/`continue` lower to a **real bounded
chartlang `for`** (never unrolled), guard a `break`/`continue` outside any loop,
add compound-assignment (`+=`/`-=`/`*=`/`/=`) parsing + lowering, and resolve the
runtime-indexed series read (`ma_slope[i]`) so `MASM_Strat.md`'s consolidation
loop converts to compiling chartlang instead of silent, invalid output.
(`break`/`continue` are already lexed/parsed/emitted — the work is the loop
**policy**, the out-of-loop guard, and compound-assign.)

## Prerequisites

- None hard. Pairs with **T9** (MASM's loop body uses multi-line conditions).

## Current Behavior

Pine:
```pine
consol_count = 0
for i = 0 to consol_tolerance
    if (ma_slope[i] > consol_range_adj) or (ma_slope[i] < -consol_range_adj)
        consol_count := 0
        break
    consol_count += 1
```
converts to invalid, **silent** (no diagnostic) output: the loop is **unrolled**
(frozen at the `input.int` default), so `break` lands at top level (a JS syntax
error) and `+=` is mangled:

```ts
if ((ms[0] > 1) || (ms[0] < (-1))) { cc = 0; break; }   // break NOT in a loop
cc + (undefined);                                         // `cc += 1` mangled
1;
if ((ms[1] > 1) || (ms[1] < (-1))) { cc = 0; break; }
...
```

- Loop policy: `src/transform/other.ts` (`emitFor`) + `controlFlow.ts` decide
  unroll-vs-runtime-`for`; an `input.int`/non-literal bound **unrolls** (the
  stateful-vs-non-stateful split, `loop-unroll-frozen-at-input-default`).
- `break`/`continue` ARE already lexed (`src/lexer/keywords.ts`), parsed
  (`src/parser/statements.ts` → `BreakStatement`/`ContinueStatement` AST nodes),
  and emitted natively as JS `break;`/`continue;` inside a runtime `for`
  (`src/transform/other.ts`). The bug is purely the loop **policy**: the
  classifier (`statementHasStatefulPrimitive`/`bodyHasStatefulPrimitive` in
  `controlFlow.ts`) ignores `break`/`continue` (its `default` arm swallows
  them), so an `input.int`-bound loop still **unrolls** and the `break` lands at
  top level (a JS syntax error).
- Compound assignment (`+=`, `-=`, …) is **not parsed at all**: the AST
  `AssignmentOperator` (`src/ast/statements.ts`) is only `"=" | ":="`, so
  `consol_count += 1` is mis-tokenized/mis-parsed (hence the `cc + (undefined);
  1;` evidence). Compound-assign must be added end-to-end (lexer token + AST +
  parser + emit), not patched as a lowering bug.
- `ma_slope[i]` (runtime loop index) would hit
  `pine-converter/transform/dynamic-series-index` (error) under a runtime `for`
  (`src/transform/exprEmit.ts`).

## Desired Behavior

```ts
// real bounded for, break preserved, += correct
let cc = 0;
for (let i = 0; i <= /*bound*/; i++) {
    if ((ms[i] > top) || (ms[i] < (-top))) { cc = 0; break; }
    cc += 1;
}
```

`break`/`continue` stay inside the emitted loop; `ms[i]` is a legal indexed
`Series` read; the bound is a compile-time integer (or a documented runtime
form).

## Requirements

### 1. `break` / `continue` parsing — ALREADY PRESENT; add the outside-loop guard

- `break`/`continue` are already lexed (`src/lexer/keywords.ts`), parsed to
  `BreakStatement`/`ContinueStatement` AST nodes (`src/parser/statements.ts`),
  and emitted natively. Do **not** re-add the keyword/parse/emit path — verify
  it with a test.
- The only parse/transform gap: a `break`/`continue` OUTSIDE any loop must raise
  a diagnostic (APPEND `break-continue-outside-loop`, error) rather than emit a
  stray JS `break;`. Loop nesting is known at transform time, so detect it there.

### 2. No-unroll when the body contains `break`/`continue` (`src/transform/other.ts` `emitFor`, `controlFlow.ts`)

- **Detection point:** extend the loop-policy classifier in `controlFlow.ts` —
  today `statementHasStatefulPrimitive`'s `default` arm silently returns `false`
  for `break-statement`/`continue-statement`, so the policy never sees them. Add
  an explicit `break`/`continue` body-walk (recurse through nested
  `if`/`for`/`switch`/`block`, mirroring `bodyHasStatefulPrimitive`'s shape) as a
  SEPARATE signal — it must force the **no-unroll / runtime-`for`** path, NOT be
  folded into the stateful signal (stateful forces *unroll*, which is the exact
  opposite of what `break` needs).
- When `break`/`continue` is present, **force the runtime-`for` path** and never
  unroll — unrolling cannot express `break`. Emit the chartlang
  `for (let i = a; i <= b; i++) { … }` with the `break`/`continue` lowered to JS
  `break;`/`continue;`.
- A stateful-primitive body (`ta.*`/`draw.*`/`plot`) **with** `break`/`continue`
  cannot be a runtime `for` (chartlang forbids stateful calls in loops) **and**
  cannot unroll (break) — emit a hard **reject** (APPEND `stateful-loop-with-break`,
  error). MASM's body is non-stateful, so the common path is the runtime `for`.

### 3. Bound resolution

- Resolve the `to` bound to a compile-time integer via the existing
  `resolveBound` (literal / unary-literal / `input.int` default). An
  `input.int`-derived bound keeps the established
  `loop-unroll-frozen-at-input-default` semantics — but since this is a runtime
  `for` (not an unroll), document the chosen behavior: either inline the frozen
  default as the literal bound, or (if chartlang permits a const-bound runtime
  `for`) bind it. A non-resolvable bound on a break-loop → reject (reuse
  `loop-bounds-not-literal-for-stateful-body` or APPEND a break-specific code).
- Honor Pine's inclusive `to` and the ascending/descending direction +
  `by`-magnitude rules already implemented for `emitFor`.

### 4. Add compound assignment `+=` `-=` `*=` `/=` (lexer + AST + parser + emit)

- Compound assignment is NOT parsed today (`AssignmentOperator` is only
  `"=" | ":="`). Add it end-to-end:
  - **Lexer** (`src/lexer/`): emit the `+=`/`-=`/`*=`/`/=` operator tokens
    (a two-char operator scan, distinct from a `+`/`-`/`*`/`/` followed by `=`).
  - **AST** (`src/ast/statements.ts`): widen `AssignmentOperator` to
    `"=" | ":=" | "+=" | "-=" | "*=" | "/="`.
  - **Parser** (`src/parser/statements.ts`): `parseAssignment` recognises the
    compound operators (widen its `operatorText` accordingly; it already
    consumes both the name and the operator).
  - **Emit** (`src/transform/other.ts` `emitAssignment`): a `state.*` scalar
    slot → `<slot>.value += <rhs>;`; a series slot / plain local → `<name> +=
    <rhs>;`. `substituteIterator` (`controlFlow.ts`) must pass a compound-assign
    statement through unchanged in the unroll path.
- Works at top level AND inside loop bodies — add a non-loop regression too.
  (`consol_count += 1` currently mangles to `cc + (undefined); 1;`.)

### 5. Runtime series index `ma_slope[i]` (`src/transform/exprEmit.ts`)

- Inside a runtime `for`, a series indexed by the loop variable (`ms[i]`) must
  emit a **legal chartlang indexed read** (chartlang `Series`/`state.series`
  support `[n]` history reads). Decide the rule:
  - if the indexed receiver is a `Series`/`state.series`/`bar.*` series, emit
    `receiver[i]` (no `dynamic-series-index`), since a runtime offset is a valid
    history read;
  - otherwise keep `dynamic-series-index`.
  Document this in the loop-policy invariant — it is the crux that lets a
  break-loop be a runtime `for` rather than forcing an (impossible) unroll.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/lexer/` (`lex.ts`/`tokens.ts`) | Modify | Add `+=`/`-=`/`*=`/`/=` operator tokens. |
| `packages/pine-converter/src/ast/statements.ts` | Modify | Widen `AssignmentOperator` to include `+=`/`-=`/`*=`/`/=`. |
| `packages/pine-converter/src/parser/statements.ts` | Modify | `parseAssignment` accepts compound operators; verify `break`/`continue` parse (already present). |
| `packages/pine-converter/src/transform/other.ts` | Modify | `emitFor` no-unroll-with-break; `emitAssignment` compound-assign lowering. |
| `packages/pine-converter/src/transform/controlFlow.ts` | Modify | break/continue body-walk forcing no-unroll; `substituteIterator` passes compound-assign through. |
| `packages/pine-converter/src/transform/exprEmit.ts` | Modify | Runtime `[i]` series read rule. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | APPEND `break-continue-outside-loop` + `stateful-loop-with-break` codes. |
| `packages/pine-converter/src/transform/*.test.ts` + `src/parser/*.test.ts` | Modify | Unit + synthetic-AST coverage. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**)
- `pnpm docs:check`

## Changeset

Covered by the T10 feature changeset created in Task 2
(`@invinite-org/chartlang-pine-converter`, minor).

## Acceptance Criteria

- A `for` loop with `break`/`continue` lowers to a runtime chartlang `for` with
  the `break`/`continue` **inside** it; never at top level.
- `consol_count += 1` lowers to a single correct compound assignment.
- `ma_slope[i]` emits a legal indexed `Series` read inside the loop.
- A stateful body with `break` is a clear reject; converter tests green at 100%.

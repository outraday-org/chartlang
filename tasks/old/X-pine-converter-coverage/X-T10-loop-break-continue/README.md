# T10 — Converter: loop `break` / `continue` + loop-body compound assignment

## Overview

Support `break`/`continue` inside Pine `for` loops, and fix compound
assignment (`+=`) inside loop bodies. `MASM_Strat.md`'s consolidation counter
is the reference:

```pine
consol_count = 0
for i = 0 to consol_tolerance
    if (ma_slope[i] > consol_range_adj) or (ma_slope[i] < -consol_range_adj)
        consol_count := 0
        break
    consol_count += 1
```

Today this produces invalid, non-compiling output **with no diagnostic**.

## Current State (evidence — ran built converter)

The loop is **unrolled** (frozen at the `input.int` default), emitting `break`
statements at top level (a JS syntax error — `break` outside a loop) and
mangling `+=`:

```ts
if ((ms[0] > 1) || (ms[0] < (-1))) { cc = 0; break; }   // break NOT in a loop
cc + (undefined);                                         // `cc += 1` mangled
1;
if ((ms[1] > 1) || (ms[1] < (-1))) { cc = 0; break; }
cc + (undefined);
1;
...
```

Root causes:
- Loop policy (`src/transform/other.ts` `emitFor`, `controlFlow.ts`) **unrolls**
  input-bound / non-literal-bound loops. Unrolling a body containing `break`
  is invalid — `break` can't span unrolled iterations. `break`/`continue` are
  already lexed/parsed/emitted, but the loop-policy classifier
  (`statementHasStatefulPrimitive`'s `default` arm) ignores them, so the unroll
  still fires.
- Compound assignment (`+=`/`-=`/`*=`/`/=`) is **not parsed at all** — the AST
  `AssignmentOperator` is only `"=" | ":="`, so `consol_count += 1` mangles to
  `cc + (undefined); 1;`. It must be added end-to-end (lexer + AST + parser +
  emit).
- `ma_slope[i]` is a runtime-indexed series read (the loop index `i`); under a
  real runtime loop this hits the converter's `dynamic-series-index` (error).

## Target State

- `break` / `continue` parse and lower into a chartlang `for` loop.
- A loop body containing `break`/`continue` is emitted as a **real bounded
  `for`** (never unrolled); the bound resolves to a compile-time integer
  (literal, unary-literal, or `input.int` default — with the existing
  `loop-unroll-frozen-at-input-default` semantics for the latter, or a runtime
  bound where chartlang permits).
- Compound assignment (`+=`, `-=`, `*=`, …) lowers correctly inside loop
  bodies.
- Runtime series indexing `ma_slope[i]` inside the loop is handled — either
  via a chartlang-legal indexed read or a documented constraint/diagnostic.

## Architecture Decisions (to finalize in step 2)

| Decision | Notes |
|----------|-------|
| No-unroll-with-`break` | The presence of `break`/`continue` forces the **runtime-`for`** path, overriding the stateful/non-stateful unroll heuristic. The body here is non-stateful (comparisons + scalar assigns), so a runtime `for` is legal in chartlang. |
| Bound resolution | MASM's bound is `consol_tolerance` (an `input.int`). chartlang forbids non-literal runtime-`for` bounds — so either freeze at the input default (consistent with current loop policy + warn) or require a literal. Decide and document. |
| `ma_slope[i]` runtime index | A series indexed by the loop variable. Determine the chartlang-legal form (indexed `Series` read) vs. emitting `dynamic-series-index`. If runtime indexing is unsupported, the loop must unroll — which conflicts with `break`. Resolve this tension explicitly (it is the crux of this task). |
| `+=` compound-assign | NOT parsed today — add end-to-end (lexer `+=`/`-=`/`*=`/`/=` tokens, widen `AssignmentOperator`, `parseAssignment`, `emitAssignment`). Works top-level + in loop bodies; add a non-loop regression. |
| `continue` | Maps to JS `continue`; ensure it interacts correctly with the bound + body. |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| Loop lowering / unroll policy | `src/transform/other.ts` (`emitFor`), `controlFlow.ts` | Add the no-unroll-with-break path. |
| Statement parsing | `src/parser/statements.ts` | `break`/`continue` already parsed — verify + add out-of-loop guard; widen `parseAssignment` for compound ops. |
| Assignment lowering | `src/transform/other.ts` (`emitAssignment`) | Add compound-assign (`+=` etc.) lowering for slots + locals. |
| Dynamic series index diagnostic | `src/transform/exprEmit.ts` (`dynamic-series-index`) | Runtime `[i]` handling. |

## Dependencies

- None hard. General-purpose (any looping script). Sequence early with T9.

## Dependency Graph

```
Task 1 (parse break/continue + no-unroll loop lowering + += fix + runtime index)
  |
  v
Task 2 (fixtures + compile round-trip + docs/CLAUDE loop policy)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Parse `break`/`continue`, no-unroll loops, fix `+=`](./1-break-continue-and-loop-lowering.md) | pine-converter | None | High |
| 2 | [Fixtures, compile round-trip, docs/CLAUDE](./2-fixtures-docs.md) | pine-converter, docs | 1 | Low |

## Acceptance Criteria

- MASM's `consol_count` loop converts to a compiling chartlang `for` with a
  working `break` and `consol_count += 1`.
- No `break`/`continue` is ever emitted outside a loop.

## Sizing note

Task 1 now spans lexer + AST + parser + transform across **two** features
(the break/continue loop policy AND compound-assign). It is borderline-large
but the two are tightly coupled through `emitFor`/`emitAssignment` and one
fixture set, so it stays one task. If it grows past ~400 lines during
implementation, split compound-assign into its own task ahead of the loop work.

## Deferred / Follow-Up

- `while` loops (forbidden by chartlang; stays rejected).
- Stateful-primitive bodies with `break`/`continue` (a `ta.*`/`draw.*` inside a
  break-loop) — hard reject via `stateful-loop-with-break`; document the
  boundary.

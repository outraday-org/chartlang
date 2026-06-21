# T1 — Converter: user-defined function declarations

## Overview

Teach the converter to translate Pine **user-defined function declarations**
— both single-line (`f(a, b) => expr`) and multi-line (indented body with an
implicit last-expression return) — into chartlang. This is the **#1 blocker**
for Trend Wizard, which is built out of ~12 helpers (`cf_slope`, `cf_dist`,
`cf_ma`, `cf_macross`, `cf_atr_perct`, `cf_limit`, `cf_tab_tover`,
`cf_tab_cross`, `cf_tab_madist`, `get_dynamic_color`, `format_trend_text`).

The hard part is **not** parsing — it's **state semantics**. chartlang keys
every `ta.*`/`state` slot by **lexical source position**
(`<sourcePath>:<line>:<col>#<callIndex>`, `callsiteIdFor` in
`packages/compiler/src/callsiteIdInjection.ts`). A stateful helper emitted
once and called N times would make every call share **one** slot — Pine
instead instantiates an independent series per call site. So a stateful UDF
called from multiple sites must be **inlined per call site**, not reused.

## Current State (evidence — ran built converter)

Pine `cf_slope(ma, n) => ta.ema(((ma - ma[1]) / ma[1] * 100), n)` then
`s = cf_slope(e, 2)` produces:

```ts
compute({ bar, ta, plot }) {
    cf_slope(ma, n);                       // decl mis-parsed as a call
    undefined;                             // the `=> body` dropped
    ta.ema((((ma - ma[1]) / ma[1]) * 100), n).current;  // body leaked top-level
    let e = ta.ema(bar.close, 8).current;
    let s = cf_slope(e, 2);                // references undefined cf_slope
}
```

→ 8× `pine-converter/semantic/unknown-identifier`. Multi-line bodies add
`pine-converter/parse/unexpected-token`. **Total failure.**

- No "function declaration" statement form exists in the parser
  (`src/parser/statements.ts` has no `name(params) => body` recognizer).
- `LambdaExpression` parses (`src/parser/expressions.ts:141`,
  `parseParenOrTupleOrLambda`) but only when a line **starts** with `(`; a
  Pine decl starts with the function name, so it parses as a call.
- No fixture anywhere defines a Pine `=>` function (confirmed by grep over
  `packages/pine-converter/fixtures/*.pine`).

## Target State

- Parse Pine top-level function declarations (single- + multi-line) into a
  new AST node (e.g. `FunctionDeclaration { name, params, body }`).
- Semantic pass records each UDF symbol, its params, and whether its body
  (transitively) contains a **stateful primitive** (`ta.*`, `state.*`,
  `plot/hline/alert`, `draw.*`) — reuse `expressionHasStatefulPrimitive` /
  `bodyHasStatefulPrimitive` from `src/transform/other.ts`.
- **Pure** UDF → emit a reusable chartlang function
  (`const cf_limit = (v, hi, lo) => Math.max(Math.min(v, hi), lo);`) at the
  top of `compute`, before first use.
- **Stateful** UDF → **inline-expand** the body at each call site, substituting
  argument expressions for params (so each `ta.*` becomes a distinct lexical
  slot). Apply the T2 nested-`.current` rule to the inlined body.
- Multi-line bodies: last expression is the return value; intermediate
  `x = …` lines become local `let`/`const` (or inlined temporaries).
- Convert Trend Wizard's helpers end-to-end (the acceptance script).

## Architecture Decisions (to finalize in step 2)

| Decision | Notes |
|----------|-------|
| Inline vs. reuse keyed on **statefulness**, not always-inline | Pure helpers stay readable functions; only stateful ones inline. Confirm the stateful-primitive detector covers transitive UDF→UDF calls (e.g. a pure helper that calls a stateful one becomes stateful). |
| Per-call-site slot isolation via inlining (converter-only) vs. a compiler "call-path slot" feature | Inlining is self-contained in the converter and needs **no** core/compiler change. A compiler-level per-call-path slot id would let stateful UDFs stay real functions but is a much larger, cross-package change. **Default: inlining.** Record the trade-off; only escalate to compiler work if inlining proves intractable for recursion/large bodies. |
| Argument capture | Substitute arg expressions textually with parenthesization; beware re-evaluating an arg with side effects / its own `ta.*` more than once (Pine evaluates args once). May need to hoist args to temps before inlining. |
| Name collisions | Route all synthesized locals through the existing `NameAllocator` (`src/transform/nameAllocator.ts`) — no `__` prefixes (repo invariant). |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| Stateful-primitive detector | `src/transform/other.ts` (`expressionHasStatefulPrimitive`, `bodyHasStatefulPrimitive`) | Decide inline vs. reuse. |
| Iterator/value substitution | `src/transform/controlFlow.ts` (`substituteIterator`, exported) | Template for param→arg substitution into a body. |
| `.current` lowering | `src/transform/other.ts` (`emitTa`/`emitSpecialCall`) + **T2** | Lower `ta.*` inside inlined bodies. |
| Name allocator | `src/transform/nameAllocator.ts` | Synthesized local names. |
| Lambda parse | `src/parser/expressions.ts:141` | Reference for params/body parsing. |
| Slot-id format (why inlining is needed) | `packages/compiler/CLAUDE.md` §"Callsite-id format" | Design rationale. |

## Dependencies

- Tight coupling with **T2** (inlined bodies are full of nested `ta.*`).
  Land T2's lowering first or together.

## Dependency Graph

```
Task 1 (parser + AST: name(params) => single/multi-line decls)
  |
  v
Task 2 (semantic: UDF symbols + transitive statefulness + recursion reject)
  |
  +-----------------------------+
  v                             v
Task 3 (pure UDF -> reusable    Task 4 (stateful UDF -> inline per call
        function)                       site + arg hoist + slot isolation)
  |                             |        [needs T2 nested-ta lowering]
  +-----------------------------+
  v
Task 5 (fixtures + compile round-trip + Trend Wizard acceptance + docs/skills)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Parser + AST: function declarations](./1-parser-function-declaration.md) | pine-converter | None | Medium |
| 2 | [Semantic: UDF registration + statefulness](./2-semantic-udf-registration.md) | pine-converter | 1 | Medium |
| 3 | [Transform: pure-UDF reusable-function emission](./3-transform-pure-udf-emission.md) | pine-converter | 2 | Medium |
| 4 | [Transform: stateful-UDF inline + slot isolation](./4-transform-stateful-udf-inline.md) | pine-converter | 2 (+ **T2**) | High |
| 5 | [Fixtures + compile round-trip + docs/skills/CLAUDE](./5-fixtures-docs-acceptance.md) | pine-converter, docs | 1–4 (+ **T2**) | Medium |

## Acceptance Criteria

- Trend Wizard's `cf_*` helpers convert to compiling chartlang; a
  stateful helper called with different MAs yields **independent** state
  (verified by a golden where two calls diverge).
- A new diagnostic (e.g. `udf-inlined` info / `udf-recursive-rejected` error)
  documents what happened.

## Deferred / Follow-Up

- Recursive UDFs (Pine forbids unbounded recursion anyway) → reject with a
  clear code.
- A compiler-level per-call-path slot id (would remove the need to inline) —
  separate RFC if ever pursued.

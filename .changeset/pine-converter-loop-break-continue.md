---
"@invinite-org/chartlang-pine-converter": minor
---

Convert Pine `for` loops that use `break`/`continue`, and add compound
assignment (`+=`/`-=`/`*=`/`/=`) — the two general-purpose gaps that broke most
real looping scripts (the `MASM_Strat.md` consolidation counter is the
reference).

- **No-unroll-with-`break`:** a loop whose body contains a `break`/`continue` is
  now ALWAYS emitted as a runtime `for` (a `break` cannot span unrolled
  iterations), overriding the stateful/non-stateful unroll heuristic. The bound
  resolves from a literal OR a frozen `input.int` default
  (`loop-unroll-frozen-at-input-default`). A body that is BOTH stateful AND has a
  `break`/`continue` is unconvertible → new `stateful-loop-with-break` error; a
  non-resolvable break-loop bound reuses `loop-bounds-not-literal-for-stateful-body`.
- **Outside-loop guard:** a `break`/`continue` with no enclosing loop is dropped
  with a new `break-continue-outside-loop` error instead of emitting an illegal
  stray `break;`.
- **Compound assignment:** `+=`/`-=`/`*=`/`/=` parse end-to-end (lexer operator
  tokens, AST `AssignmentOperator`, `parseAssignment`) and lower to a
  read-modify-write at top level and inside loop bodies — onto a `state.*`
  scalar slot's `.value` or a plain local. (Previously `count += 1` mis-lowered
  to `count + (undefined); 1;`.)
- **Runtime series index:** an `=`-declared, history-indexed `ta.*` series
  (`ma = ta.ema(...)` read as `ma[i]`) is promoted to a `state.series` slot —
  reusing the existing `var`→`state.series` machinery — so `ma[i]` is a legal
  indexed read while `ma`'s scalar uses (`ma >= 0`, `plot(ma)`) still work via
  `ma.value`. A `[i]` whose offset is an enclosing `for` iterator is a valid
  runtime history read, not a `dynamic-series-index`. A `ta.*` series never
  `[n]`-indexed keeps its `.current` scalar lowering (no regression). This makes
  the `MASM_Strat.md` consolidation loop convert to a compiling runtime `for`.

Two append-only diagnostic codes: `break-continue-outside-loop`,
`stateful-loop-with-break`.

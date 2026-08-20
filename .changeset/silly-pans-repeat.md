---
"@invinite-org/chartlang-pine-converter": patch
"@invinite-org/chartlang-conformance": patch
---

Fix Pine series-boolean control-flow predicates reading the `Series` object

`ta.crossover` / `ta.crossunder` return a `Series<boolean>` in chartlang, and a
Series OBJECT is truthy on every bar. The converter emitted
`if (ta.crossover(fast, slow))`, so an imported EMA-crossover strategy ran BOTH
order branches on EVERY bar — a 1,000-bar backtest of the canonical Pine v5
crossover strategy consumed 2,000 orders and opened 999 same-day round trips.

Every position the converter lowers into a JS truthiness test (or a scalar
boolean option) now emits through the existing `emitScalar` / `lowerTaToCurrent`
seam instead of the series-rooted emitter, so a root `ta.*` boolean is projected
to its per-bar `.current` value: the initial `if` and every `else if`
(parenthesised or not), each arm of the subjectless `switch` (plus the subject
and `case` tests of the subject form), a `strategy.*` `when =` guard, the
`plotshape` / `plotchar` / `plotarrow` condition, a conditional-colour ternary
test, and the `display = cond ? display.all : display.none` toggle. This
replaces the name-shaped `.current` append `plotshape` carried, which silently
missed a parenthesised predicate.

Only a ROOT `ta.*` call changes: comparisons, literals, `input.bool` reads,
boolean locals and already-lowered compound predicates emit byte-identically,
and nothing is projected twice. The `nested-ta-lowered` / `nested-ta-not-lowered`
diagnostic messages now name the branch-predicate position (codes unchanged).

`@invinite-org/chartlang-conformance` gains the
`pine-converter-round-trip-order-crossover` scenario, which converts that exact
Pine strategy, compiles it, runs it over the 10 000 golden bars and pins the
`orders` channel: 153 orders with the rule, 20 000 without it.

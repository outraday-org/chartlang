# T2 — Converter: nested `ta.*` arithmetic `.current` lowering

## Overview

Lower `ta.*` calls **anywhere inside an expression** to their scalar
`.current` projection — not only when the `ta.*` is the top-level value of a
declaration. Today the converter appends `.current` only to a top-level
`x = ta.foo(...)`; a `ta.*` nested inside arithmetic
(`ta.rsi(close,14) * 0.1`, `ta.wma(...) * scalar`, `a + ta.sma(...)`) is left
as a bare `Series`, so the emitted chartlang **does not type-check / compile**
— and the converter raises **no diagnostic**. This is a silent blocker:
Trend Wizard is saturated with this pattern (`rsi = ta.rsi(src,14)*rsi_scaling`,
`tab_trend_short_pre = ta.wma((…),5) * (…)`, every `cf_slope`/`cf_dist` body).

## Current State (evidence — ran built converter)

Pine `r = ta.rsi(close, 14) * 0.1` →

```ts
compute({ bar, ta, plot }) {
    let r = ta.rsi(bar.close, 14) * 0.1;   // Series * number → won't compile
    plot(r);
}
```

No errors, no warnings — **silent**. Documented as a known gap in
`packages/pine-converter/CLAUDE.md` (§"KNOWN GAPS": *"a `ta.*` nested inside an
expression (`mult * ta.stdev(...)`) is not `.current`-lowered (only
top-level), so series arithmetic does not yet compile"*).

- Top-level lowering lives in `src/transform/other.ts`
  (`emitTa` / `emitSpecialCall`): the `.current` append fires only when the
  `ta.*` call is the **top-level value** of a statement/declaration.
- Nested calls fall through `emitExpr` (`src/transform/exprEmit.ts`) by
  identity and keep the bare member chain.

## Target State

- Any `ta.*` (and signature-mapped variants like `ta.rma`→`ta.smma`) appearing
  in **value position inside an expression** lowers to `(<ta call>).current`.
- The lowering is applied recursively through arithmetic, ternaries, call
  args, and (with **T1**) inlined UDF bodies.
- `ta.*` whose result is **itself fed into another `ta.*`** as a series arg
  must keep series semantics where chartlang expects a `Series` and project
  `.current` where chartlang expects a scalar — define the rule precisely
  (chartlang `ta.*` args are scalars per bar, so inner `ta.*` → `.current`).
- Emit an **info** diagnostic when a nested `ta.*` is lowered, and an
  **error** for any residual shape that still can't compile (replace today's
  silent non-compiling output).

## Architecture Decisions (to finalize in step 2)

| Decision | Notes |
|----------|-------|
| Lower at `emitExpr` time vs. a pre-pass | Pushing `.current` into `exprEmit.ts` keeps one code path but `exprEmit` is currently pure/identity for calls — needs the annotations/context (`EmitContext`) threaded. Prefer extending `emitWithContext` (`src/transform/emitContext.ts`) which already wraps `emitExpr`. |
| Detect `ta.*` callee | Reuse `dottedCallee(...)?.startsWith("ta.")` (the established ta-dispatch shape; `src/transform/callArgs.ts`). |
| Scalar vs. series boundary | chartlang `ta.*` returns `Series<number>`; arithmetic/plot/table want scalars. Rule: project `.current` at every **non-`ta`-arg** value use; leave a series only where the immediate consumer is a chartlang API typed for `Series`. |
| Interaction with offset threading | `plot(value, offset=N)` already special-cases a **direct** top-level `ta.*` (`plotFamily.ts` `renderTaWithOffset`). Ensure nested lowering doesn't double-handle that path. |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| Top-level `.current` lowering | `src/transform/other.ts` (`emitTa`) | Extend to nested positions. |
| Expression emitter | `src/transform/exprEmit.ts` / `emitContext.ts` | Where the recursive lowering hooks in. |
| ta-dispatch helper | `src/transform/callArgs.ts` (`dottedCallee`) | Identify `ta.*`. |
| TA passthrough table | `src/mapping/taPassthrough.ts` | Signature-divergent names. |
| Known-gap skip list | `src/tests/fixtures-compile.test.ts` (`KNOWN_NON_COMPILING`) | Remove entries this unblocks; add new clean fixtures. |

## Dependencies

- Compounds with **T1** (inlined stateful UDF bodies are nested-`ta` heavy).
  Can be built independently but must be verified together.

## Dependency Graph

```
Task 1 (recursive nested ta.* -> .current lowering + scalar/series rule)
  |
  v
Task 2 (diagnostics + fixtures + compile round-trip + retire KNOWN GAP + docs/skills)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Recursive nested `ta.*` → `.current` lowering](./1-nested-ta-current-lowering.md) | pine-converter | None | High |
| 2 | [Diagnostics, fixtures, compile round-trip, docs/skills/CLAUDE](./2-diagnostics-fixtures-docs.md) | pine-converter, docs | 1 | Medium |

## Acceptance Criteria

- `r = ta.rsi(src,14)*0.1` and `ta.wma((a+b)/2, n) * c` convert to compiling
  chartlang.
- No Trend Wizard trend-score line emits silent non-compiling output.

## Deferred / Follow-Up

- Full series-arithmetic typing (e.g. `Series + Series` band math) beyond the
  scalar-per-bar model, if any Pine idiom needs it.

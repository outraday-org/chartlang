# Task 1 — Recursive nested `ta.*` → `.current` lowering

> **Status: TODO**

## Goal

Make the converter project `.current` onto a `ta.*` call **wherever it appears
in value position** inside an expression — not only when it is the top-level
value of a declaration. Today `emitTa` (`src/transform/other.ts`) appends
`.current` only at the statement-top-level, so a nested `ta.*`
(`ta.rsi(close,14) * 0.1`) emits a bare `Series` and the generated chartlang
does not type-check. Thread the lowering through the recursive expression
emitter, define the scalar/series boundary rule, and never emit a bare
un-lowered `ta.*` series in a scalar context again.

## Prerequisites

None for the mechanism. Verified together with **T1** (inlined stateful UDF
bodies are nested-`ta` heavy), but builds independently.

## Current Behavior

Pine `r = ta.rsi(close, 14) * 0.1` converts to:

```ts
compute({ bar, ta, plot }) {
    let r = ta.rsi(bar.close, 14) * 0.1;   // Series * number → won't compile
    plot(r);
}
```

No diagnostic — **silent**. Documented in `packages/pine-converter/CLAUDE.md`
(§"KNOWN GAPS": *"a `ta.*` nested inside an expression (`mult * ta.stdev(...)`)
is not `.current`-lowered (only top-level), so series arithmetic does not yet
compile"*).

- Top-level lowering: `src/transform/other.ts` (`emitTa` / `emitSpecialCall`)
  appends `.current` only when the `ta.*` call is the **top-level value** of a
  statement/declaration.
- Nested calls fall through `src/transform/exprEmit.ts` (`emitExpr`) by
  identity and keep the bare member chain.
- `ta.*` is detected via `dottedCallee(call)?.startsWith("ta.")`
  (`src/transform/callArgs.ts`); signature-divergent names map through
  `src/mapping/taPassthrough.ts` (`ta.rma`→`ta.smma`, etc.).

## Desired Behavior

```ts
// r = ta.rsi(close, 14) * 0.1
let r = ta.rsi(bar.close, 14).current * 0.1;

// x = ta.wma((a + b) / 2, n) * c          (top-level ta, nested ta as arg)
let x = ta.wma((a + b) / 2, n).current * c;

// s = cond ? ta.ema(close, 8) : ta.sma(close, 8)
let s = cond ? ta.ema(bar.close, 8).current : ta.sma(bar.close, 8).current;

// inner ta as a scalar arg to an outer ta
let y = ta.sma(ta.atr(14).current, 5).current;
```

## Requirements

### 1. Single recursive lowering rule (`src/transform/exprEmit.ts` + `emitContext.ts`)

- Introduce **one** rule, applied while emitting any expression through
  `emitWithContext` (`src/transform/emitContext.ts`, which already wraps
  `emitExpr`): a `call-expression` whose `dottedCallee` starts with `ta.` and
  that is emitted in **value position** is wrapped as `(<emitted call>).current`.
- "Value position" = operand of a binary/unary operator, a ternary arm, or an
  **argument** to another call (`ta.*`, `math.*`, `plot`/`hline`, a `draw.*`
  opt, a user function). chartlang `ta.*` arguments are scalars-per-bar, so an
  inner `ta.*` fed to an outer `ta.*` also gets `.current`.
- Thread whatever context `emitExpr` needs (annotations / a `loweringTa: true`
  flag) so the rule fires recursively without a second AST pass.

### 2. Reconcile with the existing top-level `emitTa` (`src/transform/other.ts`)

- The top-level declaration/assignment path must not produce a **double**
  `.current`. Either (a) route `emitTa`'s top-level append through the same
  rule (single source of truth), or (b) have the recursive rule skip a node
  `emitTa` already wrapped. Document which, and keep top-level golden output
  byte-identical for the already-passing single-`ta` fixtures
  (`24-ema-cross`, `25-macd`, `27-supertrend`, …).

### 3. Preserve the Series-wanted exceptions

- A `ta.*` that is the **callback body** of `request.security({interval}, (bar)
  => <ta>)` stays a `Series` (the HTF expression form, owned by
  `src/transform/requestSecurity.ts`). Ensure the general scalar-lowering does
  **not** run on that callback body (it is emitted by the request-security
  path, not the generic value emitter).
- The `plot(value, offset=N)` direct-`ta.*` offset threading
  (`src/transform/plotFamily.ts` `renderTaWithOffset`) must keep working — that
  path rebuilds the call with an `offset` opt; confirm the nested rule does not
  intercept or double-wrap it.

### 4. Never silent: residual-series guard

- If a `ta.*` survives to emission in a value position the rule cannot classify
  as scalar (defensive), emit a **warning** rather than silently producing a
  bare series (see Task 2 for the code). The default outcome for every
  Trend-Wizard-shaped expression is a clean `.current` lowering with no
  diagnostic noise — the warning is a safety net, not the common path.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/exprEmit.ts` | Modify | Recursive `.current` wrap for `ta.*` in value position. |
| `packages/pine-converter/src/transform/emitContext.ts` | Modify | Thread the lowering context into `emitWithContext`. |
| `packages/pine-converter/src/transform/other.ts` | Modify | Reconcile top-level `emitTa` with the recursive rule (no double `.current`). |
| `packages/pine-converter/src/transform/*.test.ts` | Modify | Unit coverage: `ta*scalar`, `scalar+ta`, ternary, `ta`-in-`ta`-arg, request.security callback unaffected, plot-offset unaffected. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**)
- `pnpm docs:check`

## Changeset

Covered by the T2 feature changeset created in Task 2
(`@invinite-org/chartlang-pine-converter`, minor).

## Acceptance Criteria

- A nested `ta.*` in arithmetic, ternaries, and call args lowers to
  `(...).current`; no double `.current` at top level.
- `request.security` callback bodies and `plot(..., offset=)` ta-offset
  threading are byte-unchanged.
- Existing single-`ta` fixtures still produce byte-identical golden output;
  converter tests green at 100%.

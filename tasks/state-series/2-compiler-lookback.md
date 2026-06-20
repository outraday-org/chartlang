# Task 2 — Compiler: lookback for `state.series` bindings

> **Status: TODO**

## Goal

Teach the compiler's `extractMaxLookback` analysis to recognise a variable
bound to a `state.series(...)` call so that an `s[N]` index site folds its
literal `N` into the global `manifest.maxLookback` (the same way a `ta.*`-bound
variable already does). This is what sizes the runtime ring buffer so
`state.series` history actually retains `N` bars. A non-literal index trips the
existing `dynamic-series-index` warning + `dynamicFallback` sizing, unchanged.

## Prerequisites

Task 1 (the `state.series` hole + `NumberSeriesSlot` type exist, so a fixture
using `state.series` type-checks).

## Current Behavior

- `extractMaxLookback` (`packages/compiler/src/analysis/extractMaxLookback.ts`)
  walks `ElementAccessExpression` nodes and folds the literal index of a
  *series-shaped* access into `maxLookback`. Series-shaped is decided by
  `isSeriesShapedAccess`: OHLCV fields (`bar.close[N]`), `ta.*` calls
  (`ta.ema(...)[N]`), and identifiers in `seriesVarNames`.
- `collectSeriesVarNames` builds `seriesVarNames` by walking
  `VariableDeclaration` nodes whose initializer is a `ta.*` call. It does
  **not** recognise a `state.series(...)` initializer, so `const s =
  state.series(0); … s[3]` contributes **0** to `maxLookback` — the runtime
  ring would be sized to 1 slot and `s[3]` would always read `NaN`.
- A non-literal index already produces the `dynamic-series-index` warning and
  sets `seriesCapacities.dynamicFallback = 5000`.

## Desired Behavior

- `const s = state.series(0); … const p = s[3];` folds `3` into
  `manifest.maxLookback` (so the runtime sizes the series ring ≥ 4 slots).
- `const s = state.series(0); … const p = s[i];` (non-literal `i`) trips the
  existing `dynamic-series-index` warning + `dynamicFallback` path, identical
  to the `ta.*` / `bar.*` behavior.
- `bar.*` and `ta.*` lookback behavior is byte-unchanged.

## Requirements

### 1. Recognise `state.series` bindings (`extractMaxLookback.ts`)

Extend `collectSeriesVarNames` (the helper that walks variable declarations,
currently matching `ta.*`-call initializers) to **also** add the bound name
when the initializer is a `state.series(...)` call. Resolve the callee with
the existing `resolveCalleeName(call, checker)` and match
`calleeName === "state.series"` (the same resolution path the slot-injection
pass uses, so element-access forms like `state["series"](...)` are not
mis-recognised — they are already rejected upstream as
`stateful-call-element-access`).

Keep the existing `ta.*` branch intact; this is an additive `||` arm. The
variable name then flows into `seriesVarNames`, and the existing
`isSeriesShapedAccess` identifier branch handles `s[N]` with no further change.

Note the compiler injects the slot id for `state.series` automatically because
Task 1 registered it as `{ slot: true }` — `callsiteIdInjection.ts` needs **no**
change. This task is analysis-only.

### 2. Scope handling

`collectSeriesVarNames` / `extractMaxLookback` already accept an optional
`scope` node for per-binding (multi-export) analysis. A `state.series` binding
declared inside one `defineCall` must only count toward that binding's
`maxLookback` — confirm the new arm respects the same `scope` narrowing the
`ta.*` arm uses (it walks the same node set, so this is automatic; add a test).

### 3. Tests (`extractMaxLookback.test.ts`)

Add cases mirroring the existing `ta.*`-bound-variable cases:

- `const s = state.series(0); s.value = bar.close; const p = s[4];` →
  `maxLookback === 4`.
- Deepest-wins across two series: `const a = state.series(0); const b =
  state.series(0); … a[2]; b[5];` → `maxLookback === 5`.
- Mixed with a `ta.*` var and `bar.close[N]`: the global max is the deepest of
  all three.
- Non-literal index `const s = state.series(0); const p = s[n];` → a
  `dynamic-series-index` diagnostic is produced and
  `seriesCapacities.dynamicFallback === 5000`.
- `state.series` allocated but never indexed → contributes 0 (no crash, no
  diagnostic).

### 4. Compile-level guard (`compile.test.ts`)

Extend Task 1's positive `state.series` compile test (or add a sibling) to
assert the resulting `manifest.maxLookback` reflects the deepest literal index
(e.g. body with `s[3]` ⇒ `manifest.maxLookback >= 3`). This pins the
end-to-end "the index actually sizes the buffer" contract at the compiler
boundary, before the runtime consumes it in Task 3.

## Edge cases

- `state.series` bound with `let` then reassigned: follow whatever the `ta.*`
  arm does today (it keys on the declaration initializer). A reassignment to a
  non-series value is an existing limitation, not introduced here — do not
  expand scope.
- A `state.series` returned/aliased through another variable
  (`const t = s; t[2]`) is **not** required to be tracked (the `ta.*` arm does
  not track aliases either) — document the limitation in a test comment if you
  add a negative case; do not build alias analysis.
- The `dynamic-series-index` warning text/threshold is unchanged — reuse the
  existing diagnostic, do not add a new code.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/analysis/extractMaxLookback.ts` | Modify | Recognise `state.series(...)` bindings in `collectSeriesVarNames`. |
| `packages/compiler/src/analysis/extractMaxLookback.test.ts` | Modify | Literal-fold, deepest-wins, non-literal, never-indexed cases. |
| `packages/compiler/src/compile.test.ts` | Modify | Assert `manifest.maxLookback` reflects `s[N]`. |

## Gates

- `pnpm -F @invinite-org/chartlang-compiler test` (coverage **100%** on the
  changed analysis file)
- `pnpm typecheck`, `pnpm lint`

## Changeset

Covered by Task 1's feature changeset (compiler is included as minor).

## Acceptance Criteria

- A `state.series`-bound variable's literal `s[N]` index folds `N` into
  `manifest.maxLookback`, deepest-wins across multiple series and mixed with
  `ta.*` / `bar.*`.
- Non-literal `s[i]` trips the existing `dynamic-series-index` +
  `dynamicFallback` path.
- `ta.*` / `bar.*` lookback behavior byte-unchanged; scope narrowing respected.
- Compiler tests green at 100% coverage; typecheck/lint green.
</content>

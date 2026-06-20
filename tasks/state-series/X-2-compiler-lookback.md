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

> **Concurrent work — same file.** `tasks/bounded-loop-series-index/`
> currently has **uncommitted** changes to
> `packages/compiler/src/analysis/extractMaxLookback.ts` (and adds
> `loopBounds.ts` / `resolveIndexBound.ts`). The two features are **additive
> and touch different helpers** — that work owns the *index-resolution* path
> (`resolveIndexUpperBound`), this task owns the *series-recognition* path
> (`collectSeriesVarNames`). Land on top of whatever is in the tree; do not
> revert its changes. The "Current Behavior" below reflects the post-bounded-loop
> state of the file.

## Current Behavior

- `extractMaxLookback` (`packages/compiler/src/analysis/extractMaxLookback.ts`)
  walks `ElementAccessExpression` nodes and, for a *series-shaped* access,
  runs the index through `resolveIndexUpperBound`
  (`analysis/resolveIndexBound.ts`) and folds the resolved bound into
  `maxLookback`. `resolveIndexUpperBound` resolves a numeric **literal**, a
  bare **bounded-loop induction variable** (`s[i]` inside
  `for (let i = 0; i < N; i++)` → `N − 1`; `<=` → `N`), and a lexically
  visible **`const` numeric-literal binding** — only a genuinely
  unresolvable index returns `null`. Series-shaped is decided by
  `isSeriesShapedAccess`: OHLCV fields (`bar.close[N]`), `ta.*` calls
  (`ta.ema(...)[N]`), and identifiers in `seriesVarNames`.
- `collectSeriesVarNames` builds `seriesVarNames` by walking
  `VariableDeclaration` nodes whose initializer is a `ta.*` call (matched via
  `resolveCalleeName(...).startsWith("ta.")`). It does **not** recognise a
  `state.series(...)` initializer, so `const s = state.series(0); … s[3]`
  contributes **0** to `maxLookback` — the runtime ring would be sized to 1
  slot and `s[3]` would always read `NaN`.
- An index that `resolveIndexUpperBound` returns `null` for (genuinely
  dynamic — not a literal, bounded-loop induction var, or `const`
  numeric-literal binding) produces the `dynamic-series-index` warning and
  sets `seriesCapacities.dynamicFallback = 5000`.

## Desired Behavior

- `const s = state.series(0); … const p = s[3];` folds `3` into
  `manifest.maxLookback` (so the runtime sizes the series ring ≥ 4 slots).
- A `state.series` index that `resolveIndexUpperBound` already resolves —
  bounded-loop induction var (`s[i]` inside `for (let i = 0; i < N; i++)`) or
  `const` numeric binding (`const k = 4; s[k]`) — folds its resolved bound
  into `maxLookback` with **no** warning, automatically (same path as
  `ta.*` / `bar.*`; this task adds nothing for it beyond feeding
  `seriesVarNames`).
- `const s = state.series(0); … const p = s[i];` where `i` is genuinely
  unresolvable (e.g. a `let`/mutable or runtime-derived index) trips the
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
- Resolver-backed index (proves the `state.series` arm composes with the
  bounded-loop work, not just bare literals): a `const` numeric binding
  `const k = 4; const s = state.series(0); const p = s[k];` →
  `maxLookback === 4`, **no** diagnostic. (A bounded-`for` induction-var case
  is already covered generically by the bounded-loop suite; one `const` case
  here is enough to pin the composition.)
- Genuinely-dynamic index `const s = state.series(0); … const p = s[i];`
  where `i` is unresolvable (mirror exactly how the existing non-literal
  `ta.*` / `bar.*` test constructs an unresolvable index post-bounded-loop —
  do **not** use a `const`-bound literal, which now resolves) → a
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
- Index resolution (literal vs bounded-loop induction var vs `const` numeric
  binding vs genuinely-dynamic) is **entirely** the job of the shared
  `resolveIndexUpperBound` path that `extractMaxLookback` already calls for
  every series-shaped access. This task only adds the *recognition* of
  `state.series` bindings into `seriesVarNames`; once an `s[N]` access is
  series-shaped, it inherits the identical resolution behavior as `bar.*` /
  `ta.*` for free. Do **not** re-implement index resolution in this task.

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

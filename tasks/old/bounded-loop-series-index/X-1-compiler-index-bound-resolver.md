# Task 1 — Compiler: loop-bounds helper + index-bound resolver foundation

> **Status: TODO**

## Goal

Introduce a compile-time **index-bound resolver** in the compiler's
analysis layer and wire it into `extractMaxLookback`, so a series read at
a **bare bounded-loop induction variable** (`series[i]`) or a
**lexically visible `const`-bound numeric literal** (`series[k]`) is sized to a precise
`maxLookback` with no `dynamic-series-index` warning and no 5000-slot
fallback. Extract the legal-`for`-loop parse out of `forbiddenConstructs`
into a shared helper so both passes agree on what a bounded loop is.
(Affine index expressions land in Task 2.)

## Prerequisites

None.

## Current Behavior

- `extractMaxLookback.ts` (lines 74–94): a series index is sized only
  when `ts.isNumericLiteral(argument)`; every other expression pushes a
  `dynamic-series-index` warning and sets
  `seriesCapacities.dynamicFallback = 5000`.
- `forbiddenConstructs.ts` `checkForStatement` (lines 70–90) parses the
  one legal `for` shape inline and returns only `boolean`. Nothing else
  can reach the parsed bounds.
- No const-folding / variable-resolution helper exists anywhere in the
  compiler.

## Desired Behavior

- A new `resolveIndexUpperBound(argument, ctx)` returns `number | null`:
  - numeric literal → its value;
  - identifier that is a **bounded-loop induction variable** of an
    enclosing legal `for` → the loop's max reachable index;
  - identifier that is a **`const` numeric-literal** binding in scope →
    that value;
  - otherwise → `null` (Task 2 extends this for affine expressions).
- `extractMaxLookback` uses it: a non-`null`, non-negative result feeds
  `maxLookback` like a literal (no warning, no `dynamicFallback`); a
  `null` keeps today's warn + fallback; a negative result contributes
  `0`.
- `forbiddenConstructs` consumes the shared `parseBoundedForLoop` helper
  (behaviour byte-identical — it still emits `unbounded-loop` for every
  shape it rejects today).

## Requirements

### 1. Shared loop-bounds helper — `analysis/loopBounds.ts`

Create `packages/compiler/src/analysis/loopBounds.ts`. Two-line MIT
header. Export:

```ts
/** The parsed shape of a legal chartlang `for` loop. */
export type BoundedForLoop = Readonly<{
    /** The induction variable name (the `i` in `for (let i = …)`). */
    varName: string;
    /** The literal initial value (`for (let i = <start>; …)`). */
    start: number;
    /** The comparison operator token used in the condition. */
    op: ts.SyntaxKind;
    /** The literal right-hand bound (`… i <op> <limit>; …`). */
    limit: number;
}>;

/**
 * Parse a `ts.ForStatement` into its `BoundedForLoop` shape, or `null`
 * when it is not the one legal chartlang loop form
 * (`for (let i = <numLit>; i <comparison> <numLit>; i++)` — single
 * `let` init, id-on-left/literal-on-right condition, postfix `i++`).
 * The single source of truth for "what is a bounded loop"; both
 * `forbiddenConstructs` (reject everything else) and
 * `resolveIndexUpperBound` (size the index range) call it so the two
 * passes can never disagree.
 */
export function parseBoundedForLoop(node: ts.ForStatement): BoundedForLoop | null;
```

- Move the exact predicate sequence from `checkForStatement`
  (`forbiddenConstructs.ts:70–90`) into `parseBoundedForLoop`, returning
  the captured `{ varName, start, op, limit }` instead of `true`, and
  `null` instead of `false`. Read `start` via `Number(initializer.text)`,
  `limit` via `Number(condition.right.text)`, `op` =
  `condition.operatorToken.kind`.
- The `COMPARISON_OPS` set currently in `forbiddenConstructs` moves here
  (or is re-exported) so the predicate stays identical; `forbiddenConstructs`
  imports it from `loopBounds.ts`.
- **Also move `unwrapParens` here** (currently a private function in
  `extractMaxLookback.ts:129`) and export it. Both `extractMaxLookback.ts`
  (for `readBarPointLookback`) and `resolveIndexBound.ts` (for the
  numeric-literal leaf, and Task 2's `evalInterval`) need it. Housing it
  in `loopBounds.ts` — a leaf module with no analysis-package imports —
  avoids a **circular import**: `extractMaxLookback.ts` imports
  `resolveIndexUpperBound` from `resolveIndexBound.ts`, so
  `resolveIndexBound.ts` must NOT import back from `extractMaxLookback.ts`.
  Update `extractMaxLookback.ts` to import `unwrapParens` from
  `loopBounds.ts` instead of defining it locally.
- Full JSDoc with `@since 0.1`, `@example`, stability marker on each
  export (JSDoc gate `pnpm docs:check`).

### 2. Refactor `forbiddenConstructs` to consume the helper

In `forbiddenConstructs.ts`, replace `checkForStatement(node)` with
`parseBoundedForLoop(node) !== null`. Delete the now-dead inline
predicate + the local `COMPARISON_OPS` (import from `loopBounds.ts`). The
emitted `unbounded-loop` diagnostic text and every existing
`forbiddenConstructs` test must remain unchanged — this is a pure
internal extraction.

### 3. Index-bound resolver — `analysis/resolveIndexBound.ts`

Create `packages/compiler/src/analysis/resolveIndexBound.ts`. Export:

```ts
/** Compile-time context for resolving a series index's upper bound. */
export type IndexBoundContext = Readonly<{
    /** `const <id> = <numeric literal>` bindings visible at the index use site. */
    constEnv: ReadonlyMap<string, number>;
    /** Checker used to avoid resolving loop variables through a shadowed name. */
    checker: ts.TypeChecker;
}>;

/**
 * The provable maximum non-negative integer a series-index expression
 * can reach at runtime, or `null` when no sound upper bound exists.
 * Over-approximates: a result is always `>=` the true max index, so the
 * runtime buffer (sized `maxLookback + 1`) never under-sizes. `null`
 * signals the caller to fall back to the 5000-slot dynamic buffer.
 *
 * Foundation cases (Task 1): a numeric literal, a bare bounded-loop
 * induction variable, a `const` numeric-literal binding. Affine
 * combinations (`i + 1`, `K - i`, …) are added in Task 2.
 */
export function resolveIndexUpperBound(
    argument: ts.Expression,
    node: ts.Node,
    ctx: IndexBoundContext,
): number | null;
```

Resolution (Task 1 scope):

1. **Numeric literal** (after `unwrapParens`, imported from the shared
   `loopBounds.ts` per Requirement 1 — do **not** import it from
   `extractMaxLookback.ts`, which would create a circular dependency):
   return its numeric value.
2. **Identifier**:
   a. **Bounded-loop induction variable.** Walk `node.parent` upward; for
      each `ts.ForStatement` ancestor call `parseBoundedForLoop`. If the
      parsed `varName === id.text`, this is the declaring loop — compute
      the max index:
      - `<` (`LessThanToken`)  → `limit - 1`
      - `<=` (`LessThanEqualsToken`) → `limit`
      - `>` / `>=` with `i++` (non-terminating / never-entered) → **`null`**
        (cannot bound — defer to fallback).
      Before returning, **verify the loop variable is not reassigned in
      the body** beyond the `++` incrementor (scan the loop body for an
      assignment/compound-assignment/`++`/`--` whose target identifier is
      `varName`, other than the header incrementor). If it is, return
      `null`. The matched loop is the nearest enclosing one that declares
      the name; stop walking once found. Before accepting it, use
      `ctx.checker.getSymbolAtLocation(id)` and the loop declaration's
      symbol to verify the index identifier actually refers to that
      induction variable. If a nested block, parameter, function, `let`,
      or `const` declaration shadows the same text, do not size from the
      outer loop. In that case skip the loop-var branch and continue to
      the visible-`const` branch below; if the shadowing binding is not a
      numeric `const`, the resolver returns `null`.
   b. **`const` numeric literal.** If `ctx.constEnv.has(id.text)`, return
      that value.
   c. Otherwise → `null`.
3. Anything else → `null`.

Full JSDoc + `@since 0.1` + `@example` + stability on each export.

### 4. Lexical const environment collector

Add a `collectConstNumberEnv(useSite, scopeRoot)` (in
`resolveIndexBound.ts` or a small sibling) that returns only
`const <id> = <numeric literal>` bindings that are **lexically visible at
the specific series-index expression being resolved**. A single map for
the whole `extractMaxLookback` scope is forbidden because it would
incorrectly see declarations after the read, declarations inside sibling
blocks, and shadowed names.

Rules:

- Include only `ts.VariableDeclaration`s whose parent
  `VariableDeclarationList` has the `Const` flag, whose name is an
  identifier, and whose initializer is a numeric literal **or** a unary
  `+`/`-` on a numeric literal (mirror `extractInputs.readLiteral`'s
  numeric handling — do **not** evaluate binary expressions here; that is
  Task 2's interval evaluator, and a `const` initialised from another
  expression simply isn't added).
- Walk from `useSite` outward through lexical containers
  (`Block`/`SourceFile`/function bodies/case clauses). For each container,
  collect only declarations that occur before `useSite.pos` within that
  container. Do not descend into nested functions/classes/blocks that do
  not contain `useSite`.
- Apply normal shadowing: the innermost visible declaration for a name
  wins; an outer `const k = 5` must not size `series[k]` inside a block
  that declares a non-numeric `const k = "x"` or `let k = 2`.
- Stop at `scopeRoot` so a per-export `extractMaxLookback(..., scope)`
  cannot see sibling exports' locals.

Returns `ReadonlyMap<string, number>`. Build it per
`ElementAccessExpression`/index use and pass it into the resolver via
`IndexBoundContext`.

### 5. Wire into `extractMaxLookback`

In the `isSeriesShapedAccess` block (lines 74–94), replace:

```ts
if (ts.isNumericLiteral(argument)) {
    const n = Number(argument.text);
    if (n > maxLookback) maxLookback = n;
} else {
    /* warning + dynamicFallback */
}
```

with:

```ts
const constEnv = collectConstNumberEnv(argument, scope);
const bound = resolveIndexUpperBound(argument, node, { constEnv, checker });
if (bound !== null) {
    if (bound > maxLookback) maxLookback = bound;
} else {
    /* unchanged: dynamic-series-index warning + dynamicFallback = 5000 */
}
```

`seriesVarNames` is still built once from `collectSeriesVarNames(scope,
checker)`, but `constEnv` is built at the index use site so it obeys
lexical scope and declaration order. A resolved negative `bound`
contributes nothing (the `bound > maxLookback` guard handles it since
`maxLookback` starts at `0`). The warning/fallback branch is untouched.

### 6. Tests — `extractMaxLookback.test.ts` + new resolver/helper tests

Co-locate. Cover (100% line/branch/function on the compiler package):

- **Bare loop var, `<`:** `for (let i = 0; i < 5; i++) { e[i]; }` ⇒
  `maxLookback === 4`, `seriesCapacities === {}`, **no**
  `dynamic-series-index` diagnostic.
- **Bare loop var, `<=`:** `i <= 4` ⇒ `maxLookback === 4`.
- **Const literal index:** `const k = 3; e[k];` ⇒ `maxLookback === 3`,
  no warning.
- **Const with unary minus is not a lookback:** `const k = -2; e[k];` ⇒
  contributes `0` (negative bound), no warning, no fallback.
- **Const declared after use does not resolve:** `e[k]; const k = 3;` ⇒
  `dynamic-series-index` warning + `dynamicFallback === 5000`.
- **Sibling-block const does not resolve:** `if (ok) { const k = 3; } e[k];`
  ⇒ fallback.
- **Shadowed const does not leak outer binding:** `const k = 3; { let k = 1;
  e[k]; }` and `const k = 3; { const k = "x"; e[k]; }` ⇒ fallback.
- **Non-terminating loop falls back:** `for (let i = 0; i > 5; i++) e[i];`
  ⇒ `dynamic-series-index` warning + `dynamicFallback === 5000`.
- **Reassigned loop var falls back:**
  `for (let i = 0; i < 5; i++) { i = 100; e[i]; }` ⇒ warning + fallback.
- **Shadowed loop variable falls back:** `for (let i = 0; i < 5; i++) {
  { const i = 2; e[i]; } }` resolves from the inner const if numeric, and
  `{ let i = 2; e[i]; }` falls back; neither sizes from the outer loop.
- **Unknown identifier falls back:** `e[j]` (no const, no loop) ⇒
  warning + fallback (today's behaviour preserved).
- **Literal still works:** `e[7]` ⇒ `maxLookback === 7` (regression).
- **Nested loops pick the declaring loop:** an inner `for (let j …)`
  reading `e[i]` resolves `i` to the outer loop, `e[j]` to the inner.
- `parseBoundedForLoop` unit tests for each rejected shape (multi-decl
  init, non-literal bound, wrong incrementor, missing clause) returning
  `null`, and the accepted shape returning the right `{varName,start,op,limit}`.
- `unwrapParens` (now in `loopBounds.ts`) keeps 100% coverage: it is
  exercised by the parenthesised-literal resolver case and the existing
  `bar.point(-(N), …)` lookback cases; add a direct unit test in
  `loopBounds.test.ts` if any branch is otherwise uncovered.
- `forbiddenConstructs` suite unchanged + green (extraction is behaviour-
  preserving).
- **Fix two pre-existing tests whose `const`-bound index now resolves
  (they currently assert warn + fallback and WILL break otherwise).**
  Both deliberately read a series at a `const` numeric-literal index to
  exercise the old fallback path — exactly the case this resolver now
  folds. Re-point each to a genuinely-unresolvable index (a **`let`**
  binding — mutable, so the resolver refuses it by design) so the test
  keeps proving the warn + `dynamicFallback = 5000` path:
  - `extractMaxLookback.test.ts:60` ("emits dynamic-series-index for
    non-literal indices and sets dynamicFallback"): change `const i:
    number = 2;` → `let i = 2;` (the `: number` annotation is irrelevant —
    the initializer `2` is a numeric literal the new `constEnv` would
    fold). With `let`, `bar.close[i]` stays `dynamic-series-index` +
    `dynamicFallback === 5000`.
  - `api.test.ts:397` ("flows warnings through (dynamic-series-index)
    without bailing"): change `const i = 1;` → `let i = 1;` so the
    `bar.close[i]` read still emits the warning the test asserts flows
    through. Update the comment if it claims a `const` index warns.
  No other `dynamicFallback` / `dynamic-series-index` test references a
  resolvable index: `manifest.test.ts:18` and
  `createScriptRunner.test.ts:685` hand-build the manifest (never run the
  resolver); `diagnostics.test.ts`, `api.types.test.ts`, and
  `languageServiceHelpers.test.ts` are diagnostic-shape/type unit tests —
  all stay green.

### 7. Compiler `CLAUDE.md`

Add an invariant under the `extractMaxLookback` group documenting that
bounded-loop induction variables and `const` numeric-literal indices are
resolved to a precise `maxLookback` (over-approximating, never under-
sizing) via `resolveIndexUpperBound` + the shared `parseBoundedForLoop`,
and only genuinely-unresolvable indices fall back to the
`dynamic-series-index` warning + `dynamicFallback = 5000`. Note that
`parseBoundedForLoop` is the single source of truth shared with
`forbiddenConstructs`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/analysis/loopBounds.ts` | Create | Shared `parseBoundedForLoop` + `BoundedForLoop` + `COMPARISON_OPS` + `unwrapParens` (moved from `extractMaxLookback.ts` to avoid a circular import). |
| `packages/compiler/src/analysis/loopBounds.test.ts` | Create | Parser unit tests (accepted + every rejected shape). |
| `packages/compiler/src/analysis/resolveIndexBound.ts` | Create | `resolveIndexUpperBound` + use-site lexical `collectConstNumberEnv` + `IndexBoundContext`. |
| `packages/compiler/src/analysis/resolveIndexBound.test.ts` | Create | Resolver unit tests (leaf cases + fallbacks). |
| `packages/compiler/src/analysis/forbiddenConstructs.ts` | Modify | Consume `parseBoundedForLoop`; drop inline predicate + local `COMPARISON_OPS`. |
| `packages/compiler/src/analysis/extractMaxLookback.ts` | Modify | Route index through `resolveIndexUpperBound`; build a use-site lexical `constEnv`; import `unwrapParens` from `loopBounds.ts` (drop the local definition). |
| `packages/compiler/src/analysis/extractMaxLookback.test.ts` | Modify | Add loop-var / const / fallback cases; keep existing literal + `bar.point` cases; **re-point the line-60 `const i` fallback test to `let i`** (its `const`-literal index now resolves). |
| `packages/compiler/src/api.test.ts` | Modify | Re-point the "flows warnings through (dynamic-series-index)" test's `const i = 1` index → `let i = 1` so a warning still flows (the `const` index now resolves precisely). |
| `packages/compiler/CLAUDE.md` | Modify | Document the precise-index-resolution invariant. |

## Gates

- `pnpm typecheck`
- `pnpm -F @invinite-org/chartlang-compiler test` (100% coverage,
  determinism + golden tests green)
- `pnpm docs:check` (JSDoc on new exports)

## Changeset

No standalone changeset; the feature's single changeset is created in
Task 3 (`.changeset/bounded-loop-series-index.md`, compiler `minor`).
Note this in the PR but do not add a partial changeset here.

## Acceptance Criteria

- `series[i]` in a `for (let i = 0; i < N; i++)` loop and `series[k]` for
  a `const k = <lit>` size `maxLookback` precisely with **no**
  `dynamic-series-index` warning and **no** `dynamicFallback`.
- Non-terminating loops, reassigned loop vars, `let`/unknown identifiers,
  and `const` non-numeric-literals all keep the warn + 5000 fallback.
- The two pre-existing const-index fallback tests
  (`extractMaxLookback.test.ts:60`, `api.test.ts:397`) are re-pointed to a
  `let` index so they still exercise warn + `dynamicFallback = 5000`; the
  full compiler + runtime + language-service suites stay green.
- `parseBoundedForLoop` is the only place the legal-`for` shape is
  parsed; `forbiddenConstructs` behaviour is byte-identical.
- 100% coverage on the compiler package; JSDoc gate green; determinism +
  existing goldens unchanged.
- `packages/compiler/CLAUDE.md` documents the new invariant.

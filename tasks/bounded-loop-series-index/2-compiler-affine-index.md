# Task 2 — Compiler: affine index expressions

> **Status: TODO**

## Goal

Extend `resolveIndexUpperBound` (Task 1) from leaf cases to **affine
index expressions** — `series[i + 1]`, `series[i - 1]`, `series[K - i]`,
`series[2 * i]`, `series[(i + k) * 2]`, etc. — by evaluating the index as
a compile-time **integer interval** over numeric literals, `const`
numeric bindings, and bounded-loop induction-variable ranges, combined
with `+`, `−`, `*`, unary `−`, and parentheses. The upper endpoint of the
interval is the precise `maxLookback` contribution; any unprovable
sub-term collapses the whole result to `null` (today's safe fallback).

## Prerequisites

Task 1 (the `resolveIndexUpperBound` resolver, the
`parseBoundedForLoop` helper, the checker-backed lexical `constEnv` built
at each index use).

## Current Behavior (after Task 1)

`resolveIndexUpperBound` resolves only a numeric literal, a bare loop
variable, or a `const` numeric binding. An affine expression such as
`i + 1` is not an identifier or a literal, so it returns `null` → the
read warns + forces the 5000-slot fallback.

## Desired Behavior

`resolveIndexUpperBound` resolves any expression built from:

- numeric literals,
- `const` numeric-literal identifiers (`ctx.constEnv`),
- bounded-loop induction variables (resolved to their **range**, not just
  the max),
- the binary operators `+`, `−`, `*`,
- unary `−` (and unary `+`),
- parentheses,

by computing its integer interval and returning the **upper** endpoint
(clamped at the call site: a negative upper endpoint contributes `0`).
Any other node (another identifier, a call, `/`, `%`, `**`, bitwise ops,
a non-numeric literal) makes the containing interval — and thus the whole
index — `null`.

## Requirements

### 1. Represent loop variables as ranges, not points

A bare loop variable's **max** is enough for the leaf case, but affine
forms need the full range (`K - i` is largest when `i` is *smallest*).
Refactor the loop-variable resolution from Task 1 to compute an
`Interval { lo, hi }`:

- `for (let i = a; i < b; i++)` → `i ∈ [a, b - 1]`
- `for (let i = a; i <= b; i++)` → `i ∈ [a, b]`
- non-terminating / reassigned-in-body → the variable is **unbounded** →
  the interval is `null` (collapses the expression).

Keep the Task-1 leaf entry points behaving identically: a bare loop var
returns `interval.hi`; a bare const returns `[v, v].hi === v`.

### 2. Interval evaluator

Add an internal `evalInterval(expr, ctx): Interval | null` to
`resolveIndexBound.ts`:

```ts
type Interval = Readonly<{ lo: number; hi: number }>;
```

Cases (after `unwrapParens`):

- **Numeric literal** `n` → `{ lo: n, hi: n }`.
- **Identifier**:
  - `const` numeric `v` → `{ lo: v, hi: v }`;
  - bounded-loop induction var → its `[lo, hi]` (§1), or `null` (only
    when `ctx.checker` proves the identifier refers to that loop's
    declaration; shadowed names keep Task 1's visible-`const`/fallback
    behavior);
  - else → `null`.
- **Prefix unary**: `+x` → `evalInterval(x)`; `-x` → negate the interval
  (`{ lo: -hi, hi: -lo }`); any other operator → `null`.
- **Binary**:
  - `+`: `{ lo: a.lo + b.lo, hi: a.hi + b.hi }`
  - `-`: `{ lo: a.lo - b.hi, hi: a.hi - b.lo }`
  - `*`: products of the four endpoint pairs —
    `lo = min(aLo*bLo, aLo*bHi, aHi*bLo, aHi*bHi)`,
    `hi = max(of the same four)` (standard interval multiplication;
    correct for any sign).
  - any other operator (`/`, `%`, `**`, `<<`, …) → `null`.
  - if either operand interval is `null` → `null`.
- Anything else → `null`.

`resolveIndexUpperBound` becomes: `const iv = evalInterval(argument, ctx);
return iv === null ? null : iv.hi;` (the leaf-case branches from Task 1
fold into `evalInterval`; the public signature is unchanged). The
caller's existing `bound > maxLookback` guard already discards a negative
`hi`.

> **Soundness note.** All inputs are integers and `+`/`−`/`*` preserve
> integers, so the interval endpoints are exact integers — no rounding,
> no `Number.isInteger` guard needed. Guard only against non-finite
> results defensively (`Number.isFinite(hi)` → else `null`), which also
> covers any pathological literal.

### 3. Tests — `resolveIndexBound.test.ts` + `extractMaxLookback.test.ts`

Co-locate; keep 100% coverage. Add:

- **`i + 1`:** `for (let i = 0; i < 5; i++) e[i + 1];` ⇒ `maxLookback === 5`.
- **`i - 1`:** same loop, `e[i - 1]` ⇒ `hi = 4 - 1 = 3` ⇒ `maxLookback === 3`.
- **`K - i` with const:** `const K = 4; for (let i = 0; i <= 4; i++) e[K - i];`
  ⇒ `i ∈ [0,4]`, `K - i ∈ [0,4]`, `maxLookback === 4`.
- **`2 * i`:** `for (let i = 0; i < 3; i++) e[2 * i];` ⇒ `i ∈ [0,2]`,
  `2*i ∈ [0,4]`, `maxLookback === 4`.
- **Nested affine + parens:** `e[(i + K) * 1]` resolves; mixed sign
  multiplication (`-2 * i`) yields the correct `hi`.
- **All-negative interval contributes 0:** `const K = 1;
  for (let i = 2; i < 5; i++) e[K - i];` ⇒ `K - i ∈ [-3,-1]`, `hi < 0` ⇒
  contributes `0`, no warning, no fallback.
- **Unsupported operator falls back:** `e[i / 2]`, `e[i % 2]`,
  `e[i ** 2]` ⇒ `dynamic-series-index` + `dynamicFallback === 5000`.
- **Unknown sub-term falls back:** `e[i + j]` (j unbound) ⇒ fallback.
- **Lexical const rules still hold in affine forms:** `e[k + 1]; const k = 3;`,
  a sibling-block `const k`, and a non-numeric shadowing `const k` all
  fall back rather than using an out-of-scope numeric binding.
- **Shadowed loop variables stay sound in affine forms:** inside
  `for (let i = 0; i < 5; i++)`, `{ let i = 1; e[i + 1]; }` falls back
  rather than sizing from the outer loop.
- **Determinism:** the same affine source analysed twice yields identical
  manifests (covered by the existing determinism harness; add a case if a
  gap shows).
- **Soundness property test (never under-size).** The over-approximation
  contract is the feature's core safety invariant, and interval `*`
  sign-handling is exactly the space example tests cover poorly. Add a
  property test in a new `resolveIndexBound.property.test.ts` (fast-check
  `fc.assert`/`fc.property`, mirroring the package's existing
  `*.property.test.ts` files such as `extractInputs.property.test.ts`)
  that, for randomly generated affine index
  expressions over random bounded-loop ranges and `const` bindings,
  brute-forces the **true** maximum index by evaluating the expression at
  every integer point in the loop domain, then asserts
  `resolveIndexUpperBound(...) >= trueMax` (or `=== null`). A resolved
  bound must never be smaller than the true max — the property that
  guarantees the runtime buffer is never under-sized.

### 4. Compiler `CLAUDE.md`

Amend the Task-1 invariant note to state that affine combinations
(`+`, `−`, `*`, unary `−`, parens) of literals / `const` numbers /
bounded-loop ranges are sized via integer interval arithmetic on the
upper endpoint; division, modulo, exponent, bitwise, calls, and unknown
identifiers fall back to the `dynamic-series-index` + `dynamicFallback`
path.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/analysis/resolveIndexBound.ts` | Modify | Add `Interval` + `evalInterval`; reroute loop-var to a range; `resolveIndexUpperBound` returns `evalInterval(...).hi`. |
| `packages/compiler/src/analysis/resolveIndexBound.test.ts` | Modify | Affine + interval-arithmetic + fallback cases. |
| `packages/compiler/src/analysis/resolveIndexBound.property.test.ts` | Create | Soundness property test: `resolveIndexUpperBound >=` brute-forced true max index (or `null`). |
| `packages/compiler/src/analysis/extractMaxLookback.test.ts` | Modify | End-to-end affine `maxLookback` cases. |
| `packages/compiler/CLAUDE.md` | Modify | Amend the precise-index invariant for affine forms. |

## Gates

- `pnpm typecheck`
- `pnpm -F @invinite-org/chartlang-compiler test` (100% coverage,
  determinism + goldens green)
- `pnpm docs:check`

## Changeset

Folds into the single `.changeset/bounded-loop-series-index.md` created
in Task 3 (compiler `minor`).

## Acceptance Criteria

- Affine indices (`i + 1`, `i - 1`, `K - i`, `2 * i`, parenthesised /
  nested combinations) size `maxLookback` to the exact interval upper
  endpoint, with no warning / fallback.
- An all-negative interval contributes `0`; unsupported operators,
  unknown identifiers, and calls fall back to warn + 5000.
- Interval multiplication is sign-correct (endpoint-product min/max).
- A soundness property test proves `resolveIndexUpperBound >=` the
  brute-forced true max index (or `null`) across random affine
  expressions / loop ranges — the resolver never under-sizes.
- 100% coverage; determinism + goldens unchanged; JSDoc + CLAUDE.md
  updated.

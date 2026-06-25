# Task 1 — Core `math` namespace + ambient shim

> **Status: DONE**

## Goal

Introduce a pure frozen `math` namespace in core carrying only the chart-aware
/ Pine-parity scalar helpers that bare `Math` lacks (tick rounding, scalar
`na`/`nz`/`fixnan`, variadic `avg`/`sum`, `sign`, `clamp`), export it from the
barrel, mirror it in the compiler ambient shim, and land unit + property tests
+ the changeset.

## Prerequisites

None.

## Current Behavior

- No `math` namespace. Bare `Math.*` (except `random`) is usable in `compute`.
- `color` (`packages/core/src/color/index.ts:20`) is the pure frozen-namespace
  precedent; the compiler ambient shim mirrors it at
  `packages/compiler/src/program.ts:891`.

## Desired Behavior

```ts
math.roundToMintick(101.237, syminfo.mintick); // snap to tick
math.roundTo(7.34, 0.25);                       // 7.25
math.na(x);                                      // Number.isNaN(x)
math.nz(x);                                      // NaN/∞ → 0
math.nz(x, -1);                                  // NaN/∞ → -1
math.fixnan(x, lastGood);                        // na(x) ? lastGood : x
math.avg(a, b, c);                               // skip-NaN scalar mean
math.sum(a, b, c);                               // skip-NaN scalar sum
math.sign(x); math.clamp(x, lo, hi);
```

## Requirements

### 1. Implementation (`packages/core/src/math/mathHelpers.ts`, new)

Two-line MIT header. Pure functions; each with `@since 1.4`, `@stable`,
`@example` (core ships at 1.3.0; this minor bump lands as 1.4.0, matching how
`state.array`/`time.*` tagged `@since` to their shipping minor version):

```ts
export const roundTo = (value: number, step: number): number =>
    step > 0 && Number.isFinite(step) ? Math.round(value / step) * step : value;

// semantic alias — same impl, price-snapping intent
export const roundToMintick = (value: number, mintick: number): number =>
    roundTo(value, mintick);

export const na = (value: number): boolean => !Number.isFinite(value);
export const nz = (value: number, replacement = 0): number =>
    Number.isFinite(value) ? value : replacement;
export const fixnan = (value: number, lastGood: number): number =>
    Number.isFinite(value) ? value : lastGood;

export const sign = (value: number): number =>
    Number.isNaN(value) ? Number.NaN : Math.sign(value);

export const clamp = (value: number, lo: number, hi: number): number =>
    value < lo ? lo : value > hi ? hi : value;

export const avg = (...values: ReadonlyArray<number>): number => {
    let sum = 0, n = 0;
    for (const v of values) if (Number.isFinite(v)) { sum += v; n++; }
    return n === 0 ? Number.NaN : sum / n;
};

export const sum = (...values: ReadonlyArray<number>): number => {
    let s = 0, n = 0;
    for (const v of values) if (Number.isFinite(v)) { s += v; n++; }
    return n === 0 ? Number.NaN : s;
};
```

> **Decisions baked in:** `na` treats `±Infinity` as "not available" (matches
> `nz`'s finite check — Pine's `na` is NaN-only, but chartlang's series carry
> NaN, not Infinity, so the stricter finite check is safe and documented).
> `nz`/nz-default = `0` mirrors `ta.nz`. `avg`/`sum` skip non-finite and return
> NaN on an all-NaN/empty arg list (consistent with `../array-analytics/`).
> The variadic `for...of` here is in **library code** (core), not author
> script, so the forbidden-constructs loop gate does not apply.

### 2. `math` namespace (`packages/core/src/math/index.ts`, new)

```ts
import { avg, clamp, fixnan, na, nz, roundTo, roundToMintick, sign, sum } from "./mathHelpers.js";

/** Pure, chart-aware scalar math. Bare `Math.*` (except `random`) is already
 *  available; this adds only what `Math` lacks. @since 1.4 @stable
 *  @example const p = math.roundToMintick(x, syminfo.mintick); void p; */
export const math = Object.freeze({
    roundToMintick, roundTo, na, nz, fixnan, sign, clamp, avg, sum,
});

export type MathNamespace = typeof math;
```

Barrel-export from `packages/core/src/index.ts` next to `color`/`str`:

```ts
export { math } from "./math/index.js";
export type { MathNamespace } from "./math/index.js";
```

### 3. Compiler ambient shim (`packages/compiler/src/program.ts`)

Add an ambient `export const math: Readonly<{ … }>` block next to the `color`
block; signatures match core exactly (variadic `avg`/`sum` typed
`(...values: ReadonlyArray<number>) => number`). Update the shim's namespace
inventory comment if present.

### 4. Tests (co-located)

- **Unit** (`packages/core/src/math/index.test.ts`): each helper incl. edge
  cases — `roundTo(x, 0)` / `roundTo(x, NaN)` → `x` unchanged;
  `roundToMintick` snaps; `na(NaN)`/`na(Infinity)`/`na(1)`;
  `nz(NaN)` → 0, `nz(NaN, -1)` → -1, `nz(Infinity)` → 0;
  `fixnan(NaN, 5)` → 5, `fixnan(2, 5)` → 2; `sign(-0)`/`sign(NaN)`;
  `clamp` below/within/above; `avg()`/`sum()` empty → NaN; `avg`/`sum` skip
  NaN.
- **Property** (`packages/core/src/math/mathHelpers.property.test.ts`):
  for random finite `(value, step>0)`, `|roundTo(value, step) − value| ≤ step/2`
  and the result is an integer multiple of `step` within `1e-9`;
  `clamp(x, lo, hi) ∈ [lo, hi]`; `avg` of finite values ∈ `[min, max]`.

### 5. Changeset

`.changeset/math-namespace.md` — `"@invinite-org/chartlang-core": minor`,
`"@invinite-org/chartlang-compiler": minor`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/math/mathHelpers.ts` | Create | Pure scalar helpers. |
| `packages/core/src/math/index.ts` | Create | Frozen `math` namespace + type. |
| `packages/core/src/math/index.test.ts` | Create | Unit tests. |
| `packages/core/src/math/mathHelpers.property.test.ts` | Create | Property tests. |
| `packages/core/src/index.ts` | Modify | Barrel export `math`. |
| `packages/compiler/src/program.ts` | Modify | Ambient shim `math` block. |
| `.changeset/math-namespace.md` | Create | minor (core, compiler). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on core + compiler)
- `pnpm docs:check`

## Changeset

`.changeset/math-namespace.md` — **minor** (core, compiler).

## Acceptance Criteria

- `math.*` type-checks in `compute` via core + ambient shim; a compile fixture
  using `math.roundToMintick(x, syminfo.mintick)` compiles clean.
- No bare-`Math` re-wrap present (surface is exactly the documented members).
- Unit + property layers landed; 100% coverage on `packages/core/src/math/`.
- JSDoc gate green; changeset committed.

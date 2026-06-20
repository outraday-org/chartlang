# `math.*` — thin chart-aware math namespace

## Overview

Plain JS `Math.*` is **already allowed** on the author path (only
`Math.random` is forbidden — `packages/compiler/src/analysis/forbiddenConstructs.ts`
gates `random`, not the namespace). So this is deliberately **not** a re-wrap
of `abs`/`pow`/`sqrt`/`floor`/… The `math` namespace adds only the chart-aware
and Pine-parity helpers that bare `Math` cannot express: **tick-size
rounding**, **NaN-aware scalar helpers** (`na`/`nz`/`fixnan` as plain values,
distinct from the series-aware `ta.nz`), and a few variadic scalar reducers
(`avg`/`sum`) Pine authors reach for. Pure, frozen, compute-time — same shape
as `color` / `str`.

## Current State

- No `math` namespace. `grep -rn "export const math" packages/core/src` →
  nothing.
- `Math.*` (except `random`) is usable directly in `compute`.
- `ta.nz(series, replacement?)` exists for **Series** NaN-coalescing
  (`packages/core/src/ta/` + runtime); there is no **scalar** `nz` for plain
  numbers.
- `syminfo.mintick` (`packages/core/src/views/syminfo.ts`) is available to
  scripts — the input to tick rounding.
- Pure-namespace precedent: `color` (`packages/core/src/color/index.ts:20`),
  `str` (`../str-utilities/`).

## Target State

- A frozen `math` namespace exported from core + mirrored in the compiler
  ambient shim. v1 surface (all pure scalar, deterministic):
  - `math.roundToMintick(value, mintick)` — round `value` to the nearest
    multiple of `mintick` (price-snapping). `mintick ≤ 0` / NaN → returns
    `value` unchanged.
  - `math.roundTo(value, step)` — general round-to-nearest-multiple (alias
    family of the above; `roundToMintick` is `roundTo` with semantic intent).
  - `math.na(value)` — `Number.isNaN(value)` (Pine `na(x)`).
  - `math.nz(value, replacement?)` — scalar NaN-coalesce → `replacement ?? 0`
    when NaN/non-finite (the scalar twin of `ta.nz`).
  - `math.fixnan(value, lastGood)` — `na(value) ? lastGood : value` (caller
    threads `lastGood`; the stateful Pine `fixnan` lives in `ta`/`state`).
  - `math.avg(...values)` / `math.sum(...values)` — variadic scalar reducers,
    skip-NaN (NOT series — `ta.*` owns rolling reductions).
  - `math.sign(value)`, `math.clamp(value, lo, hi)`.
- Pine `math.round_to_mintick` / `na` / `nz` / `math.avg` / `math.sum` /
  `math.sign` map onto the namespace via the converter.
- Docs page + skill reference entry + example.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **No re-wrap of bare `Math`** | `Math.abs/pow/sqrt/floor/ceil/round/min/max/log/exp/...` already work and are deterministic. Re-exposing them as `math.*` doubles the surface for zero gain and invites drift. The namespace carries only what `Math` lacks. |
| **`roundToMintick(value, mintick)` takes the step explicitly** | The namespace is pure (no ambient `syminfo`). Author passes `syminfo.mintick`. Mirrors the `str.tostring(x, step)` decision. A future ambient `math.roundToMintick(x)` reading `syminfo` is deferred. |
| **Scalar `nz`/`na`/`fixnan` live in `math`, series versions stay in `ta`** | `ta.nz` operates on a `Series`; authors also need the plain-number form for intermediate scalars. Putting the scalar twins in `math` keeps `ta` series-only and gives a clear home. Documented cross-reference both ways. |
| **`avg`/`sum` are variadic scalar, not series** | Disambiguates from `ta.sma`/rolling sums. `math.avg(a, b, c)` is a fixed-arity scalar mean; rolling windows use `state.array(...).avg()` (`../array-analytics/`) or `ta.*`. |
| **Tick rounding via integer-multiple, not float `%`** | `Math.round(value / step) * step` with a guard for `step ≤ 0`/NaN; document the residual float error is identical to Pine's. |

## Dependency Graph

```
Task 1 (core math namespace + impl + unit/property tests + ambient shim)
  |
  v
Task 2 (pine-converter mapping + docs/skills/example)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Core `math` namespace](./1-core-math-namespace.md) | core, compiler | None | Medium |
| 2 | [Converter + docs/skills/example](./2-converter-docs-skills.md) | pine-converter, docs | 1 | Low |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| `color`/`str` frozen-namespace pattern | `packages/core/src/color/index.ts:20` | Template for `math` + ambient shim. |
| `ta.nz` semantics | `packages/core/src/ta/` + runtime | Match the replacement convention (`?? 0`) in the scalar twin; cross-link JSDoc. |
| `syminfo.mintick` | `packages/core/src/views/syminfo.ts` | Author-supplied step for `roundToMintick`. |
| Converter family transforms | `packages/pine-converter/src/transform/` | Add `math.*` subset mapping. |

## Provenance

N/A — fresh namespace; Pine `math.*` parity is reuse of semantics, not a port.

## Deferred / Follow-Up Work

- Ambient `math.roundToMintick(x)` reading `syminfo.mintick` directly.
- Pine `math.*` items intentionally left to bare `Math`
  (`abs`/`pow`/`sqrt`/`log`/`exp`/`floor`/`ceil`/`round`/`min`/`max`) — if
  parity-completeness is later desired, add thin aliases in one follow-up.
- `math.todegrees`/`math.toradians`, `math.gcd`/`math.factorial` (Pine parity,
  low demand).

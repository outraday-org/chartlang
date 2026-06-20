# `str.*` — string formatting namespace

## Overview

Give script authors a sanctioned, Pine-parity **string namespace** for
building the dynamic text that already-shipped `draw.text`, `draw.table`,
`draw.marker`, and `alert(...)` consume. Today an author has no curated way
to format a number to fixed precision or to a symbol's tick size — they fall
back to raw JS template literals + `.toFixed()`, which gives no parity with
Pine's `str.*` and no `syminfo.mintick`-aware rounding. This adds a **pure,
compute-time** `str` namespace (no slots, no runtime state, no capability) —
the same shape as the existing `color` namespace
(`packages/core/src/color/index.ts`).

## Current State

- No `str` namespace exists. `grep -rn "export const str" packages/core/src`
  returns nothing.
- Pure namespaces already exist as a pattern: `color`
  (`packages/core/src/color/index.ts:20`, a frozen object) is exported from
  the core barrel (`packages/core/src/index.ts:229`) and mirrored in the
  compiler's ambient script shim (`packages/compiler/src/program.ts:891`).
- `syminfo.mintick` is available to scripts
  (`packages/core/src/views/syminfo.ts`, field `mintick`), so tick-aware
  rounding can be offered without new plumbing.
- `draw.text` / `draw.table` / `alert` all accept plain `string` today, so
  `str.*` outputs drop straight in with no contract change.

## Target State

- `str` is a frozen namespace exported from `packages/core/src/index.ts`
  and declared in the compiler ambient shim, so scripts call `str.*` with no
  import and full type-checking.
- v1 surface (all pure, deterministic, host-independent — no `Intl`,
  no locale): `str.tostring`, `str.format`, `str.length`, `str.contains`,
  `str.startsWith`, `str.endsWith`, `str.replace`, `str.replaceAll`,
  `str.split`, `str.substring`, `str.upper`, `str.lower`, `str.trim`,
  `str.repeat`.
- The Pine converter maps `str.tostring` / `str.format` / `str.length` /
  `str.contains` / `str.replace_all` / `str.split` / `str.upper` /
  `str.lower` onto the chartlang surface.
- A docs reference page + author-skill reference entry + one runnable example
  (a formatted `draw.table` HUD).

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Pure namespace, no slot / no capability** | `str.*` is referentially transparent — same inputs, same output, every bar. It needs none of the slot lifecycle (`state.*`) or capability gating (`draw.*`). Model it on `color` (frozen object), not on `ta.*`. |
| **No `Intl` / locale** | The compiler pins `lib: ["lib.es2022.d.ts"]` and forbids host globals; outputs must be byte-identical across hosts (worker / quickjs). Number formatting is implemented with a hand-rolled fixed/precision formatter, never `toLocaleString`. |
| **`str.tostring(x, fmt?)` precision via format string** | Mirrors Pine `str.tostring(value, format)`. `fmt` is a Pine-style mask (`"#.##"`, `"0.0000"`, `"mintick"`). The literal `"mintick"` rounds to `syminfo.mintick` — but since the namespace is pure, the author passes the step explicitly via `str.tostring(x, syminfo.mintick)` (a numeric step) **or** uses `math.roundToMintick` (see `../math-utilities/`). The `"mintick"` keyword is **not** supported in v1 to keep the namespace side-effect-free; documented as a deferred follow-up. |
| **`str.format` is index-placeholder only** | `str.format("{0} / {1}", a, b)` with positional `{n}` and optional `{n,number,#.##}` numeric mask. No locale/date sub-formats (those need `Intl`). |

## Dependency Graph

```
Task 1 (core str namespace + impl + unit/property tests + ambient shim)
  |
  v
Task 2 (pine-converter mapping + conformance + docs + skill + example)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Core `str` namespace + formatter](./1-core-str-namespace.md) | core, compiler | None | Medium |
| 2 | [Converter + conformance + docs/skills/example](./2-converter-docs-skills.md) | pine-converter, conformance, docs | 1 | Medium |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| `color` frozen-namespace pattern | `packages/core/src/color/index.ts:20` | Template for the `str` frozen object + barrel export. |
| Compiler ambient shim block | `packages/compiler/src/program.ts:886-915` (color block) | Add the `str` `export const` mirror next to `color`. |
| `syminfo.mintick` | `packages/core/src/views/syminfo.ts` | Author passes as the numeric step to `str.tostring`. |
| Pine converter family transforms | `packages/pine-converter/src/transform/` | Add a `str.*` call mapping alongside existing families. |

## Provenance

N/A — not a `../invinite/` port. `str.*` is a fresh, pure namespace.

## Deferred / Follow-Up Work

- `str.tostring(x, "mintick")` keyword form (needs ambient `syminfo` access
  inside a pure fn — deferred).
- Locale / date sub-formats in `str.format` (needs `Intl`, host-variant).
- `str.tonumber(s)` parse helper.

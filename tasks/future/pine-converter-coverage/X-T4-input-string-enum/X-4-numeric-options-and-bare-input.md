# Task 4 — Numeric `input.int/float(options=)` + bare `input()` → source/typed

> **Status: TODO**

## Goal

Two remaining input-mapping gaps (both `MASM_Strat.md`), built on Task 1's core
numeric-enum surface + Task 2's array-literal parse, and alongside Task 3's
`inputs.ts` mapping:

1. **Numeric dropdowns** — `input.int(default, options=[8,21,30,…])` /
   `input.float(default, options=[…])` → chartlang `input.enum<number>`
   (the numeric `input.enum` form added by **Task 1**).
2. **Bare generic `input()`** — `input(title=…, defval=close)` (legacy form)
   → chartlang `input.source` for a series default, or the typed
   `input.int/float/bool/string` for a literal default.

## Prerequisites

- **Task 1** (core `input.enum<T extends string | number>`) — the numeric
  `input.enum<number>` target only type-checks after the core widening lands.
- **Task 2** (value-position `[…]` array-literal parse) — the numeric
  `options=[…]` needs it.
- **Task 3** — shares `src/transform/inputs.ts` + `src/mapping/inputs.ts`; land
  after (or with) Task 3 to avoid churn on the same `INPUT_MAP` rows, and reuse
  its element-type-distinction + default-mismatch check.

## Current Behavior

Ran built converter:

- `input.int(21, "", options=[8,21,30,50,100,200])` → `parse/expected-token`,
  `unexpected-token` + `input-arg-not-mapped`; emits `input.int(21)` (options
  dropped) and leaks the first element `8;`. Same `[…]` parse failure as the
  string case, plus no numeric-enum mapping.
- `lt = input(title="LT", defval=close)` → **no diagnostic**, but emits
  `let lt = input("LT", bar.close)` — `input` is a namespace, `input()` is not
  callable in chartlang; not hoisted to `manifest.inputs`. (MASM's `lt_trend`
  external-series feed.)

`src/transform/inputs.ts` walks `input.*` declarations; there is no branch for a
numeric `options=` arg nor for the bare `input(...)` callee. `INPUT_MAP`
(`src/mapping/inputs.ts`) maps `input.timeframe`→`input.interval` etc. but has no
bare-`input` entry.

## Desired Behavior

```ts
// input.int(21, "", options=[8,21,30,50,100,200])
inputs: { len: input.enum(21, [8, 21, 30, 50, 100, 200]) },   // numeric enum
// use sites: inputs.len as number  (length arg, comparisons keep working)

// lt = input(title="LT", defval=close)
inputs: { lt: input.source("close", { title: "LT" }) },        // series default → source
// reads: inputs.lt

// input(defval=14)   (literal default)
inputs: { n: input.int(14) },                                  // literal → typed
```

## Requirements

### 1. Numeric `input.int/float(options=[…])` → `input.enum<number>`

- In `src/transform/inputs.ts`, when an `input.int`/`input.float` carries an
  `options=` array literal (parsed via Task 2) whose elements are all numeric
  literals, emit `input.enum(<default>, [<numeric literals>])` instead of the
  bare `input.int/float`. This target only type-checks because **Task 1**
  widened core's `input.enum` to `T extends string | number`. Reuse Task 3's
  string-options → `input.enum` branch, parameterised by element type
  (`number` vs `string`).
- Validate `default ∈ options` (warn if not — reuse Task 3's check).
- Use sites: a numeric enum value is `number`; ensure the existing
  `inputs.<name> as number` cast still applies so length args / comparisons
  (`len == 8`, `ta.sma(close, len)`) type-check.

### 2. Bare `input()` → `input.source` (series) / typed (literal)

- Recognize a call whose callee is the **bare identifier `input`** (not
  `input.<member>`). Resolve its `defval` (positional or named) + optional
  `title`.
- **Series default** (`defval=close`/`open`/`hl2`/another series) → emit
  `input.source(<source-field-literal>, { title? })`, hoisted to
  `scaffold.inputs` (named by the bound symbol, e.g. `lt_trend` → `inputs.lt_trend`),
  exactly like the typed `input.*` path — never an inline `input(...)` call.
- **Literal default** → emit the typed factory by the default's type
  (`input.int`/`float`/`bool`/`string`).
- **Routing is a TRANSFORM decision, not a mapping-table lookup.** `INPUT_MAP`
  is keyed by Pine callee name and cannot branch on a runtime `defval` value, so
  the source-vs-typed choice lives in `src/transform/inputs.ts` (inspect the
  resolved `defval`: an OHLCV/series default → `input.source`; a literal default
  → the typed factory by literal type). Add a bare-`input` entry to `INPUT_MAP`
  **only as a recognised-primitive marker** (so the input is not dropped as an
  unknown `input.*`); the actual target is decided in the transform. This is the
  same pattern Task 3 uses for the string-vs-numeric element branch — the
  data/logic split is preserved (the table recognises, the transform decides).
- A non-literal, non-source `defval` (computed) → reject with a clear diagnostic
  (reuse `non-literal-input-default` / `non-literal-source-input` as fits).
- A bare `input()` with **no `defval`** or `defval=na` (no default to infer a
  type from) → reject via `non-literal-input-default` and skip the input (no
  `appendInput`).

### 3. Diagnostics

- Reuse existing input codes where possible. If the bare-`input` source path
  needs a distinct signal, append it to `src/diagnostics/codes.ts`
  (append-only).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/inputs.ts` | Modify | Numeric `options=` → `input.enum<number>`; bare `input()` → source/typed. |
| `packages/pine-converter/src/mapping/inputs.ts` | Modify | `INPUT_MAP` bare-`input` recognised-primitive marker (transform decides the target). |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify (if needed) | Append a bare-input/source code if no existing one fits. |
| `packages/pine-converter/src/transform/inputs.test.ts` | Modify | Numeric options, bare-input-source, bare-input-literal, non-literal reject. |
| `packages/pine-converter/CLAUDE.md` | Modify | Document numeric-enum + bare-`input` mapping in the §inputs invariants. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (100% coverage)
- `pnpm docs:check`

## Changeset

Covered by the shared T4 `@invinite-org/chartlang-pine-converter` **minor**
changeset (Tasks 2–4 add new converter surface). The core numeric-enum widening
ships its own `@invinite-org/chartlang-core` **minor** changeset in Task 1.

## Acceptance Criteria

- MASM's `ma_length = input.int(21, options=[8,21,30,50,100,200])` converts to
  `input.enum(21, [8,21,30,50,100,200])` with working numeric use sites.
- MASM's `lt_trend = input(title=…, defval=close)` converts to a hoisted
  `input.source("close", { title: … })` referenced as `inputs.lt_trend` — no
  inline `input(...)` call survives.
- A bare `input(defval=<literal>)` maps to the matching typed `input.*`.

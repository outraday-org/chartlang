# Task 3 — Transform: `input.string(options=[…])` → `input.enum`

> **Status: TODO**

## Goal

Map a Pine `input.string(default, title?, options=[literals])` dropdown onto
chartlang's `input.enum(default, [literals], { title? })`, validate that the
default is one of the options, and ship the fixture triple + compile
round-trip + docs/CLAUDE.md updates. With T4 Task 2 (array-literal parse) in
place, the `options=` value now reaches the input transform as an
`ArrayLiteralExpression` instead of breaking parsing.

## Prerequisites

- T4 Task 2 (value-position `[…]` array literals parse).

## Current Behavior

- `packages/pine-converter/src/transform/inputs.ts` emits one
  `InputDeclarationIR` per `input.*` site. It **rejects** Pine `input.enum`
  (`input-enum-rejected`) and **drops** unmapped named args — including
  `options` — via `input-arg-not-mapped` (warning), emitting a plain
  `input.string(default)`.
- `packages/pine-converter/src/mapping/inputs.ts` (`INPUT_MAP`) maps
  `input.string` → `input.string`; there is no `string`+`options` → `enum`
  bridge.
- Result (per T4 README evidence): the dropdown constraint is lost; the value
  becomes a free-text string input.

## Desired Behavior

```pine
ma_type = input.string("EMA", "MA Type", options = ["SMA", "EMA"])
```
→
```ts
inputs: {
    ma_type: input.enum("EMA", ["SMA", "EMA"], { title: "MA Type" }),
}
```

- `ma_type == "EMA"` comparisons keep working (the enum value is the string).
- A `default` not present in `options` → a new warning
  `input-string-options-default-mismatch`, still emitting the enum (default
  clamped per `input.enum`'s own contract — verify in
  `packages/core/src/input/input.ts`).
- Non-literal options (an identifier / computed element) → keep a reject
  (`input-string-options-not-literal`), fall back to plain `input.string`.

## Requirements

### 1. Detect the `options=` named arg (`src/transform/inputs.ts`)

- In the `input.string` branch, look for a named arg `options` whose value is
  an `ArrayLiteralExpression` (from Task 2). **Distinguish element type by
  inspecting `ArrayLiteralExpression.elements`** (the AST records each
  element's literal kind): when present and **every element is a string
  literal**, switch the emit target to `input.enum` (this task). When every
  element is a **numeric literal**, defer to Task 4's numeric branch (do not
  handle it here). When the elements are **mixed or non-literal**, fall back to
  plain `input.string` + the `input-string-options-not-literal` diagnostic
  (below).
- Resolve the title from the positional title arg or a `title=` named arg as
  today; thread it into the `{ title }` opts.

### 2. Emit `input.enum` (verbatim source string)

- `InputDeclarationIR.code` becomes — note core's signature is
  `input.enum(default, options, { title? })`, so the **title is an options
  OBJECT, not a trailing string slot**:
  ```ts
  `input.enum(${defaultLiteral}, [${optionLiterals.join(", ")}]${
      title ? `, { title: ${titleLiteral} }` : ""
  })`
  ```
  Match the existing verbatim-string IR convention (inputs are
  `{ name, code }`). (The earlier draft's `…]${titleOpts})` form was wrong — it
  spliced the title directly after `]` instead of inside a `{ title: … }`
  object.)
- Keep the `inputs.<name>` reference rewrite working (Task 16 / `emitContext`
  already rewrites a bound input name); no change needed there since the name
  is unchanged.

### 3. Validation + diagnostics (append-only, `src/diagnostics/codes.ts`)

- `input-string-options-default-mismatch` (warning) — default ∉ options.
- `input-string-options-not-literal` (warning) — a non-literal option element;
  fall back to `input.string`, drop options.
- Both appended (never reorder); reference by short key via `pushCode`.

### 4. Fixture triple (`packages/pine-converter/fixtures/`)

- `NN-input-string-enum.pine` + `.expected.chart.ts` + `.expected.diagnostics.json`
  covering: a 2-option selector, a selector used in a `== "X" ? …` comparison,
  and a default-mismatch case. The clean case must pass the compile round-trip
  in `src/tests/fixtures-compile.test.ts` (do **not** add to
  `KNOWN_NON_COMPILING`).

### 5. Docs + CLAUDE.md

- `docs/converter/supported.md`: add the `input.string(options=)` → `input.enum`
  row. `docs/converter/diagnostics.md` (generated) picks up the two new codes —
  run the generator.
- `packages/pine-converter/CLAUDE.md` "Transform: inputs" invariant: note the
  `string`+`options` → `enum` bridge and that Pine `input.enum` (UDT) stays
  rejected.

### 6. Tests

- `src/transform/inputs.test.ts`: enum mapping, title threading, default
  mismatch, non-literal option fallback. 100% coverage.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/inputs.ts` | Modify | `string`+`options` → `enum` branch + validation. |
| `packages/pine-converter/src/transform/inputs.test.ts` | Modify | Unit tests. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append two codes. |
| `packages/pine-converter/fixtures/NN-input-string-enum.*` | Create | Fixture triple. |
| `docs/converter/supported.md` | Modify | Mapping row. |
| `docs/converter/diagnostics.md` | Modify (regenerate) | New codes. |
| `packages/pine-converter/CLAUDE.md` | Modify | Inputs invariant note. |
| `.changeset/converter-input-string-enum.md` | Create | minor (pine-converter; may be the shared T4 changeset). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage on pine-converter; fixture compile round-trip green)
- `pnpm docs:check`
- `pnpm readme:check`

## Changeset

`.changeset/converter-input-string-enum.md` — **minor**
(`@invinite-org/chartlang-pine-converter`) — new converter surface. May be the
shared T4 pine-converter **minor** changeset across Tasks 2–4.

## Acceptance Criteria

- Trend Wizard's `preset_select`, per-MA `"SMA"/"EMA"`, `Excl` `"0"/"1"/"2"`,
  and plot-type selectors convert to `input.enum` with no parse errors and
  working string comparisons.
- Default-mismatch and non-literal-option paths each emit their documented
  diagnostic; non-literal falls back to `input.string` (no hard failure).
- Fixture triple compiles in the round-trip; coverage + docs gates green;
  changeset committed.

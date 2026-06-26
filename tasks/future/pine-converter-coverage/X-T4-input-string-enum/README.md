# T4 — Converter: input dropdowns + bare `input()` → `input.enum` / `input.source`

## Overview

Three converter input-mapping gaps in `src/transform/inputs.ts`, plus one
**core prerequisite**:

1. **`input.string(default, title, options=[…])`** (string dropdown) → chartlang
   `input.enum(default, [...])`. Trend Wizard relies on this for `preset_select`,
   the per-MA type selectors (`"SMA"/"EMA"`), the crossing `"Excl"` codes, and
   the plot-type selectors.
2. **`input.int(default, options=[8,21,30,…])`** (numeric dropdown, MASM
   `ma_length`) → `input.enum<number>`.
3. **Bare `input(title=…, defval=close)`** (the legacy generic / source form,
   MASM's `lt_trend` external-series feed) → chartlang `input.source`.

The converter work shares the `[…]` **array-literal parse** gap (Task 2) and the
`inputs.ts` mapping. But gap #2 has no faithful target today: chartlang core's
`input.enum` is **string-only** (`enum<T extends string>`). So **Task 1 extends
core `input.enum` to `T extends string | number`** before the numeric-options
lowering can land. Today the `options=[…]` array literal fails to parse, and bare
`input()` emits an invalid `input(...)` call.

## Current State (evidence — ran built converter)

Pine `sel = input.string("EMA", "MA Type", options=["SMA","EMA"])` →
`pine-converter/parse/expected-token`, `unexpected-token`, plus
`pine-converter/transform/input-arg-not-mapped`. Output drops the options and
leaks the first array element as a statement:

```ts
inputs: { sel: input.string("EMA") },
compute({ … }) {
    "SMA";                          // array element leaked
    plot(((inputs.sel as string) == "EMA") ? bar.close : bar.open);
}
```

Root causes:
- The Pratt parser treats `[` **only** as postfix history-access
  (`src/parser/expressions.ts`), so a `[…]` **array literal in value
  position** (here, the `options=` named-arg value) does not parse →
  `expected-token`.
- `src/transform/inputs.ts` rejects Pine `input.enum`
  (`input-enum-rejected`) and drops unmapped named args (`options`) via
  `input-arg-not-mapped`; there is no `input.string`+`options` → `input.enum`
  bridge.

MASM evidence (ran built converter):
- `input.int(21, "", options=[8,21,30,50,100,200])` → `parse/expected-token`,
  `unexpected-token` + `input-arg-not-mapped`; emits `input.int(21)` (options
  dropped) and leaks `8;` — same `[…]` parse failure, numeric variant.
- `lt = input(title="LT", defval=close)` → **no diagnostic**, but emits
  `let lt = input("LT", bar.close)` — not valid chartlang (`input` is a
  namespace, `input()` is not callable) and not hoisted to `manifest.inputs`.

## Target State

- Parse `[a, b, c]` **array literals in value position** (at minimum as a
  named-arg value; ideally generally).
- `input.string(default, title?, options=[literals])` → chartlang
  `input.enum(default, [literals], { title? })`.
- `default` must be one of the options (Pine guarantees this); validate and
  warn if not.
- String comparisons against the value (`sel == "EMA"`) keep working
  (enum value is the string).
- `input.int/float(default, options=[…])` → `input.enum<number>` (numeric
  dropdown); numeric comparisons (`len == 8`) and use as a length arg keep
  working.
- Bare `input(defval=<series>)` / `input(title=…, defval=close)` → chartlang
  `input.source` (hoisted to `manifest.inputs`, referenced as `inputs.<name>`),
  not an inline `input(...)` call. A bare `input(defval=<literal>)` maps to the
  corresponding `input.int/float/bool/string` by the default's type.

## Architecture Decisions (to finalize in step 2)

| Decision | Notes |
|----------|-------|
| Array-literal parse scope | A general value-position `[…]` array literal is the clean fix and also helps elsewhere; scope to named-arg values if general parsing is risky. Note: `[a,b] = …` tuple **destructuring** is a different statement-leading form already handled — don't regress it. |
| Map to `input.enum`, not free-text | chartlang `input.enum` exists (`packages/core/src/input/input.ts`) and gives the dropdown + validation parity. |
| Options must be compile-time literals | Matches `input.enum`'s contract and the converter's literal-default rule. Non-literal options → keep today's reject with a clear code. |
| Numeric options → `input.enum<number>` (**needs core**) | Core `input.enum` is string-only today; **Task 1 widens it to `T extends string \| number`** (decided: add the core feature first). The converter then routes numeric `options=` (array-literal from Task 2) through an `inputs.ts` branch keyed on the `input.int`/`input.float` factory; the enum value type is `number`. |
| Bare `input()` → `input.source` vs typed | `input(defval=<series source>)` (OHLCV / another series) → `input.source`; `input(defval=<literal>)` → the typed `input.int/float/bool/string`. Pine's generic `input()` infers type from `defval`; mirror that. **The source-vs-typed choice is a TRANSFORM decision** (inspects the `defval` value) — `INPUT_MAP` only carries a recognised-primitive marker for bare `input`, it cannot branch on a runtime arg value. |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| Input transform | `src/transform/inputs.ts` | Add the `string`+`options` → `enum` branch. |
| Input mapping table | `src/mapping/inputs.ts` (`INPUT_MAP`) | Target name/shape + bare-`input` recognised-primitive marker. |
| `input.enum` core surface | `packages/core/src/input/input.ts`, `inputDescriptor.ts` | **EXTENDED** (not a new symbol) — widen the generic to `string \| number` (Task 1). |
| `input.source` core surface | `packages/core/src/input/input.ts` | Emission target for bare `input(defval=<series>)`. |
| Pratt parser primary/postfix | `src/parser/expressions.ts` | Array-literal parsing. |

## Dependencies

- Task 1 (core numeric enum) is a **cross-package prerequisite** for Task 4's
  numeric-options lowering — it lands in `core` + the compiler shim.
- The array-literal parse (Task 2) is also a dependency of **T5** (tuple
  `request.security` `[high, low]` source-list arg is a different position, but
  consumes the same array-literal node) — T5 should depend on T4 Task 2 rather
  than re-implement it; coordinate the parser change.

## Dependency Graph

```
Task 1 (core: input.enum<T extends string | number>)   Task 2 (parser: value-position [...] array literal)
        |                                                       |
        |                          +----------------------------+----------------------------+
        |                          v                                                         v
        |                  Task 3 (transform: input.string(options=) -> input.enum)          |
        |                          |                                                         |
        +--------------------------+----------------------------+----------------------------+
                                                                v
                              Task 4 (transform: numeric input.int/float(options=) -> input.enum<number>
                                      + bare input()/source -> input.source)   [needs Tasks 1, 2, 3]
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Core: extend `input.enum` to `string \| number`](./1-core-numeric-enum.md) | core (+ compiler shim) | None | Small–Medium |
| 2 | [Parser: value-position `[…]` array literals](./2-parser-array-literal.md) | pine-converter | None | Medium |
| 3 | [Transform: `input.string(options=)` → `input.enum`](./3-transform-string-options-to-enum.md) | pine-converter | 2 | Medium |
| 4 | [Transform: numeric `input.int/float(options=)` → `input.enum<number>` + bare `input()` → `input.source`](./4-numeric-options-and-bare-input.md) | pine-converter | 1, 2, 3 | Medium |

## Acceptance Criteria

- Trend Wizard's `preset_select` / MA-type / `Excl` / plot-type inputs convert
  to `input.enum` with no parse errors and working string comparisons.
- MASM's `ma_length` numeric dropdown converts to `input.enum<number>`, and
  `lt_trend = input(defval=close)` converts to a hoisted `input.source`.

## Changesets

- **`@invinite-org/chartlang-core` — minor** (Task 1: widened `input.enum`
  generic, additive).
- **`@invinite-org/chartlang-pine-converter` — minor** (Tasks 2–4: new converter
  surface — array-literal parsing + enum/source input mapping). May be one shared
  changeset across Tasks 2–4.

## Deferred / Follow-Up

- `input.enum` backed by a Pine **UDT enum** stays rejected (out of scope).

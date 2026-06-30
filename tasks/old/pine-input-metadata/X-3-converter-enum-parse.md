# Task 3 — Converter: parse native Pine `enum` declarations + register members

> **Status: Complete + Ship**

## Goal

Teach the converter parser + semantic analyzer to recognise a native Pine
`enum Name` declaration (currently `unexpected-token`), producing an
`EnumDeclaration` AST node and a semantic symbol that maps the enum type to
its ordered members and their string values. This is the foundation Task 4
uses to lower `input.enum(EnumType.member, …)`.

## Prerequisites

None (parser-only; independent of Tasks 1/2 but numbered after them to keep
execution order linear).

## Current Behavior

`parseKeywordStatement` (`packages/pine-converter/src/parser/statements.ts:682`)
has no `enum` arm, and `packages/pine-converter/src/lexer/keywords.ts` does
not include `enum`, so an `enum Signal` line is currently lexed as
identifiers and falls through to `unexpected-token` + `recoverLine`,
discarding the declaration and leaving every `Signal.member` reference as
`unknown-identifier`. `input.enum(...)` is then hard-rejected by the transform
(`input-enum-rejected`).

## Desired Behavior

A declaration like:

```pine
enum Signal
    buy  = "Buy Signal"
    sell = "Sell Signal"
    flat                       // no string ⇒ value is the field name "flat"
```

parses into an `EnumDeclaration` node and registers a `kind: "enum-type"`
semantic symbol carrying ordered members `[{ name: "buy", value: "Buy
Signal" }, { name: "sell", value: "Sell Signal" }, { name: "flat", value:
"flat" }]`. A reference `Signal.buy` resolves (no `unknown-identifier`).

## Requirements

### 1. AST node (`packages/pine-converter/src/ast/statements.ts`)

Add a pure `export type` node (deeply readonly, kebab-case `kind`, 1-based
`span`), following the `FunctionDeclaration` precedent:

```ts
export type EnumMember = Readonly<{
    name: string;
    /** The `= "literal"` title, or null when omitted (value defaults to `name`). */
    value: string | null;
    span: SourceSpan;
}>;

export type EnumDeclaration = Readonly<{
    kind: "enum-declaration";
    name: string;
    members: readonly EnumMember[];
    span: SourceSpan;
}>;
```

Add `EnumDeclaration` to the `Statement` union. The AST module is
coverage-excluded (declarations only).

### 2. Lexer + parser (`packages/pine-converter/src/lexer/keywords.ts`, `parser/statements.ts`)

Add `"enum"` to `PINE_V6_KEYWORDS` and cover it in the keyword tests so the
parser can reach `parseKeywordStatement`. Then add an `enum` arm to
`parseKeywordStatement` calling a new `parseEnumDeclaration(ctx, start)`:

- After `enum`, expect an `identifier` (the type name) — missing →
  `expected-token` + `recoverCompound`, return `null`.
- Expect `newline indent` … `dedent` (reuse `parseBlock`'s block-boundary
  handling; or walk members with `skipNewlines()` between them like the
  switch-arm precedent). An enum with no indented body → `expected-token` +
  `recoverCompound`.
- Each member line: an `identifier` (field name), optionally followed by `=`
  and a **string literal** (read the string token's text directly, the way
  `parseExpression`/`LITERAL_TOKEN_KINDS` in `parser/expressions.ts` does —
  there is no parser-level `stringLiteralOf` helper; that name lives in
  `transform/inputs.ts`). A member
  with a non-string `= <expr>` value, or a non-identifier member, →
  `unsupported-enum-member` (new error code) for that member; recover to the
  next member line, keep parsing the rest.
- Return the `EnumDeclaration`; on a fully malformed head return `null`
  (block-recovered).

Mirror the `looksLikeFunctionDeclaration` bounded-lookahead discipline — do
not consume tokens you cannot complete. The parser never throws.

### 3. Every exhaustive statement walker gets an `enum-declaration` arm

Adding to the `Statement` union means **every** exhaustive `switch` over
statement `kind` must handle the new kind (mirror how `FunctionDeclaration` /
`SwitchExpression` were threaded — see `packages/pine-converter/CLAUDE.md`).
There are ~11 statement switches across 8 files; an `enum-declaration` is a
compile-time constant that emits nothing, so each arm is a **no-op** (`return
[]` / `break` / skip — match the file's `function-declaration` arm, which is
already a no-op in most of these). The full set to update:

- `semantic/analyze.ts` — `walkStatement` (real registration, see §4).
- `semantic/statefulness.ts` — statement fact collector (no-op).
- `semantic/drawingCamp.ts` — drawing-site scanner (no-op).
- `transform/controlFlow.ts` — the statement switches here (no-op arms).
- `transform/declaration.ts` — drawing-declaration walk (no-op).
- `transform/inputs.ts` — the statement walk in input collection (no-op; the
  enum decl feeds input lowering via the symbol table in Task 4, not here).
- `transform/other.ts` — `emitStatement` **and** the other statement switches
  in this file (body emitter / CFG traversal) — no-op arms (`return []`).
- `transform/udfInline.ts` — statement-substitution switch (no-op).

Do not rely on the typecheck alone to find these: switches with a `default`
arm will silently mis-handle an enum statement rather than error, so add the
explicit `enum-declaration` arm to each. Confirm completeness with a repo
grep for statement-`kind` switches after the union change.

### 4. Semantic registration (`packages/pine-converter/src/semantic/`)

- Add a `kind: "enum-type"` `SymbolInfo` variant carrying
  `members: readonly { name: string; value: string }[]` (the resolved value:
  the `= "literal"` string, or the member `name` when null) in declaration
  order, plus the default member name (the **first** member — Pine's enum
  default is the first declared field).
- Register enum types in a **pre-pass** so forward references resolve
  (mirror `registerUserFunctions` hoisting). `analyze` registers the symbol
  keyed by the declaration span (the `symbols` map), extends the root scope so
  `Signal` resolves to the `enum-type` symbol, and adds an explicit
  `enumTypes: ReadonlyMap<string, EnumTypeInfo>` (or equivalent named type) to
  `SemanticResult` so Task 4 can transform `input.enum` and `EnumType.member`
  without walking scope internals.
- A `Signal.member` member-access where `Signal` is a registered enum type
  must NOT raise `unknown-identifier`; an unknown member on a known enum →
  `unknown-enum-member` (new error) at the reference. A duplicate enum-type
  name → reuse the existing redeclaration handling (or `accidental-shadowing`
  precedent) — pick the lexically-first, warn once.
- `enum-type` symbols carry no lifetime/statefulness (they are compile-time
  constants).

### 5. Diagnostic codes (`packages/pine-converter/src/diagnostics/codes.ts`)

Append (no reorder), namespaced correctly:

- `pine-converter/parse/unsupported-enum-member` (error) — a non-identifier
  member or a non-string `= value`.
- `pine-converter/semantic/unknown-enum-member` (error) — `EnumType.x` where
  `x` is not a declared member.

(`input-enum-rejected` is **removed** in Task 4, not here.)

### 6. Tests

- `parser/parseEnum.test.ts`: a clean 3-member enum (mixed valued/unvalued),
  a missing-name head (reject + recover), an empty body (reject), a
  non-string member value (`unsupported-enum-member` + continue). Assert the
  AST shape + spans.
- `semantic/enumType.test.ts`: forward + backward `Signal.buy` references
  resolve; `Signal.nope` → `unknown-enum-member`; default member is the
  first; member values resolve title-or-name correctly.
- Synthetic-AST coverage for any defensive walker arm unreachable from real
  source (the established precedent).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/ast/statements.ts` | Modify | `EnumDeclaration` + `EnumMember` + union member |
| `packages/pine-converter/src/lexer/keywords.ts` | Modify | Add `enum` to the Pine keyword set |
| `packages/pine-converter/src/lexer/*.test.ts` | Modify | Keyword coverage for `enum` |
| `packages/pine-converter/src/parser/statements.ts` | Modify | `enum` arm + `parseEnumDeclaration` |
| `packages/pine-converter/src/semantic/analyze.ts` (+ `types.ts`, pre-pass module) | Modify | `enum-type` symbol + hoisting + member resolution + `SemanticResult.enumTypes` lookup |
| `packages/pine-converter/src/transform/other.ts` | Modify | No-op `enum-declaration` arm in `emitStatement` + the other statement switches in this file |
| `packages/pine-converter/src/transform/{controlFlow,declaration,inputs,udfInline}.ts` | Modify | No-op `enum-declaration` arm in each exhaustive statement switch |
| `packages/pine-converter/src/semantic/{statefulness,drawingCamp}.ts` | Modify | No-op `enum-declaration` arm in each statement walker |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | 2 new codes |
| `docs/converter/diagnostics.md` | Regenerate | Generated via `pnpm converter:docs:generate` after adding codes |
| `packages/pine-converter/src/parser/parseEnum.test.ts` | Create | Parser coverage |
| `packages/pine-converter/src/semantic/enumType.test.ts` | Create | Semantic coverage |
| `packages/pine-converter/CLAUDE.md` | Modify | Document the `enum` parse + `enum-type` symbol invariant |
| `.changeset/converter-enum-parse.md` | Create | Changeset |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on parser/semantic/codes touched files)
- `pnpm converter:docs:check`

## Changeset

`.changeset/converter-enum-parse.md` — **patch** bump for
`@invinite-org/chartlang-pine-converter` (no user-visible output change yet;
enum lowering lands in Task 4).

## Acceptance Criteria

- A native `enum Name` declaration parses to an `EnumDeclaration` with
  ordered members + per-member value resolution (title-or-name).
- `enum` is lexed as a keyword, and `SemanticResult` exposes an enum-type
  lookup for Task 4.
- Forward/backward `EnumType.member` references resolve; unknown members →
  `unknown-enum-member`; malformed members → `unsupported-enum-member`; the
  parser never throws.
- All exhaustive statement walkers handle `enum-declaration`; `compute` emit
  is a no-op.
- New codes registered; `codes.test.ts` namespace + coverage-grep pass.
- `docs/converter/diagnostics.md` regenerated from the diagnostic registry;
  `converter:docs:check` green.
- 100% coverage on touched files; CLAUDE.md updated; changeset committed.

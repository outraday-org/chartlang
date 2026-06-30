# Task 4 — Converter: lower native `input.enum(EnumType.member, …)`

> **Status: TODO**

## Goal

Replace the `input-enum-rejected` hard-reject with a real lowering of Pine's
native `input.enum(EnumType.member, "Title", …)` to chartlang
`input.enum("<member value>", ["<all member values>"], { title, group,
inline, tooltip, … })`, using the `enum-type` symbol Task 3 registered and
the metadata-opts emission Task 2 built.

## Prerequisites

- Task 1 (core `input.enum` opts accept `group`/`inline`/`tooltip`/etc.).
- Task 2 (the shared metadata-opts emission in `buildOptions` / enum bridge).
- Task 3 (the `EnumDeclaration` AST + `enum-type` semantic symbol +
  member resolution).

## Current Behavior

`buildInputCode` (`packages/pine-converter/src/transform/inputs.ts:525`):

```ts
if (primitive === "input.enum") {
    diagnostics.pushCode("input-enum-rejected", call.span);
    return null;
}
```

So `input.enum(Signal.buy, "Signal")` is dropped entirely. Note: the
converter-synthesised `options=[…]` → `input.enum` **bridge** (string/numeric
dropdowns) is a separate, already-working path and is untouched here.

## Desired Behavior

Given Task 3's `enum Signal { buy="Buy Signal", sell="Sell Signal", flat }`:

```pine
sig = input.enum(Signal.sell, "Entry Signal", group="Trade", tooltip="…")
```

lowers to:

```ts
sig: input.enum("Sell Signal", ["Buy Signal", "Sell Signal", "flat"],
    { title: "Entry Signal", group: "Trade", tooltip: "…" }),
```

- default = the referenced member's resolved value.
- options = **all** members' resolved values, in declaration order.
- the opts object carries the same `title`/`group`/`inline`/`tooltip`/
  `display`/`confirm` passthrough as every other input (Task 2).

## Requirements

### 1. Remove the reject; resolve the enum reference (`inputs.ts`)

Replace the `input.enum` reject arm in `buildInputCode` with a call to a new
`buildNativeEnum(call, analysis, diagnostics)`. The transform needs read
access to the `enum-type` symbol table — thread `analysis` (or just the
enum-symbol lookup) into `buildInputCode` / `transformInputs`'s `WalkState`
(it already carries `scaffold` + `diagnostics`; add the lookup).

`buildNativeEnum`:

1. The **first positional arg** must be a member-access `EnumType.member`.
   Resolve `EnumType` against the enum-type table:
   - not an enum-type member-access (e.g. a bare literal, an unknown type) →
     `input-enum-default-not-member` (new error) + return `null`.
   - `EnumType` unknown → `input-enum-default-not-member` (the semantic pass
     already raised `unknown-identifier`/`unknown-enum-member`; keep this a
     transform-level reject so the input is skipped cleanly).
2. `default` = the member's resolved value, JSON-quoted.
3. `options` = `[` + every member value JSON-quoted, declaration order, `]`.
4. opts fragment = the shared metadata builder (Task 2) reading the named
   args **and** the 2nd positional `title` (mirror `enumTitleOpt`'s
   positional-title handling — Pine `input.enum(default, title, …)`).
5. Emit `input.enum(<default>, [<options>], <opts?>)` (omit the opts object
   when empty).

### 2. Reuse, do not fork, the metadata-opts emission

The opts fragment for a native enum is **identical** to the dropdown-bridge
opts (Task 2 §4). Extract that into one shared helper (e.g.
`buildEnumOpts(call, named, diagnostics)`) used by BOTH `resolveOptionsEnum`
(the `options=[…]` bridge) and `buildNativeEnum`, so the
title/group/inline/tooltip/display/confirm logic lives once.

### 3. The reference cast (`other.ts` `inputCastType`)

`other.ts` casts an input read by its factory: `input.enum("…"` → `string`,
`input.enum(21,` (numeric) → `number`. A native enum lowers to a
**string** `input.enum("…", […])`, so it casts as `string` — confirm the
existing `inputCastType` gate (keyed on `input.enum("`) already covers the
native-enum output (it produces a string-default enum, so the `"`-prefixed
gate matches). Add a test asserting `inputs.sig as string`.

### 4. Member references in `compute` bodies

A Pine script may compare a value against `Signal.buy` outside the input
(e.g. `preset == Signal.buy`). Lower a bare `EnumType.member` expression to
its resolved value string literal (`"Buy Signal"`). Member-access expressions
(`kind: "member-access-expression"`) are emitted by `emitMemberChain` in
`packages/pine-converter/src/transform/exprEmit.ts` (the `case
"member-access-expression"` arm, ~line 223) — that is where the enum-type
case belongs: before falling through to `emitMemberChain`, look up
`head`/`chain[0]` against the enum-type symbol table and, when it resolves to
a known member, emit the JSON-quoted value instead. Thread the enum lookup
into `exprEmit`'s context the same way Requirement 1 threads it into
`buildInputCode`. An unknown member here is already `unknown-enum-member`
(Task 3); the emitter falls back to the existing verbatim `emitMemberChain`
output only if unresolved. Add a fixture witness.

### 5. Diagnostics

- `pine-converter/transform/input-enum-default-not-member` (error, append to
  `codes.ts`) — `input.enum`'s default is not an `EnumType.member`.
- **Remove** `input-enum-rejected` from `codes.ts` (defined there, namespace
  `pine-converter/transform/`) and its assertions. The code is referenced in
  `src/transform/inputs.ts` (the reject arm being replaced),
  `src/transform/input-rejects.test.ts`, and
  `src/transform/inline-input.test.ts`; update those transform test files. A
  `src/parser/parse-udt-reject.test.ts` file exists, but it covers `type` /
  `method` / `import` parser rejects and is not an `input-enum-rejected`
  assertion site unless a local grep proves otherwise. (Do not touch
  `CHANGELOG.md`'s historical mention.) Removing a code is
  acceptable here — it was a "not supported" marker, now superseded; note it
  in the changeset and CLAUDE.md as a behavior change. If downstream tooling
  pins it, prefer retiring it to an unused-but-registered entry — pick
  removal unless the `codes.test.ts` namespace/coverage-grep cross-check
  forbids an orphan; document the choice.

### 6. Fixtures (goldens)

- `49-input-string-enum` and `50-numeric-options-and-bare-input` stay the
  **bridge** witnesses (untouched behavior).
- Add `77-native-enum-input.pine`: an `enum` decl + an `input.enum(
  EnumType.member, "Title", group=…, tooltip=…)` + a `value == EnumType.other`
  comparison. Expected `.chart.ts` shows the string-enum lowering + the
  metadata opts + the member-comparison lowering; expected
  `.diagnostics.json` is clean (or carries only the expected infos). Fixtures
  are auto-discovered, so bump the corpus-size assertion in `golden.test.ts`
  (`expect(pineFixtures.length).toBe(77)` after Task 2 → `.toBe(78)`).
  Confirm `fixtures-compile.test.ts` round-trips it (needs Task 1's core
  opts). `77` is the next free numeric prefix.
- Update any fixture/test that asserted `input-enum-rejected`.

### 7. Docs + skill

- `docs/converter/supported.md`: move `input.enum` from rejected → supported.
- `docs/converter/rejects.md`: drop `input-enum-rejected`, add
  `input-enum-default-not-member` where relevant.
- Regenerate `docs/converter/diagnostics.md` with
  `pnpm converter:docs:generate`; do not hand-edit it (`docs/CLAUDE.md` marks
  it generated).
- `packages/pine-converter/CLAUDE.md` "Transform: inputs": replace the
  "`input.enum` STAYS rejected via `input-enum-rejected`" wording with the
  native-enum lowering description (keep the bridge distinction explicit).
- `skills/chartlang-coding/references/translating-from-pine.md`: native enum
  row.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/inputs.ts` | Modify | `buildNativeEnum` + shared `buildEnumOpts`; remove reject |
| `packages/pine-converter/src/transform/exprEmit.ts` | Modify | `EnumType.member` member-access lowering (the `member-access-expression` arm) |
| `packages/pine-converter/src/transform/other.ts` | Modify | `inputCastType` confirmation for the string-default native enum |
| `packages/pine-converter/src/transform/inputs.test.ts` | Modify | Native-enum unit coverage |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Add `input-enum-default-not-member`; remove `input-enum-rejected` |
| `packages/pine-converter/fixtures/77-native-enum-input.*` | Create | Golden witness |
| `packages/pine-converter/src/tests/golden.test.ts` | Modify | Bump corpus-size assertion `toBe(77)` → `toBe(78)` |
| `packages/pine-converter/src/transform/input-rejects.test.ts`, `inline-input.test.ts` | Modify | Drop `input-enum-rejected` assertions |
| `packages/pine-converter/CLAUDE.md` | Modify | Native-enum invariant |
| `docs/converter/supported.md`, `rejects.md` | Modify | Doc the support |
| `docs/converter/diagnostics.md` | Regenerate | Generated via `pnpm converter:docs:generate`; do not hand-edit |
| `skills/chartlang-coding/references/translating-from-pine.md` | Modify | Enum row |
| `.changeset/converter-native-enum.md` | Create | Changeset |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on pine-converter; `codes.test.ts` namespace +
  coverage-grep pass after the code add/remove)
- `pnpm skills:gate`
- `pnpm converter:docs:check`
- Converter golden + `fixtures-compile` suites green

## Changeset

`.changeset/converter-native-enum.md` — **minor** bump for
`@invinite-org/chartlang-pine-converter` (new supported surface; note the
removed `input-enum-rejected` code as a behavior change).

## Acceptance Criteria

- `input.enum(EnumType.member, "Title", group=…, …)` lowers to a
  string-backed chartlang `input.enum` with default = member value, options =
  all member values in declaration order, and the full metadata opts.
- The dropdown-bridge path (`options=[…]`) is unchanged; opts emission is
  shared (one helper, no fork).
- `EnumType.member` comparisons in `compute` lower to the member value
  string; `inputs.<name> as string` cast verified.
- Fixture 77 converts AND compiles; `input-enum-rejected` removed; new code
  registered. (Fixture 77 is the **primary** native-enum witness — the
  reference scripts `MASM_Strat.md` / `Trend_Wizard.md` use no native `enum`
  / `input.enum`, so they do **not** exercise this path.)
- `MASM_Strat` / `Trend_Wizard` still convert cleanly with preserved input
  panels (this witnesses Task 2's metadata passthrough, not native enum;
  manual spot-check is acceptable evidence).
- 100% coverage; docs + CLAUDE.md + skill updated; changeset committed.

# Pine Input Metadata Parity (group / inline / tooltip / display / confirm + native `input.enum`)

## Overview

TradingView Pine Script lets every `input.*` declaration carry UI-layout
and help metadata — `group` (section header), `inline` (same-row
grouping), `tooltip` (hover help), `display` (status-line / data-window
visibility), and `confirm` (prompt-on-add) — plus a native `input.enum`
backed by a user-declared `enum` type. chartlang's input model currently
carries only `defaultValue`, `title`, numeric `min`/`max`/`step`,
`multiline`, `pickFromChart`, and enum `options`. The Pine converter
therefore **drops** `group`/`inline`/`tooltip`/`confirm`/`display` with an
`input-arg-not-mapped` warning and **rejects** native `input.enum` with
`input-enum-rejected`.

This phase closes that gap so a converted script (e.g. `MASM_Strat`,
`Trend_Wizard`) preserves its panel structure, and an adapter can read
`manifest.inputs` and render a grouped, tooltip-annotated settings panel
that matches the original. It adds:

1. Five presentation-only metadata fields to the core input descriptors +
   builders (`group?`, `inline?`, `tooltip?`, `display?`, `confirm?`).
2. Converter pass-through of those five fields (replacing the drop).
3. Native Pine `enum` declaration parsing + `input.enum(EnumType.member,
   …)` lowering in the converter (replacing the reject).
4. An adapter-kit `groupInputs()` helper + docs/example so adapters render
   grouped panels consistently.

`active` (Pine's conditional input graying, which references *other*
inputs) is **explicitly out of scope** — it needs an input-to-input
dependency model and is listed under Deferred Work.

Relevant repo conventions: root `CLAUDE.md` (skill-sync rule),
`packages/core/CLAUDE.md` (`input.enum` widened generic, additive
`apiVersion: 1` rule), `packages/pine-converter/CLAUDE.md` (Transform:
inputs invariant, residual-diagnostics `input-arg-not-mapped`),
`packages/compiler/CLAUDE.md` (`program.ts` ambient shim lockstep).

## Current State

- **Core** (`packages/core/src/input/`): `Common<K, T> = { kind;
  defaultValue; title? }` is the shared descriptor base
  (`inputDescriptor.ts:87`); each `input.*` builder (`input.ts`) accepts a
  narrow per-kind `opts` object (e.g. `int` accepts `{ min, max, step,
  title }`). `input.enum<T extends string | number>` already exists and is
  fully wired through the compiler + runtime.
- **Compiler** (`packages/compiler/src/`): `extractInputs.ts`'s
  `copyObjectLiteralFields` copies **any** literal-valued property from the
  builder's opts object into the manifest descriptor — so new
  string/number/boolean opts serialise generically once the types accept
  them. `program.ts` ships the ambient core `.d.ts` shim that mirrors the
  descriptor types and must stay in lockstep.
- **Runtime** (`packages/runtime/src/inputs/resolveInputs.ts`):
  `matchesDescriptor` keys only on `descriptor.kind` + `options`; the new
  presentation fields are ignored by resolution (correct — they are
  metadata, not values). No runtime change needed.
- **Adapter-kit** (`packages/adapter-kit/src/types.ts`): re-exports
  `InputKind`; `Capabilities.inputs: ReadonlySet<InputKind>`. No helper to
  bucket inputs into render groups.
- **Converter** (`packages/pine-converter/src/transform/inputs.ts`):
  `buildOptions` maps `title`/`minval`/`maxval`/`step`, forces `multiline`
  for `text_area`, and warns-and-drops every other named arg via
  `warnUnmappedInputArg` → `input-arg-not-mapped`. `buildInputCode` rejects
  `input.enum` with `input-enum-rejected`. The converter parser
  (`parser/statements.ts:705`) has no `enum` arm — a native `enum Name`
  declaration falls through to `unexpected-token`.

## Target State

- Core descriptors + builders accept and carry `group?: string`,
  `inline?: string`, `tooltip?: string`, `display?: InputDisplay`
  (`"all" | "status-line" | "data-window" | "none"`), `confirm?: boolean`
  on **every** `input.*` kind (including `externalSeries`). `manifest.inputs`
  preserves declaration order (already true via `Record` insertion — pinned
  by a test).
- The converter maps Pine `group`/`inline`/`tooltip`/`display`/`confirm`
  onto those fields; `input-arg-not-mapped` fires only for genuinely
  unmodellable args (`active`, future unknowns) + non-literal values.
- The converter parses a native Pine `enum Name` declaration into an
  `EnumDeclaration` AST node + semantic symbol, and lowers `input.enum(
  EnumType.member, "Title", …)` to chartlang `input.enum("memberValue",
  ["v1", "v2", …], { title, group, inline, tooltip })`. `input-enum-rejected`
  is removed.
- Adapter-kit exports `groupInputs(inputs)` → an ordered list of groups,
  each an ordered list of inline rows, each an ordered list of
  `{ name, descriptor }`; a docs page + example shows an adapter rendering a
  grouped panel.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Put the 5 fields on a shared `CommonInputOpts` mixed into `Common<K,T>` + every builder opts type | The fields apply to all `input.*` kinds; one mixin avoids 12 divergent copies and keeps `program.ts` mirror small. |
| `display` is a string-literal union, not a boolean | Pine `display` has four states (all / status-line / data-window / none); a boolean would lose the status-line/data-window distinction an adapter wants. Omitted ⇒ `"all"`. |
| Presentation fields are metadata only — no runtime resolution change | `resolveInputs.matchesDescriptor` keys on `kind`/`options`; group/inline/tooltip/display/confirm never affect the resolved value, so the runtime ignores them by construction. |
| Serialisation rides the existing generic `copyObjectLiteralFields` | The compiler already copies arbitrary literal opts; only the **types** + `program.ts` shim need the new fields. No new extractor logic, keeping manifest snapshots additive. |
| Converter native `input.enum` split into parse/semantic (Task 3) then transform (Task 4) | A native `enum` decl needs new lexer-adjacent parsing + a symbol table before any lowering; the two layers are independently testable and each spec stays < 300 lines. |
| `active` deferred | It references *other* inputs (conditional enable), needing an input-dependency graph — a separate, much larger effort than the flat metadata fields. |
| Adapter grouping is a helper, not a forced render contract | Adapters keep full control of their UI; `groupInputs()` only buckets/orders, so every adapter renders consistently without re-deriving the grouping. |

## Dependency Graph

```
Task 1 (core: descriptor fields + builders + program.ts shim + skill)
  |
  +-----------------------------+-----------------------------+
  v                             v                             v
Task 2 (converter:        Task 5 (adapter-kit:          (Task 3 parser is
 metadata passthrough)     groupInputs + docs)           core-independent but
  |                                                       numbered after 2 to
  v                                                       keep order linear)
Task 3 (converter: enum decl parse + semantic)
  |
  v
Task 4 (converter: input.enum lowering + goldens)   [depends on 1, 2, 3]
```

Each task depends only on lower-numbered tasks.

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Core input metadata fields](./X-1-core-input-metadata.md) | core (+ compiler shim, skill) | None | Medium |
| 2 | [Converter metadata passthrough](./X-2-converter-input-metadata-passthrough.md) | pine-converter | 1 | Medium |
| 3 | [Converter native enum parse + semantic](./X-3-converter-enum-parse.md) | pine-converter | None (numbered after 2) | High |
| 4 | [Converter input.enum lowering](./X-4-converter-enum-transform.md) | pine-converter | 1, 2, 3 | Medium |
| 5 | [Adapter-kit groupInputs helper + docs](./X-5-adapter-input-grouping.md) | adapter-kit (+ docs) | 1 | Medium |

## Code Reuse

| Existing symbol / file | Import path | Reused for |
|------------------------|-------------|------------|
| `Common<K, T>` base + per-kind descriptors | `packages/core/src/input/inputDescriptor.ts` | Task 1 extends with `CommonInputOpts` |
| `input.*` builders | `packages/core/src/input/input.ts` | Task 1 widens each opts type |
| `copyObjectLiteralFields` / `readLiteral` | `packages/compiler/src/analysis/extractInputs.ts` | Generic serialisation for normal inputs; Task 1 also extends `serialiseExternalSeries` for metadata |
| `program.ts` ambient core shim | `packages/compiler/src/program.ts` | Task 1 mirrors new fields |
| `buildOptions` / `warnUnmappedInputArg` / `enumTitleOpt` / `resolveOptionsEnum` | `packages/pine-converter/src/transform/inputs.ts` | Tasks 2 + 4 |
| `parseKeywordStatement` / `recoverCompound` / `parseBlock` | `packages/pine-converter/src/parser/statements.ts` | Task 3 adds `enum` arm |
| `DiagnosticCollector` / `pushCodeOnce` | `packages/pine-converter/src/transform/diagnosticCollector.ts` | Tasks 2 + 4 |
| `DISPLAY_MAP` / `enumLookup` | `packages/pine-converter/src/mapping/enums.ts` | Task 2 `display` mapping (extend with input variant) |
| `InputKind` re-export, `Capabilities` | `packages/adapter-kit/src/types.ts` | Task 5 |

## Provenance

None — this is net-new chartlang surface, not a port from `../invinite/`.
The two reference Pine scripts (`MASM_Strat.md`, `Trend_Wizard.md`, repo
root) motivate the metadata fields and are the acceptance witnesses for the
converter tasks.

## Deferred / Follow-Up Work

- **Pine `active` (conditional enable / graying).** Needs an input→input
  dependency model; out of scope.
- **`display.status_line` vs `display.data_window` adapter semantics.** The
  field is carried; how the reference canvas2d adapter visually
  distinguishes the four states beyond show/hide is left to the adapter
  author.
- **Per-bar / series `display`.** Pine `display` is constant; no dynamic
  channel planned.
- **Tooltip rich text / `\n` rendering** is adapter-defined; the converter
  passes the raw string through.

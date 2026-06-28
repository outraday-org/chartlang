# Task 1 — Core: extend `input.enum` to `T extends string | number`

> **Status: TODO**

## Goal

Extend chartlang's `input.enum` authoring surface so a dropdown can be backed
by **numeric** options, not only string options. Today
`input.enum<T extends string>` accepts string members only; MASM's
`ma_length = input.int(21, options=[8,21,30,…])` (Task 4) needs a numeric
dropdown, and the converter has no faithful target for it without this core
change. This is the cross-package prerequisite for T4 Task 4's numeric-options
lowering.

## Prerequisites

None. (Foundational — lands before the converter tasks; T4 Task 4 depends on
it.)

## Current Behavior

- `packages/core/src/input/input.ts` declares
  `enum<T extends string>(default: T, options: readonly T[], opts?: { title?: string }): EnumDescriptor<T>`
  — the type parameter is constrained to `string`, so numeric option arrays do
  not type-check.
- `packages/core/src/input/inputDescriptor.ts` declares
  `EnumDescriptor<T extends string>` with the same constraint.
- `packages/compiler/src/program.ts` carries an **ambient shim** of the input
  namespace that must mirror core's `enum` signature exactly (load-bearing — a
  drift breaks `pnpm typecheck` against the compiled program type).

## Desired Behavior

```ts
const mode = input.enum("fast", ["fast", "slow"]);   // unchanged (string)
const len  = input.enum(21, [8, 21, 30, 50, 100]);   // NEW (numeric)
// len typed as 8 | 21 | 30 | 50 | 100 (a numeric enum member)
```

- `input.enum` accepts a `readonly number[]` options array with a numeric
  default; the descriptor and the resolved input value are typed `number`.
- The string form is **unchanged** (no behavior or signature regression for
  existing string enums).
- A numeric enum default round-trips through the runtime + both hosts exactly
  like a string enum (the resolved value is a plain JSON-serialisable
  primitive; no `Color`/object payload), so `host-worker` / `host-quickjs`
  parity holds with no transferable changes.

## Requirements

### 1. Widen the constraint (`packages/core/src/input/`)

- `input.ts`: change `enum<T extends string>(…)` →
  `enum<T extends string | number>(…)`. Keep the `options: readonly T[]`,
  `default: T`, `opts?: { title?: string }` shape.
- `inputDescriptor.ts`: change `EnumDescriptor<T extends string>` →
  `EnumDescriptor<T extends string | number>`.
- The barrel export (`packages/core/src/index.ts`) is unchanged — `input` and
  `EnumDescriptor` are already exported; only their generic bound widens.

### 2. JSDoc on the changed export

- Update the `@example` on `input.enum` to show both a string and a numeric
  enum. Keep `@since` as-is (the symbol already existed) and add a one-line note
  that the numeric form was added; bump the stability marker only if the
  existing one requires it (a widened generic is additive — `@stable` stays).
  `pnpm docs:check` must stay green.

### 3. Ambient shim mirror (`packages/compiler/src/program.ts`)

- Update the shim's `enum` signature to the widened `T extends string | number`
  bound so the compiled-program type matches core. Keep the two in lockstep
  (CLAUDE.md invariant).

### 4. Runtime / host parity

- Verify the input-resolution path (runtime + `host-worker` + `host-quickjs`)
  carries a numeric enum default through unchanged — a numeric default is a
  plain number, so no serialisation change should be required. Add a host
  round-trip assertion if the existing input parity tests are value-typed.

### 5. Tests (`packages/core` — unit + type)

- `packages/core/src/input/input.types.test.ts`: a numeric
  `input.enum(21, [8, 21, 30])` resolves to the numeric-member union type; the
  string form's type is unchanged.
- `packages/core/src/input/input.test.ts`: a numeric enum descriptor carries
  the numeric options + default; `{ title }` opts still thread.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/input/input.ts` | Modify | Widen `enum<T extends string \| number>` + JSDoc. |
| `packages/core/src/input/inputDescriptor.ts` | Modify | Widen `EnumDescriptor<T extends string \| number>`. |
| `packages/core/src/input/input.types.test.ts` | Modify | Numeric-enum type test. |
| `packages/core/src/input/input.test.ts` | Modify | Numeric-enum descriptor unit test. |
| `packages/compiler/src/program.ts` | Modify | Mirror the widened `enum` shim signature. |
| `packages/core/src/input/CLAUDE.md` *(or the input folder's per-folder CLAUDE.md, if present)* | Modify | Note the `string \| number` enum constraint. |
| `.changeset/core-numeric-enum.md` | Create | **minor** (`@invinite-org/chartlang-core`). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (core unit + type)
- `pnpm docs:check`
- `pnpm readme:check`

## Changeset

`.changeset/core-numeric-enum.md` — **minor** (`@invinite-org/chartlang-core`).
A widened generic bound is additive (new surface), so a minor bump is correct;
the string form is untouched.

## Acceptance Criteria

- `input.enum(21, [8, 21, 30])` type-checks and resolves to the numeric-member
  union; `input.enum("fast", ["fast", "slow"])` is unchanged.
- The compiler ambient shim mirrors the widened signature (`pnpm typecheck`
  green across the workspace).
- Numeric enum default round-trips through runtime + both hosts (parity test
  green).
- core unit + type tests cover the numeric form; `docs:check` + changeset green.

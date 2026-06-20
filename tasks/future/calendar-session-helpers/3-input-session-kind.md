# Task 3 — `input.session` kind across core + compiler + adapter-kit

> **Status: TODO**

## Goal

Add a new `input.session(default, opts?)` kind that produces a
`SessionDescriptor { kind: "session", defaultValue: string }` (an
`"HH:MM-HH:MM"` window spec), wired across the **five lockstep edit sites** a
new input kind requires: core descriptor + builder, compiler `extractInputs`
recognise + wire-tag, the `program.ts` ambient shim, and the adapter-kit
`InputKind` alias (which derives from core, so it is automatic but its
capability set + tests need the new tag).

## Prerequisites

Task 1 (the feature changeset exists; this task adds `adapter-kit` minor which
is already listed there).

## Current Behavior

- Core `InputKind` union (`input/inputDescriptor.ts:16-28`) has 12 kinds
  (`int … external-series`); per-kind descriptors at `:100-235`; builders in
  `input/input.ts:34-233`. `input.session` does not exist.
- Compiler `extractInputs.ts` gates recognised builders on `INPUT_KINDS`
  (`:17`) and maps camelCase → kebab wire tag via `KIND_TO_WIRE` (`:33`); an
  unrecognised builder name is silently ignored (`:119` guard).
- `program.ts` shim mirrors the `InputKind` union (`:914`), each descriptor
  (`:943-959`), and the `input` const (`:973-990`).
- adapter-kit `InputKind = CoreInputKind` (`adapter-kit/src/types.ts:155`); the
  capability surface uses `ReadonlySet<InputKind>` (`:279`).

## Desired Behavior

- `input.session("0930-1600", { title: "Session" })` type-checks and returns a
  `SessionDescriptor`. The compiler extracts it into `manifest.inputs` with
  wire `kind: "session"` and `defaultValue` the literal string.
- The runtime resolves it to a plain string (no special runtime handling —
  string inputs already flow through `resolvedInputs`; confirm a `session`
  input round-trips like a `string` input and add a test if the resolver
  switches on `kind`).
- adapter-kit's `InputKind` automatically includes `"session"`; the
  capability-set type accepts it.

## Requirements

### 1. Core descriptor + union (`packages/core/src/input/inputDescriptor.ts`)

- Add `"session"` to the `InputKind` union (`:16-28`), after `"interval"`,
  before `"external-series"`.
- Add a descriptor type with full JSDoc:
  ```ts
  /**
   * Descriptor for `input.session(...)`. The value is an `"HH:MM-HH:MM"`
   * (or `"HHMM-HHMM"`) session-window spec consumed by `session.isOpen`.
   *
   * @since 1.2
   * @stable
   * @example
   *     const d: SessionDescriptor = { kind: "session", defaultValue: "0930-1600" };
   *     void d;
   */
  export type SessionDescriptor = Common<"session", string>;
  ```
- Add `SessionDescriptor` to the `InputDescriptor<T>` union (`:71-83`).

### 2. Core builder (`packages/core/src/input/input.ts`)

Add to the frozen `input` object (after `interval`, before `externalSeries`),
importing `SessionDescriptor`:

```ts
/**
 * Build a session-window input descriptor (`"HH:MM-HH:MM"`).
 *
 * @since 1.2
 * @stable
 * @example
 *     const sess = input.session("0930-1600");
 *     void sess;
 */
session(defaultValue: string, opts?: { readonly title?: string }): SessionDescriptor {
    return Object.freeze({ kind: "session" as const, defaultValue, ...opts });
},
```

### 3. Core barrel (`packages/core/src/index.ts`)

Add `SessionDescriptor` to the `input/index.js` type re-export block
(`:191-208`).

### 4. Compiler `extractInputs.ts`

- Add `"session"` to `INPUT_KINDS` (`:17`).
- Add `session: "session"` to `KIND_TO_WIRE` (`:33`).
- Confirm the existing default-value extraction path handles a string literal
  (it already does for `string`/`symbol`/`interval`) — add a unit test that
  `input.session("0930-1600")` extracts `{ kind: "session", defaultValue:
  "0930-1600" }`.

### 5. Compiler ambient shim (`packages/compiler/src/program.ts`)

- Add `"session"` to the shim `InputKind` union (`:914-926`).
- Add `export type SessionDescriptor = CommonInputDescriptor<"session",
  string>;` (after `IntervalDescriptorInput`, `:953`).
- Add `SessionDescriptor` to the shim `InputDescriptor<T>` union (`:960-972`).
- Add `session(defaultValue: string, opts?: Readonly<{ title?: string }>):
  SessionDescriptor;` to the shim `input` const (`:973-990`, after `interval`).

### 6. adapter-kit (`packages/adapter-kit/src/types.ts`)

`InputKind = CoreInputKind` (`:155`) picks up `"session"` automatically.
Confirm the JSDoc `@example` and any exhaustive kind list/test in adapter-kit
that enumerates kinds includes `"session"`; update the capability-surface test
if it asserts a fixed kind set.

### 7. Type-level + extraction tests

- Core type-test (`input/*.types.test.ts`): `input.session("0930-1600")` is a
  `SessionDescriptor`.
- Compiler test (`extractInputs.test.ts`): extraction wire shape.
- Sentinel/round-trip: ensure a `session` input resolves to its string default
  at runtime (extend the input-resolution test that covers `string`).

## Edge cases

- v1 does **not** validate the `"HH:MM-HH:MM"` grammar at compile time — it is
  a free string (mirrors `input.string`). `session.isOpen` (Task 4) parses it
  at runtime and falls back gracefully on a malformed spec.
- Do NOT add a calendar/session picker UI hint (e.g. `pickFromChart`) —
  deferred.
- `@since 1.2`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/input/inputDescriptor.ts` | Modify | Union + `SessionDescriptor`. |
| `packages/core/src/input/input.ts` | Modify | `session` builder. |
| `packages/core/src/index.ts` | Modify | Re-export `SessionDescriptor`. |
| `packages/core/src/input/*.types.test.ts` | Modify | Type assertion. |
| `packages/compiler/src/analysis/extractInputs.ts` | Modify | `INPUT_KINDS` + `KIND_TO_WIRE`. |
| `packages/compiler/src/analysis/extractInputs.test.ts` | Modify | Extraction test. |
| `packages/compiler/src/program.ts` | Modify | Shim union + descriptor + builder. |
| `packages/adapter-kit/src/types.ts` | Modify (confirm) | Kind set / capability test. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test`
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm -F @invinite-org/chartlang-adapter-kit test`
- `pnpm docs:check`

## Changeset

Covered by Task 1's feature changeset (adapter-kit included as minor).

## Acceptance Criteria

- `input.session(default, opts?)` returns a `SessionDescriptor` and extracts to
  wire `kind: "session"`.
- All five lockstep sites (core descriptor, core builder, compiler extract,
  compiler shim, adapter-kit alias) carry `"session"`.
- Round-trips to a string default at runtime.
- typecheck/lint/core+compiler+adapter-kit tests/docs:check green.

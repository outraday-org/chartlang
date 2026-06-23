# Task 3 — `input.session` kind: validated implementation plan

## Context

Add a new `input.session(default, opts?)` input kind producing
`SessionDescriptor { kind: "session"; defaultValue: string; title?: string }`
— an `"HH:MM-HH:MM"` window spec, structurally a constrained string mirroring
`input.string`. Wire tag is `"session"`; the doc default in examples is
`"0930-1600"`. `session.isOpen` (Task 4) parses it at runtime; v1 does NOT
validate the grammar at compile time.

This is the input-kind plumbing only — independent of the runtime calendar
impl (Task 2). It rides Task 1's combined changeset
(`.changeset/calendar-session-helpers.md`, already present, listing core +
compiler + runtime + adapter-kit minor).

## Pre-existing work (do NOT touch / revert)

- The combined changeset `.changeset/calendar-session-helpers.md` already
  exists and already names every package this task bumps. No new changeset.
- The tree carries uncommitted state-array, multi-symbol-security, bgcolor,
  and cal-task-1 work. My diff must be calendar-task-3-only.
- adapter-kit `InputKind = CoreInputKind` (`types.ts:167`) derives from core,
  so `"session"` is picked up automatically. The capability surface
  `Capabilities.inputs: ReadonlySet<InputKind>` (`:292`) accepts it with no
  edit. There is NO fixed-kind-set assertion test in adapter-kit to update
  (verified by grep — the only `"symbol"` references in adapter-kit are the
  unrelated drawing-emission validator). So site (4) is confirm-only.

## Issues found / deviations from the task file

1. **Sixth lockstep site (NOT in the task's "five"): runtime
   `resolveInputs.ts`.** Its `matchesDescriptor` switch over `descriptor.kind`
   has a case for all 12 kinds and **no `default`**; the function body is the
   switch and each arm returns. Adding `"session"` to the core `InputKind`
   union makes `descriptor.kind` include `"session"`, and `noImplicitReturns`
   means the switch must handle it or runtime stops compiling. `"session"` is
   a string, so it joins the existing `string | color | symbol | interval`
   string-validating arm. The task's own "Desired Behavior §" calls for a
   round-trip test "if the resolver switches on kind" — it does, so this edit
   + tests are required, not optional. Runtime is already in the changeset.

2. Task file step 3 says re-export `SessionDescriptor` from the root barrel —
   it must be added in BOTH `input/index.ts` (the input barrel) and
   `src/index.ts` (the root) to match how every sibling descriptor is
   re-exported (two-hop). The task only named the root; both are needed.

## Steps (verified paths)

1. **core `inputDescriptor.ts`** (`packages/core/src/input/inputDescriptor.ts`)
   - Add `"session"` to the `InputKind` union after `"interval"`, before
     `"external-series"` (`:27`).
   - Add `SessionDescriptor` to the `InputDescriptor<T>` union after
     `IntervalDescriptorInput` (`:82`).
   - Add the `SessionDescriptor = Common<"session", string>` type with full
     JSDoc (`@since 1.2` / `@stable` / `@example`) after
     `IntervalDescriptorInput` (`:215`).

2. **core `input.ts`** (`packages/core/src/input/input.ts`)
   - Import `SessionDescriptor` in the type-import block (`:5-20`).
   - Add the `session(defaultValue, opts?)` builder after `interval`,
     before `externalSeries` (`:207`), mirroring `string`/`interval`.

3. **core barrels**
   - `input/index.ts`: add `SessionDescriptor` to the
     `./inputDescriptor.js` type re-export.
   - `src/index.ts`: add `SessionDescriptor` to the `./input/index.js` type
     re-export block (`:193-210`).

4. **core tests**
   - `input.test.ts`: add a `builds a session descriptor` unit test.
   - `input.types.test.ts`: assert `input.session("0930-1600")` is
     `SessionDescriptor` (+ import the type).

5. **compiler `extractInputs.ts`**
   (`packages/compiler/src/analysis/extractInputs.ts`)
   - Add `"session"` to `INPUT_KINDS` (`:29`).
   - Add `session: "session"` to `KIND_TO_WIRE` (`:45`).
   (Builder name === wire tag, like `interval`. Default-value path already
   handles string literals — no serialiser change.)

6. **compiler `extractInputs.test.ts`**
   - Extend the "serialises all supported builders" case with a
     `sess: input.session("0930-1600", { title: "Session" })` entry +
     assertion `{ kind: "session", defaultValue: "0930-1600", title: "Session" }`.

7. **compiler ambient shim `program.ts`**
   - Add `"session"` to the shim `InputKind` union (`:931-943`, after
     `"interval"`).
   - Add `export type SessionDescriptor = CommonInputDescriptor<"session",
     string>;` after `IntervalDescriptorInput` (`:970`).
   - Add `SessionDescriptor` to the shim `InputDescriptor<T>` union (`:977-989`).
   - Add `session(defaultValue: string, opts?: Readonly<{ title?: string }>):
     SessionDescriptor;` to the shim `input` const after `interval` (`:1005`).

8. **runtime `resolveInputs.ts`** — add `case "session":` to the string arm
   alongside `string`/`color`/`symbol`/`interval` (`:71-75`).

9. **runtime `resolveInputs.test.ts`** — add `session` rows to both
   `it.each` tables (accept-match + fallback-mismatch).

10. **adapter-kit** — confirm only (no edit). `InputKind = CoreInputKind`
    surfaces `"session"`; `Capabilities.inputs` accepts it.

## Files table

| File | Action |
|------|--------|
| `packages/core/src/input/inputDescriptor.ts` | Modify — union + `SessionDescriptor` |
| `packages/core/src/input/input.ts` | Modify — `session` builder + import |
| `packages/core/src/input/index.ts` | Modify — re-export |
| `packages/core/src/index.ts` | Modify — root re-export |
| `packages/core/src/input/input.test.ts` | Modify — unit |
| `packages/core/src/input/input.types.test.ts` | Modify — type test |
| `packages/compiler/src/analysis/extractInputs.ts` | Modify — `INPUT_KINDS` + `KIND_TO_WIRE` |
| `packages/compiler/src/analysis/extractInputs.test.ts` | Modify — extraction test |
| `packages/compiler/src/program.ts` | Modify — shim union + descriptor + builder |
| `packages/runtime/src/inputs/resolveInputs.ts` | Modify — `case "session"` (exhaustiveness) |
| `packages/runtime/src/inputs/resolveInputs.test.ts` | Modify — round-trip rows |

## Gates to keep green

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test`
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm -F @invinite-org/chartlang-adapter-kit test`
- `pnpm -F @invinite-org/chartlang-runtime test` (added — exhaustive switch)
- `pnpm docs:check`
- 100% coverage in core/compiler/runtime preserved (every new arm/builder
  exercised by a test).

## Changeset

No new file — `.changeset/calendar-session-helpers.md` already lists
core/compiler/runtime/adapter-kit minor.

## Acceptance criteria

- `input.session(default, opts?)` returns `SessionDescriptor` and extracts to
  wire `kind: "session"`, `defaultValue` the literal string.
- `"session"` present at all six sites: core descriptor union + builder,
  core barrels, compiler `INPUT_KINDS`/`KIND_TO_WIRE`, compiler shim,
  adapter-kit alias (automatic), runtime resolver.
- Round-trips to a string default at runtime; a non-string override falls
  back + diagnoses.
- typecheck/lint/core+compiler+adapter-kit+runtime tests/docs:check green.

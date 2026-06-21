# Task 1 — Core: `state.color` + non-numeric `state` series types

> **Status: TODO**

## Goal

Add the **authoring-surface** types for non-numeric persistent state: a
persistent `state.color(init)` scalar slot, and boolean/string series slots
(`state.boolSeries(init)` / `state.stringSeries(init)`, the non-numeric
siblings of the existing numeric `state.series`). Mirror them in the compiler
ambient shim, add type-level + unit tests, and create the shared T12
changeset. This task adds **only** the core surface + slot view types — the
runtime ring/buffer plumbing is Task 2.

## Prerequisites

None.

## Current Behavior

- `state` (`packages/core/src/state/state.ts:26`, frozen namespace) exposes
  `float`/`int`/`bool`/`string` scalars (`MutableSlot<T>`), a **numeric-only**
  `series(_init: number): NumberSeriesSlot`, and `tick.{float,int,bool,string}`.
- There is **no** `state.color`, and `series` is hard-typed to `number` /
  `NumberSeriesSlot` (`packages/core/src/types.ts`). A persistent color or a
  boolean/string history has no slot to bind to.
- `MutableSlot<T>` (`packages/core/src/state/mutableSlot.ts`) is the generic
  `.value` get/set scalar slot — already type-generic, so a color scalar fits
  it directly.
- `color` is a frozen namespace (`packages/core/src/color/index.ts:20`); the
  `Color` value type is exported from `packages/core/src/color/`.

## Desired Behavior

```ts
// persistent color scalar (var color c = na)
const c = state.color(color.na);        // MutableSlot<Color>
c.value = up ? color.green : color.red;

// boolean history (var bool active; active[1])
const active = state.boolSeries(false); // BoolSeriesSlot — .value head + [n] history
active.value = entered;
const wasActive = active[1];            // false on the first bar (v6 semantics)

// string history (var string label; label[1])
const label = state.stringSeries("");   // StringSeriesSlot
```

- `state.color(init: Color): MutableSlot<Color>` — persistent color scalar.
- `state.boolSeries(init: boolean): BoolSeriesSlot` and
  `state.stringSeries(init: string): StringSeriesSlot` — indexable history
  slots (`.value` writable head + `[n]` readonly history), the non-numeric
  analogues of `NumberSeriesSlot`.
- **Defaults / first-bar:** bool history `[n]` past the buffer ⇒ `false`
  (matches Pine v6, where bool `[]` no longer returns `na`); string ⇒ `""`;
  color scalar default is the caller's `init` (`color.na`/transparent).

## Requirements

### 1. Decide: typed siblings vs. generic `state.series<T>`

Two shapes (pick one, document in `state.ts` + CLAUDE.md):
- **(Recommended) Typed sibling factories** `boolSeries` / `stringSeries` +
  `BoolSeriesSlot` / `StringSeriesSlot` types. Keeps `series`/`NumberSeriesSlot`
  (numeric, `Float64`-backed) untouched and byte-stable; each non-numeric slot
  gets its own concrete type. Lowest blast radius.
- **(Alternative) Generic** `series<T>(init: T): SeriesSlot<T>`. More elegant
  but reworks the numeric `series` signature + every `NumberSeriesSlot`
  consumer. Only take this if the generic genuinely simplifies the runtime.

The rest of this task assumes the **typed-sibling** decision; adjust names if
the generic path is chosen.

### 2. Slot view types (`packages/core/src/types.ts`)

Add `BoolSeriesSlot` and `StringSeriesSlot` next to `NumberSeriesSlot`,
mirroring its shape — a writable `.value` head plus integer-indexed readonly
history (`readonly [index: number]: T`). JSDoc each with `@since`, `@stable`,
and the first-bar default rule. **Export both new types from the package
barrel** (`packages/core/src/index.ts`) alongside the existing
`NumberSeriesSlot` export, so consumers (and the compiler shim) can name them.

### 3. `state.color` + series factories (`packages/core/src/state/state.ts`)

Add to the frozen `state` object:

```ts
color(_init: Color): MutableSlot<Color> { /* stub — runtime binds */ },
boolSeries(_init: boolean): BoolSeriesSlot { /* stub */ },
stringSeries(_init: string): StringSeriesSlot { /* stub */ },
```

Follow the existing stub convention (the core factory bodies are placeholders;
the runtime supplies the real slot — same as `series`). Import `Color` from
`../color/`. Each carries `@since`, `@stable`, `@example`.

### 4. Compiler ambient shim (`packages/compiler/src/program.ts`)

Mirror `state.color` / `state.boolSeries` / `state.stringSeries` (and the new
slot types) in the ambient `state` shim, byte-consistent with core — same
lockstep rule as the existing `state` members.

### 5. Tests

- **Type-level** (`packages/core/src/state/*.types.test.ts`): `state.color(c)`
  is `MutableSlot<Color>`; `state.boolSeries(false)[1]` is `boolean`;
  `state.stringSeries("")[2]` is `string`.
- **Unit** (`packages/core/src/state/state.test.ts`): the new factories exist,
  are frozen, and return the stub shape (mirror the `series` unit test).

### 6. Changeset

Create `.changeset/<slug>.md` — the **shared** T12 changeset:

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-pine-converter": patch
---

Add non-numeric persistent state: `state.color` plus boolean/string series
slots (`state.boolSeries` / `state.stringSeries`), enabling `var color` and
`var bool/string` history conversion.
```

## Edge cases

- `@since` — confirm the current core version (T8 uses `1.4`); bump
  accordingly (likely `1.5`).
- Do NOT change the numeric `series` signature or `NumberSeriesSlot` (keep
  numeric snapshots byte-identical) under the typed-sibling decision.
- `Color` must be imported as a **type** where possible to avoid a runtime
  cycle with `color/`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/types.ts` | Modify | `BoolSeriesSlot` / `StringSeriesSlot`. |
| `packages/core/src/index.ts` | Modify | Barrel-export `BoolSeriesSlot` / `StringSeriesSlot`. |
| `packages/core/src/state/state.ts` | Modify | `color` / `boolSeries` / `stringSeries` factories. |
| `packages/compiler/src/program.ts` | Modify | Mirror in ambient `state` shim. |
| `packages/core/src/state/*.types.test.ts` | Modify/Create | Type-level tests. |
| `packages/core/src/state/state.test.ts` | Modify | Unit tests. |
| `.changeset/<slug>.md` | Create | Shared T12 changeset. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test` (100% coverage)
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm docs:check` (JSDoc on every new export)

## Changeset

`.changeset/<slug>.md` — **minor** (core, runtime, compiler) + **patch**
(pine-converter). Shared across all T12 tasks.

## Acceptance Criteria

- `state.color`, `state.boolSeries`, `state.stringSeries` (+ slot types)
  defined, JSDoc'd, exported; shim mirrors core.
- Type tests prove the slot value types; numeric `series`/`NumberSeriesSlot`
  untouched; typecheck/lint/core+compiler tests/docs:check green.

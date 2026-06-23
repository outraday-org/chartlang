# Task 1 — Core type + `state.array` hole + registry + compiler shim

> **Status: TODO**

## Goal

Introduce the `MutableArraySlot<T>` interface (a bounded FIFO collection
handle) in core, add the `state.array<T>(capacity)` sentinel hole on the
`state` namespace, append `{ name: "state.array", slot: true }` to
`STATEFUL_PRIMITIVES`, and mirror all of it in the compiler's ambient shim
(`program.ts`) in lockstep. Add type-level tests proving the collection
surface (`push`/`get`/`last`/`size`/`capacity`/`clear`). Create the feature
changeset.

## Prerequisites

None.

## Current Behavior

- `state` (`packages/core/src/state/state.ts:25-102`) is a frozen object of
  sentinel holes: `float`/`int`/`bool`/`string` (lines 35-76) return
  `MutableSlot<number|…>`, plus the nested `tick` object (lines 88-101).
  `StateNamespace = typeof state` (line 114). The `sentinel(name)` helper
  (line 6) throws `"<name> called outside an active script step"`.
- `MutableSlot<T>` (`packages/core/src/state/mutableSlot.ts:24`) is
  `{ get value(): T; set value(v: T) }` — "no `.history()`, no indexing."
- `STATEFUL_PRIMITIVES` (`packages/core/src/statefulPrimitives.ts`, canonical
  array `STATEFUL_PRIMITIVE_ENTRIES` lines 18-201) lists the eight `state.*` /
  `state.tick.*` entries (lines 184-191) as `{ slot: true }`;
  `STATEFUL_PRIMITIVES_BY_NAME` (line 263) derives from the same list.
- `packages/compiler/src/program.ts` ambient shim declares `MutableSlot`
  (line 992, as the simplified `{ value: T }`), `StateNamespace`
  (lines 995-1006, a `Readonly<{ … }>` of the eight methods + `tick`), and
  `state` (line 1007) — must stay in lockstep with core's surface.

## Desired Behavior

- `state.array<number>(20)` type-checks and returns a `MutableArraySlot<number>`:
  `a.push(1)`, `a.get(0)` (`number`), `a.last()` (`number`), `a.size`
  (`number`), `a.capacity` (`number`), and `a.clear()` all type-check.
- `state.array` is **not** number-coercible: `+a` / `a === 5` are NOT
  asserted to be a number — it is a plain handle (the deliberate contrast with
  `state.series`).
- The compiler program type-checks the same (shim mirrors core).
- Existing `state.*` holes, `MutableSlot`, and the registry are unchanged
  except for the additive `array` entry.

## Requirements

### 1. New core type (`packages/core/src/state/arraySlot.ts`, new — or in `types.ts`)

Add a dedicated interface (a sibling to `MutableSlot`, **not** an intersection
with it). Prefer a new `state/arraySlot.ts` file so it sits next to
`mutableSlot.ts` (follow the `mutableSlot.ts` two-line MIT header + JSDoc
style):

```ts
/**
 * Script-facing handle on a persistent, bounded **FIFO collection** —
 * Pine's `var array<…>` with capacity eviction. Unlike {@link MutableSlot}
 * (one value's history) or a `Series` (bar-indexed history), this is a
 * **collection** you push many values into: `push` appends (evicting the
 * oldest once `capacity` is reached), `get(n)` reads the `n`-th element from
 * the newest (`n = 0`), `last()` is the newest, `size` is the current filled
 * count, `capacity` is the fixed bound, and `clear()` empties it.
 *
 * The collection persists across bars with `state.*` committed/tentative
 * semantics: pushes during a tick are tentative and discarded if a later
 * tick replaces the head bar; on bar close they commit. `capacity` is a
 * required compile-time numeric literal so the store is bounded and
 * snapshot-clean.
 *
 * Out-of-range `get(n)` returns the element type's empty value (`NaN` for
 * `number`); it never throws. This is **not** number-coercible — there is no
 * `+a` / `valueOf`; it is a collection, not a value.
 *
 * @since 1.2
 * @stable
 * @example
 *     function rollingMean(a: MutableArraySlot<number>, x: number): number {
 *         a.push(x);
 *         let sum = 0;
 *         for (let i = 0; i < a.size; i++) sum += a.get(i);
 *         return sum / a.size;
 *     }
 */
export type MutableArraySlot<T> = {
    push(value: T): void;
    get(n: number): T;
    last(): T;
    clear(): void;
    readonly size: number;
    readonly capacity: number;
};
```

Re-export `MutableArraySlot` from the package root
(`packages/core/src/index.ts`) alongside `MutableSlot` (and from
`state/index.ts` if there is a state barrel — follow the `MutableSlot`
export path exactly).

### 2. `state.array` hole (`packages/core/src/state/state.ts`)

Add to the frozen `state` object (after `string`, before `tick` — mirroring
where the README places `state.series`). Use a generic so `T` flows:

```ts
/**
 * Allocate or read a persistent **bounded collection** slot — a
 * fixed-capacity FIFO ring you push values into across bars. `a.push(v)`
 * appends (evicting the oldest once full); `a.get(n)` reads the `n`-th
 * element from the newest; `a.last()` is the newest; `a.size` is the filled
 * count; `a.capacity` is the bound; `a.clear()` empties it. `capacity` must
 * be a compile-time numeric literal (the slot is bounded so it serializes).
 * Unlike {@link state}.series (one value's bar-indexed history), this is a
 * collection of many pushed values. v1 supports `number` element type.
 *
 * @since 1.2
 * @stable
 * @example
 *     const fn: typeof state.array = state.array;
 *     void fn;
 */
array<T>(_capacity: number): MutableArraySlot<T> {
    return sentinel("state.array");
},
```

`MutableArraySlot` is imported from `./arraySlot.js` (mirrors how
`MutableSlot` is imported at `state.ts:4`). `state.tick.array` is **out of
scope** (deferred) — do not add a tick variant. `StateNamespace = typeof
state` picks the new method up automatically.

### 3. Registry (`packages/core/src/statefulPrimitives.ts`)

Append (additive within `apiVersion: 1`, per `core/CLAUDE.md`) to the
canonical `STATEFUL_PRIMITIVE_ENTRIES` array, in the `state.*` region (after
the `state.tick.*` entries, line ~191, before `request.security`):

```ts
{ name: "state.array", slot: true },
```

`STATEFUL_PRIMITIVES_BY_NAME` derives from the same list — no extra edit.
Update the two "currently 175 entries" counts in the file's JSDoc (lines ~222
and ~245) to 176 (search for `175 entries`).

### 4. Compiler ambient shim (`packages/compiler/src/program.ts`)

Mirror in the `declare module "@invinite-org/chartlang-core"` block (lines
29+), byte-consistent with core's surface:

- Add a `MutableArraySlot<T>` type declaration next to the shim's
  `MutableSlot` (line 992), matching the core interface shape (escaped
  backticks per the existing shim string style if the JSDoc is included; the
  shim types are typically terse, so a doc-free declaration is fine — match
  the neighbouring `MutableSlot` density):
  ```ts
  export type MutableArraySlot<T> = {
      push(value: T): void;
      get(n: number): T;
      last(): T;
      clear(): void;
      readonly size: number;
      readonly capacity: number;
  };
  ```
- Add `array<T>(capacity: number): MutableArraySlot<T>;` to the
  `StateNamespace` `Readonly<{ … }>` (after `string`, line ~999, before
  `tick`).
- `STATEFUL_PRIMITIVES` registry: the entry rides the same
  `ReadonlySet`/`ReadonlyMap` declarations already present in the shim — no
  shape change. The runtime/core list is the source of truth; nothing to add
  here beyond confirming the type still matches.

> **Do not "fix" the shim's `MutableSlot`.** The `program.ts` shim declares
> `MutableSlot<T>` as the simplified `{ value: T }` (line 992), **not** core's
> getter/setter pair — a deliberate, pre-existing simplification. Leave it
> alone; it is unrelated to `MutableArraySlot`. "Lockstep" here means the
> `StateNamespace.array` signature and the `MutableArraySlot` interface must
> match between core and shim.

### 5. Type-level tests

- **Core** (`packages/core/src/state/arraySlot.types.test.ts` or the existing
  state type-test location — follow whatever path `state.series`'s siblings
  use; the README points at `types.types.test.ts` / `state/*.types.test.ts`):
  using `expect-type`, allocate `const a = state.array<number>(8)` and assert:
  - `a` is assignable to `MutableArraySlot<number>`,
  - `a.get(0)` is `number`, `a.last()` is `number`, `a.size` is `number`,
    `a.capacity` is `number`,
  - `a.push(1)` is allowed; `a.clear()` is allowed,
  - `a.size = 1` is a **type error** (`size`/`capacity` are `readonly`) —
    assert with `expect-type`'s error form or a `// @ts-expect-error`.
- **Compiler** (`packages/compiler/src/compile.test.ts`): a positive
  `compile()` test (alongside the existing `state.*` tests) whose fixture body
  is:
  ```ts
  const win = state.array<number>(20);
  win.push(bar.close * 2);
  let sum = 0;
  for (let i = 0; i < win.size; i++) sum += win.get(i);
  plot(win.size > 0 ? sum / win.size : 0);
  ```
  Assert it compiles with **no** type diagnostics. (`compile()` type-checks;
  `transformAndAnalyse` does not — this guards the shim retyping. The in-loop
  `win.get(i)` is a method call, NOT a registry callsite, so it must NOT trip
  `stateful-call-inside-loop` — this test also pins that.)

### 6. Changeset

Create `.changeset/<slug>.md` (feature changeset for the whole work):

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-pine-converter": minor
"@invinite-org/chartlang-cli": patch
---

Add `state.array<T>(capacity)` — a persistent, bounded FIFO collection. Push
many values across bars (`a.push(v)`) into a fixed-capacity ring and read
them back by element (`a.get(0)` = newest, `a.last()`, `a.size`,
`a.capacity`, `a.clear()`). Bounded literal capacity keeps it
serialization-clean. The Pine converter lowers a bounded numeric
`var array<…>` Camp B ring to it.
```

The **`cli` patch** covers Task 6's additive `state.array` doc entry in
`packages/cli/src/commands/genPhase4Docs.ts` (a `packages/*/src/` change to a
published package). Fold it into this one feature changeset (changesets
accumulate until release).

## Edge cases

- `MutableArraySlot` is a plain handle, **not** an intersection with
  `MutableSlot` or `Series` — confirm `a.value` is a type error (no scalar
  `.value`) and `+a` is NOT asserted to coerce. This is the deliberate
  contrast with `state.series`.
- Use `@since 1.2` for the new core surface, matching the
  `@invinite-org/chartlang-core` minor bump (currently `1.1.1`; align with
  whatever `state.series` chose if it lands first).
- Do NOT add a `tick.array` hole, a `state.map`, or non-`number` `T` handling
  — all deferred.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/state/arraySlot.ts` | Create | Add `MutableArraySlot<T>` interface. |
| `packages/core/src/index.ts` | Modify | Re-export `MutableArraySlot`. |
| `packages/core/src/state/state.ts` | Modify | Add `array` hole. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Append registry entry; bump 175→176 counts. |
| `packages/core/src/state/arraySlot.types.test.ts` | Create | expect-type assertions. |
| `packages/compiler/src/program.ts` | Modify | Mirror type + hole in shim. |
| `packages/compiler/src/compile.test.ts` | Modify | Positive compile test (incl. in-loop method call). |
| `.changeset/<slug>.md` | Create | Feature changeset. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test` (100% coverage; the sentinel
  hole's throw is asserted, like every sibling)
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm docs:check` (JSDoc on new exports: `@since`, `@example`, `@stable`)

## Changeset

`.changeset/<slug>.md` — **minor** (core, compiler, runtime, pine-converter)
+ **patch** (cli, for Task 6's `genPhase4Docs.ts` docs-entry addition).

## Acceptance Criteria

- `MutableArraySlot<T>` defined + exported with full JSDoc; it is a plain
  handle (no `.value`, not number-coercible).
- `state.array` hole added (throws the active-step sentinel when called
  directly); registry entry appended; counts bumped; `tick.array` NOT added.
- Shim in `program.ts` mirrors core exactly (lockstep).
- expect-type test proves the collection surface + `readonly size`/`capacity`.
- `compile()` test proves `state.array(...)` + in-loop `.get(i)` type-checks
  with no diagnostics (and the method call does NOT trip the in-loop ban).
- Changeset committed; typecheck/lint/core+compiler tests/docs:check green.

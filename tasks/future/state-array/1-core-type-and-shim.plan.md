# Plan — Task 1: Core type + `state.array` hole + registry + compiler shim

> Audit artifact for `1-core-type-and-shim.md`. Validated against the live
> workspace on 2026-06-22.

## Context

Introduce `MutableArraySlot<T>` (a bounded FIFO collection handle) in
`@invinite-org/chartlang-core`, add the `state.array<T>(capacity)` sentinel
hole, append `{ name: "state.array", slot: true }` to the stateful-primitives
registry, and mirror the type + hole in the compiler's ambient shim
(`program.ts`). Add core type-level tests + a compiler positive compile test.
Pure type/contract work — no runtime behavior (that is Task 2).

## Pre-existing work

- **`state.series` already landed.** `state.ts:79-96` has the `series` hole,
  `statefulPrimitives.ts:188` has `{ name: "state.series", slot: true }`, the
  shim `program.ts:1008` has `series(init): NumberSeriesSlot`, and
  `compile.test.ts:143-177` has the series compile test. `state.array` mirrors
  this exactly, one shape down (a collection, not a number-coercible slot).
- The registry JSDoc count is **already 176** (lines 223, 251), NOT 175 as the
  task text says (the task text is stale — it predates `state.series` landing).
  So the bump is **176 → 177**, not 175 → 176.
- Core `package.json` is `1.2.0`; `state.series` chose `@since 1.3`
  (`state.ts:88`). Per the task edge-case "align with whatever `state.series`
  chose if it lands first," the new surface uses **`@since 1.3`**, NOT the
  `@since 1.2` literally written in the task body.

## Issues found / decisions

1. **`@since` version.** Task body says `1.2`; edge case + the landed
   `state.series` say `1.3`. Resolution: use `@since 1.3` (sibling parity,
   matches the next core minor). Documented here so the divergence from the
   task body is intentional.
2. **Entry count.** Bump `176 → 177` (not `175 → 176`).
3. **`MutableSlot` shim simplification.** Leave the shim's `MutableSlot` as
   `{ value: T }` (per the task's explicit warning). `MutableArraySlot` in the
   shim mirrors the full core shape (no getter/setter to simplify — it is
   methods + readonly fields).
4. **No `genPhase4Docs.ts` edit in Task 1.** The changeset's `cli: patch`
   is forward-looking for Task 6; Task 1 itself does not touch the cli.
5. **`readonly` negative test.** Use `// @ts-expect-error` for
   `a.size = 1` / `a.capacity = 1` (expect-type has no clean "assignment is an
   error" form; `@ts-expect-error` is the idiom and keeps the test honest).

## Steps

1. Create `packages/core/src/state/arraySlot.ts` — `MutableArraySlot<T>`
   interface with the full JSDoc (MIT header, `@since 1.3`, `@stable`,
   `@example`). Methods: `push`/`get`/`last`/`clear`; readonly `size`/`capacity`.
2. `packages/core/src/state/state.ts` — `import type { MutableArraySlot }`
   from `./arraySlot.js`; add the `array<T>(_capacity)` sentinel hole after
   `series`, before `tick`.
3. `packages/core/src/state/index.ts` — re-export `type MutableArraySlot`.
4. `packages/core/src/index.ts` — re-export `MutableArraySlot` from
   `./state/index.js` alongside `MutableSlot`/`StateNamespace`.
5. `packages/core/src/statefulPrimitives.ts` — append
   `{ name: "state.array", slot: true }` after the `state.tick.*` block
   (line ~191, before `request.security`); bump both `176 entries` → `177`.
6. `packages/core/src/state/state.test.ts` — assert the new sentinel throw.
7. `packages/core/src/state/arraySlot.types.test.ts` (new) — expect-type
   assertions for the collection surface + readonly negative test.
8. `packages/compiler/src/program.ts` — add `MutableArraySlot<T>` decl next to
   the shim `MutableSlot` (line 1000); add `array<T>(capacity): MutableArraySlot<T>;`
   to `StateNamespace` after `series` (line 1008).
9. `packages/compiler/src/compile.test.ts` — positive compile test
   (allocation + in-loop `.get(i)` method call).
10. `.changeset/state-array.md` — feature changeset.

## Files to create / modify

| File | Action |
|------|--------|
| `packages/core/src/state/arraySlot.ts` | Create |
| `packages/core/src/state/arraySlot.types.test.ts` | Create |
| `packages/core/src/state/state.ts` | Modify (import + hole) |
| `packages/core/src/state/state.test.ts` | Modify (sentinel throw) |
| `packages/core/src/state/index.ts` | Modify (re-export) |
| `packages/core/src/index.ts` | Modify (re-export) |
| `packages/core/src/statefulPrimitives.ts` | Modify (entry + counts) |
| `packages/compiler/src/program.ts` | Modify (shim type + hole) |
| `packages/compiler/src/compile.test.ts` | Modify (positive compile test) |
| `.changeset/state-array.md` | Create |

## Gates to keep green

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test` (100% coverage)
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm docs:check`

## Changeset

`.changeset/state-array.md` — core/compiler/runtime/pine-converter **minor**,
cli **patch**.

## Acceptance criteria

- [ ] `MutableArraySlot<T>` defined + exported, full JSDoc, plain handle.
- [ ] `state.array` hole added (throws sentinel); registry entry appended;
      counts bumped 176→177; no `tick.array`.
- [ ] Shim mirrors core (lockstep): `MutableArraySlot` + `StateNamespace.array`.
- [ ] expect-type test proves surface + `readonly size`/`capacity`.
- [ ] compile() test proves `state.array(...)` + in-loop `.get(i)` type-checks
      with no diagnostics, and the method call does not trip the in-loop ban.
- [ ] Changeset committed.

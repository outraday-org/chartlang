# Plan — Task 6: Docs (un-defer), primitive page, skills, example, demo

## Context

Final task of the `state.array` feature (Tasks 1–5 landed & green). It surfaces
`state.array<number>(capacity)` everywhere the language is taught and flips the
deferral in `docs/spec/pine-migration.md`. Author surface (validated against
source): `const a = state.array<number>(capacity)`; `capacity` is a REQUIRED
compile-time numeric literal (a `const` numeric binding also resolves; max
`MAX_STATE_ARRAY_CAPACITY` = 100_000, guarded by Task 3 as
`state-array-capacity-not-literal` / `state-array-capacity-exceeds-max`).
Methods: `push(v)`, `get(n)` (0 = newest; out-of-range ⇒ `NaN`), `last()`
(=== `get(0)`), `size` (filled ≤ capacity), `capacity`, `clear()`. It is a plain
handle, NOT number-coercible. `push`/`get`/`last` are handle methods, so they are
legal inside a bounded `for` loop; only the allocation `state.array(...)` call is
a registry callsite (the in-loop ban applies to allocation only). Bounded loops
need a LITERAL bound + inner `if (i < a.size)` guard.

Teaching distinction baked in everywhere: `state.series` = "value N BARS ago";
`state.array` = "a bounded bag of the last K things I PUSHED".

## Pre-existing work (verified, already landed — do NOT redo)

- `packages/core/src/state/state.ts:99-118` — `array<T>(_capacity)` hole with full
  JSDoc (`@since 1.3`, `@stable`, `@example`). This drives the generated page.
- `packages/core/src/state/arraySlot.ts` — `MutableArraySlot<T>` interface + JSDoc.
- `STATEFUL_PRIMITIVES` has the `state.array` entry (Task 1).
- `packages/core/CLAUDE.md` (lines 53-65) + `packages/runtime/CLAUDE.md`
  (lines 101-133) ALREADY document the `state.array` invariants → **Req. 6 for
  core/runtime is already done**; nothing to add.
- `packages/compiler/CLAUDE.md:144-163` ALREADY documents the capacity guard →
  **Req. 6 compiler is already done**.
- `packages/pine-converter/CLAUDE.md:1013-1017` ALREADY documents the lowering →
  **Req. 6 pine-converter is already done** (Task 5).
- `.changeset/state-array.md` already covers core/compiler/runtime/pine-converter
  (minor) + cli (patch). The `genPhase4Docs.ts` edit is a cli `src/` change →
  covered by the existing cli patch. **No new changeset.**
- Pine fixture is `31-var-array-window.{pine,expected.chart.ts,...}` (task text
  said `30-`; actual is `31-`).
- `stateArrayRollingWindow.scenario.ts` is Task 4's conformance scenario (pins a
  hash) — DIFFERENT job from the demo/example this task adds.

## Issues found

- Task references `30-var-array-window.pine`; actual fixture is `31-…`. Use `31-`.
- Adding an example script requires updating `EXAMPLE_SCRIPTS` in
  `packages/cli/src/e2e.test.ts` (line 13) AND the same-`id` `DEMO_SCRIPTS` mirror
  (`pnpm examples:sync` token-compares them).
- Requirement 7 (converter round-trip conformance scenario) is RECOMMENDED and
  requires re-pinning a hash through the conformance harness message — deferred to
  keep scope tight; the changeset already covers it if added later. Acceptance
  marks it optional.

## Steps

1. **`packages/cli/src/commands/genPhase4Docs.ts`** — append a `state.array`
   `Phase4DocEntry` immediately after the `state.series` entry (after line 120),
   before `barstate`. `symbolPath: ["state", "array"]`,
   `outRelPath: "docs/primitives/state/array.md"`, `seeAlso: "\`state.*\` namespace"`.

2. Run `pnpm docs:generate` → produces `docs/primitives/state/array.md` from the
   JSDoc. Verify with `pnpm docs:gate`.

3. **`docs/spec/pine-migration.md`** —
   - Support table (line 344): change the "Arrays and matrices" row from a single
     `not-supported` to partial support. Split into the bounded-literal/objects
     phrasing (covered-inline) + a `state.array` cell that is
     `covered: [persistent collections](#persistent-collections-and-large-arrays)`,
     keeping `state.map`/matrices as not-supported. Match existing vocabulary.
   - §"Persistent Collections and Large Arrays" (line 380): rewrite to "bounded
     numeric `state.array<number>(capacity)` IS supported in v1; serialization
     policy = required compile-time literal capacity + reuse of the ring's snapshot
     hooks"; keep `state.map`, matrices, non-numeric (`bool`/`string`/object), and
     large mutable collections deferred. Keep anchor
     `#persistent-collections-and-large-arrays` stable. Link the new primitive page.
   - Grep `docs/` for contradictions (`state.array … deferred / not v1`).

4. **`docs/language/series-and-indexing.md`** — add a
   "## Persistent collections — `state.array`" section after the `state.series`
   section (after line 291, before `## Lookback is bounded`): disambiguation,
   API, "which do I reach for?", not-number-coercible footgun, and the compiling
   code fence from the task (`pnpm docs:snippets`-checked).

5. **`examples/scripts/rolling-window-mean.chart.ts`** (new) — a rolling-mean over
   the last K closes using `state.array<number>(K)` (overlay: true). MIT header,
   top-level imports + destructured params. Genuinely needs a pushed collection
   (a bounded for-loop over `win.size` with the inner guard idiom).

6. Wire the example:
   - Add `"examples/scripts/rolling-window-mean.chart.ts"` to `EXAMPLE_SCRIPTS` in
     `packages/cli/src/e2e.test.ts`.
   - Add a `ROLLING_WINDOW` source constant + `DEMO_SCRIPTS` entry
     (`id: "rolling-window"`, label, disambiguating description) in
     `apps/site/src/components/demo/scripts.ts` — the inlined mirror.
   - Run `pnpm examples:generate`; verify `pnpm examples:gate` + `pnpm examples:sync`.

7. **`skills/chartlang-coding/SKILL.md`** — add `state.array` prose after the
   `state.series` paragraph (line 297): the push/get/last/size/capacity/clear
   surface, the bounded-literal-capacity rule, the not-number-coercible footgun,
   the series-vs-array distinction, the bounded-loop-with-`if (i < a.size)` idiom.

8. **`skills/chartlang-coding/references/translating-from-pine.md`** — in Camp B
   (line 52) note that a bounded NUMERIC `var array<float|int>` ring now lowers to
   `state.array<number>(K)` (eviction elided), with a short before/after. Add a
   gotcha mirroring the existing `var x := …; x[1]` → `state.series` note.

9. Run `pnpm skills:generate` (regenerates `primitives.md` — no-op for `state`,
   keeps the gate honest); verify `pnpm skills:gate`.

10. Update `examples/scripts/CLAUDE.md` (shipped-scripts list) + the `apps/`
    `DEMO_SCRIPTS` comment header if needed — add the new example's note.

## Files

| File | Action |
|------|--------|
| `packages/cli/src/commands/genPhase4Docs.ts` | Modify — append `state.array` entry |
| `docs/primitives/state/array.md` | Regenerate (`pnpm docs:generate`) |
| `docs/spec/pine-migration.md` | Modify — un-defer bounded `state.array` |
| `docs/language/series-and-indexing.md` | Modify — persistent-collections section |
| `examples/scripts/rolling-window-mean.chart.ts` | Create |
| `packages/cli/src/e2e.test.ts` | Modify — add to `EXAMPLE_SCRIPTS` |
| `apps/site/src/components/demo/scripts.ts` | Modify — source const + `DEMO_SCRIPTS` entry |
| `docs/examples/*.md`, `docs/examples/index.md` | Regenerate (`pnpm examples:generate`) |
| `skills/chartlang-coding/SKILL.md` | Modify — `state.array` prose |
| `skills/chartlang-coding/references/translating-from-pine.md` | Modify — Camp B numeric ring |
| `skills/chartlang-coding/references/primitives.md` | Regenerate (`pnpm skills:generate`) |
| `examples/scripts/CLAUDE.md` | Modify — shipped-scripts note |

## Gates to keep green

- `pnpm docs:generate` + `pnpm docs:gate` (Phase4 page byte-diff)
- `pnpm docs:check` (JSDoc gate on package src — unaffected by md edits)
- `pnpm docs:snippets` (the series-and-indexing code fence compiles)
- `pnpm examples:generate` + `pnpm examples:gate` + `pnpm examples:sync`
- `pnpm skills:generate` + `pnpm skills:gate`
- `pnpm readme:check` (unaffected — no README touched)
- `pnpm hover:check` (unaffected — no core export signature changed)
- (Recommended/deferred) `pnpm conformance` + `pnpm conformance:check`,
  `pnpm converter:docs:check` if the round-trip scenario is added.

## Changeset

None new — `.changeset/state-array.md` already covers the cli patch (the
`genPhase4Docs.ts` `src/` edit) and the feature packages.

## Acceptance criteria

- `pine-migration.md` no longer defers bounded numeric `state.array`; the
  serialization policy is documented; `state.map`/matrices/non-numeric stay
  deferred; the section anchor is unchanged.
- `docs/primitives/state/array.md` generated; series-and-indexing has the
  persistent-collections section + disambiguation + footgun.
- New example script + demo entry run with `state.array`; `docs/examples/*.md`
  regenerated; skills + `primitives.md` regenerated.
- `examples:gate`, `examples:sync`, `skills:gate`, `docs:gate`, `docs:snippets`,
  `docs:check`, `readme:check`, `hover:check` all green.

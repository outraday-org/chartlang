# Task 6 — Docs (un-defer), primitive page, skills, example, demo

> **Status: TODO**

## Goal

Surface `state.array` everywhere the language is taught AND flip the deferral
that gated it: un-defer the persistent-collection rows in
`docs/spec/pine-migration.md`, generate the `state.array` primitive page, add a
collections section to the series-and-indexing guide, update the
chartlang-coding skill (incl. the Camp B → `state.array` mapping in
`translating-from-pine.md`), add a curated example script + live demo entry,
and update the per-folder `CLAUDE.md` invariants. Regenerate every
machine-generated artifact.

## Prerequisites

Tasks 1–5 (the feature works end-to-end and the converter lowers it, so the
demo/example actually run and the converter example actually converts).

## Current Behavior

- `docs/spec/pine-migration.md` **defers** `state.array(...)`: the support
  table row (line ~344, "Arrays and matrices … persistent collections are not
  v1 … not-supported: persistent collections") and the
  §"Persistent Collections and Large Arrays" section (line ~380: "Persistent
  `state.array(...)`, `state.map(...)`, matrices, and large mutable collections
  are deferred until a serialization policy is agreed").
- `docs/primitives/state/*.md` (`float.md`, …, `tick-string.md`) are
  **auto-generated** by `chartlang docs` from `PHASE4_DOC_ENTRIES`
  (`packages/cli/src/commands/genPhase4Docs.ts:98-113`, which enumerates
  `state.float/int/bool/string` + `tick` variants via a `.flatMap`). There is
  no `series.md` or `array.md`.
- `docs/language/series-and-indexing.md` documents bar fields + `ta.*` series
  + indexing. No persistent collection.
- `apps/site/src/components/demo/scripts.ts` (`DEMO_SCRIPTS`) drives the live
  demo and, via `scripts/gen-examples-docs.ts` (`pnpm examples:generate`), the
  `docs/examples/*.md` pages. No `state.array` demo.
- `skills/chartlang-coding/SKILL.md` (line ~268) documents `state.float`/`int`/
  `bool` as scalar slots only; `references/translating-from-pine.md` (line ~52)
  documents Camp B as a **drawing-handle** ring (`var array<line>`), with no
  numeric-collection target.
- `references/primitives.md` is auto-generated from `ta.*` / `draw.*` JSDoc
  only — it has **no** `state.*` section.

## Desired Behavior

- `pine-migration.md` reflects that bounded numeric `state.array` IS supported
  (the deferral narrows to `state.map` / matrices / non-numeric collections). A
  generated `docs/primitives/state/array.md` page exists (from Task 1's JSDoc).
  The series-and-indexing guide has a "Persistent collections — `state.array`"
  section that disambiguates it from `state.series`. The skill + the Camp B
  pine-translation note show `state.array`. A new example script + demo entry
  use a `state.array` rolling window. The CLAUDE.md invariants are updated.

## Requirements

### 1. Un-defer `pine-migration.md` (THE landing of the serialization policy)

- **Support table row (line ~344):** change the "Arrays and matrices" row from
  `not-supported: persistent collections` to reflect partial support — e.g.
  split into "Bounded literal arrays + TypeScript objects" (covered) and
  "Persistent numeric collection" → `state.array` (covered:
  [persistent collections](#persistent-collections-and-large-arrays)), keeping
  `state.map` / matrices as not-supported. Match the table's existing
  `covered:` / `not-supported:` link vocabulary exactly.
- **§"Persistent Collections and Large Arrays" (line ~380):** rewrite from
  "Persistent `state.array(...)` … deferred until a serialization policy is
  agreed" to: bounded numeric `state.array<number>(capacity)` IS supported in
  v1 — the **serialization policy** is "a required compile-time literal
  capacity + reuse of the ring buffer's snapshot hooks" — and explicitly keep
  `state.map(...)`, matrices, non-numeric (`bool`/`string`/object) collections,
  and large mutable collections deferred. Link to the new
  `docs/primitives/state/array.md` page. Keep the section anchor stable
  (`#persistent-collections-and-large-arrays`) so existing links don't break.
- Cross-check there are no other `state.array … deferred / not v1` strings in
  `docs/` that contradict the new support (grep `state.array`, `state.map`,
  "persistent collection", "serialization policy").

### 2. Primitive page (generated)

The state-slot pages are emitted from `PHASE4_DOC_ENTRIES`
(`packages/cli/src/commands/genPhase4Docs.ts`), **not** auto-discovered. The
page will not generate unless you append a `state.array` entry. `state.array`
is an inline method on the frozen `state` object (like `float`), so
`symbolPath: ["state", "array"]` resolves identically — no shorthand handling
needed. Add next to the existing `state.*` entries (after the `.flatMap`
block, before `barstate`):

```ts
Object.freeze({
    title: "state.array",
    sourceRelPath: `${CORE}/state/state.ts`,
    symbolPath: ["state", "array"],
    outRelPath: "docs/primitives/state/array.md",
    seeAlso: "`state.*` namespace",
}),
```

Then run the generator (`pnpm docs:generate`, the `chartlang docs`
no-positional form) so `docs/primitives/state/array.md` is produced from Task
1's `state.array` JSDoc — do **not** hand-write it. Verify with
`pnpm docs:check` / `pnpm docs:gate`.

### 3. Series-and-indexing guide (`docs/language/series-and-indexing.md`)

Add a "Persistent collections — `state.array`" section. Lead with the
**disambiguation** that keeps it from reading as redundant with `state.series`:

- `state.array<number>(capacity)` is a bounded FIFO collection you **push**
  many values into; `state.series(init)` is the **history of one value**.
  `a.get(n)` is "the n-th element from newest", NOT "n bars ago".
- API: `push(v)` (FIFO, oldest-evict at capacity), `get(n)` (0 = newest),
  `last()`, `size` (filled ≤ capacity), `capacity`, `clear()`.
- "Which do I reach for?" — use `state.series` when you want "the value N
  **bars** ago"; use `state.array` when you want "a bounded **bag** of the last
  K things I pushed" (a rolling window, an event-value log, a
  multiple-values-per-bar accumulator). Neither expresses the other.
- Footgun note: `state.array` is a collection handle, NOT number-coercible —
  `+a` is `NaN`; use `a.get(n)` / `a.last()`.
- A compiling code fence (checked by `pnpm docs:snippets`):
  ```ts
  // A rolling window of the last 20 closes — pushes accumulate across bars,
  // oldest evicted at capacity. get(i) iterates ELEMENTS, not bars.
  const win = state.array<number>(20);
  win.push(bar.close.current);
  let sum = 0;
  for (let i = 0; i < win.size; i++) sum += win.get(i);
  plot(win.size > 0 ? sum / win.size : 0);
  ```

### 4. New example script + demo entry

- Create `examples/scripts/rolling-window-mean.chart.ts` (or similar) using
  `state.array` for a rolling-window indicator that genuinely needs a pushed
  collection (not derivable from a single `state.series`/`bar.close[N]` — e.g. a
  multi-push-per-bar accumulator, or a window whose contents are
  conditionally pushed). A clean choice: a rolling mean/median over the last K
  closes (`overlay: false` if median, `overlay: true` if mean over price).
  Follow `examples/scripts/CLAUDE.md` conventions. Note this is a DIFFERENT
  job from Task 4's conformance scenario (which pins a hash); the demo's job is
  to teach the idiom.
- Add a `DEMO_SCRIPTS` entry in `apps/site/src/components/demo/scripts.ts`
  (`id: "rolling-window"` or `state-array`, a `label`, `source`, and a
  catalogue `description` that states the disambiguation: "a bounded collection
  you push many values into — here a rolling window — which `state.series`
  (one value's bar history) can't express"). Keep the `id` stable for the
  `?script=…` deep link.
- Run `pnpm examples:generate`, verify `pnpm examples:gate` (rewrites
  `docs/examples/<new>.md` + `index.md`; never hand-edit generated files).

### 5. Skills

- `state.*` is documented in the **hand-written** skill prose, NOT the
  generated `references/primitives.md`. Add the `state.array` material
  (push/get/last/size/capacity/clear, the bounded-literal-capacity rule, the
  not-number-coercible footgun, the series-vs-array disambiguation) to
  `skills/chartlang-coding/SKILL.md` (next to the `state.float`/etc. line at
  ~268).
- Update `skills/chartlang-coding/references/translating-from-pine.md`: in the
  **Camp B** section (line ~52, currently only `var array<line>` drawing-handle
  rings) add that a bounded **numeric** `var array<float|int>` ring now lowers
  to `state.array<number>(K)` (the eviction block elided), with a short
  before/after. Update the reject/gotcha rows that reference `var array<…>`
  numeric collections if any now have a target.
- Still run `pnpm skills:generate` (regenerates `primitives.md` from ta/draw
  JSDoc — a no-op for `state`, keeps the gate honest) and verify
  `pnpm skills:gate`.

### 6. CLAUDE.md invariants

- `packages/core/CLAUDE.md`: note `MutableArraySlot` + the `state.array`
  registry entry (additive within `apiVersion: 1`; the entry-count bump).
- `packages/runtime/CLAUDE.md`: note the `state.array` slot (two-ring
  `committedRing`/`tentativeRing`, `onBarClose` tentative→committed /
  `onBarTick` committed→tentative, `:array` snapshot key, the storage-map
  choice from Task 2) alongside the existing `state.*` invariants.
- `packages/compiler/CLAUDE.md`: if Task 3 shipped the capacity guard, note the
  `state-array-capacity-not-literal` analysis.
- `packages/pine-converter/CLAUDE.md`: already updated in Task 5 — confirm the
  KNOWN GAPS prose is consistent.

### 7. (Recommended) Converter round-trip conformance scenario

Add a `pine-converter-round-trip-var-array` conformance scenario (mirror the
existing `pine-converter-round-trip-*` scenarios) that converts the Task-5
`30-var-array-window.pine` fixture at module-load and runs the compiled output
— pinning the converter→compile→runtime round-trip. Register it and re-pin its
hash via the harness message (reuses Task 4's pattern). If added, run
`pnpm converter:docs:generate` only if Task 5 added diagnostic codes
(regenerates `docs/converter/diagnostics.md`) and verify
`pnpm converter:docs:check`.

## Edge cases

- The generated `[Try it live]` link (`?script=<id>`) must keep working — keep
  the demo `id` stable.
- `pnpm examples:gate` / `pnpm skills:gate` / `docs:gate` / converter-docs gate
  fail CI if generation is stale — always regenerate, never hand-edit generated
  files.
- The `pine-migration.md` section anchor must stay
  `#persistent-collections-and-large-arrays` so the support-table link and any
  external links keep resolving.
- If Task 3 was skipped, phrase the docs as capacity "should be a literal"
  rather than "must be" (the runtime still bounds it).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/spec/pine-migration.md` | Modify | Un-defer the bounded-`state.array` rows; keep `state.map`/matrices deferred. |
| `packages/cli/src/commands/genPhase4Docs.ts` | Modify | Append `state.array` to `PHASE4_DOC_ENTRIES` (else `array.md` never generates). |
| `docs/primitives/state/array.md` | Regenerate | From Task 1 JSDoc via `pnpm docs:generate`. |
| `docs/language/series-and-indexing.md` | Modify | Persistent-collections section + series-vs-array disambiguation + footgun. |
| `examples/scripts/rolling-window-mean.chart.ts` | Create | New `state.array` rolling-window example. |
| `apps/site/src/components/demo/scripts.ts` | Modify | Demo entry + description. |
| `docs/examples/*.md`, `docs/examples/index.md` | Regenerate | `pnpm examples:generate`. |
| `skills/chartlang-coding/SKILL.md`, `references/translating-from-pine.md` | Modify | `state.array` prose + Camp B numeric mapping. |
| `skills/chartlang-coding/references/primitives.md` | Regenerate | `pnpm skills:generate` (no-op for `state`; keeps gate green). |
| `packages/conformance/src/scenarios/*` | Modify (recommended) | Round-trip scenario. |
| `packages/core/CLAUDE.md`, `packages/runtime/CLAUDE.md`, `packages/compiler/CLAUDE.md` | Modify | New invariants. |

## Gates

- `pnpm examples:gate`, `pnpm skills:gate`
- `pnpm docs:check`, `pnpm docs:gate`, `pnpm docs:snippets`, `pnpm hover:check`
- `pnpm readme:check`
- `pnpm converter:docs:check` plus `pnpm test:scripts` for
  `scripts/gen-converter-docs.test.ts` (if Task 5 added codes)
- `pnpm conformance` + `pnpm conformance:check` (if the round-trip scenario is
  added)
- `pnpm -F site build` / `pnpm -F site typecheck` (demo compiles)

## Changeset

Covered by Task 1's feature changeset — which includes the
`@invinite-org/chartlang-cli` **patch** that this task's
`genPhase4Docs.ts` edit requires (cli is a published package, so its `src/`
change needs a bump). Do **not** add a second changeset file.

## Acceptance Criteria

- `pine-migration.md` no longer defers bounded numeric `state.array` (the
  serialization policy is documented); `state.map` / matrices / non-numeric
  collections stay deferred; the section anchor is unchanged.
- `docs/primitives/state/array.md` generated; series-and-indexing guide has the
  persistent-collections section + series-vs-array disambiguation + footgun.
- New example script + demo entry run with `state.array`; `docs/examples/*.md`
  regenerated; skills + `primitives.md` regenerated.
- (If added) converter round-trip conformance scenario green.
- CLAUDE.md invariants updated.
- `examples:gate`, `skills:gate`, `docs:check`, `docs:gate`, `docs:snippets`,
  `hover:check`, `readme:check` (and converter/conformance if added) all green.

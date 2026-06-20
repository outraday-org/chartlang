# Task 2 — Runtime `draw.fillBetween` emit + full §22.10 set

> **Status: DONE**

## Goal

Implement the runtime `draw.fillBetween` emit primitive and land the
draw primitive landing set that this repo's sibling `draw.*` primitives
actually carry: JSDoc with the required draw tags, a co-located unit
test at 100% coverage, a conformance scenario with a pinned drawing
hash, and the regenerated auto-docs page + skills reference. Property
tests are optional; per-primitive draw benches are not used in this
folder today.

## Prerequisites

Task 1 (the `"fill-between"` kind, `FillBetweenState`,
`FillBetweenStyle`, `DrawNamespace.fillBetween`, and
`STATEFUL_PRIMITIVES` `draw.fillBetween` slot entry must exist).

## Current Behavior

`draw.fillBetween` is declared on the type but unimplemented — the
`namespace.ts` proxy throws "unsupported drawing kind" at call time.

## Desired Behavior

Author scripts can call `draw.fillBetween(edgeA, edgeB, opts?)` inside
`compute({ bar, draw })`; it emits a `fill-between` drawing and returns a
`DrawingHandle` whose `.update({ edgeA, edgeB, style })` re-anchors it and
`.remove()` deletes it. The auto-docs page and skills reference list it.

## Requirements

### 1. Emit file (`packages/runtime/src/emit/draw/boxes/fillBetween.ts`)

Model on `boxes/path.ts` (array anchors, same 3-overload shape). MIT
header. Structure:

- `OUTSIDE_CTX_MESSAGE` sentinel reused/imported as siblings do.
- `fillBetweenImpl(slotId, edgeA, edgeB, opts)`:
  - read `ACTIVE_RUNTIME_CONTEXT.current`, throw the sentinel if null;
  - `const subId = nextSubId(ctx, slotId);`
  - build `const state: FillBetweenState = { kind: "fill-between", edgeA,
    edgeB, style: opts ?? {} };`
  - `return createDrawingHandle(slotId, subId, "fill-between", state);`
- Script-facing overload (no `slotId`) carrying the JSDoc.
- Compiler-injected overload (leading `slotId: string`).
- Implementation signature branching on `typeof arg1 === "string"`,
  exactly as `path.ts` does.

**Edge / NaN handling:** do not throw on empty edges or `NaN` prices —
emit the state as given; the adapter (Task 1) no-ops degenerate frames.
Document this in the JSDoc `@warmup` note. (Keep the emit pure;
validation/skip lives in the renderer, matching the other primitives.)

### 2. JSDoc (draw tag set — feeds docs + skills generators)

On the script-facing overload, include the draw tag set. The tags the
draw docs gate actually enforces are the ones `boxes/path.ts` /
`lines/line.ts` carry: `@anchors`, `@anchorCount`, `@bucket`, `@since`, a
stability marker (`@stable`), and a type-checkable `@example`. `@warmup`
is **not** one of them — the sibling draw primitives omit it — but it is a
known tag and including `@warmup none` here is harmless and documents the
no-op-degenerate contract, so keep it. (`@formula` is likewise not
required for draw primitives.)

```ts
/**
 * Fill the ribbon between two edges. The native equivalent of Pine
 * `linefill.new(line1, line2, color)` and `fill(plot1, plot2, color)`.
 * The filled region is the closed polygon `edgeA` forward then `edgeB`
 * reversed; the two edges need not share x-coordinates or length.
 *
 * @anchors `edgeA`, `edgeB` — two `WorldPoint` lists (the band edges)
 * @anchorCount variable
 * @bucket polylines
 * @warmup none — a frame with an empty edge or NaN anchor is a no-op
 * @since 0.4
 * @stable
 * @example
 *     import { defineIndicator } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.fillBetween demo",
 *         apiVersion: 1,
 *         compute({ bar, draw }) {
 *             draw.fillBetween(
 *                 [{ time: bar.time, price: bar.high }],
 *                 [{ time: bar.time, price: bar.low }],
 *                 { fill: "#3b82f6", fillAlpha: 0.2 },
 *             );
 *         },
 *     });
 */
```

The draw docs generator (`packages/cli/src/commands/extractDrawingPages.ts`)
parses `@anchorCount` as a **free non-empty string** (it rejects only a
missing or empty tag) and prints it verbatim on the page. `line` uses
`2`, `path` uses the range `2..20` — there is no special "variable"
token, so any non-empty string is accepted. For the two variable-length
edges, use a clear value such as `variable` (or `2..N per edge`); confirm
the page renders by running `pnpm docs:generate`. Keep the same token in
the `@anchorCount` JSDoc and the README architecture note.

### 3. Namespace registration (`packages/runtime/src/emit/draw/namespace.ts`)

Import `fillBetween` and add `fillBetween` to `KIND_IMPLS` in the same
alphabetical/grouped position the file already uses (near `path`).

### 4. Tests (co-located — match the layers the sibling draw primitives ship)

**Reality check on the sibling layers:** `boxes/path.ts` ships **only**
`path.test.ts` and `lines/line.ts` ships **only** `line.test.ts` — there
is **no** `*.property.test.ts` and **no** per-primitive `*.bench.ts` in
`emit/draw/` (the sole bench is `pushDrawing.bench.ts`). So mirror that:
the **required** layer is the unit `*.test.ts` (plus the conformance
scenario in §5); a property test is **optional/recommended** and bench is
**not carried** by the draw siblings — skip it. 100% coverage is the hard
gate, achievable with the unit test.

- `fillBetween.test.ts` (**required**) — unit: script-facing throw
  outside context; happy path emits one `fill-between` drawing;
  `handle.id` is `slotId#subId`; `state.edgeA`/`edgeB`/`style` are the
  passed values; `opts` omitted defaults `style` to `{}`; `update()`
  patches state; `remove()` removes. `afterEach` resets
  `ACTIVE_RUNTIME_CONTEXT.current`.
- `fillBetween.property.test.ts` (**optional**) — fast-check: for random
  valid edge arrays, the emitted state round-trips (edges preserved, kind
  correct, stable id within a slot across bars). Seeded. Add only if it
  buys coverage/confidence the unit test doesn't.
- Bench: **skip** — no sibling draw primitive carries one.

**100% line/branch/function coverage** on the new file.

### 5. Conformance scenario (`packages/conformance/src/scenarios/drawFillBetween.scenario.ts`)

Model on `drawLine.scenario.ts`:

- `INLINE_SOURCE` — a tiny `defineIndicator` that calls
  `draw.fillBetween([...], [...], { fill: "#3b82f6", fillAlpha: 0.2 })`
  on a single bar.
- `ASSERTIONS` — `{ kind: "drawing-hash", sha256: "<pin>" }` plus
  `diagnostic-code-absent` for `unsupported-drawing-kind` and
  `drawing-budget-exceeded`.
- Export `DRAW_FILL_BETWEEN_SCENARIO` (`id: "draw-fill-between"`,
  `intervalCount: 1`).
- Register: import + re-export in
  `packages/conformance/src/scenarios/index.ts`, re-export in
  `packages/conformance/src/index.ts`, and add to `ALL_SCENARIOS` in
  `packages/conformance/src/runConformanceSuite.ts`.
- **Pin the hash:** run the suite once, copy the actual `sha256` into
  the assertion, re-run to confirm green. Never invent the hash.

### 6. Regenerate generated artifacts

- `pnpm docs:generate` → creates `docs/primitives/draw/fill-between.md`
  (**kebab-case** filename, derived from the kebab kind — generated pages
  are kebab, e.g. `rotated-rectangle.md`, **not** camelCase). Commit it;
  `pnpm docs:gate` must byte-match.
- `pnpm skills:generate` → updates
  `skills/chartlang-coding/references/primitives.md` (a `draw.fillBetween`
  entry under the `## draw.*` section). Commit it; `pnpm skills:gate`
  must byte-match.
- Do **not** hand-edit either generated file.

### 7. CLAUDE.md

`packages/runtime/CLAUDE.md` — add `draw.fillBetween` to any documented
draw primitive inventory and note the snapshot-edge / no-op-degenerate
emit contract.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/emit/draw/boxes/fillBetween.ts` | Create | emit impl + JSDoc |
| `packages/runtime/src/emit/draw/boxes/fillBetween.test.ts` | Create | unit tests |
| `packages/runtime/src/emit/draw/boxes/fillBetween.property.test.ts` | Create (optional) | property tests — siblings ship none |
| ~~bench~~ | — | **Skip** — no sibling draw primitive carries a bench |
| `packages/runtime/src/emit/draw/namespace.ts` | Modify | `KIND_IMPLS` |
| `packages/conformance/src/scenarios/drawFillBetween.scenario.ts` | Create | scenario |
| `packages/conformance/src/scenarios/index.ts` | Modify | register |
| `packages/conformance/src/index.ts` | Modify | re-export |
| `packages/conformance/src/runConformanceSuite.ts` | Modify | `ALL_SCENARIOS` |
| `docs/primitives/draw/fill-between.md` | Generate | auto-docs page (kebab filename) |
| `skills/chartlang-coding/references/primitives.md` | Regenerate | skills ref |
| `packages/runtime/CLAUDE.md` | Modify | invariant |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on runtime + conformance)
- `pnpm docs:check` (JSDoc tags present) + `pnpm docs:gate` (page bytes)
- `pnpm skills:gate` (primitives.md bytes)
- `pnpm conformance` (new scenario green with pinned hash)
- `pnpm bench:ci` (if a bench test was added)

## Changeset

Deferred to Task 5.

## Acceptance Criteria

- `draw.fillBetween(...)` emits a `fill-between` drawing and returns a
  working handle (`update` / `remove`).
- The unit `*.test.ts` (the layer sibling draw primitives carry) is
  present and green at 100% coverage; property test optional; bench
  skipped.
- Conformance scenario registered with a real pinned hash; `pnpm
  conformance` green.
- `docs/primitives/draw/fill-between.md` and `primitives.md` regenerated
  and gate-clean (no hand-edits).
- `packages/runtime/CLAUDE.md` updated.

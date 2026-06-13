# Task 21 — gen-docs.ts extension + `docs/primitives/draw/<kind>.md` (61 pages) + index page

> **Status: TODO**

## Goal

Extend the Phase-2 `gen-docs.ts` CLI script to walk
`packages/core/src/draw/draw.ts` JSDoc (and the runtime-side
emit functions) and auto-generate 61 `docs/primitives/draw/<kind>.md`
pages. Plus a manually-curated `docs/primitives/draw/index.md`
listing every kind grouped by category. Each port task
(Tasks 5–18) already ran `pnpm docs:generate` per-PR and
committed its pages; Task 21 is the "extend the generator + add
the index page" PR.

## Prerequisites

- Tasks 1–20.

## Background

Phase 2 shipped the gen-docs entry point at
`packages/cli/src/commands/genDocs.ts` (NOT
`packages/cli/src/gen-docs/`; that directory doesn't exist).
The Phase-2 generator walks `packages/runtime/src/ta/<id>.ts`
JSDoc for `ta.*` primitives and emits
`docs/primitives/ta/<id>.md` per template (§17.4). The
generator consumes:
- `@since`, `@example`, stability marker (`@stable` /
  `@experimental` / `@deprecated`).
- `@formula`, `@warmup`, `@anchors` (Phase-2 indicator-specific).

Phase 3 ports introduced new JSDoc tags on drawing kinds:
- `@anchors` — describing the anchor tuple (e.g. "from, to",
  "x, a, b, c, d").
- `@anchorCount` — the integer arity.
- `@bucket` — the `DrawingCounts` bucket name (lines / labels /
  boxes / polylines / other).

Tasks 5–18 already write per-kind docs pages (the generator
walks the JSDoc and writes one page per `draw.<kind>` export).
Task 21 extends the generator with:

1. Handling of the 4 sub-namespaces (`draw.fib.*`,
   `draw.gann.*`, `draw.elliott.*`, `draw.pattern.*`) — these
   methods live at `draw.<namespace>.<kind>` and need
   `docs/primitives/draw/fib/<kind>.md` paths.
2. Cross-references to the `WorldPoint` / `DrawingHandle`
   types (auto-linked).
3. The 61-page index page generation.

## Requirements

### 1. `packages/cli/src/commands/extractDrawingPages.ts`

A new extractor that:
- Reads `packages/core/src/draw/draw.ts` for the namespace
  shape.
- Reads each `packages/runtime/src/emit/draw/<kind>.ts` JSDoc
  for the live `@anchors` / `@anchorCount` / `@bucket` /
  `@example`.
- Resolves sub-namespace kinds (e.g. `fibRetracement` →
  `docs/primitives/draw/fib/retracement.md`).
- Emits per-page markdown using the new template (see below).

The extractor sits next to the Phase-2 `genDocs.ts` entry
(`packages/cli/src/commands/genDocs.ts`) and is invoked from
the same `pnpm docs:generate` script. Tests live alongside as
`extractDrawingPages.test.ts`.

### 2. Per-page template (`docs/primitives/draw/<path>.md`)

```markdown
# `draw.<camelKind>`

> Stability: experimental · Since `0.3` · Bucket: `<bucket>`

## Anchors

<rendered `@anchors` content with `anchorCount` confirmation>

## Signature

```ts
draw.<camelKind>(<args>): DrawingHandle
```

## Example

```ts
<rendered `@example` content>
```

## Schema

The emitted `DrawingState` variant carries:

| Field | Type | Notes |
|---|---|---|
| `kind` | `"<kebabKind>"` | discriminator |
| <field> | <type> | <notes> |

## Adapters

To declare support: `capabilities.<camelKind>()` (per-kind) or
`capabilities.<categoryGroup>()` (group). See the [adapter
guide](../../adapters/declaring-capabilities.md).
```

### 3. Index page — `docs/primitives/draw/index.md`

Manually curated (NOT auto-generated) page listing every kind
grouped by category, with links to each per-kind page. ~80
lines, cap at 100. Mirrors the existing
`docs/primitives/ta/index.md` (if Phase-2 added one) — if
neither exists, Task 21 creates both index pages from a single
template.

Structure:

```markdown
# `draw.*` Primitives

61 drawing kinds across 13 categories. Each emits a
`DrawingHandle` the script can update / remove. See PLAN.md
§10 for the language-level spec.

## Lines / Rays (6)

- [`draw.line`](./line.md)
- [`draw.horizontalLine`](./horizontal-line.md)
- …

## Boxes / Shapes (8)

…

(13 sections, 61 links total)
```

### 4. `pnpm docs:generate` script entry

Already exists from Phase 2. Confirm the new extractor is
invoked. Re-run end-to-end and commit any per-page diffs
introduced by the new template — should be minimal since each
port task already committed its page.

### 5. `pnpm docs:check` integration

The existing `scripts/docs-check.ts` (Phase 1 Task 3) executes
`@example` blocks in JSDoc. Phase 3's `@example` blocks
already run through this gate. Verify no `@example` regressions
in the post-Task-20 state.

### 6. Tests

- `packages/cli/src/commands/extractDrawingPages.test.ts` —
  given a fixture `packages/runtime/src/emit/draw/line.ts`
  JSDoc string, produces the expected `line.md` markdown.
- `packages/cli/src/commands/extractDrawingPages.types.test.ts`
  — extractor return type.
- `packages/cli/src/commands/genDocs.test.ts` (existing) —
  extended to cover the new drawing-extraction path; assert it
  writes 61 pages.

### 7. Index page link audit

A simple test in `scripts/docs-check.ts` (extend) walks every
link in `docs/primitives/draw/index.md` and asserts the
referenced file exists.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/cli/src/commands/extractDrawingPages.ts` | Create |
| `packages/cli/src/commands/extractDrawingPages.test.ts` | Create |
| `packages/cli/src/commands/extractDrawingPages.types.test.ts` | Create |
| `packages/cli/src/commands/genDocs.ts` | Modify (wire the new extractor in the existing entry point) |
| `packages/cli/src/commands/genDocs.test.ts` | Modify (assert 61 draw pages written) |
| `packages/cli/src/commands/docs.ts` | Modify (if it dispatches to genDocs; verify in PR) |
| `docs/primitives/draw/index.md` | Create |
| `docs/primitives/draw/fib/index.md` | Create (sub-category index for the 10 fib kinds) |
| `docs/primitives/draw/gann/index.md` | Create |
| `docs/primitives/draw/elliott/index.md` | Create |
| `docs/primitives/draw/pattern/index.md` | Create |
| `scripts/docs-check.ts` | Modify (link audit) |
| `packages/cli/README.md` | Modify (`gen-docs` covers draw pages) |
| `.changeset/phase-3-task-21-docs-generation.md` | Create |

## Gates

- `pnpm typecheck`, `pnpm test` (100% coverage), `pnpm
  docs:check`, `pnpm readme:check`.
- New: index-page link audit pass in `docs:check`.
- `pnpm docs:generate` is idempotent — running it twice yields
  no diff.

## Changeset

`@invinite-org/chartlang-cli: minor`. Description:
"`gen-docs` extension for `draw.*` primitives — 61 per-kind
pages + 5 category index pages + the root drawing index.
Mirrors the Phase-2 `ta.*` extractor."

## Acceptance Criteria

- 61 `docs/primitives/draw/<path>.md` pages exist + cleanly
  re-generate.
- `docs/primitives/draw/index.md` + 4 sub-category index pages
  ship and pass link audit.
- `pnpm docs:generate` is idempotent.
- 100% coverage on the cli package.
- Phase-1/-2 + Tasks 1–20 gates green.
- Changeset committed.

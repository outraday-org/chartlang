# Task 5 — Adapter-kit: `groupInputs()` helper + rendering docs/example

> **Status: TODO**

## Goal

Give adapter authors a single, ordered way to turn `manifest.inputs` into a
grouped, inline-rowed structure they can render as a settings panel — so the
`group`/`inline`/`tooltip`/`display` metadata Tasks 1–4 preserve actually
drives a nice UI, consistently across adapters.

## Prerequisites

Task 1 (descriptors carry `group`/`inline`/`tooltip`/`display`/`confirm`;
`manifest.inputs` preserves declaration order).

## Current Behavior

`packages/adapter-kit/src/types.ts` re-exports `InputKind` and declares
`Capabilities.inputs: ReadonlySet<InputKind>`. There is no helper to bucket
`manifest.inputs` into render groups; an adapter must iterate the flat
`Record` and re-derive grouping itself.

## Desired Behavior

```ts
import { groupInputs } from "@invinite-org/chartlang-adapter-kit";

for (const group of groupInputs(manifest.inputs)) {
    renderHeader(group.title);            // group.title ?? "" (ungrouped bucket)
    for (const row of group.rows) {
        renderRow(row.map((e) => widgetFor(e.name, e.descriptor)));
    }
}
```

`groupInputs` returns ordered groups → ordered inline rows → ordered entries,
preserving declaration order throughout, so the rendered panel matches the
original Pine layout.

## Requirements

### 1. The helper (`packages/adapter-kit/src/groupInputs.ts`)

Import `InputDescriptor` / `InputSchema` from
`@invinite-org/chartlang-core` (the package already imports `InputKind` from
core). Define the return types and the function:

```ts
export type GroupedInputEntry = Readonly<{
    name: string;
    descriptor: InputDescriptor<unknown>;
}>;

/** One inline row: entries sharing an `inline` id, in declaration order. */
export type GroupedInputRow = readonly GroupedInputEntry[];

export type GroupedInputSection = Readonly<{
    /** The `group` string, or null for inputs declared with no group. */
    title: string | null;
    rows: readonly GroupedInputRow[];
}>;

export function groupInputs(
    inputs: InputSchema,
): readonly GroupedInputSection[];
```

Algorithm (all ordering by **first appearance** in `Object.entries(inputs)`,
which is declaration order per Task 1):

1. Walk entries once. Bucket by `descriptor.group ?? null`, preserving group
   first-appearance order (a `Map<string | null, …>`).
2. Within a group, bucket by `descriptor.inline ?? <unique-per-entry>`:
   entries sharing a non-null `inline` id join one row (first-appearance
   order); an entry with no `inline` is its **own** single-entry row at its
   position. Do **not** merge same-`inline` entries that are separated by a
   different group (Pine scopes `inline` visually within the rendered order;
   keep it simple — `inline` rows are formed within a group bucket).
3. Return the sections in group order, each with its rows in order.

Edge cases: an empty `inputs` → `[]`; all-ungrouped → one section with
`title: null` and one row per input; `external-series` descriptors are
included like any other (they carry the metadata via Task 1).

### 2. Barrel export (`packages/adapter-kit/src/index.ts`)

Export `groupInputs` + the three types alongside the existing `InputKind`
re-export. Keep the README public-surface list in sync.

Add JSDoc with `@example`, `@since 1.8`, and `@stable` to every exported type
and function in `groupInputs.ts`; `pnpm docs:check` scans package source
exports, not the README.

### 3. Tests (`packages/adapter-kit/src/groupInputs.test.ts`)

- Ordered grouping: three inputs in groups `A`, `A`, `B` → two sections
  `[A, B]`; the two `A` inputs in declaration order.
- Inline rows: two inputs sharing `inline: "1"` within a group → one row of
  two entries; a third with no `inline` → its own row after.
- Declaration order preserved across the whole structure (assert exact
  `name` sequence flattened).
- Empty schema → `[]`; all-ungrouped → single `title: null` section.
- 100% line/branch/function coverage (it is the gate for the new file).

### 4. Docs + example

- Add `docs/adapters/rendering-inputs.md` (or extend the existing adapter
  guide) showing the `groupInputs` loop, how to read `descriptor.tooltip` for
  hover help, and how to interpret `descriptor.display` (`"none"` ⇒ hide from
  status line / data window, panel still shows it). Keep ≤ the docs section
  conventions; link from the adapter index.
- Add a short worked example: a minimal snippet (in the docs page, or as a
  commented block in `examples/canvas2d-adapter/`) that renders one group
  header + one inline row. A full canvas2d settings-panel UI is **not**
  required — the helper + a representative snippet is the deliverable.

### 5. Capability note (optional, no behavior change)

`Capabilities.inputs` (the supported `InputKind` set) is unchanged — the
metadata fields are kind-agnostic. Note in the docs that an adapter
advertising an `InputKind` should also honor that kind's metadata via
`groupInputs`. **No conformance scenario is required**: `groupInputs` is a
pure presentation helper with no capability key and no runtime emission, so
it does not exercise the adapter conformance harness — the adapter-kit
"conformance" test layer applies to capability/emission changes, which this
is not. Unit + type coverage is the complete layer set here.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/groupInputs.ts` | Create | The helper + return types |
| `packages/adapter-kit/src/index.ts` | Modify | Barrel export |
| `packages/adapter-kit/src/groupInputs.test.ts` | Create | Unit coverage |
| `packages/adapter-kit/README.md` | Modify | Public-surface list (≤ 100 lines) |
| `docs/adapters/rendering-inputs.md` | Create | Rendering guide + example |
| `examples/canvas2d-adapter/` (snippet/comment) | Modify (optional) | Worked example |
| `.changeset/adapter-kit-group-inputs.md` | Create | Changeset |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on adapter-kit; `groupInputs.ts` fully covered)
- `pnpm docs:check` (new exports need `@example`/`@since`/stability)
- `pnpm readme:check` (adapter-kit README ≤ 100 lines)

## Changeset

`.changeset/adapter-kit-group-inputs.md` — **minor** bump for
`@invinite-org/chartlang-adapter-kit`.

## Acceptance Criteria

- `groupInputs(manifest.inputs)` returns ordered sections → inline rows →
  entries, preserving declaration order; documented edge cases handled.
- Exported from the barrel with JSDoc (`@example`/`@since 1.8`/stability);
  README public surface updated and ≤ 100 lines. (`@since` tracks the
  workspace release train — currently `1.8`; adapter-kit already ships
  `@since 1.7`, so a new export must be `1.8`, not `1.7`.)
- Docs page shows the render loop + tooltip/display interpretation with a
  worked example.
- 100% coverage on the new file; `docs:check` + `readme:check` green;
  changeset committed.

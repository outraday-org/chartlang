# Task 13 — Transform: tables (`table.new` → `draw.table`)

> **Status: TODO**

## Goal

Translate Pine's mutable-builder table API (`table.new` + `table.cell`
+ `table.cell_set_*` + `table.merge_cells`) into chartlang's immutable
functional table (`draw.table({ position, cells: [[...], [...]] })`).
Pine builds a table by repeated mutation; chartlang rebuilds the whole
grid each bar. The transform collects every observed cell write into a
2D array literal in `compute({ ... })`, gated by `barstate.islast` per
the chartlang dashboard idiom, and emits `draw.table(...)` once with
the merged data.

## Prerequisites

Task 12 (Camp C handling — tables share the "collect writes, emit
once" pattern, and a few table edge cases overlap with the rejected
collection idioms).

## Current Behavior

`table.new` call-sites pass through the converter untouched (still
appear in the IR as raw Pine calls). `table.cell` writes are
unprocessed.

## Desired Behavior

A package-internal `transformTables(analysis: SemanticResult, scaffold:
ScriptScaffold, diagnostics: DiagnosticCollector): void` API in
`src/transform/tables.ts`:

1. Detects every `var table <id> = na` + `<id> := table.new(...)`
   declaration.
2. Collects every observed `table.cell(<id>, col, row, …)` write site,
   indexed by `(col, row)`.
3. Collects every `table.cell_set_*` mutation against the same `(col,
   row)` slot.
4. Detects `table.merge_cells(<id>, c0, r0, c1, r1)` and records the
   merge spans (chartlang has no merge; emit warning + fold the merged
   cells into the top-left cell only).
5. Synthesizes one `draw.table({ position, cells: [[…], […]] })` call
   per table, placed inside the same control-flow context as the
   original Pine `table.new` (typically inside `if barstate.islast`).
6. When cells are written inside loops, unrolls the loop (literal-
   bounded only — non-literal bounds emit error).

## Requirements

### 1. Detection

For each `var table` (or `varip table`) declared variable, walk the
script to find:

- The single `table.new(position, columns, rows, ...)` call assigning
  into it.
- Every `table.cell(<id>, col, row, text, ...)` call writing into it.
- Every `table.cell_set_*` call mutating into it.
- The optional `table.merge_cells(<id>, …)` call.
- The optional `table.clear(<id>, …)` and `table.delete(<id>)` calls.

If multiple `table.new` calls target the same variable across
different control-flow branches, emit `table-multi-init` warning and
use the first.

### 2. Cell collection

Build a `Map<string, CellSpec>` keyed by `${col}:${row}`:

```ts
type CellSpec = {
    text: string;             // chartlang TS expression
    bgColor?: string;
    textColor?: string;
    textHalign?: string;
    textValign?: string;
    textSize?: string;
    sourceSpan: SourceSpan;
};
```

When the same `(col, row)` is written multiple times across the
script, the **last** write wins (Pine semantics), with the order
determined by source position.

The cell collection is converted into a chartlang 2D array literal at
emit time. Cells absent from the map render as an empty string with no
styling.

### 3. Column/row count inference

The table's `(columns, rows)` count from `table.new(...)` defines the
grid dimensions. The `cells: [[...], [...]]` array in the chartlang
output is always exactly `rows × columns`. Any `table.cell(...)` write
to `(col, row)` where `col >= columns` or `row >= rows` is an error
`table-cell-out-of-bounds`.

### 4. Loop-driven cell writes

Common dashboard idiom:

```pinescript
var table dash = na
if barstate.islast
    if na(dash)
        dash := table.new(position.top_right, 2, 5)
    for i = 0 to 4
        table.cell(dash, 0, i, "Row " + str.tostring(i))
        table.cell(dash, 1, i, str.tostring(close[i]))
```

Transform unrolls the loop (must be literal-bounded):

```ts
const rows = [
    [{ text: "Row " + String(0) }, { text: String(bar.close) }],
    [{ text: "Row " + String(1) }, { text: String(bar.close[1]) }],
    [{ text: "Row " + String(2) }, { text: String(bar.close[2]) }],
    [{ text: "Row " + String(3) }, { text: String(bar.close[3]) }],
    [{ text: "Row " + String(4) }, { text: String(bar.close[4]) }],
];
if (barstate.islast) {
    __dash_handle.current()?.remove();
    __dash_handle.set(draw.table({
        position: "top-right",
        cells: rows,
    }));
}
```

A non-literal bound emits `table-dynamic-loop` error.

The `String(...)` conversion replaces Pine's `str.tostring(...)` per
Task 15's string mapping; here we just delegate to the passthrough
table.

### 5. `merge_cells` fallback

chartlang's `draw.table` has no merge. The transform:

- Detects `table.merge_cells(dash, c0, r0, c1, r1)`.
- Picks the top-left cell (`c0, r0`) and replaces the cells in the
  merge span with empty cells in the chartlang output.
- Emits `table-merge-fallback` warning per merge call.

### 6. `table.clear` and `table.delete`

- `table.clear(dash, c0, r0, c1, r1)` — converted to setting the cells
  in that range to empty in subsequent rebuilds. For v1, since the
  table is rebuilt each bar from the collected cell map, `clear` calls
  inside the rebuild block effectively no-op; emit `table-clear-noop`
  info.
- `table.delete(dash)` — emits `__dash_handle.current()?.remove();
  __dash_handle.set(null);` at the call-site.

### 7. Handle storage

Tables use the same `useDrawingHandleSlot<"table">()` helper from
Task 10. The handle is stored, but unlike Camp A drawings, the table
is **fully rebuilt** every barstate.islast tick rather than partially
updated. This matches the chartlang dashboard idiom recommended in
the API research.

Why rebuild instead of `handle.update({ cells: ... })`? Because the
cell vocabulary is a deeply-nested immutable structure, and a single
cell change in chartlang requires re-emitting the whole grid; the
codepath is identical to fresh creation, so the converter just always
creates fresh.

### 8. Cap interaction

chartlang's per-bucket cap groups `table` into the `"other"` bucket.
A script with one table needs `maxDrawings.other` ≥ 1 (default is
typically set). When multiple tables coexist, the converter raises the
declaration scaffold's `maxDrawings.other` to match the count + 1
(headroom) and emits info `table-bucket-cap-adjusted`.

### 9. Diagnostic codes (added this task)

- `table-multi-init` (warning)
- `table-cell-out-of-bounds` (error)
- `table-dynamic-loop` (error)
- `table-merge-fallback` (warning)
- `table-clear-noop` (info)
- `table-bucket-cap-adjusted` (info)
- `table-formatting-not-mapped` (warning) — Pine's `text_formatting`,
  `text_font_family`, `text_wrap` have no chartlang analogue.

### 10. Tests (§16.3)

| File | Purpose |
|------|---------|
| `tables.test.ts` | Canonical dashboard fixture: 2-col × 5-row + loop unroll. Asserts cells array + position + `barstate.islast` gating. |
| `tables.property.test.ts` | Property: the emitted cells array's dimensions match the declared `(rows, columns)`. Property: last-write-wins ordering is preserved. |
| `table-merge.test.ts` | `merge_cells(0,0,1,0)` → top-left preserved, others empty + warning. |
| `table-out-of-bounds.test.ts` | Write at `(col=2, row=0)` with `columns=2` emits error. |
| `table-dynamic-loop.test.ts` | Non-literal loop bound emits error. |
| `table-delete.test.ts` | `table.delete` emits remove + slot reset. |

Coverage 100% on `src/transform/tables.ts`.

### 11. JSDoc

Every exported function/type carries `@since 0.1`, `@experimental`,
and an `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/tables.ts` | Create | Table transform. |
| `packages/pine-converter/src/transform/index.ts` | Modify | Re-export. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Add Task-13 codes. |
| `packages/pine-converter/src/transform/tables.test.ts` | Create | Canonical dashboard tests. |
| `packages/pine-converter/src/transform/tables.property.test.ts` | Create | Dimensions + ordering properties. |
| `packages/pine-converter/src/transform/table-merge.test.ts` | Create | Merge fallback tests. |
| `packages/pine-converter/src/transform/table-out-of-bounds.test.ts` | Create | Out-of-bounds tests. |
| `packages/pine-converter/src/transform/table-dynamic-loop.test.ts` | Create | Dynamic loop tests. |
| `packages/pine-converter/src/transform/table-delete.test.ts` | Create | Delete tests. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-transform-tables.md` — patch bump.

## Acceptance Criteria

- A 2-column × 5-row dashboard fixture produces a `draw.table({
  position: "top-right", cells: [[…], …] })` with a 5-element outer
  array, each containing 2 cells.
- `merge_cells(0,0,1,0)` produces a 2-cell row where the second cell
  is empty + `table-merge-fallback` warning.
- Out-of-bounds write produces `table-cell-out-of-bounds` error.
- `table.delete(dash)` emits the slot-clear pattern.
- 100% coverage on the listed files.
- JSDoc + lint + typecheck gates green.
- Changeset committed.

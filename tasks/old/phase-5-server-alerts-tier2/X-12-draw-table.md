# Task 12 — `draw.table` + `TableCell` + `DrawingKind = "table"` + viewport renderer

> **Status: TODO**

## Goal

Land Pine's `table()` analogue — a CSS-pixel-viewport-anchored
dashboard primitive distinct from the world-space drawings. New
`DrawingKind = "table"` joins the union (62 total). `TableCell`
schema ships from core. Runtime emit + canvas2d renderer treat
tables as viewport-anchored (NOT world-space). One conformance
scenario covers happy path; one covers capability gating.

## Prerequisites

- Task 11: `runtime.log.*` landed.

## Current Behavior

- `packages/core/src/draw/drawingKind.ts` `DrawingKind` is a 61-entry
  union; no `"table"`.
- `packages/core/src/draw/draw.ts` namespace covers lines / boxes /
  curves / annotations / fib / gann / pitch / elliott / pattern /
  cycles / containers — no `table`.
- `packages/core/src/draw/buckets.ts` `KIND_BUCKET` doesn't map
  `"table"`.
- No `TableCell` type exported.
- canvas2d-adapter renders only world-space drawings.

## Desired Behavior

- `DrawingKind` widens to 62 entries.
- `draw.table(opts)` ships in core with the §10.2 signature.
- `TableCell` exported from core.
- `KIND_BUCKET` maps `"table"` → `"other"`.
- `KIND_CAMELCASE` / `KIND_KEBABCASE` extend with the new kind.
- Runtime emit produces a `DrawingEmission` with
  `kind: "table"` carrying the position + cells + optional borders.
- canvas2d-adapter renders viewport-anchored tables — `position`
  selects the anchor corner / edge / center; cells render at
  CSS-pixel offsets independent of the chart's world coordinates.
- `Capabilities.drawings: !includes("table")` → silent no-op +
  `unsupported-drawing-kind` diagnostic.
- Two conformance scenarios.

## Requirements

### 1. `packages/core/src/draw/drawingKind.ts` — widen

- `DrawingKind` union: append `| "table"`.
- `DRAWING_KINDS` array: append `"table"`.
- `KIND_CAMELCASE` map: `"table" → "table"`.
- `KIND_KEBABCASE` map: `"table" → "table"`.
- JSDoc preamble updates the count (62) and references PLAN §10.2.

### 2. `packages/core/src/draw/buckets.ts` — extend

- `KIND_BUCKET.set("table", "other")`.

### 3. `packages/core/src/draw/table.ts` (new)

```ts
import type { Color } from "../types";
import type { DrawingHandle } from "./handle";

export type TablePosition =
    | "top-left" | "top-center" | "top-right"
    | "middle-left" | "middle-center" | "middle-right"
    | "bottom-left" | "bottom-center" | "bottom-right";

export type TableCell = Readonly<{
    text: string;
    bgColor?: Color;
    textColor?: Color;
    textHalign?: "left" | "center" | "right";
    textValign?: "top" | "middle" | "bottom";
    textSize?: "tiny" | "small" | "normal" | "large" | "huge";
}>;

export type TableOpts = Readonly<{
    position: TablePosition;
    cells: ReadonlyArray<ReadonlyArray<TableCell>>;
    borderColor?: Color;
    borderWidth?: number;
    frame?: Readonly<{ color: Color; width: number }>;
}>;

/**
 * Compile-time callable hole. The compiler rewrites every callsite
 * to dispatch to the runtime's `drawTable` impl with the slot id
 * injected.
 *
 * @since 0.5
 * @example
 *     // Inside compute:
 *     // const h = draw.table({
 *     //     position: "top-right",
 *     //     cells: [[{ text: "P&L" }, { text: "+12.5%", textColor: "#00ff00" }]],
 *     // });
 */
export function table(_opts: TableOpts): DrawingHandle {
    throw new Error("draw.table called outside compiled runtime");
}
```

### 4. `packages/core/src/draw/draw.ts` — add `table` to namespace

The `DrawNamespace` type widens to include `table: typeof table`. The
namespace stub adds a `table` method via the existing
`throwingMethod` pattern.

### 5. `packages/core/src/draw/index.ts` — re-export

`export { table, type TableCell, type TableOpts, type TablePosition } from "./table";`

### 6. `packages/core/src/index.ts` — re-export

Re-export `TableCell`, `TableOpts`, `TablePosition` types under the
`draw` cluster.

### 7. `packages/core/src/statefulPrimitives.ts` — register

Append `{ name: "draw.table", slot: true }`. Bump cardinality
test to **167**.

### 8. `packages/adapter-kit/src/types.ts` — extend `DrawingState`

Add a new `DrawingState` discriminant:

```ts
| Readonly<{
      kind: "table";
      position: TablePosition;
      cells: ReadonlyArray<ReadonlyArray<TableCell>>;
      borderColor?: Color;
      borderWidth?: number;
      frame?: Readonly<{ color: Color; width: number }>;
  }>
```

Reuse the core `TableCell` / `TablePosition` type imports.

### 9. `packages/adapter-kit/src/validation/validateEmission.ts`

`validateTableDrawing`:
- `position ∈ TablePosition`.
- `cells` is a non-empty 2D array.
- Each cell's `text` is a string; styling fields if present pass
  their respective unions.
- `borderColor` / `borderWidth` consistent (both present or neither).
- `frame` (if present) has both `color` and `width`.

### 10. `packages/runtime/src/emit/drawingEmission.ts` — extend dispatch

Add a `case "table"` producing the corresponding `DrawingEmission`
with the viewport-anchored fields. No world-space anchor needed —
the runtime passes the position enum + cells verbatim. Reuse the
existing slot-id + handle pattern.

### 11. `examples/canvas2d-adapter/src/render/draw/table.ts` — viewport renderer

The reference adapter renders drawings through per-kind files under
`examples/canvas2d-adapter/src/render/draw/`. Add a new `table.ts`
alongside the existing per-kind drawing renderers (with a matching
`render/draw/table.test.ts`). Key points:

- `position` maps to anchor coordinates relative to the chart's
  CSS-pixel viewport (NOT world-space):
  - `top-left` → `(padding, padding)`
  - `top-center` → `(viewportWidth/2 - tableWidth/2, padding)`
  - etc.
- Per-cell rendering: CSS-pixel column widths derived from longest
  text in the column at `textSize`. Row heights derived from
  `textSize` ascent + descent.
- `textSize` mapping: `tiny=8px / small=10px / normal=12px / large=16px / huge=24px`.
- Borders / frame drawn after cells via `ctx.strokeRect`.
- Use `ctx.save()` / `ctx.restore()` around the table draw so the
  transform doesn't bleed.

### 12. `examples/canvas2d-adapter/src/capabilities.ts` — widen

Append `"table"` to `CANVAS2D_CAPABILITIES.drawings` and to
`maxDrawingsPerScript.other` cap (per Phase-3 bucket strategy).

### 13. Conformance scenarios

Existing scenarios sit flat under `packages/conformance/src/scenarios/`
with the `<name>.scenario.ts` suffix; follow the same convention.

- `drawTableHappy.scenario.ts` — script declares a 3-row × 2-col
  table with mixed styling. Assertions:
  - `drawing-hash` matches captured golden.
  - No diagnostic.
- `drawTableGated.scenario.ts` — same script with
  `Capabilities.drawings` not including `"table"`. Assertions:
  - `drawing-hash` is empty.
  - `diagnostic-code-present`: `unsupported-drawing-kind` (existing
    diagnostic code; no new code).

### 14. Tests

- `packages/core/src/draw/table.test.ts` — compile-time hole throws.
- `packages/core/src/draw/drawingKind.test.ts` — extend assertion
  to `DRAWING_KINDS.length === 62`.
- `packages/core/src/draw/buckets.test.ts` — `"table"` → `"other"`.
- `packages/adapter-kit/src/validation/validateEmission.test.ts`
  — table-specific failure modes.
- `packages/runtime/src/emit/drawingEmission.test.ts` — table emit
  path.
- `examples/canvas2d-adapter/src/render/draw/table.test.ts` — render
  ops for each `position` enum value.

### 15. JSDoc + ambient shim

- `draw.table` + types — `@since 0.5`, `@example`, `@experimental`.
- `CORE_AMBIENT_SHIM` mirrors the new types + namespace addition.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/draw/drawingKind.ts` | Modify | Widen union + arrays + maps |
| `packages/core/src/draw/buckets.ts` | Modify | Map `"table"` → `"other"` |
| `packages/core/src/draw/table.ts` | Create | Compile-time hole + types |
| `packages/core/src/draw/table.test.ts` | Create | Hole-throws test |
| `packages/core/src/draw/draw.ts` | Modify | Add `table` to namespace |
| `packages/core/src/draw/index.ts` | Modify | Re-export |
| `packages/core/src/index.ts` | Modify | Re-export types |
| `packages/core/src/statefulPrimitives.ts` | Modify | Append entry; bump to 167 |
| `packages/adapter-kit/src/types.ts` | Modify | `DrawingState` table variant |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify | `validateTableDrawing` |
| `packages/runtime/src/emit/drawingEmission.ts` | Modify | Table dispatch |
| `examples/canvas2d-adapter/src/render/draw/table.ts` | Create | Viewport-anchored renderer |
| `examples/canvas2d-adapter/src/render/draw/table.test.ts` | Create | Renderer ops per `position` |
| `examples/canvas2d-adapter/src/capabilities.ts` | Modify | Include `"table"` |
| `packages/conformance/src/scenarios/drawTableHappy.scenario.ts` | Create | Happy |
| `packages/conformance/src/scenarios/drawTableGated.scenario.ts` | Create | Capability gated |
| `packages/conformance/src/scenarios/index.ts` | Modify | Register |
| `packages/compiler/src/program.ts` | Modify | Mirror types in ambient shim |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100%)
- `pnpm docs:check`
- `pnpm conformance`
- `pnpm readme:check`

## Changeset

`.changeset/phase5-draw-table.md` — `minor` bump for core,
adapter-kit, runtime, canvas2d-adapter, conformance. Body cites
PLAN §10.2.


- [x] `DrawingKind` count is 62; `DRAWING_KINDS.length === 62`.
- [x] `STATEFUL_PRIMITIVES.size === 167`.
- [x] `draw.table(opts)` compiles + runs; handle.update works.
- [x] Viewport-anchored rendering verified per `position` value.
- [x] Capability gating fires `unsupported-drawing-kind`.
- [x] Both conformance scenarios green.
- [x] 100% coverage; gates green.
- [x] Changeset committed.

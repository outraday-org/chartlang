# Task 20 — `defineDrawing` constructor + interactive-tool conformance scenarios

> **Status: TODO**

## Goal

Land the `defineDrawing` constructor (PLAN.md §4.1) — the third
script kind alongside `defineIndicator` / `defineAlert`. It
emits `ScriptManifest.kind: "drawing"` (already declared in
Phase 1's manifest shape) and runs as a one-shot script that
takes user-pickable anchors via `input.time({ pickFromChart:
true })` (Phase 4 input UI lands later — Phase 3 ships the
constructor + a fixed-anchor fallback so the runtime path can
be exercised). Plus 3 conformance scenarios covering the
interactive update flow (`DrawingHandle.update` across multiple
bars).

## Prerequisites

- Tasks 1–19 (all 61 kinds emittable + renderable).
- Task 1's `ScriptManifest.maxDrawings?: DrawingCounts` + the
  `DefineIndicatorOpts.maxDrawings?` propagation pattern —
  `defineDrawing` mirrors that opt and writes it to the
  manifest the runtime reads in Task 3.

## Requirements

### 1. `packages/core/src/define/defineDrawing.ts`

```ts
import type { ComputeFn, InputSchema, ScriptManifest } from "../types";

/**
 * Construct an interactive-drawing script. Emits exactly one
 * drawing tied to user-pickable anchors (in Phase 4 + via
 * `input.time({ pickFromChart: true })`; in Phase 3 the
 * anchors come from script-provided literals or `inputs.time`
 * with fixed defaults).
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { defineDrawing, draw, input } from "@invinite-org/chartlang-core";
 *     export default defineDrawing({
 *         name: "Interactive Fib Retracement",
 *         apiVersion: 1,
 *         inputs: {
 *             swingLowTime: input.time(1_700_000_000_000),
 *             swingLowPrice: input.float(100),
 *             swingHighTime: input.time(1_700_086_400_000),
 *             swingHighPrice: input.float(110),
 *         },
 *         compute({ inputs, draw }) {
 *             draw.fib.retracement(
 *                 { time: inputs.swingLowTime, price: inputs.swingLowPrice },
 *                 { time: inputs.swingHighTime, price: inputs.swingHighPrice },
 *             );
 *         },
 *     });
 */
export function defineDrawing<TInputs extends InputSchema>(opts: {
    readonly name: string;
    readonly apiVersion: 1;
    readonly inputs?: TInputs;
    readonly compute: ComputeFn;
    readonly maxDrawings?: DrawingCounts;
}): CompiledScriptObject {
    // … manifest construction; mirrors defineIndicator
    return {
        manifest: { /* … */ kind: "drawing", /* … */ },
        compute: opts.compute,
    };
}
```

Mirrors `defineIndicator` structurally; only the
`manifest.kind` differs (`"drawing"` vs `"indicator"`). The
runtime treats both identically at the per-bar level — the
difference is purely a host-side hint for the editor (Phase 4)
to distinguish drawing scripts from indicator scripts in the
UI.

### 2. Compiler / runtime compatibility

`defineDrawing` is recognised by the compiler's manifest
extractor (the same TS-AST pass that handles
`defineIndicator` / `defineAlert`). Verify the existing
pass in `packages/compiler/src/manifest.ts` accepts the new
constructor name — extend if needed (1-3 line change).

`createScriptRunner` already handles `manifest.kind:
"drawing"` (Phase 1's shape allowed it). Verify.

### 3. Core barrel + STATEFUL_PRIMITIVES

`packages/core/src/index.ts` re-exports `defineDrawing`.

`STATEFUL_PRIMITIVES` is unchanged — `defineDrawing` is a
constructor, not a callable primitive (it doesn't appear inside
`compute`).

### 4. Conformance scenarios

3 new scenarios:

- `drawInteractiveUpdate.scenario.ts` — script emits a
  `draw.horizontalLine(...)` on bar 0, then `handle.update({
  price: bar.close })` every subsequent bar. Asserts:
  - `drawing-hash` pinned to a hash that captures ~10 000
    `op: "update"` emissions (one per bar) following the
    initial `op: "create"`.
  - Handle id stable across bars.
- `defineDrawingBasic.scenario.ts` — uses `defineDrawing` (not
  `defineIndicator`) to emit one fib retracement. Asserts:
  - `drawing-hash` pinned.
  - The compiled manifest carries `kind: "drawing"` (via a new
    `manifest-kind` assertion if needed — or extend the
    scenario runner to expose manifest for assertion).
- `drawHandleRemove.scenario.ts` — script emits a drawing on
  bar 0, calls `.remove()` on bar 100. Asserts:
  - Exactly one `op: "remove"` emission with the last-known
    state.
  - Bucket counter decrements (no `drawing-budget-exceeded` for
    a subsequent create in the same bucket).

### 5. Updates

`scenarios/index.ts` re-exports the 3 new scenarios.

### 6. Tests

- `defineDrawing.test.ts` — manifest shape pinning;
  `compute` callable; `maxDrawings` propagation.
- `defineDrawing.types.test.ts` — return type
  `CompiledScriptObject`; inputs schema inference.
- Manifest extractor test (in compiler package) — `defineDrawing`
  recognised + `kind: "drawing"` emitted.

### 7. JSDoc + README

- `defineDrawing` JSDoc per §17.2: `@since 0.3`,
  `@experimental`, `@example`.
- `packages/core/README.md` adds a "Drawing scripts (Phase 3)"
  one-liner.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/core/src/define/defineDrawing.ts` | Create |
| `packages/core/src/define/defineDrawing.test.ts` | Create |
| `packages/core/src/define/defineDrawing.types.test.ts` | Create |
| `packages/core/src/define/index.ts` | Modify |
| `packages/core/src/index.ts` | Modify |
| `packages/compiler/src/manifest.ts` | Modify (if needed) |
| `packages/compiler/src/manifest.test.ts` | Modify |
| `packages/conformance/src/scenarios/drawInteractiveUpdate.scenario.ts` | Create |
| `packages/conformance/src/scenarios/defineDrawingBasic.scenario.ts` | Create |
| `packages/conformance/src/scenarios/drawHandleRemove.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `packages/core/README.md` | Modify |
| `.changeset/phase-3-task-20-define-drawing.md` | Create |

## Gates

Standard set.

## Changeset

Minor on `@invinite-org/chartlang-core`, possibly on
`@invinite-org/chartlang-compiler` (if manifest extractor
changes), `@invinite-org/chartlang-conformance`.

## Acceptance Criteria

- `defineDrawing(...)` returns a `CompiledScriptObject` with
  `manifest.kind === "drawing"`.
- 3 new scenarios pass.
- Compiler manifest extractor recognises `defineDrawing` calls.
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–19 gates green.
- Changeset committed.

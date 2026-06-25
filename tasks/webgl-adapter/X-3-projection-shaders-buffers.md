# Projection (ortho2d) + viewport + shader modules + buffer pool

> **Status: TODO**

## Goal

Port the pure math and GPU-memory layers: `projection.ts` (`ortho2d`
world→clip matrix), `viewport.ts` (`paneViewport` CSS→device-px rect),
the shader modules (`assemble`, `project32`, `nan-skip`, `aa`), and
`buffer-pool.ts` (pooled/content-addressed GPU buffers with dirty-range
upload). The math is fully unit-tested headlessly.

## Prerequisites

Task 2 (gl-context, program, vao).

## Desired Behavior

`src/webgl/` gains a tested `ortho2d`, a tested `paneViewport`, the four
GLSL shader-module strings, and a buffer pool the programs upload through.

## Requirements

1. **`src/webgl/projection.ts`** — port `ortho2d(left, right, bottom, top)`
   → column-major `Float32Array(9)` mat3 (`sx,0,0, 0,sy,0, tx,ty,1`). The
   adapter feeds this the world window resolved from the shared
   `ViewController` (Task 4), NOT invinite's frame-state. **Pure →
   unit-test** every branch (incl. degenerate equal-bounds, which must
   not divide-by-zero — clamp like the canvas2d viewport does).

2. **`src/webgl/viewport.ts`** — port `paneViewport(paneCssRect,
   canvasCssHeight, dpr)` → bottom-left-origin device-px rect for
   `gl.viewport()`/`gl.scissor()`. **Single rounding site** (per-edge
   `round(edge*dpr)` so adjacent panes tile tight). Pure → unit-test the
   rounding + origin flip.

3. **`src/webgl/shader-modules/{assemble,project32,nan-skip,aa}.ts`** —
   port the GLSL-string modules:
   - `assemble.ts` — `assembleVertexShader({modules, body})` /
     `assembleFragmentShader(...)` concatenating `#version 300 es` +
     precision + modules + body. Pure → unit-test the concatenation.
   - `project32.ts` — `worldToSnappedNdc` (device-px snap) +
     `dojiInflateNdcY` GLSL helpers (strings; assert they export the
     expected symbol names).
   - `nan-skip.ts` — `nan_skip_segmentInvalid` / `nan_skip_neighborInvalid`
     GLSL predicates.
   - `aa.ts` — `disk_aa_alpha` (fwidth/smoothstep edge feather).
   Each carries the provenance header noting the luma.gl/deck.gl pattern
   inspiration (re-implemented in-tree, NOT an npm dep).

4. **`src/webgl/buffer-pool.ts`** — port the pooled buffer model:
   content-addressed slot `id`, growable `cpu` Float32Array (identity
   preserved when capacity suffices), full vs partial (`bufferSubData`
   dirty-range) upload, same-frame upload-once gating, scratch slots, and
   the consumer registry (free on last release). Port correctness first;
   the per-frame fast-path may be simplified if needed (note any
   simplification in CLAUDE.md). The pure book-keeping (capacity growth,
   dirty-range arithmetic, consumer ref-counting) is unit-tested with a
   stub `gl` that records `bufferData`/`bufferSubData` calls.

5. **Provenance headers** on all files.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/webgl/projection.ts` | Create | `ortho2d` mat3 |
| `examples/webgl-adapter/src/webgl/viewport.ts` | Create | `paneViewport` device-px rect |
| `examples/webgl-adapter/src/webgl/shader-modules/{assemble,project32,nan-skip,aa}.ts` | Create | GLSL modules |
| `examples/webgl-adapter/src/webgl/buffer-pool.ts` | Create | Pooled GPU buffers |
| `examples/webgl-adapter/src/webgl/*.test.ts` | Create | Pure-math + upload book-keeping tests |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test`
- `pnpm conformance` (unchanged)

## Changeset

None.

## Acceptance Criteria

- `ortho2d` + `paneViewport` are pure and 100% covered by their own unit
  tests (degenerate bounds handled, no NaN/Infinity).
- The four shader modules export the expected GLSL symbols; `assemble`
  concatenation tested.
- Buffer pool's capacity-growth / dirty-range / consumer-registry logic
  is tested against a recording stub `gl`; full + partial upload paths
  exercised.
- Provenance headers present; build/typecheck/lint green.

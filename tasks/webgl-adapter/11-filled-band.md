# Filled-band program (fill-between / Bollinger ribbons)

> **Status: TODO**

## Goal

Port invinite's `filled-band-program.ts` so the `fill-between` drawing
kind and band-style overlays (Bollinger, clouds) render as a GPU-filled
region between two polylines, with optional edge strokes.

## Prerequisites

Task 7 (line-strip, for the edge strokes), Task 10 (subpane layout +
bar programs pattern).

## Desired Behavior

A `draw.fillBetween(edgeA, edgeB, …)` emission (and any band overlay)
renders as a translucent filled polygon between the two edges, with the
edges optionally stroked via the line-strip program — matching canvas2d's
`decomposeFillBetween` behavior (closed filled polygon, edge fill +
optional outline, degenerate-edge no-op).

## Requirements

1. **`src/webgl/programs/filled-band-program.ts`** — port: build a
   triangle strip spanning the two edge polylines (per-x: top edge +
   bottom edge → 2 triangles), uniforms `uProj`, `uColor`(vec4 with
   alpha), blend; handle NaN gaps (skip degenerate spans, reuse the
   `nan-skip` predicate). Provenance.

2. **Pure packer** — edges (two world-point arrays) → triangle-strip
   vertex buffer. Unit-test: aligned edges, mismatched lengths (clamp to
   the shorter), NaN gaps (no spanning triangle across a gap), empty →
   no-op. Reuse `medianBarSpacing`/`projectShiftedX` if the band carries
   an `xShift`.

3. **Wire to `decomposeDrawing`** — the `fill-between` drawing kind
   already decomposes (adapter-kit `decomposeFillBetween`) to a polygon
   primitive; in Task 13 drawings route through `decomposeDrawing`. Here,
   provide the GPU fill program + a descriptor path so that when Task 13
   emits a `filled-band`/polygon-fill descriptor it renders. If a band is
   also emitted directly as a plot-style (e.g. an `area` fill body or a
   Bollinger overlay), route it to this program from `buildFrame`.

4. **Area fill** — render the `area` plot kind's fill body via this
   program (between the series line and a baseline), complementing Task
   7's area edge line. Update `buildFrame` to emit the fill descriptor.

5. **Renderer dispatch** — add the `filled-band` arm to `dispatchLayer`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/webgl/programs/filled-band-program.ts` | Create | GPU fill between two edges |
| `examples/webgl-adapter/src/webgl/programs/filled-band-pack.ts` | Create | Pure triangle-strip packer |
| `examples/webgl-adapter/src/buildFrame.ts` | Modify | Emit area/band fill descriptors |
| `examples/webgl-adapter/src/webgl/Renderer.ts` | Modify | Dispatch `filled-band` |
| `examples/webgl-adapter/src/webgl/programs/filled-band-pack.test.ts` | Create | Packer unit tests |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test`
- `pnpm conformance` (unchanged)

## Changeset

None.

## Acceptance Criteria

- Filled-band program ported with provenance; alpha-blended fill between
  two edges, NaN-gap safe.
- Pure packer unit-tested (aligned, mismatched, gaps, empty).
- `area` plot fill + band overlays route through it; build/lint green.

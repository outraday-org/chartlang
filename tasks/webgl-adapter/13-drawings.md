# Drawings via decomposeDrawing → GL primitives

> **Status: TODO**

## Goal

Render all 63 drawing kinds by reusing the shared
`decomposeDrawing(emission, viewport)` → `DrawPrimitive[]`
(polyline / arc / text / marker) and painting those primitives with the
GL programs (line-strip for polylines, a new arc program for arcs,
filled-band for fills) + the 2D overlay (text), exactly mirroring how
canvas2d paints `decomposeDrawing` output.

## Prerequisites

Task 7 (line-strip), Task 11 (filled-band), Task 12 (markers + overlay
text).

## Desired Behavior

`draw.*` emissions (lines, rays, channels, fibs, patterns, tables, etc.)
render correctly through the shared decomposer — no per-kind geometry is
re-derived in the adapter (the adapter-kit contract).

## Requirements

1. **Drawing → primitives** — in `buildFrame` (or a dedicated drawing
   pass), for each live drawing call `decomposeDrawing(emission, viewport)`
   (reuse — DO NOT fork; the canvas2d/all-adapter contract) and map each
   `DrawPrimitive` to a GL descriptor:
   - `polyline` (with `StrokeStyle`/`FillStyle`) → `line-strip`
     descriptor (stroke) + optional `filled-band`/polygon-fill descriptor
     (fill). Honor dash + alpha (`StrokeStyle.alpha`).
   - `arc` → a new **arc program** (Task: port from a simple circle/arc
     shader, or tessellate the arc into a polyline and reuse line-strip).
     Prefer tessellation-to-polyline to avoid a new program unless an arc
     program is cheap.
   - `text` → overlay text (Task 8/12 overlay), positioned at the
     primitive's pixel anchor.
   - `marker` → markers program (Task 12).
   The `viewport` passed to `decomposeDrawing` is the pixel-space
   `Viewport` (reuse `timeToX`/`priceToY` from adapter-kit for the
   overlay-aligned pixel projection so drawing pixel coords match the GL
   geometry — keep ONE projection source of truth per frame).

2. **`src/webgl/programs/drawings-program.ts`** (optional) — port
   invinite's drawings program ONLY if it does something line-strip can't;
   otherwise route polyline primitives through the existing line-strip
   program (preferred — less surface). Document the choice in CLAUDE.md.

3. **Arc handling** — if tessellating, add a pure `arcToPolyline(center,
   radius, start, end, segments)` helper, unit-tested (full circle,
   partial arc, zero radius → empty, matching `decomposeDrawing`'s arc
   semantics).

4. **z-order** — drawings participate in the per-pane z/seq order (Task
   14 finalizes the global sort); here, render drawings in the overlay
   pane with their `z`/`seq` from ingest.

5. **Tests** — unit-test the primitive→descriptor mapping (a polyline
   primitive yields a line-strip descriptor with the right
   color/width/dash/alpha; a fill yields a filled-band descriptor; a text
   primitive yields an overlay text entry; arc tessellation). Drive a few
   representative drawing emissions through `decomposeDrawing` + the
   mapper and assert the descriptor set (pure, headless).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/drawings.ts` | Create | `decomposeDrawing` → GL descriptors + overlay text (pure) |
| `examples/webgl-adapter/src/webgl/programs/drawings-program.ts` | Create (optional) | Arc/poly program if needed |
| `examples/webgl-adapter/src/buildFrame.ts` | Modify | Drawing pass |
| `examples/webgl-adapter/src/overlay.ts` | Modify | Drawing text |
| `examples/webgl-adapter/src/drawings.test.ts` | Create | Primitive→descriptor mapping tests |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test`
- `pnpm conformance` (all scenarios still pass; drawings are
  emission-validated upstream — confirm no drawing scenario regresses)

## Changeset

None.

## Acceptance Criteria

- All drawing kinds route through the shared `decomposeDrawing` (no
  forked per-kind geometry); polyline→line-strip, fill→filled-band,
  arc→tessellated polyline (or arc program), text→overlay, marker→markers.
- `StrokeStyle.alpha` + dash honored; arc tessellation unit-tested.
- Primitive→descriptor mapping unit-tested; build/lint/conformance green.

# Cursors + glyph plots + markers + alert badges

> **Status: TODO**

## Goal

Port invinite's `cursors-program.ts`, `indicator-markers-program.ts`, and
`markers-program.ts`, and render the glyph plot styles (`shape`,
`character`, `arrow`) + alert badges — geometry on the GPU (disk AA via
the `aa` shader), text via the 2D overlay (Task 8).

## Prerequisites

Task 8 (overlay text + crosshair infra).

## Desired Behavior

A crosshair cursor tracks the pointer (disk/line AA); glyph plot series
(`shape`/`character`/`arrow`) and alert badges render at their bars;
their text labels paint via the 2D overlay.

## Requirements

1. **`src/webgl/programs/cursors-program.ts`** — port: instanced quads
   with `disk_aa_alpha` (from `aa.ts`) for smooth crosshair dots/halos;
   crosshair lines via the line-strip program (or a thin dedicated quad).
   Provenance. Wire to pointer-move (from Task 8's interaction) →
   `requestRender`.

2. **`src/webgl/programs/markers-program.ts` +
   `indicator-markers-program.ts`** — port the instanced marker quads
   (entry/exit/shape glyphs). Map the chartlang glyph plot styles:
   - `shape` (triangle-up/down, circle, square, …) → marker quad +
     shape selector uniform/attribute.
   - `arrow` (up/down) → marker quad.
   - `character` → a glyph rendered as TEXT via the overlay (Task 8),
     positioned at the projected bar point.
   Honor `location` (above/below/absolute) + `size` from the style, and
   `xShift` via the shared helper.

3. **Alert badges** — render alert markers at their anchor bar (badge
   quad via the markers program; text via overlay), mirroring canvas2d's
   `drawAlertBadge`. Respect `alertBadgeFilter` (Task 1 opt).

4. **Pure packers** — marker/cursor instance packing (bar→x/y, shape id,
   color, size) is pure → unit-tested. Text positioning math (project
   bar point → overlay pixel) pure → tested. The `gl.*`/overlay draw is
   browser-only.

5. **Renderer dispatch + overlay hook** — add `cursor`/`marker` arms to
   `dispatchLayer`; the overlay text pass (Task 8) gains marker/badge/
   character text.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/webgl/programs/cursors-program.ts` | Create | Crosshair cursor (disk AA) |
| `examples/webgl-adapter/src/webgl/programs/markers-program.ts` | Create | Glyph/marker quads |
| `examples/webgl-adapter/src/webgl/programs/indicator-markers-program.ts` | Create | Indicator markers |
| `examples/webgl-adapter/src/glyphs.ts` | Create | Pure glyph/marker/badge packers + text positioning |
| `examples/webgl-adapter/src/webgl/Renderer.ts` | Modify | Dispatch cursor/marker |
| `examples/webgl-adapter/src/overlay.ts` | Modify | Marker/badge/character text |
| `examples/webgl-adapter/src/*.test.ts` | Create | Packer + positioning tests |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test`
- `pnpm conformance` (unchanged)

## Changeset

None.

## Acceptance Criteria

- Cursors/markers/indicator-markers ported with provenance; disk AA via
  `aa.ts`.
- `shape`/`arrow`/`character` glyph styles + alert badges render
  (geometry on GPU, text on overlay); `location`/`size`/`xShift` honored.
- Pure packers + text-positioning unit-tested; build/lint green.

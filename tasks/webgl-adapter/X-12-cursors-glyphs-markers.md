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

2. **Glyph plot styles — render via the shared
   `adapter-kit/canvas/glyphs.ts` on the 2D overlay (parity).**
   `tasks/adapter-feature-parity` Task 9 promoted the glyph geometry
   (`drawShape`/`drawCharacter`/`drawArrow`/`drawMarker`/`drawLabel`)
   into `adapter-kit/canvas/glyphs.ts`, consumed by uplot + lwc. webgl's
   overlay is a 2D canvas with the same `RenderCtx`, so **reuse that
   shared helper** for all glyph plot styles — do NOT re-derive
   per-shape geometry. This guarantees byte-identical glyphs across the
   six adapters. Map every reachable style (parity requires the `marker`
   style canvas2d previously dropped is now dispatched):
   - `shape` (circle/square/diamond/triangle-up/triangle-down/cross/
     xcross/flag), `arrow` (up/down), `marker`, `label` → shared glyph
     helper on the overlay.
   - `character` → shared `drawCharacter` (text) on the overlay,
     positioned at the projected bar point.
   Honor `location` (above/below/absolute) + `size` from the style, and
   `xShift` via the shared helper.

   The ported invinite **`markers-program.ts` /
   `indicator-markers-program.ts`** (instanced GPU marker quads) are an
   **optional perf path** for high-volume markers; the correctness
   baseline is the shared overlay helper. If you keep the GPU programs,
   they must produce the same shapes — prefer the overlay helper unless
   profiling needs the GPU path (document the choice in CLAUDE.md).

3. **Alert badges** — render alert markers at their anchor bar (badge
   quad via the markers program; text via overlay), mirroring canvas2d's
   `drawAlertBadge`. Respect `alertBadgeFilter` (Task 1 opt).

4. **Pure packers** — cursor instance packing (bar→x/y, halo, color) +
   any optional GPU-marker packing is pure → unit-tested. Glyph
   **positioning** math (project bar point + `location`/`size` → overlay
   pixel anchor) is pure → tested; the glyph **geometry** is the shared
   helper's responsibility (do not re-test it here). The `gl.*`/overlay
   draw is browser-only.

5. **Renderer dispatch + overlay hook** — add `cursor`/`marker` arms to
   `dispatchLayer`; the overlay text pass (Task 8) gains marker/badge/
   character text.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/webgl/programs/cursors-program.ts` | Create | Crosshair cursor (disk AA) |
| `examples/webgl-adapter/src/webgl/programs/markers-program.ts` | Create | Glyph/marker quads |
| `examples/webgl-adapter/src/webgl/programs/indicator-markers-program.ts` | Create | Indicator markers |
| `examples/webgl-adapter/src/glyphs.ts` | Create | Pure positioning + dispatch into the shared `adapter-kit/canvas/glyphs.ts` (no forked geometry) |
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
- `shape`/`arrow`/`character`/`marker`/`label` glyph styles + alert
  badges render via the shared `adapter-kit/canvas/glyphs.ts` on the
  overlay (no forked geometry — byte-identical to uplot/lwc); the
  previously-dropped `marker` style is dispatched; `location`/`size`/
  `xShift` honored.
- Pure positioning + cursor packers unit-tested; build/lint green.

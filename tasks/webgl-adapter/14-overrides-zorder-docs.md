# Candle/background overrides + z-order render pass + docs + changeset + gates

> **Status: TODO**

## Goal

Finish full parity: render the candle/background override emissions
(`bg-color`, `bar-color`, `candle-override`, `bar-override`,
`horizontal-histogram`), implement the global per-pane **z-order render
pass** (mirroring canvas2d's `collectSortableMarks` + `sortByRenderOrder`),
add the docs example page, write the changeset (if applicable), and prove
the whole adapter green across every gate.

## Prerequisites

Tasks 10–13 (all program families landed).

## Desired Behavior

`bgcolor`/`barcolor`/`candle-override` tint backgrounds/candles; plots,
glyphs, hlines, and drawings paint in a single stable z-then-band-then-seq
order per pane (default `z=0` reproduces series→glyphs→hlines→drawings);
the adapter passes the full conformance suite and all repo gates.

## Requirements

1. **Background + bar/candle overrides** — render:
   - `bg-color` → a full-pane (or per-bar span) translucent fill (a quad
     program or filled-band) painted BEFORE the sorted pass.
   - `bar-color`/`candle-override`/`bar-override` → per-bar candle/bar
     color overrides feeding the candle/vertical-bars programs (override
     the static bull/bear color for that bar, per the
     `colorValue`/override precedence contract in adapter-kit's wire
     invariants). Mirror canvas2d's `renderBackgroundOverlays` /
     `renderBarOverlays`.
   - `horizontal-histogram` → the horizontal-volume-bars program (Task
     10) at the bar's anchor.
   Pure override-resolution (which color wins per bar) unit-tested.

2. **z-order render pass** — port canvas2d's approach: a per-pane
   `collectSortableMarks` (plot series, glyph overlays, hlines, drawings)
   tagged `(z, band, seq)` + a stable `sortByRenderOrder`
   (z → band → seq), then dispatch each in order. `BAND = { series:0,
   glyph:1, hline:2, drawing:3 }` so default `z=0` reproduces the legacy
   order. Substrate (bg/candles/axis) before; alerts after. Pure sort
   logic unit-tested. Keep it per-pane (never cross-pane).

3. **Docs** — if the adapter warrants a docs page or the
   `DEMO_SCRIPTS`/examples gates touch it, run `pnpm examples:generate` /
   `pnpm docs:*` as needed and commit regenerated output. Ensure the
   adapter README + CLAUDE.md are final (GL pipeline, overlay-text split,
   pure-vs-browser test boundary, z-order, override precedence,
   provenance, reuse of ViewController/yRangeInWindow/decomposeDrawing).

4. **Final gate sweep** — run the full content gate set and fix any
   drift: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`,
   `pnpm adapters:gate`, `pnpm conformance` (webgl: all 248 scenarios),
   `pnpm build` (apps bundle webgl), react-starter `adapter-matrix`,
   create-chartlang `seamTemplates` parity, `pnpm readme:check`,
   `pnpm docs:check`/`docs:gate` (if docs changed), `pnpm skills:gate`
   (unchanged — no ta/draw primitive added), `pnpm examples:sync`
   (unchanged).

5. **Changeset** — if the published `create-chartlang` template change
   (Task 9) needs a changeset, ensure a `patch` changeset for
   `@invinite-org/create-chartlang` is committed. The example adapter
   itself is private → no changeset.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/webgl/programs/*` | Create/Modify | bg/override fill program |
| `examples/webgl-adapter/src/renderOrder.ts` | Create | Pure z-order sort |
| `examples/webgl-adapter/src/buildFrame.ts` | Modify | Overrides + sorted descriptor order |
| `examples/webgl-adapter/src/ingest.ts` | Modify | Per-bar override precedence |
| `examples/webgl-adapter/{README.md,CLAUDE.md}` | Modify | Final docs |
| `.changeset/*.md` | Create (if needed) | create-chartlang patch |
| `examples/webgl-adapter/src/*.test.ts` | Create | Override + z-order unit tests |

## Gates

- All of: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`,
  `pnpm adapters:gate`, `pnpm conformance`, `pnpm build`,
  react-starter `adapter-matrix`, create-chartlang `seamTemplates` parity,
  `pnpm readme:check`, `pnpm docs:check` (+ `docs:gate` if docs changed).

## Changeset

`patch` for `@invinite-org/create-chartlang` if Task 9 didn't already add
it; none for the private example adapter.

## Acceptance Criteria

- bg/bar/candle overrides + horizontal-histogram render with correct
  per-bar precedence (unit-tested).
- Per-pane z-order pass implemented + unit-tested; default `z=0`
  reproduces the canonical band order.
- Full conformance (248 scenarios) + every repo gate green; docs/CLAUDE.md
  final; changeset committed if required. **WebGL adapter at full
  parity.**

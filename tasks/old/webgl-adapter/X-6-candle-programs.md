# Candle bodies + wicks programs

> **Status: TODO**

## Goal

Port invinite's `candle-bodies-program.ts` + `candle-wicks-program.ts`
and their pure geometry packers, and wire them into the `Renderer`
dispatch so candles render with GPU-instanced quads, device-pixel
snapping (crisp edges), doji min-height, and bull/bear coloring.

## Prerequisites

Task 5 (Renderer + factory + descriptors flowing).

## Desired Behavior

A mounted webgl chart paints OHLC candles: instanced unit-quad bodies
(1 instance/bar) + wicks (2 instances/bar), edge-snapped to device
pixels, bull/bear colored from the palette, with bodies never collapsing
below 1 device-px (the min-body parity with the canvas2d fix).

## Requirements

1. **`src/webgl/programs/base-program.ts`** — port the shared program
   lifecycle abstraction (`pack` → `upload` → `buildVao` on first
   per-pane miss → `setUniforms` → draw; optional `onBeforeDraw`,
   `drawOverride`, `prunePaneOverride`, `cleanupExtras` hooks). Provenance.

2. **`src/webgl/programs/candle-bodies-program.ts`** — port: instanced
   unit-quad, per-instance attributes `aIdx/aOpen/aClose/aIsBull`,
   vertex shader using `worldToSnappedNdc` + `dojiInflateNdcY` (min
   1-device-px height), uniforms `uProj`(mat3), `uBodyWidthPx`,
   `uBullColor`/`uBearColor`, viewport size, dpr; `mix(bear,bull,aIsBull)`
   color; `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` blend via `onBeforeDraw`;
   `drawArraysInstanced(TRIANGLE_STRIP,0,4,rowCount)`. Body width derives
   from bar spacing (px) — apply a **min 1 device-px** floor (parity with
   the canvas2d `MIN_BODY_WIDTH_PX` fix).

3. **`src/webgl/programs/candle-wicks-program.ts`** — port: 2
   instances/bar (upper+lower), per-instance `aLow/aBodyBottom/aBodyTop/
   aHigh`, edge-aligned device-px snapping (no center snap → thin wicks
   stay crisp), the per-pane `bullFlags` Uint8 buffer + VAO and the
   `drawOverride`/`prunePaneOverride`/`cleanupExtras` hooks;
   `drawArraysInstanced(TRIANGLE_STRIP,0,4,rowCount*2)`.

4. **Pure packers** — extract the CPU-side geometry/attribute packing
   (bar rows → Float32Array instance buffer; bull-flag bytes) into pure
   functions and **unit-test** them (correct stride, bull/bear flag,
   doji handling, empty bars). The `gl.*` upload/draw is browser-only.

5. **Renderer dispatch** — add `candle-bodies` + `candle-wicks` arms to
   `dispatchLayer` (Task 5), resolving the program from `program-cache`.

6. **Colors** — bull/bear from `state.palette` (reuse the palette type;
   resolve in `colors.ts` from Task 4). Honor per-bar `candle-override`
   later (Task 14) — for now use the static palette.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/webgl/programs/base-program.ts` | Create | Program lifecycle |
| `examples/webgl-adapter/src/webgl/programs/candle-bodies-program.ts` | Create | Instanced bodies |
| `examples/webgl-adapter/src/webgl/programs/candle-wicks-program.ts` | Create | Instanced wicks |
| `examples/webgl-adapter/src/webgl/programs/*pack*.ts` | Create | Pure packers |
| `examples/webgl-adapter/src/webgl/Renderer.ts` | Modify | Dispatch candle kinds |
| `examples/webgl-adapter/src/webgl/programs/*.test.ts` | Create | Packer unit tests |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test`
- `pnpm conformance` (unchanged)

## Changeset

None.

## Acceptance Criteria

- Bodies + wicks programs ported with provenance; instanced draw +
  device-px snapping + doji min-height + min-1px body floor in place.
- Pure packers unit-tested (stride, bull/bear, doji, empty).
- Renderer dispatches both candle kinds; build/typecheck/lint green.

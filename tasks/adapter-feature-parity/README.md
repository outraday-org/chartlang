# Adapter Feature Parity

## Overview

A cross-adapter audit (2026-06-23) of the five reference adapters
(`canvas2d`, `echarts`, `konva`, `uplot`, `lightweight-charts`) found
that while `xShift`/offset, top-level `color` forwarding, `value:null`
gaps, pane routing, and the 63-kind drawing decomposition are
consistent everywhere, four feature areas diverge badly:

1. **z render-order** — honored only by `canvas2d`; the other four
   ignore `plot.z` / `drawing.z` entirely, so the shipped
   `z-layering.chart.ts` sample only works on one adapter.
2. **Glyph fidelity** — `shape` / `character` / `arrow` / `marker` /
   `label` collapse to undifferentiated dots/circles in `echarts` and
   `lightweight-charts`, and are not painted at all in `uplot`.
3. **Per-bar dynamic color (`colorValue`)** — unhandled for
   line-family plots in *every* adapter (including the reference);
   `konva` also ignores it for `bar-color`. Note: line-family
   `colorValue` is **not reachable from the authoring surface today** —
   only the `bgcolor()` / `barcolor()` aliases pass a `dynamicColor`
   into `plotImpl`; the script-facing `plot()` always passes
   `undefined`. Wiring line-family `colorValue` here is **wire-level
   honesty** (an arriving emission paints correctly), exactly like the
   `area` / `filled-band` / `label` plot styles below — not a fix for a
   value currently being dropped. Exposing it from the authoring API is
   separate feature work (see Deferred).
4. **Capability honesty** — `alertConditions` / `logs` are declared
   `true` but never rendered in four adapters; `lightweight-charts`
   `bg-color` is a no-op; `candle-override` ignores bull/bear/doji
   direction in `echarts` / `konva` / `uplot`; `uplot` leaves eight
   plot kinds buffered-but-unpainted; `canvas2d` (the reference) drops
   the `marker` plot style.

This task set brings **all five adapters to full feature parity** with
the wire contract in `packages/adapter-kit/src/types.ts`. Per the
authoring decisions: full rendering everywhere (no documented no-ops
left standing), `colorValue` honored in all five (including a
structural rework in `lightweight-charts`), and the z-order comparator
promoted into `adapter-kit` as a single shared helper (mirroring the
earlier `shift.ts` promotion that fixed the offset hand-port bug).

Relevant `CLAUDE.md`: `packages/adapter-kit/CLAUDE.md` (geometry +
wire/capability invariants), `examples/<adapter>-adapter/CLAUDE.md`
(per-adapter native mapping), and the `Z-order render pass invariants`
section of `examples/canvas2d-adapter/CLAUDE.md`.

## Current State

- **`canvas2d`** (reference): renders alerts/logs, bg/bar-color
  `colorValue` (3-state), candle-override by direction, full glyphs,
  and a local z-sort pass (`render/renderOrder.ts`). Gaps: the
  `marker` plot style is dropped (`isGlyphOverlay` omits it),
  `step-line` paints as a plain line, and `area`/`filled-band`/`label`
  render helpers exist but are never dispatched. Line-family
  `colorValue` is not consumed.
- **`echarts`**: line/area/histogram/filled-band/hline/bg-color/
  bar-color all correct (incl. bg/bar `colorValue`). Glyphs collapse
  to one scatter dot; candle-override is bull-only; drawing `z`
  ignored; alertConditions/logs buffered only.
- **`konva`**: most kinds render; `bar-color` ignores `colorValue`;
  candle-override bull-only; `marker`/`shape` degrade to a square; no
  z-order; alertConditions/logs buffered only.
- **`uplot`**: line/step/area/histogram/hline/bg-color/bar-color/
  drawings render. Eight kinds buffered-but-unpainted
  (candle-override, bar-override, horizontal-histogram, +5 glyphs);
  filled-band renders a single edge; `visible:false` drops the slot;
  no z-order; alertConditions/logs buffered only.
- **`lightweight-charts`**: line-family `color` forwarding just fixed;
  drawings via the primitive overlay. Filled-band edges get no color;
  area `fillAlpha` dropped; glyphs are one hardcoded blue circle;
  candle-override is a whole-series tint; bg-color is a no-op;
  alertConditions/logs buffered; no z-order; line-family per-bar color
  is structurally impossible today (creation-only series color).

## Target State

- A shared `sortByRenderOrder` + `RENDER_BAND` in `adapter-kit`,
  consumed by all five adapters; `z`-layering works identically
  everywhere (within each adapter's rendering model).
- Every reachable `PlotStyle` kind renders faithfully in all five
  adapters: glyphs show their shape/char/direction/text; candle-override
  picks bull/bear/doji by bar direction; `marker` is dispatched.
- `colorValue` (omitted ⇒ static, present ⇒ override, `null` ⇒
  paint-nothing gap) is honored for bg-color, bar-color, AND
  line-family in all five.
- `alertConditions` and `logs` render in all five (native overlay per
  model); `lightweight-charts` `bg-color` renders. No `Capabilities`
  flag is declared without a real renderer behind it.
- All adapter packages stay at 100% coverage; the CLI's embedded
  adapter bundles (`pnpm adapters:generate`) stay byte-synced
  (`adapters:gate`); each task lands an (empty) changeset for its
  private example package.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Promote the z-sort comparator to `adapter-kit`, generic over payload** | The `shift.ts` promotion fixed a bug born of four hand-ports of the offset math. The z-comparator (`a.z - b.z \|\| a.band - b.band \|\| a.seq - b.seq`) is identical across models; only the per-mark *payload* and the *application* differ. Ship one `sortByRenderOrder<T extends RenderOrderKey>` + `RENDER_BAND` const; each adapter keeps its own mark union but imports the comparator + bands. |
| **`canvas2d` first establishes the line-family `colorValue` pattern** | Line-family per-bar color (3-state, per-segment recolor) is new even in the reference. Designing it once in `canvas2d` (Task 3) gives the other four a proven contract + test shape to mirror. |
| **Render per native model; do NOT force the canvas sink on non-canvas adapters** | `echarts` paints alert/log/glyph overlays via `graphic`; `konva` via nodes; `uplot`/`lightweight-charts` via their canvas draw-hook / primitive overlay (which MAY reuse the `/canvas` `paintPrimitive` sink). Konva stays forbidden from `/canvas`. |
| **`lightweight-charts` line-family `colorValue` = per-color-run segment series** | LC line series carry a single creation-time color with no per-point field. To honor per-bar color we split a line slot into consecutive same-color *runs*, each its own native `Line` series; a `null` run is a whitespace gap. Documented as the LC-specific structural approach. |
| **Promote canvas glyph geometry to `adapter-kit/canvas`, shared by uplot + lwc** | The `shape`/`character`/`arrow`/`marker`/`label` geometry is pure-on-`RenderCtx` and needed by two canvas-sink consumers (uplot draw-hook, lwc overlay). Rather than hand-port it twice (the bug class `shift.ts`/`renderOrder.ts` promotions exist to kill), Task 9 promotes it into `adapter-kit/canvas/glyphs.ts` (minor adapter-kit bump); Task 11 consumes it. echarts uses native `graphic` (not the canvas sink), so it maps geometry intent rather than importing the helper. canvas2d re-consuming the promoted helper is deferred. |
| **Wire `area`/`filled-band`/`label` rendering even though unreachable from the authoring surface** | `PlotOptsStyle` (core) cannot emit them today, but they are declared in every adapter's `Capabilities`. Wiring the render dispatch makes the *wire-level* capability honest (an arriving emission paints). Exposing them in the authoring API is separate feature work (see Deferred). |
| **Each adapter change re-runs `pnpm adapters:generate`** | The CLI embeds a generated copy of each example adapter; `adapters:gate` byte-diffs it. Every adapter task regenerates + re-gates in the same PR (caught only by `test:scripts` otherwise). |

## Dependency Graph

```
Task 1 (adapter-kit: shared sortByRenderOrder + canvas2d consumes)
  |
  ├─> Task 2 (canvas2d: marker/step-line/area/filled-band/label dispatch)
  |
  └─> Task 3 (canvas2d: line-family colorValue — REFERENCE PATTERN)
        |
        ├─> Task 4 (echarts: glyphs + candle-override + drawing-z) ── needs T1
        │     └─> Task 5 (echarts: alertConditions/logs + line colorValue) ── needs T3
        |
        ├─> Task 6 (konva: bar-color colorValue + candle-override + glyphs + z) ── needs T1
        │     └─> Task 7 (konva: alertConditions/logs + line colorValue) ── needs T3
        |
        └─> Task 8  (uplot: candle/bar-override + h-histogram + filled-band + visible) ── needs T1
              └─> Task 9  (uplot: glyphs + PROMOTES shared adapter-kit/canvas glyph helper)
                    └─> Task 10 (uplot: z + alertConditions/logs + line colorValue) ── needs T1,T3

Task 11 (lwc: filled-band color + area alpha + glyphs + candle-override) ── needs T9 (shared glyph helper)
  └─> Task 12 (lwc: bg-color + alertConditions/logs + z) ── needs T1, T11
        └─> Task 13 (lwc: line-family colorValue — structural) ── needs T3, T12
```

The LWC chain (11→12→13) is near-independent: Task 11 builds on the
already-landed `color`-forwarding fix and on the shared `adapter-kit/
canvas` glyph helper promoted in Task 9 (its overlay-painted glyphs
consume it). Task 13 also needs Task 3 (the `colorValue` contract).

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Shared render-order sort](./1-adapter-kit-render-order.md) | adapter-kit, canvas2d | None | Medium |
| 2 | [canvas2d: complete plot dispatch](./2-canvas2d-plot-dispatch.md) | canvas2d | 1 | Medium |
| 3 | [canvas2d: line-family colorValue](./3-canvas2d-line-colorvalue.md) | canvas2d | 1 | Medium |
| 4 | [echarts: glyphs + candle-override + z](./4-echarts-glyphs-candle-z.md) | echarts | 1 | High |
| 5 | [echarts: alert/log + line colorValue](./5-echarts-alerts-logs-colorvalue.md) | echarts | 3, 4 | Medium |
| 6 | [konva: colorValue + candle + glyphs + z](./6-konva-render-correctness.md) | konva | 1 | High |
| 7 | [konva: alert/log + line colorValue](./7-konva-alerts-logs-colorvalue.md) | konva | 3, 6 | Medium |
| 8 | [uplot: overrides + h-histogram + band](./8-uplot-overrides-band.md) | uplot | 1 | High |
| 9 | [uplot: glyph kinds + shared glyph helper](./9-uplot-glyphs.md) | uplot, adapter-kit | 8 | High |
| 10 | [uplot: z + alert/log + line colorValue](./10-uplot-z-alerts-colorvalue.md) | uplot | 1, 3, 9 | High |
| 11 | [lwc: band color + area + glyphs + candle](./11-lwc-band-glyphs-candle.md) | lightweight-charts | 9 | High |
| 12 | [lwc: bg-color + alert/log + z](./12-lwc-bgcolor-alerts-z.md) | lightweight-charts | 1, 11 | High |
| 13 | [lwc: line-family colorValue (structural)](./13-lwc-line-colorvalue.md) | lightweight-charts | 3, 12 | High |

## Code Reuse

| Existing code | Import path | Reused for |
|---------------|-------------|------------|
| `sortByRenderOrder` / `BAND` / `SortableMark` | `examples/canvas2d-adapter/src/render/renderOrder.ts` | Promoted to `adapter-kit` (Task 1), then re-exported back |
| `drawCandleOverride` bull/bear/doji logic | `examples/canvas2d-adapter/src/render/candleOverride.ts:52` | Direction-resolution pattern copied into echarts/konva/uplot/lwc |
| `drawAlertConditions` / `drawLogPane` / `drawAlertBadge` | `examples/canvas2d-adapter/src/render/{alertConditions,logPane,alertBadge}.ts` | Visual design + layout mirrored per native model |
| `drawShape`/`drawCharacter`/`drawArrow`/`drawMarker`/`drawLabel` | `examples/canvas2d-adapter/src/render/{shape,character,arrow,marker,label}.ts` | Glyph geometry reference for echarts `graphic`; **promoted to `adapter-kit/canvas/glyphs.ts` (Task 9)** and consumed by the uplot draw-hook + lwc overlay (canvas2d re-consume deferred) |
| `bgColor.ts` 3-state `colorValue` resolution | `examples/canvas2d-adapter/src/render/bgColor.ts:43`; `uplot` `src/bgColor.ts` | `colorValue` precedence reference |
| `decomposeDrawing` / `paintPrimitive` | `@invinite-org/chartlang-adapter-kit` (+ `/canvas`) | Already shared; unchanged |
| `shiftedBarTime`/`projectShiftedX`/`shiftedBarIndex`/`medianBarSpacing` | `@invinite-org/chartlang-adapter-kit` | Already shared; unchanged |
| `markerNodes` per-shape geometry (private fn — factor into a shared helper) | `examples/konva-adapter/src/primitiveToNode.ts` | konva marker/shape glyphs (Task 6). NOTE: covers only 5 shapes (circle/square/diamond/triangle-up/triangle-down) = the full `marker` set but only 5/8 `shape` kinds; `cross`/`xcross`/`flag` geometry is new (ref `canvas2d/render/shape.ts`) |
| `MockCanvasContext` / `hashCallLog` | `@invinite-org/chartlang-adapter-kit/canvas` | uplot/lwc overlay call-log assertions |

## Provenance

None — these are first-party adapter fixes, not `../invinite/` ports.
No provenance headers required.

## Deferred / Follow-Up Work

- **Expose `area` / `filled-band` / `label` in the authoring surface**
  (`core` `PlotOptsStyle` + the `runtime` emit path). They are wired
  for rendering here but remain unreachable from a script until the
  authoring API is widened — a separate language-surface feature with
  its own §22.10-style docs.
- **Expose line-family per-bar `colorValue` in the authoring surface.**
  Tasks 3/5/7/10/13 wire line/step-line/area/histogram `colorValue`
  rendering in all five adapters, but no script path emits it today
  (only `bgcolor()` / `barcolor()` pass `dynamicColor`; `plot()` does
  not — see `runtime/src/emit/plot.ts`). The rendering is **wire-level
  honest** (a synthetic emission carrying `colorValue` paints), but
  there is no conformance scenario exercising it (a script cannot
  produce one). Adding a `plot(..., { colorValue })` / per-bar-color
  authoring path is separate language-surface feature work.
- **Alert badges / log panes participating in the `z` sort.** Per the
  `canvas2d` invariant they paint always-on-top in v1 (a deliberate
  deferral); this task set keeps that posture across all adapters.
- **Log-scale-exact drawing projection** in `lightweight-charts`
  (`decomposeDrawing` `project?` override) — pre-existing deferral,
  untouched here.
- **canvas2d re-consuming the promoted glyph helper.** Task 9 promotes
  the glyph geometry into `adapter-kit/canvas/glyphs.ts` for uplot + lwc;
  canvas2d keeps its local `render/{shape,character,arrow,marker,label}.ts`
  renderers (already working). Refactoring canvas2d to re-export the
  shared helper (the `renderOrder.ts` pattern) is a follow-up, not
  required for parity.

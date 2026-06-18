# Konva adapter: scaffold + series / candles / panes

> **Status: TODO**

## Goal

Scaffold `examples/konva-adapter/` and implement everything except
drawings: package wiring, full `Capabilities`, headless `DEFAULT_ADAPTER`
conformance export, and the `createKonvaAdapter` factory. Konva is a
generic 2D scene-graph with **no** native chart facilities, so the adapter
owns its own coordinate scale (port canvas2d's pane/viewport math) and
builds candles + plots + hlines from Konva nodes.

## Prerequisites

- Tasks 1–3 (geometry layer; the adapter reuses adapter-kit's
  `Viewport`/`timeToX`/`priceToY`).

## Current Behavior

No Konva adapter exists.

## Desired Behavior

A private `chartlang-example-konva-adapter` whose default export passes
conformance and whose factory renders candles + all plot kinds + hlines +
panes as Konva nodes, ready for drawings (Task 12).

## Requirements

### 1. Scaffold

1. Append `"examples/konva-adapter"` to `PACKAGE_DIRS`; run `pnpm scaffold`.
2. `package.json` (private, mirror canvas2d): deps adapter-kit + host-worker
   (`workspace:^`) + `konva` (`^9`); devDeps compiler/core/runtime +
   `@types/node`. Name `chartlang-example-konva-adapter`, single `.` export.

### 2. Capabilities + headless export

- `src/capabilities.ts` — `KONVA_CAPABILITIES` / `KONVA_SYM_INFO`, full
  surface via the `capabilities` builders.
- `src/defaultAdapter.ts` — frozen headless `Adapter`, package `default`.

### 3. Coordinate scale — reuse adapter-kit

Konva has no chart scale, so the adapter computes its own `Viewport` from
bars + stage size, exactly as canvas2d does. **Reuse** `Viewport`,
`timeToX`, `priceToY` from `@invinite-org/chartlang-adapter-kit`; port the
pane-layout + per-pane viewport math from
`examples/canvas2d-adapter/src/render/paneLayout.ts` into
`src/paneLayout.ts` (this is layout policy, not drawing geometry, so it
stays adapter-local). Document that the Konva adapter is the second
"self-scaled" adapter (like canvas2d); extracting pane layout to a shared
home is the deferred follow-up noted in the README.

### 4. Factory — `src/createKonvaAdapter.ts`

`createKonvaAdapter(opts): KonvaAdapterHandle` (`= Adapter & { host:
ScriptHost }`), WeakMap-held state. Use a Konva `Stage` with `Layer`s
(e.g. a candles/series layer + a drawings layer per Task 12).

- **Candles** → `Konva.Rect` (bodies) + `Konva.Line` (wicks) per bar.
- **Plots** → `Konva.Line` (line/step via `points` + tension/step), area
  via a closed `Konva.Line` with `fill`, histogram via `Konva.Rect`s,
  filled-band via a closed `Konva.Line`.
- **Horizontal lines** → `Konva.Line` across the pane.
- **Sub-panes** → stacked `Konva.Group`s (one per `PlotEmission.pane`),
  positioned via `paneLayout`.
- **onEmissions** ingest → `validateEmission`; rebuild the series layer
  nodes; buffer drawings for Task 12; `layer.batchDraw()`.
- **dispose** → `stage.destroy()`.

### 5. Mock library surface — `src/testing.ts`

Konva can run headlessly on Node via `konva/lib/index-node` (no
node-canvas? Konva-node DOES pull `canvas`). **Avoid the native dep**
(canvas2d's CLAUDE forbids node-canvas for portability) by mocking: provide
`MockKonva` exposing `Stage`/`Layer`/`Group`/`Rect`/`Line`/`Text`/`Arc`/
`Path` stand-ins that record their constructor config + `add`/`destroy`/
`batchDraw` into a `RecordedCall[]`, hashed via `hashCallLog` from
`@invinite-org/chartlang-adapter-kit/canvas`. The factory takes an
`opts.konva?` seam (the Konva namespace) so tests inject `MockKonva` and
production passes the real `Konva`. Assert the node tree (types + config),
not pixels.

> Do **not** add `canvas`/`node-canvas`. The mock node tree is the test
> surface, mirroring canvas2d's "no native canvas" invariant.

### 6. Tests (100% coverage)

- `capabilities.test.ts`, `defaultAdapter.test.ts`, `index.test.ts`,
  `paneLayout.test.ts`.
- `createKonvaAdapter.test.ts` — drive candles + each plot kind + hlines +
  multi-pane through `MockKonva`; assert the recorded node tree / hash.

### Edge cases

- Empty bars → stage + layers, no nodes, no throw.
- `filled-band` null bounds → gap in the closed shape.
- NaN plot values → skip the segment/point.
- Pane ordering: overlay group first; new panes appended deterministically.
- Node reuse vs rebuild: rebuilding the series layer each drain is simplest
  and matches canvas2d's stateless redraw — document it.
- **Override/style plot kinds** (`candle-override`, `bar-override`,
  `bg-color`, `bar-color`, `horizontal-histogram`) are part of the
  declared `allPhase5Plots()` surface (mirrors `CANVAS2D_PLOT_KINDS`).
  Map each to the closest Konva facility (per-bar `Rect` fill, a
  background `Rect`, a `Rect`-bars histogram) or no-op it with a
  documented comment — do not silently drop them.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/scaffold.ts` | Modify | append `PACKAGE_DIRS` |
| `examples/konva-adapter/**` (scaffolded) | Create | skeleton |
| `.../src/capabilities.ts` (+test) | Create | full caps |
| `.../src/defaultAdapter.ts` (+test) | Create | headless export |
| `.../src/paneLayout.ts` (+test) | Create | ported pane/viewport math |
| `.../src/createKonvaAdapter.ts` (+test) | Create | node-based candle/plot/pane factory |
| `.../src/testing.ts` (+test) | Create | `MockKonva` node recorder |
| `.../src/index.ts` (+test) | Modify | barrel + default |
| `examples/konva-adapter/CLAUDE.md` | Create | invariants (self-scaled; no node-canvas; mock node tree; drawings deferred) |

## Gates

- `pnpm typecheck` / `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm readme:check`

## Changeset

Private example → no public changeset (patch if repo changesets privates).

## Acceptance Criteria

- Scaffolds via `pnpm scaffold`; `PACKAGE_DIRS` updated.
- Default export passes conformance.
- Candles + all plot kinds + hlines + panes render as Konva nodes (via
  `MockKonva` in tests); no `node-canvas` dependency.
- Reuses adapter-kit `Viewport`/projection; pane layout ported locally.
- 100% coverage; README + JSDoc gates green.
- Drawings deferred to Task 12.

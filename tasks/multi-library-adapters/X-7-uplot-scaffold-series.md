# uPlot adapter: scaffold + series / candles / panes

> **Status: TODO**

## Goal

Scaffold `examples/uplot-adapter/` and implement everything except
drawings: package wiring, full `Capabilities`, headless `DEFAULT_ADAPTER`
conformance export, and the `createUplotAdapter` factory that maps
chartlang candles + plots + hlines onto uPlot series + a custom
candlestick path builder, with sub-panes handled as stacked uPlot
instances or a single instance with multiple scales.

## Prerequisites

- Tasks 1–3 (geometry layer).

## Current Behavior

No uPlot adapter exists.

## Desired Behavior

A private `chartlang-example-uplot-adapter` whose default export passes
conformance and whose factory renders candles + all plot kinds + hlines
via uPlot, ready for drawings (Task 8).

## Requirements

### 1. Scaffold

1. Append `"examples/uplot-adapter"` to `PACKAGE_DIRS` in
   `scripts/scaffold.ts`; run `pnpm scaffold`.
2. `package.json` (private, mirror canvas2d): deps
   `@invinite-org/chartlang-adapter-kit` (`workspace:^`),
   `@invinite-org/chartlang-host-worker` (`workspace:^`), `uplot` (`^1`);
   devDeps compiler/core/runtime + `@types/node`. Name
   `chartlang-example-uplot-adapter`, single `.` export.

### 2. Capabilities + headless export

- `src/capabilities.ts` — `UPLOT_CAPABILITIES` / `UPLOT_SYM_INFO`, full
  surface via the `capabilities` builders (same set as canvas2d).
- `src/defaultAdapter.ts` — frozen headless `Adapter`, package `default`.

### 3. Factory — `src/createUplotAdapter.ts`

`createUplotAdapter(opts): UplotAdapterHandle` (`= Adapter & { host:
ScriptHost }`), WeakMap-held state like canvas2d.

- **Candles** → a custom uPlot series with a `paths` draw function (uPlot
  ships an official candlestick demo; port that path builder). Feed OHLC
  arrays from the `Bar` stream.
- **Plots** → native uPlot `series` (one per `slotId`); `line`/`step-line`
  via `paths` (`uPlot.paths.stepped` for step), `area`/`histogram`/
  `filled-band` via the series `fill` + a band/bars `paths` builder.
- **Horizontal lines** → drawn in a `hooks.draw` pass using `u.valToPos`
  (this is the same ctx-hook used for drawings in Task 8 — establish the
  hook here for hlines, extend it there for drawings).
- **Sub-panes** → stacked uPlot instances (one per pane) sharing the x
  scale, OR a single instance with per-series scales. **Decision:** stacked
  instances keyed by `PlotEmission.pane`, mirroring canvas2d's `paneOrder`
  ordering. Document the choice.
- **onEmissions** ingest → `validateEmission`; update `u.setData`; buffer
  drawings for Task 8.
- **dispose** → `u.destroy()` for each instance.

### 4. Mock library surface — `src/testing.ts`

uPlot needs a DOM target. Provide a `MockUplot` recording the calls the
factory makes (`new uPlot(opts, data, target)` captured opts, `setData`,
`setScale`, `destroy`, and the `hooks.draw` ctx) using the `hashCallLog`
canonicaliser from `@invinite-org/chartlang-adapter-kit/canvas`. Because
uPlot draws to a `CanvasRenderingContext2D`, tests inject a
`MockCanvasContext` (adapter-kit/canvas) as the hook ctx. The factory
takes an `opts.uplotFactory?` + `opts.ctx?` seam (like canvas2d's
`opts.ctx`).

### 5. Tests (100% coverage)

- `capabilities.test.ts`, `defaultAdapter.test.ts`, `index.test.ts`.
- `createUplotAdapter.test.ts` — drive candles + each plot kind + hlines +
  multi-pane through the mock; assert recorded calls / hashed ctx draw.

### Edge cases

- Empty data → factory builds instance(s), no throw.
- `filled-band` null bounds → gap in the band.
- NaN plot values → uPlot `null` gap (no spurious segment).
- Step vs line `paths` selection per `PlotStyle`.
- Pane ordering: overlay always first, new panes appended deterministically.
- **Override/style plot kinds** (`candle-override`, `bar-override`,
  `bg-color`, `bar-color`, `horizontal-histogram`) are part of the
  declared `allPhase5Plots()` surface (mirrors `CANVAS2D_PLOT_KINDS`).
  Map each to the closest uPlot facility (per-point colours, the draw
  hook, a `bars` paths builder) or no-op it with a documented comment —
  do not silently drop them, so the "all plot kinds" claim stays honest.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/scaffold.ts` | Modify | append `PACKAGE_DIRS` |
| `examples/uplot-adapter/**` (scaffolded) | Create | skeleton |
| `.../src/capabilities.ts` (+test) | Create | full caps |
| `.../src/defaultAdapter.ts` (+test) | Create | headless export |
| `.../src/createUplotAdapter.ts` (+test) | Create | candles/plots/panes factory |
| `.../src/candlePaths.ts` (+test) | Create | ported candlestick `paths` builder |
| `.../src/testing.ts` (+test) | Create | `MockUplot` + ctx seam |
| `.../src/index.ts` (+test) | Modify | barrel + default |
| `examples/uplot-adapter/CLAUDE.md` | Create | invariants (stacked-instance panes; ctx-hook seam; drawings deferred) |

## Gates

- `pnpm typecheck` / `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm readme:check`

## Changeset

Private example → no public changeset (patch if repo changesets privates).

## Acceptance Criteria

- Scaffolds via `pnpm scaffold`; `PACKAGE_DIRS` updated.
- Default export passes conformance.
- Candles + all plot kinds + hlines + panes render via uPlot, verified by
  `MockUplot`/`MockCanvasContext` hashed tests.
- 100% coverage; README + JSDoc gates green.
- Drawings deferred to Task 8 (hook seam established).

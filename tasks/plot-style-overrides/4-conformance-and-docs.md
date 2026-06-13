# Task 4 — Conformance scenario + canvas2d reference adapter + docs

> **Status: TODO**

## Goal

Prove the override channel end-to-end and document it:

- Teach the canvas2d reference adapter to honor `PlotEmission.visible`
  (skip render + viewport) and the override-baked `color` / `style`.
- Add a conformance scenario covering empty-override parity, mount-time
  overrides, and a live `setPlotOverrides` flip — asserted identical
  across both hosts.
- Update the docs (emissions, contract, host pages, manifest) and the
  input/style explainer.

## Prerequisites

Task 2 (`manifest.plots`) and Task 3 (runtime apply + host forward).

## Current Behavior

- `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` (workspace
  package name **`chartlang-example-canvas2d-adapter`** per
  `examples/canvas2d-adapter/package.json:2`) — `applyPlot` at line 377
  and `computeViewport` at line 146 render every plot series
  unconditionally; the per-pane y-range includes every plotSeries
  point. No `visible` awareness.
- `packages/conformance/` — 238+ `.scenario.ts` files (count via
  `ls packages/conformance/src/scenarios/*.scenario.ts | wc -l`); none
  exercises plot overrides. Scenarios are individually imported AND
  re-exported in `packages/conformance/src/scenarios/index.ts`, then
  appended to the frozen `ALL_SCENARIOS` array near the bottom of that
  file; the root barrel `packages/conformance/src/index.ts` re-exports
  the constant by name. Determinism is defined over "same compiled
  bundle, candle stream, inputs, symInfo, capabilities" (PLAN §6.4 +
  §6.9 — this task does **not** extend that contract in PLAN.md
  because Task 3 keeps the empty-override path byte-identical; the
  override channel is documented separately in `docs/adapters/`).
- `docs/spec/emissions.md` — `PlotEmission` table has no `visible` row.
  `docs/adapters/contract.md` — `Adapter` table lists `resolveInputs?`
  but no plot-override resolver. `docs/hosts/worker.md` /
  `writing-a-host.md` — `CreateWorkerHostOpts` + `load` frame omit
  `plotOverrides`; no `setPlotOverrides`. `docs/spec/manifest.md` — no
  `plots` field. `docs/language/inputs.md` — describes inputs as the
  only tuning channel.

## Desired Behavior

### Reference adapter (`examples/canvas2d-adapter/`)

- `applyPlot` skips storing / drops the series point when
  `emission.visible === false` (keep the slot key in `paneOrder` so the
  pane layout is stable, but contribute no points).
- `computeViewport(state, paneKey)` excludes hidden-slot series from the
  per-pane y-range (a hidden RSI must not stretch the subpane scale).
- Override-baked `color` / `lineWidth` / `lineStyle` already arrive on
  the emission — the renderer reads them as it does today; just confirm
  the line renderer honors `lineStyle` dashed/dotted (if the reference
  renderer is solid-only, render solid and note it; the override channel
  is proven by the wire values + the runtime tests regardless).
- `createCanvas2dAdapter.test.ts` — a `visible: false` emission produces
  no rendered series and does not affect the pane viewport; a recolored
  emission renders with the override color.

### Conformance (`packages/conformance/`)

- New `packages/conformance/src/scenarios/plotStyleOverrides.scenario.ts`.
  A 2-plot inline script:
  - **(a) empty overrides** → drained emissions byte-identical to the
    no-override baseline hash (pins the additive guarantee).
  - **(b) mount overrides** `{ "<slot0>": { visible: false }, "<slot1>":
    { color: "#ff0000", lineWidth: 3 } }` → slot0 emits `visible: false`;
    slot1 emits `color: "#ff0000"` and `style.lineWidth === 3`.
  - **(c) live update** — after N bars, `host.setPlotOverrides({ "<slot0>":
    { visible: true } })` (i.e. clear the hide); the next drain shows
    slot0 with no `visible` field again.
- **Scenario registration** — `packages/conformance/src/scenarios/index.ts`
  imports the scenario at the top, re-exports it via the long
  `export { ... } from "./scenarios/index.js";` list, and appends it to
  the `ALL_SCENARIOS = Object.freeze([...])` array (near line 476). The
  root barrel `packages/conformance/src/index.ts` also re-exports the
  new constant alongside the existing `PLOT_KIND_*_SCENARIO` entries.
- **`Scenario` shape** — extend the existing `Scenario` /
  `ScenarioEventStream` types in
  `packages/conformance/src/runConformanceSuite.ts` if needed to carry
  initial `plotOverrides` and a sparse list of `{ atBar, kind:
  "setPlotOverrides", overrides }` events that the harness applies to
  the host between bar pushes. (Confirm the current `ScenarioAssertion`
  / event-stream surface before adding — extend rather than duplicate.)
- **Cross-host parity** — run (b) through both `host-worker` and
  `host-quickjs`; assert byte-identical drained emissions.
- Use `manifest.plots` to resolve the `slotId`s the scenario targets
  (do not hardcode id strings — read them from the compiled manifest so
  the scenario survives id-format changes).

### Docs

- `docs/spec/emissions.md` — add the `visible?` row to the `PlotEmission`
  table (omitted ⇒ visible; only present as `false`); note it in the
  capability-fallback / silent-no-op section (a hidden plot is not a
  diagnostic).
- `docs/spec/manifest.md` — add `plots?` to the manifest field table +
  a `Plot Slot Descriptors` subsection (`slotId`, `kind`, optional
  `title`).
- `docs/adapters/contract.md` — add `resolvePlotOverrides?` to the
  `Adapter` table + a short "Plot overrides" subsection explaining the
  `slotId`-keyed, presentation-only, runtime-applied model.
- `docs/hosts/worker.md` + `docs/hosts/writing-a-host.md` — document the
  `resolvePlotOverrides` constructor opt, the `plotOverrides` load-frame
  field, and the `setPlotOverrides` method + frame. Update the wire-shape
  table in `writing-a-host.md`.
- `docs/language/inputs.md` — add a cross-link: "Inputs tune `compute`;
  for presentation-only recolor / show-hide of individual plots from the
  embedder, see [plot overrides](../adapters/contract.md#plot-overrides)."
- New short page `docs/adapters/plot-overrides.md` (optional but
  recommended) walking the full slot-list → override → `setPlotOverrides`
  flow with one example; add it to the VitePress sidebar config.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | Modify | Honor `visible` in render + viewport |
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.test.ts` | Modify | Hidden / recolored emission assertions |
| `packages/conformance/src/scenarios/plotStyleOverrides.scenario.ts` | Create | Empty-parity, mount, live-update, cross-host |
| `packages/conformance/src/scenarios/index.ts` | Modify | Import + re-export `PLOT_STYLE_OVERRIDES_SCENARIO`; append to `ALL_SCENARIOS` frozen array |
| `packages/conformance/src/index.ts` | Modify | Re-export `PLOT_STYLE_OVERRIDES_SCENARIO` in the root barrel list |
| `packages/conformance/src/runConformanceSuite.ts` | Modify (only if needed) | Extend `Scenario` / event-stream types to carry initial `plotOverrides` + mid-stream `setPlotOverrides` events; route them into both hosts |
| `packages/conformance/CLAUDE.md` | Modify | Note the override scenario + parity assertion |
| `docs/spec/emissions.md` | Modify | `PlotEmission.visible?` row |
| `docs/spec/manifest.md` | Modify | `plots?` field + descriptor subsection |
| `docs/adapters/contract.md` | Modify | `resolvePlotOverrides?` + Plot overrides section |
| `docs/hosts/worker.md` | Modify | Constructor opt + load field + setPlotOverrides |
| `docs/hosts/writing-a-host.md` | Modify | Wire-shape table + lifecycle note |
| `docs/language/inputs.md` | Modify | Cross-link to plot overrides |
| `docs/adapters/plot-overrides.md` | Create | Walkthrough page |
| `docs/.vitepress/config.ts` | Modify | Sidebar entry for the new page |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-conformance test` (both hosts pass every scenario)
- `pnpm -F chartlang-example-canvas2d-adapter test` (workspace name from
  `examples/canvas2d-adapter/package.json:2`) — coverage 100%
- `pnpm docs:check` (link + JSDoc + auto-gen freshness; the executor
  runs every `@example` body)

## Changeset

`.changeset/plot-overrides-4-conformance-docs.md` — `patch` for
`@invinite-org/chartlang-conformance`; docs + example changes are not
published packages (no bump needed beyond conformance). Confirm against
the repo's changeset convention for example/doc-only changes.

## Acceptance Criteria

- The canvas2d adapter renders nothing for a `visible: false` slot and
  excludes it from the pane viewport; recolored slots render with the
  override color.
- The conformance scenario passes on **both** hosts with byte-identical
  drained emissions for the fixed override set.
- Empty-override run matches the pre-feature baseline hash.
- Scenario reads target `slotId`s from `manifest.plots`, not hardcoded.
- `PLOT_STYLE_OVERRIDES_SCENARIO` appears in `ALL_SCENARIOS`,
  `packages/conformance/src/scenarios/index.ts` exports, and the root
  barrel `packages/conformance/src/index.ts` exports.
- All docs updated; `pnpm docs:check` green (every `@example` body
  executes — no throws).
- Changeset `.changeset/plot-overrides-4-conformance-docs.md` committed
  (`patch` for `@invinite-org/chartlang-conformance`; the
  `examples/canvas2d-adapter` package is `private: true` so no
  changeset bump is required for it).

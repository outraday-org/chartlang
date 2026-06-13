# Subpane Rendering

> **Status: TODO.** Lifts the Phase-1 "every pane folds to overlay"
> contract documented in
> `packages/runtime/src/emit/paneResolver.ts:7-22` and the
> `packages/conformance/CLAUDE.md` "`unsupported-pane` not asserted on
> RSI scenario" carve-out. Wires `defineIndicator({ overlay: false })`
> + `plot(..., { pane: "new" | "<id>" })` into actual subpane
> rendering in the canvas2d reference adapter.
>
> **Plan reference:** PLAN.md §4.5 (capabilities), §7.2 (subPanes
> sentinel), §7.3 (PlotEmission.pane field), §5.5 (callsite-id is the
> default subpane key).
>
> **Version target:** per-package minor bump. `STATEFUL_PRIMITIVES`
> stays untouched — `plot` / `hline` get one new option each but
> remain in the same slot-injection class.

## Goal

Make `pane: "overlay" | "new" | "<id>"` route end-to-end:

- The runtime stops folding non-overlay panes when the adapter
  declares `subPanes >= 1`.
- `defineIndicator({ overlay: false })` becomes the **script-level
  default pane** the runtime applies to every `plot()` / `hline()`
  call without an explicit `pane` opt.
- Per-call `pane: "<id>"` overrides the script default and routes
  same-id calls into the same subpane. `pane: "new"` resolves to a
  per-script-id pane key (every `pane: "new"` in the same script ends
  up in the same subpane).
- The canvas2d reference adapter renders a fixed **70% price pane +
  30% subpane band** layout, splitting the subpane band uniformly
  across the distinct pane keys it sees. Each pane gets its own y-
  scale; bars only render in the price pane; hlines route to the pane
  of the slot's nearest plot.
- The two existing RSI demo scripts in `examples/react-demo/` —
  already authored with `overlay: false` — render in a real subpane
  with no script edits. A new explicit-`pane` demo script ships
  alongside them to exercise per-call override.

## Current State

- **`packages/runtime/src/emit/paneResolver.ts`** — return type is
  the literal `"overlay"`. Every non-overlay request is folded to
  overlay and an `unsupported-pane` warning is pushed (lines 23-50).
  Two branches differ only in the diagnostic message: one for
  `subPanes >= 1`, one for `subPanes === 0`. Tests in
  `paneResolver.test.ts:75-93` pin the fold.
- **`packages/runtime/src/runtimeContext.ts`** — `RuntimeContext`
  has no `defaultPane` / `overlay` field. `createScriptRunner.ts`
  receives the manifest at mount but does not surface its
  routing-relevant flags into the per-step context.
- **`packages/core/src/define/defineIndicator.ts:24-33`** —
  `DefineIndicatorOpts.overlay?: boolean` is accepted by the
  constructor, **destructured but never stored on the manifest**
  (the `manifest = { ...base, ...(opts.maxDrawings ? {...}) }`
  block at lines 69-80 has no `overlay` spread). The compiler's
  ambient shim at `packages/compiler/src/program.ts:1305` lists the
  field as well.
- **`packages/core/src/types.ts:266`** — `ScriptManifest` has no
  `overlay` / `defaultPane` field.
- **`packages/core/src/plot/plot.ts:217-239`** — `PlotOpts.pane?:
  "overlay" | "new" | string` is already the canonical shape and
  documents Phase-2+ as the lift-off target. `HLineOpts` (lines 251-
  256) has **no** `pane` field — hlines today always go to overlay
  (`packages/runtime/src/emit/hline.ts:41`).
- **`packages/adapter-kit/src/types.ts:457-468`** — `PlotEmission.pane`
  is already on the wire contract; no schema change needed for the
  emission shape. `Capabilities.subPanes` (lines 271-281) carries the
  sentinel; canvas2d declares `Number.MAX_SAFE_INTEGER`
  (`examples/canvas2d-adapter/src/capabilities.ts:84`).
- **`examples/canvas2d-adapter/src/createCanvas2dAdapter.ts`** —
  `AdapterState.plotSeries: Map<string, PlotPoint[]>` (line 117) is
  keyed by `slotId` only. `computeViewport` (line 146) computes one
  shared y-scale from **bars ∪ every plotSeries point**, so an RSI
  series in 0-100 expands the viewport and the price chart squashes.
  `applyPlot` (line 377) discards `plot.pane`. `renderFrame` (line
  338) draws bars + every plot series in the same coordinate space.
- **`packages/conformance/CLAUDE.md`** documents the carve-out: "The
  `unsupported-pane` diagnostic is NOT asserted on the RSI-divergence
  scenario." A synthetic explicit-`pane: "new"` script is used to
  exercise the diagnostic path in `runConformanceSuite.test.ts`.
- **`examples/react-demo/src/scripts.ts`** ships four demo scripts;
  two (`rsi-divergence-alert`, `smoothed-rsi-cross`) carry
  `overlay: false` but render on the price pane today because the
  flag never reaches the runtime.

## Target State

### Core (`packages/core/`)

- `DefineIndicatorOpts.overlay?: boolean` is **persisted to the
  manifest** as `ScriptManifest.overlay?: boolean` (Phase-2+ field).
  The compiler's ambient shim mirrors it on `ScriptManifest`. No
  semantic default — absence means "overlay" per the existing
  PLOTOpts default; explicit `true` is also overlay; explicit
  `false` triggers subpane routing.
- `HLineOpts.pane?: "overlay" | "new" | string` added — same
  three-variant shape as `PlotOpts.pane`. JSDoc updated to call out
  that hlines now route to the pane the same script's plots route
  to by default (via the manifest's `overlay: false` signal).
- `defineIndicator.test.ts` extended to cover the `overlay` round
  trip on the manifest.

### Compiler (`packages/compiler/`)

- `manifest.ts` — `buildManifest` reads `overlay` off
  `defineIndicator` opts and emits it on the manifest JSON. The
  ambient shim entry (`program.ts:1280-1298`) gains the
  `overlay?: boolean` field on `ScriptManifest`.
- `manifest.test.ts` — new test pins `overlay: false` round trips
  through bundle → re-import → manifest read.

### Runtime (`packages/runtime/`)

- `RuntimeContext` gains `readonly defaultPane: string` and
  `readonly scriptPane: string`. `defaultPane` is `"overlay"` when the
  manifest's `overlay` flag is `true` / absent and `scriptPane` when
  `overlay: false`. `scriptPane` is always
  `"script:${sanitisedManifestName}"`, so explicit `pane: "new"` has a
  stable target even for overlay-default scripts. `createScriptRunner`
  resolves both once at mount.
- `paneResolver.ts` becomes a real router:
  - `requested === "overlay"` → `"overlay"`.
  - `requested === undefined` → `ctx.defaultPane`.
  - `requested === "new"` → `ctx.scriptPane` (same coalesce used by
    the manifest path when `defaultPane` is already a subpane key).
  - Named (`"rsi"`, etc.) → returned unchanged if
    `capabilities.subPanes >= 1`; otherwise folded to overlay with
    the existing diagnostic.
  - `subPanes === 0` still folds everything to overlay with the
    `unsupported-pane` diagnostic (this branch is what makes
    bare-bones adapters keep working).
- `plot.ts` calls `resolvePane(opts.pane, ctx, slotId)` unchanged; the
  emitted `PlotEmission.pane` is now whatever the resolver returned.
- `hline.ts` reads `opts.pane`, calls the same resolver, emits the
  resolved pane on the `PlotEmission` (instead of the hard-coded
  `"overlay"`).
- `paneResolver.test.ts` rewritten — covers default-pane resolution,
  `"new"` coalescing, named-pane pass-through, and the subPanes-0
  fold. New property test in `paneResolver.property.test.ts` over
  arbitrary requested strings × `subPanes ∈ {0, 1, MAX}`.

### Adapter (`examples/canvas2d-adapter/`)

- `AdapterState` gains:
  - `readonly paneOrder: string[]` — distinct pane keys in first-emit
    order; `"overlay"` always at index 0.
  - `plotSeries: Map<string, PlotPoint[]>` keyed by **`${paneKey}|${slotId}`**.
  - `plotSeriesStyle` similarly keyed.
  - `hlines: Map<string, HLine & { paneKey: string }>` — hlines
    carry their pane key.
- New module `src/render/paneLayout.ts` exports `computePaneLayout(
  paneOrder, canvas)` → `ReadonlyArray<{ paneKey, rect }>` where
  `rect = { x, y, w, h }`. Price pane (key `"overlay"`) gets the
  top 70%; every other pane shares the bottom 30% uniformly. Single-
  pane case (no subpanes seen): price pane uses full height.
- `computeViewport(state, paneKey)` (renamed from `computeViewport`)
  computes a y-scale **per pane**: the price pane uses
  bars ∪ plotSeries-in-overlay; subpanes use only their own
  plotSeries.
- `renderFrame` walks each `paneLayout` entry: per-pane clear, bars
  (overlay only), per-pane plotSeries, per-pane hlines, per-pane
  drawings. Glyph overlays + drawings without pane routing fall back
  to the overlay pane (Phase-3 drawings are not pane-routed in this
  task — deferred).
- `applyPlot` writes into the `${paneKey}|${slotId}` bucket and adds
  the pane key to `paneOrder` on first sight.
- `paneLayout.test.ts` — unit tests for the layout split (0
  subpanes, 1 subpane, 3 subpanes, 5 subpanes — uniform division).
- `createCanvas2dAdapter.test.ts` extended: an `overlay: false`
  bundle emits plots whose `PlotPoint`s land in a non-overlay pane
  rect; the price viewport y-range is unaffected by RSI 0-100 values.

### Conformance (`packages/conformance/`)

- New scenario `rsiSubpaneRouting.scenario.ts` (added to
  `PHASE_1_SCENARIOS`). The script declares `overlay: false`, plots
  RSI(14) + hlines at 30/70, and the assertions pin: (1) the
  `pane` field on every emitted `PlotEmission` is **not** `"overlay"`;
  (2) **no** `unsupported-pane` diagnostic is pushed; (3) the pane
  key is stable across all plots in the script.
- The existing carve-out in `packages/conformance/CLAUDE.md` is
  rewritten: "The `unsupported-pane` diagnostic IS asserted on the
  subpane-routing scenario when the adapter declares `subPanes ===
  0`; on adapters with `subPanes >= 1` (canvas2d), the diagnostic is
  absent and the resolved pane equals the manifest's
  `script:${name}` key."

### React demo (`examples/react-demo/`)

- The two RSI scripts (`rsi-divergence-alert`, `smoothed-rsi-cross`)
  already declare `overlay: false`; no source edit needed. After the
  runtime and adapter changes land, both render in a subpane below
  the price chart.
- New demo script `explicit-pane-routing` is added to
  `DEMO_SCRIPTS`: a single `defineIndicator` body with `overlay:
  true` that emits `plot(close)` to overlay + `plot(rsi, { pane:
  "rsi" })` to a subpane. Demonstrates the per-call override path
  end-to-end inside one script.

## Architecture Decisions

| Decision | Rationale |
|---|---|
| **Persist `overlay` on the manifest rather than computing a default pane at compile time** | The manifest is the runtime's source of truth for routing; the compiler already emits the rest of the script's static contract there. Computing a per-script default pane key in the compiler and storing only the key would couple the compiler to the runtime's pane-key naming convention; round-tripping `overlay: boolean` keeps the contract additive and the runtime in charge of the keying scheme. |
| **`"new"` coalesces to **one** subpane per script (the manifest default)** | TradingView's mental model: an indicator with `overlay: false` lives in **one** subpane regardless of how many `plot()` calls it issues. Per-callsite subpanes would make the layout noisy (one subpane per RSI plot + EMA-of-RSI plot, etc.). The escape hatch is named panes — `pane: "a"`, `pane: "b"` — which a script can use when it deliberately wants two subpanes. |
| **Hline pane is opt-in via `HLineOpts.pane`, not auto-routed from `overlay: false`** | Two reasons. (1) Existing hline call-sites that don't pass `pane` should keep landing on overlay when the script's other plots are on overlay — auto-routing them under the script default would re-route them too, which is correct for the RSI use case **as long as it follows the same default-pane path**. (2) The implementation cost is the same as plot's: `resolvePane(opts.pane, ctx, slotId)`. So we wire hline through the same router; default behaviour falls out automatically (no `pane` → manifest default), and the explicit override is free. |
| **Fixed 70/30 split, no opts** | The user picked the fixed-ratio option. Configurable ratios via `createCanvas2dAdapter` opts is a small follow-up that can land later without breaking the contract — the layout helper takes `{ priceFraction: 0.7 }` internally so the future opt just threads through. |
| **Subpanes share the 30% band uniformly** | Matches the user's "fixed price 70% + uniform subpanes" answer. Single-pane charts (every plot on overlay) collapse to the existing full-height behaviour — no visual regression for the EMA-cross / Bollinger demos. |
| **Bars render in the overlay pane only** | Subpanes show oscillators (RSI, MACD, etc.) on their own y-axis; rendering bars (candles in the y-range of bars) in a subpane would be a category error. Drawing dispatch (Phase 3 surface) stays overlay-only for the same reason — pane-routed drawings are explicit follow-up work. |
| **Pane key for `overlay: false` is `script:${manifest.name}` (sanitised)** | The script's `name` is the most ergonomic key for two scripts to deliberately share a subpane (`overlay: false, name: "rsi-cluster"`). Using the slot prefix would key per-callsite; using a UUID would foreclose intentional sharing. `:`/spaces/etc. get replaced with `-` so the key fits the existing `string` shape on `PlotEmission.pane`. |
| **Split the canvas2d work into pure helpers (Task 3) + integration (Task 4)** | A single canvas2d task spec exceeded the ~300-line soft cap (layout helper + state refactor + per-pane viewport + render-loop walk + adapter tests + integration-hash re-pin + mock extensions). Task 3 ships the three pure helpers (`paneLayout` / `clearPaneRect` / `paneSeparator`) with their own unit tests; Task 4 composes them into `createCanvas2dAdapter.ts` and re-pins the integration hash. Each task spec lands well under the cap and each is independently reviewable. |
| **Bundle the React demo addition into Task 5 (conformance scenario), not Task 4 (adapter integration)** | Task 4 is already the larger of the two canvas2d tasks (state refactor + viewport split + render-loop walk + mock extensions). Pushing the React demo wiring into Task 5 keeps Task 4's diff focused on the adapter contract and Task 5's diff focused on user-facing demonstrations. |

## Dependency Graph

```
Task 1 (core types + compiler manifest)
   |
   v
Task 2 (runtime: paneResolver + defaultPane + hline pane)
   |
   v
Task 3 (canvas2d pure layout helpers — paneLayout / clearPaneRect / paneSeparator)
   |
   v
Task 4 (canvas2d adapter integration: pane-aware state + per-pane viewport + render walk)
   |
   v
Task 5 (conformance scenario + react demo wiring)
```

Each task is a strict prerequisite of the next: the runtime cannot
read `manifest.overlay` until Task 1 stores it; the adapter cannot
render pane-routed emissions until Task 2 emits non-overlay pane
strings; the render-loop refactor in Task 4 composes the pure
helpers Task 3 ships; the conformance scenario cannot assert pane
!= "overlay" until Task 4 makes the canvas2d adapter actually
consume the field.

## Task Summary

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|---|---|---|---|
| 1 | [Core types + compiler manifest propagation](./1-core-and-compiler.md) | core, compiler | None | Medium |
| 2 | [Runtime pane router + hline pane support](./2-runtime-pane-router.md) | runtime | 1 | Medium |
| 3 | [Canvas2d pane layout + render helpers (pure)](./3-canvas2d-layout-helpers.md) | examples/canvas2d-adapter | 2 | Low |
| 4 | [Canvas2d adapter integration (state + viewport + render walk)](./4-canvas2d-integration.md) | examples/canvas2d-adapter | 3 | Medium |
| 5 | [Conformance scenario + React demo](./5-conformance-and-demo.md) | conformance, examples/react-demo | 4 | Low |

## Code Reuse

| Reuse | Source | Notes |
|---|---|---|
| `PlotOpts.pane` shape (`"overlay" \| "new" \| string`) | `packages/core/src/plot/plot.ts:239` | `HLineOpts.pane` in Task 1 copies this exact type alias. Don't introduce a parallel literal union. |
| `resolvePane` function signature | `packages/runtime/src/emit/paneResolver.ts:23` | Task 2 rewrites the body but keeps the signature `(requested, ctx, slotId) => string`. The hline emit re-uses the same call site. |
| `pushDiagnostic` + `unsupported-pane` code | `packages/runtime/src/emit/emissionsQueue.ts` | Task 2 keeps the diagnostic on the `subPanes: 0` branch; only the unfold branch changes. |
| `Capabilities.subPanes` sentinel | `packages/adapter-kit/src/types.ts:271-281` + `examples/canvas2d-adapter/src/capabilities.ts:84` | No change. The adapter already declares the unlimited sentinel. |
| `Viewport` + `priceToY` / `timeToX` / `yToPrice` | `examples/canvas2d-adapter/src/render/coords.ts` | Task 3 reuses these per-pane — `priceToY` already takes a `Viewport`, so the per-pane y-scale falls out by passing a per-pane viewport. |
| `Object.freeze` capabilities pattern | `examples/canvas2d-adapter/src/capabilities.ts:75-105` | No change. |
| `Scenario` + `inlineSource` pattern | Phase-2 scenarios (e.g. `taWma.scenario.ts`) | Task 4's `rsiSubpaneRouting.scenario.ts` mirrors the Phase-2 inline-source convention; the virtual `sourcePath` is `<inline:rsi-subpane-routing>.chart.ts`. |
| `DEMO_SCRIPTS` array shape | `examples/react-demo/src/scripts.ts:113-118` | Task 4 appends one entry; no schema change. |

## Provenance

No `../invinite/` ports. All work is on chartlang-native code.

## Deferred / Follow-Up Work

- **Configurable pane ratios via `createCanvas2dAdapter({ paneRatios:
  ... })`.** The layout helper takes a `priceFraction` internally to
  keep the future opt threadable; not exposed in this task.
- **Pane-routed drawings.** `draw.*` emissions (Phase 3 surface)
  stay overlay-only here. A follow-up adds `DrawingEmission.pane`
  on the wire + per-pane drawing dispatch.
- **Pane titles / left-axis labels.** The canvas2d renderer draws no
  per-pane chrome (axis ticks, pane name strip). UX-polish task.
- **Cross-script pane sharing via named pane keys.** Two scripts
  passing `plot(..., { pane: "shared" })` will collide in one
  subpane today — intentional. A follow-up could add a host-level
  pane registry to coordinate.
- **Interactive resize / drag-to-resize panes.** Pure UX, deferred.
- **`Capabilities.subPanes` finite-cap enforcement.** Today the
  runtime's pane router doesn't count distinct pane keys against the
  cap (the canvas2d adapter declares `Number.MAX_SAFE_INTEGER` so
  the path is untested). An adapter declaring `subPanes: 2` with a
  script emitting 5 distinct pane keys is a follow-up validation.
- **Bench coverage for the per-pane render loop.** The Phase-1
  renderer integration bench is single-pane; a pane-walking bench
  is a follow-up.

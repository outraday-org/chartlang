# Phase 3 — `0.3` Full Drawing Parity

> **Plan reference:** PLAN.md §19 Phase 3, with cross-cuts into §10
> (full `draw.*` namespace), §3.1 (drawing-schema reference paths),
> §7.4 (silent no-op semantics), §17.4 (auto-generated docs),
> §22.10 (per-port landing rule).
> **Prerequisite:** Phase 2 indicator parity (`0.2`) shipped — see
> `tasks/phase-2-indicator-parity/README.md`.
> **Version target:** `0.3` (per-package). `apiVersion: 1` script
> header unchanged (Phase 3 is additive at runtime).
> **Invinite reference commit:** the Phase-2 SHA
> `078f41fe2569d659d5aba726da8bcb5d3e2ced02` carries forward — every
> port task that lifts geometry / anchor semantics from
> `../invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts` or
> `../invinite/src/components/trading-chart/tools/<name>-tool.ts`
> pins this SHA in its provenance header.

## Goal

Add the full `draw.*` namespace so chartlang scripts can imperatively
place every one of the **61 drawing kinds** that invinite supports.
Each kind ships with: a script-facing `draw.<kind>(...)` runtime
function returning a `DrawingHandle`; a typed `DrawingState` variant
on the wire; a real-impl `validateEmission` + `decodeDrawing` per
kind; a canvas2d reference-adapter renderer at conformance-acceptable
fidelity; a per-kind `*.scenario.ts` (inline-source) covering the
emit path; an auto-generated `docs/primitives/draw/<kind>.md` page;
JSDoc with `@anchors` + `@since` + stability marker + `@example`.

Adapters that omit a kind degrade silently per §7.4: the kind drops
with `unsupported-drawing-kind` and the rest of the script renders.
Excess emissions drop with `drawing-budget-exceeded` once a script's
bucket (lines / labels / boxes / polylines / other) is full.

## Current State

Phase 2 left the repo at:

- `packages/adapter-kit/src/types.ts` declares `DrawingKind = "line"`
  as a placeholder (`@since 0.1`, `@experimental`) and
  `DrawingEmission` with `op: "create" | "update" | "remove"` +
  `state: unknown` (the wire shape is pinned but never carries real
  data).
- `validateEmission`'s `validateDrawingEmission` unconditionally
  returns `{ ok: false, code: "unsupported-drawing-kind", message:
  "drawing emissions are not supported in Phase 1" }`.
- `decodeDrawing(e)` returns `null` always — a Phase-1 stub.
- `Capabilities.drawings: ReadonlySet<DrawingKind>` and
  `Capabilities.maxDrawingsPerScript: DrawingCounts` (the
  `{ lines, labels, boxes, polylines, other }` 5-bucket bag) are
  already wired; canvas2d's `defaultAdapter` declares
  `drawings: new Set()` + zero-budget.
- `DiagnosticCode` already includes `"unsupported-drawing-kind"` and
  `"drawing-budget-exceeded"`.
- `packages/runtime/src/emit/` ships `plot` / `hline` / `alert`
  primitives, the `emissionsQueue` (with `pushPlot` / `pushAlert` /
  `pushDiagnostic`), `hash.ts` (FNV-1a), `paneResolver.ts`. There is
  no `emit/draw/` directory; the runtime never emits a
  `DrawingEmission` today.
- `packages/core/src/` ships `plot/`, `ta/`, `alert/`, `define/`
  (with `defineIndicator` + `defineAlert`) but no `draw/` subpath.
  `defineDrawing` (per PLAN.md §4.1) is declared in the spec but
  unimplemented.
- `examples/scripts/` ships three curated `.chart.ts` files
  (`ema-cross.chart.ts`, `bollinger-bands.chart.ts`,
  `rsi-divergence-alert.chart.ts`). The fourth script,
  `fib-retracement.chart.ts`, was deferred from Phase 1 — Phase 3
  adds it as part of the fib-retracement scenario.
- `packages/conformance/src/runConformanceSuite.ts` defines
  `ScenarioAssertion` over five variants (`plot-hash`,
  `alert-count`, `alert-message-contains`,
  `diagnostic-code-absent`, `diagnostic-code-present`) — no
  `drawing-*` assertion yet.
- `STATEFUL_PRIMITIVES` (`packages/core/src/statefulPrimitives.ts`)
  carries 90 `ta.*` + `plot` + `hline` + `alert` entries =
  **93 entries**. No `draw.*` names appear.
- Canvas2d adapter has plot renderers under
  `examples/canvas2d-adapter/src/render/`
  (`line.ts`, `horizontalLine.ts`, `histogram.ts`, `marker.ts`,
  `area.ts`, `filledBand.ts`, `label.ts`, `bars.ts`, `candles.ts`,
  `alertBadge.ts`, plus the shared `coords.ts`, `lineDash.ts`,
  `clear.ts`) — these render `PlotEmission`s, not `DrawingEmission`s.
  No `draw/` subdirectory exists under `render/`.

## Target State

After all 22 tasks land:

### Core (`packages/core/src/`)

- New `packages/core/src/draw/` subtree:
  - `drawingKind.ts` — the full kebab-case `DrawingKind` discriminator
    union (61 entries) — pinned in this single declaration; every
    consumer imports from here. Plus `DRAWING_KINDS:
    ReadonlyArray<DrawingKind>` for runtime iteration.
  - `worldPoint.ts` — `WorldPoint = { time: Time; price: Price }`
    plus the per-kind anchor tuple helpers (`AnchorPair`,
    `AnchorTriple`, `AnchorPoints<N>`).
  - `drawingState.ts` — the `DrawingState` discriminated union —
    one variant per kind, with collab-only fields (Yjs ids, layer
    ids, intervals, parentGroupId/FrameId, createdAt, authorId)
    stripped per §10.4. Geometry + style fields only.
  - `drawingStyle.ts` — `LineDrawStyle`, `ShapeStyle`,
    `HighlighterStyle`, `BrushStyle`, `TextOpts`, `ArrowOpts`,
    `ArrowMarkerOpts`, `PathOpts`, `FibOpts`,
    `RegressionTrendOpts`, `FrameOpts`. JsonValue-clean — survive
    postMessage + QuickJS membrane unchanged.
  - `draw.ts` — `DrawNamespace` script-facing surface (one method
    per kind, plus the `draw.fib.*`, `draw.gann.*`, `draw.elliott.*`,
    `draw.pattern.*` sub-namespaces).
  - `handle.ts` — `DrawingHandle = { id, update(patch), remove() }`
    type only; the impl lives in the runtime.
  - `index.ts` — barrel.
- `STATEFUL_PRIMITIVES` extends by **61 entries** — one per kind
  string (`draw.line`, `draw.horizontalLine`, `draw.fibRetracement`,
  …) all `slot: true`. End-of-phase cardinality: **154 entries**
  (93 from Phase 2 + 61 new). Test asserts `.size === 154`.
- `defineDrawing` constructor lands in `packages/core/src/define/`
  (Task 20) — emits `ScriptManifest.kind: "drawing"` (already
  declared in Phase 1).

### Adapter-kit (`packages/adapter-kit/src/`)

- `DrawingKind` widened from `"line"` to the full 61-kebab-case
  union — re-exports the canonical declaration from
  `@invinite-org/chartlang-core/draw`.
- `DrawingEmission.state` re-typed from `unknown` to the
  `DrawingState` discriminated union; `decodeDrawing(e):
  DrawingState | null` narrows by `e.drawingKind`.
- `validateEmission` per-kind dispatch:
  `validateDrawingEmission(e)` now switches on `e.drawingKind`,
  validates anchors against the per-kind anchor schema (count,
  finite time/price), validates style payload, and walks `meta`
  for JsonValue compliance. Real `decodeDrawing` returns
  `DrawingState` (typed by kind) for well-formed payloads.
- `capabilities.*` builder set extended: one builder per kind
  (`capabilities.line()`, `capabilities.fibRetracement()`, …),
  category groups (`capabilities.allLineDrawings()`,
  `capabilities.allBoxDrawings()`, `capabilities.allCurveDrawings()`,
  `capabilities.allFreehandDrawings()`,
  `capabilities.allAnnotationDrawings()`,
  `capabilities.allChannelDrawings()`, `capabilities.allFibDrawings()`,
  `capabilities.allGannDrawings()`,
  `capabilities.allPitchforkDrawings()`,
  `capabilities.allPatternDrawings()`,
  `capabilities.allElliottDrawings()`,
  `capabilities.allCycleDrawings()`,
  `capabilities.allContainerDrawings()`), and one umbrella —
  `capabilities.allPhase3Drawings()` — returning every kind.
- `bucketFor(kind: DrawingKind): keyof DrawingCounts` exported from
  `adapter-kit` — the canonical kind → bucket map used by the
  runtime budget enforcer and by adapters that pre-budget.

### Runtime (`packages/runtime/src/`)

- New `packages/runtime/src/emit/draw/` subtree:
  - `handle.ts` — `DrawingHandle` impl. Each `update(patch)` merges
    the patch with the current `DrawingState` for the handle's
    `slotId#subId` and emits a `DrawingEmission` with the full
    merged state under `op: "update"`. `remove()` emits
    `op: "remove"` with the last-known state. Handles are stable
    across bars per §10.3.
  - `pushDrawing.ts` — `pushDrawing(queue, e)` validation + push to
    `MutableRunnerEmissions.drawings`, with `drawing-budget-exceeded`
    enforcement (per `DrawingCounts` bucket from
    `adapter-kit.bucketFor`) and `unsupported-drawing-kind` gating
    (against `ctx.capabilities.drawings`). Per-bar dedup by
    `(handleId, op)` — repeated `update`s on the same bar collapse
    last-write-wins.
  - `kindBuckets.ts` — re-export of `adapter-kit.bucketFor` plus
    the runtime's per-script bucket counters.
  - One `<kind>.ts` per drawing kind (e.g. `line.ts`,
    `fibRetracement.ts`, `elliottImpulseWave.ts`) — 61 files.
    Each exports the (overloaded) script-facing function +
    compiler-injected `(slotId, ...)` signature, returning a
    `DrawingHandle`.
  - `index.ts` — barrel exporting the `draw` namespace
    (`{ draw }`) plus the runtime-side type
    `RuntimeDrawNamespace`.
- `RunnerEmissions.drawings: ReadonlyArray<DrawingEmission>` —
  already declared (Phase 1) — flows real entries from Phase 3
  onward.
- The slot-store path widens to include a `DrawingState` map per
  drawing slot, indexed by `slotId#subId` so a script's `for`-loop
  emitting N labels gets N independent handles.

### Compiler (`packages/compiler/src/`)

- `transformers/callsiteIdInjection.ts` recognises the 61 new
  `draw.*` callable names (consumed from `STATEFUL_PRIMITIVES`
  with `slot: true`) and injects a stable slot id as the first
  argument.
- `analysis/statefulCallInLoop.ts` flags `draw.*` calls in
  unbounded loops with the existing
  `stateful-call-inside-loop` error.

### Conformance (`packages/conformance/`)

- `ScenarioAssertion` extended with a sixth variant —
  `{ kind: "drawing-hash"; handleId?: string; sha256: string }`
  — pinning a SHA-256 over JSON-stringified
  `{ handleId, drawingKind, op, state, bar }` tuples (in emission
  order), filtered by `handleId` if supplied. Pinning workflow
  mirrors `plot-hash` (re-pin from the failure-message `actual`).
- 61 per-kind scenario files in
  `packages/conformance/src/scenarios/` — one `*.scenario.ts`
  per kind, all using `inlineSource` (the Phase-2 pattern) with
  a 6–12 line `defineIndicator` source that emits the kind once
  and asserts via `drawing-hash` against the existing
  `goldenBars.json` fixture. Scenario filenames mirror the
  Phase-2 convention (`drawLine.scenario.ts`,
  `drawFibRetracement.scenario.ts`, …).
- 12 task-bundled scenarios — one per port task (Tasks 5, 7,
  8, 9, 10, 12, 13, 14, 15, 16, 17, 18). Task 8 collapses
  Curves + Freehand into one `drawCurvesAndFreehandAll`
  bundle; Task 7 supersedes Task 6's `drawBoxesA` with
  `drawBoxesAll`; Task 12 supersedes Task 11's `drawFibA`
  with `drawFibAll`. Bundles span all 13 kind-categories.
  Plus `drawAll61.scenario.ts` — a smoke test exercising all
  61 kinds in one script (used to verify the per-script
  budget + `unsupported-drawing-kind` paths).
- `scenarios/index.ts` re-export list grows monotonically.

### Canvas2d reference adapter (`examples/canvas2d-adapter/`)

- `CANVAS2D_CAPABILITIES.drawings` declared via
  `capabilities.allPhase3Drawings()` so the conformance suite
  covers every kind end-to-end.
- `CANVAS2D_CAPABILITIES.maxDrawingsPerScript` raised from the
  Phase-1 zero-budget to a per-bucket set high enough to render
  the 61-kind smoke test (declared in Task 4).
- New `src/render/draw/` directory with one renderer per kind
  (61 files) plus shared helpers — `worldToCanvas.ts` (extends
  the existing `coords.ts` for `Time → x` projection),
  `drawingDispatch.ts` (routes a `DrawingEmission` to its
  renderer), `fibLevels.ts` (the 0.236/0.382/0.5/0.618/0.786/1.0
  / 1.272 / 1.618 / 2.618 / 4.236 level array shared by all
  fib kinds), `bezier.ts` (quadratic + cubic curve helpers
  shared by `arc` / `curve` / `double-curve` / fib spirals).

### CLI / Docs (`packages/cli/` + `docs/`)

- `gen-docs.ts` extended to walk `packages/core/src/draw/draw.ts`
  JSDoc and write `docs/primitives/draw/<kind>.md` per template
  — 61 new pages. Per-kind docs source the `@anchors`,
  `@since`, `@example`, stability marker, and the inline
  conformance-scenario snippet.
- Each port task re-runs `pnpm docs:generate` and commits the
  diff. The Phase-2 `pnpm docs:check` gate continues to execute
  `@example` blocks against the runtime; Phase 3 examples
  compile through the same path.
- `docs/primitives/draw/index.md` index page lists every kind
  grouped by category (manual file, ~80 lines, committed in
  Task 21).

### Repo-level

- Per-package version bump to `0.3` in the closeout task.
- Each port task lands a changeset
  (`packages/core` minor for `STATEFUL_PRIMITIVES` +
  `DrawingKind` extension; `packages/adapter-kit` minor for
  validator + decoder extension; `packages/runtime` minor for
  new exports; `canvas2d-adapter` minor for new renderers;
  `packages/conformance` minor for new scenarios). Bench
  thresholds for the runtime emit path pinned against
  post-Phase-3 Apple-silicon runs.

## Architecture Decisions

| Decision | Rationale |
|---|---|
| **Category-aligned port tasks (mostly 1 task per category, two categories split)** | 14 port tasks total across 13 categories. Boxes/Shapes splits into A (rectangle / rotated-rectangle / triangle / polyline — straight-edged) and B (circle / ellipse / path / marker — curved-edge or single-anchor). Fibonacci splits into A (retracement / trendExtension / channel / timeZone / wedge — linear levels) and B (speedFan / speedArcs / spiral / circles / trendTime — radial / curve). Within a category the kinds share renderer scaffolding (the fib-level array, the bezier helpers, the harmonic-pattern leg projection), so a per-category spec amortises that boilerplate while staying under ~300 lines. |
| **Per-kind `Capabilities.drawings` granularity + category-group builders** | Mirrors Phase 2's `capabilities.allPhase2Plots()` shape. Per-kind precision lets a v1 chart adapter ship `capabilities.union(capabilities.allLineDrawings(), capabilities.fibRetracement())` without writing raw `new Set<DrawingKind>(...)` literals. The category groups (`allFibDrawings()`, `allElliottDrawings()`, …) are the canonical user-facing surface — most adapters declare one or two groups + an umbrella. |
| **5-bucket `DrawingCounts` carried forward unchanged** | The Phase-1 `{ lines, labels, boxes, polylines, other }` bag pins as-is. Every `DrawingKind` maps to exactly one bucket via the new `bucketFor()` helper exported by adapter-kit and pinned in Task 1. Lines/rays/horizontalLine/verticalLine/crossLine/trendAngle → `lines`; rectangle/rotatedRectangle/triangle/circle/ellipse/marker → `boxes`; path/polyline/curves/freehand/channels/pitchforks/patterns/elliott → `polylines`; text/arrow/arrowMarker/arrowMarkUp/arrowMarkDown → `labels`; fib-* / gann-* / cycles-* / containers → `other`. The mapping is exhaustive and tested in Task 1. |
| **Full-state emission on every `DrawingHandle.update`** | `op: "update"` carries the FULL merged `DrawingState`, not a patch. Adapters get an idempotent rewrite — simpler render path, robust against dropped messages, structured-clone safe through the worker + QuickJS membranes. Matches §10.3 ergonomics. The runtime tracks per-handle state in the slot store so `update` can construct the merged payload. |
| **`DrawingHandle` keyed by `slotId#subId`** | A script's `for (let i = 0; i < 10; i++) draw.text(...)` produces 10 stable handles, each keyed `<callsite>#0`, `<callsite>#1`, …, `<callsite>#9`. Cross-bar: same loop iteration → same handle id, so `update` works across bars. The sub-id is the call-order index within the callsite; the runtime resets the counter at the start of each bar. |
| **Kebab-case wire format, camelCase TS surface** | Script authors write `draw.horizontalLine(...)` / `draw.fibRetracement(...)` (camelCase, matches Pine + invinite); the wire format is kebab-case (`horizontal-line`, `fib-retracement`). The conversion is purely lexical and pinned in Task 1's `DRAWING_KINDS` array (each entry carries both forms). `decodeDrawing` normalises both directions. Don't drift on the convention — every test and scenario pins the kebab form. |
| **Variant-collapse cases pinned in Task 1** | Per §3.1: the 4 pitchfork tools (standard / schiff / modifiedSchiff / inside) collapse into one `pitchfork` kind with a `variant` discriminator; `ray` and `extendedLine` tools collapse into the `line` kind with `extendLeft` / `extendRight` flags (no separate `ray-tool` / `extended-line` kinds on the wire). The `cypher-pattern` kind has no standalone tool (it's a `defineDrawing`-only kind). These three collapses are the only ones — every other kind maps 1:1 to its invinite source. |
| **Per-kind inline-source conformance scenarios + 12 task bundles + 1 smoke test + 2 capability/budget companions** | One `*.scenario.ts` per kind (inline 6-12 line source) keeps a port's coverage local. 12 task-bundles cross-check the kind groups render together (one per port task — Curves+Freehand share a bundle in Task 8); `drawAll61` smokes all kinds together; `drawBudgetOverflow` + `drawUnsupportedKind` (Task 19) exercise the per-bucket budget + capability-gating paths. Scenario file count: 61 + 12 + 3 = 76. `examples/scripts/` stays at four files (the three Phase-1 demos + the new `fib-retracement.chart.ts` from Task 19). |
| **New `drawing-hash` `ScenarioAssertion`** | Mirrors `plot-hash`: SHA-256 over the JSON-stringified `[{ handleId, drawingKind, op, state, bar }, ...]` array in emission order. Filtered by `handleId` if supplied. The per-kind scenarios pin one hash; the category bundles pin one per kind in the bundle. Re-pinning workflow identical to `plot-hash` — copy `actual` from the failure message. The `drawing-hash` assertion is declared once in Task 3 and reused by every port task. |
| **Canvas2d renderers in `src/render/draw/<kind>.ts`** | One renderer per kind keeps each file small (~30-80 lines) and lets the existing `RenderCtx` test seam (the `MockCanvas2DContext`) cover them. Shared helpers (`worldToCanvas.ts`, `drawingDispatch.ts`, `fibLevels.ts`, `bezier.ts`) live alongside. Phase-1 plot renderers in `src/render/` stay where they are; `render/draw/` is a sibling. |
| **`drawing-budget-exceeded` per-bucket; full-emission semantics** | When a bucket overflows, every subsequent emission to that bucket drops with `drawing-budget-exceeded` until the script finishes. The bucket counter increments on `op: "create"`, decrements on `op: "remove"`, and is unchanged on `op: "update"`. The budget is the min of `defineIndicator.maxDrawings[bucket]` and `adapter.capabilities.maxDrawingsPerScript[bucket]` per §4.1. Pinned in Task 3. |
| **`defineDrawing` lands late (Task 20)** | The interactive-drawing constructor is the smallest deliverable that needs every kind to be emittable — testing its `DrawingHandle.update` flow against fewer than the full surface would be shallow. Landing it after all 61 kinds ship means its conformance scenarios can pick any kind and exercise the full update path. |
| **`fib-retracement.chart.ts` example script lands with Task 19, not the fib port** | The fib-retracement port (Task 11) ships its scenario via `inlineSource`. The curated 4th example script is a separate deliverable — it demonstrates a multi-emit "stage-an-impulse" script (retracement + extension + a hand-placed text label) and is what users see in `examples/scripts/`. Task 19 also lands the `drawAll61` smoke scenario. |
| **Numbering = execution order; no parallel waves** | Tasks 1–4 are foundations (core types → adapter-kit validators → runtime infra → canvas2d helpers); Tasks 5–18 port one category each in dependency order (lines first → boxes → curves → annotations → channels → fib → gann → pitchfork → patterns → elliott → cycles → containers); Tasks 19–22 close out (example script + comprehensive scenario; `defineDrawing` + interactive flow; gen-docs extension + index page; phase closeout with version bump + changeset). Each task's prerequisites are strictly lower-numbered. |

## Dependency Graph

```
Task 1 (core types: DrawingKind / DrawingState / WorldPoint + STATEFUL_PRIMITIVES + bucket map)
    |
    v
Task 2 (adapter-kit: validateEmission per-kind + decodeDrawing real impl + capability builders)
    |
    v
Task 3 (runtime: emit/draw/ infra — handle, pushDrawing, budget, dedup + drawing-hash assertion)
    |
    v
Task 4 (canvas2d shared draw helpers — worldToCanvas, drawingDispatch, fibLevels, bezier)
    |
    +-----> Task 5  (Lines/Rays — 6 kinds)
    |           |
    |           v
    +-----> Task 6  (Boxes A — rectangle / rotated-rectangle / triangle / polyline — 4 kinds)
    |           |
    |           v
    +-----> Task 7  (Boxes B — circle / ellipse / path / marker — 4 kinds)
    |           |
    |           v
    +-----> Task 8  (Curves + Freehand — arc / curve / double-curve / pen / highlighter / brush — 6 kinds)
    |           |
    |           v
    +-----> Task 9  (Annotations — text / arrow / arrow-marker / arrow-mark-up / arrow-mark-down — 5 kinds)
    |           |
    |           v
    +-----> Task 10 (Channels — trend-channel / flat-top-bottom / disjoint-channel / regression-trend — 4 kinds)
    |           |
    |           v
    +-----> Task 11 (Fibonacci A — retracement / trendExtension / channel / timeZone / wedge — 5 kinds)
    |           |
    |           v
    +-----> Task 12 (Fibonacci B — speedFan / speedArcs / spiral / circles / trendTime — 5 kinds)
    |           |
    |           v
    +-----> Task 13 (Gann — gannBox / gannSquareFixed / gannSquare / gannFan — 4 kinds)
    |           |
    |           v
    +-----> Task 14 (Pitchforks — pitchfork (4 variants) / pitchfan — 2 kinds)
    |           |
    |           v
    +-----> Task 15 (Patterns — xabcd / cypher / headAndShoulders / abcd / triangle / threeDrives — 6 kinds)
    |           |
    |           v
    +-----> Task 16 (Elliott — impulse / correction / triangle / doubleCombo / tripleCombo — 5 kinds)
    |           |
    |           v
    +-----> Task 17 (Cycles — cyclicLines / timeCycles / sineLine — 3 kinds)
    |           |
    |           v
    +-----> Task 18 (Containers — group / frame — 2 kinds)
                |
                v
Task 19 (fib-retracement.chart.ts example + drawAll61.scenario.ts smoke test)
    |
    v
Task 20 (defineDrawing constructor + interactive-tool conformance scenarios)
    |
    v
Task 21 (gen-docs.ts extension + docs/primitives/draw/<kind>.md + index page)
    |
    v
Task 22 (Phase 3 closeout — STATEFUL_PRIMITIVES verification + 0.3 version bump + changeset)
```

Each port task (Tasks 5–18) adds the matching renderers + per-kind
scenarios + auto-generated docs in the SAME PR per §22.10. After
Task 4 the four foundation surfaces (core types, adapter-kit
validators, runtime emit infra, canvas2d helpers) are stable; each
port task only consumes lower-numbered foundations.

Kind count by task: 6 + 4 + 4 + 6 + 5 + 4 + 5 + 5 + 4 + 2 + 6 + 5
+ 3 + 2 = **61** ✓.

## Task Summary

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|---|---|---|---|
| 1 | [Core types — `DrawingKind` / `DrawingState` / `WorldPoint` + `STATEFUL_PRIMITIVES` + bucket map](./1-core-types.md) | core | None | High |
| 2 | [Adapter-kit — per-kind `validateEmission` + real `decodeDrawing` + capability builders](./2-adapter-kit-validation.md) | adapter-kit | 1 | High |
| 3 | [Runtime — `emit/draw/` infra (handle, pushDrawing, budget, dedup) + `drawing-hash` assertion](./3-runtime-emit-infra.md) | runtime, conformance | 2 | High |
| 4 | [Canvas2d — shared draw helpers (worldToCanvas, drawingDispatch, fibLevels, bezier)](./4-canvas2d-helpers.md) | canvas2d-adapter | 3 | Medium |
| 5 | [Lines / Rays — `line` / `horizontalLine` / `horizontalRay` / `verticalLine` / `crossLine` / `trendAngle`](./5-lines-and-rays.md) | core, adapter-kit, runtime, canvas2d, conformance | 4 | Medium |
| 6 | [Boxes A — `rectangle` / `rotatedRectangle` / `triangle` / `polyline`](./6-boxes-a.md) | core, adapter-kit, runtime, canvas2d, conformance | 4 | Medium |
| 7 | [Boxes B — `circle` / `ellipse` / `path` / `marker`](./7-boxes-b.md) | core, adapter-kit, runtime, canvas2d, conformance | 4 | Medium |
| 8 | [Curves + Freehand — `arc` / `curve` / `doubleCurve` / `pen` / `highlighter` / `brush`](./8-curves-and-freehand.md) | core, adapter-kit, runtime, canvas2d, conformance | 4 | Medium |
| 9 | [Annotations — `text` / `arrow` / `arrowMarker` / `arrowMarkUp` / `arrowMarkDown`](./9-annotations.md) | core, adapter-kit, runtime, canvas2d, conformance | 4 | Medium |
| 10 | [Channels — `trendChannel` / `flatTopBottom` / `disjointChannel` / `regressionTrend`](./10-channels.md) | core, adapter-kit, runtime, canvas2d, conformance | 4 | Medium |
| 11 | [Fibonacci A — `fibRetracement` / `fibTrendExtension` / `fibChannel` / `fibTimeZone` / `fibWedge`](./11-fibonacci-a.md) | core, adapter-kit, runtime, canvas2d, conformance | 4 | Medium |
| 12 | [Fibonacci B — `fibSpeedFan` / `fibSpeedArcs` / `fibSpiral` / `fibCircles` / `fibTrendTime`](./12-fibonacci-b.md) | core, adapter-kit, runtime, canvas2d, conformance | 11 | Medium |
| 13 | [Gann — `gannBox` / `gannSquareFixed` / `gannSquare` / `gannFan`](./13-gann.md) | core, adapter-kit, runtime, canvas2d, conformance | 4 | Medium |
| 14 | [Pitchforks — `pitchfork` (4 variants) / `pitchfan`](./14-pitchforks.md) | core, adapter-kit, runtime, canvas2d, conformance | 4 | Medium |
| 15 | [Harmonic Patterns — `xabcdPattern` / `cypherPattern` / `headAndShoulders` / `abcdPattern` / `trianglePattern` / `threeDrivesPattern`](./15-patterns.md) | core, adapter-kit, runtime, canvas2d, conformance | 4 | High |
| 16 | [Elliott Waves — `elliottImpulseWave` / `elliottCorrectionWave` / `elliottTriangleWave` / `elliottDoubleCombo` / `elliottTripleCombo`](./16-elliott.md) | core, adapter-kit, runtime, canvas2d, conformance | 4 | High |
| 17 | [Cycles — `cyclicLines` / `timeCycles` / `sineLine`](./17-cycles.md) | core, adapter-kit, runtime, canvas2d, conformance | 4 | Medium |
| 18 | [Containers — `group` / `frame`](./18-containers.md) | core, adapter-kit, runtime, canvas2d, conformance | 5–17 | Medium |
| 19 | [`fib-retracement.chart.ts` example script + `drawAll61.scenario.ts` smoke test](./19-example-script-and-smoke.md) | examples, conformance | 5–18 | Low |
| 20 | [`defineDrawing` constructor + interactive-tool conformance scenarios](./20-define-drawing.md) | core, runtime, conformance | 5–18 | Medium |
| 21 | [gen-docs.ts extension + `docs/primitives/draw/<kind>.md` (61 pages) + index page](./21-docs-generation.md) | cli, docs | 5–18 | Medium |
| 22 | [Phase 3 closeout — `STATEFUL_PRIMITIVES` verification + `0.3` version bump + changeset](./22-phase-closeout.md) | core, adapter-kit, runtime, canvas2d, conformance, cli | 1–21 | Low |

## Code Reuse

Phase 3 reuses every Phase-1 and Phase-2 facility — the coverage /
lint / scaffold / docs / readme / conformance gates, the
`MutableRunnerEmissions` queue, `validateEmission`'s `walkMeta`
helper, the FNV-1a `hashStringStable` from `emit/hash.ts`, the
`ACTIVE_RUNTIME_CONTEXT` accessor, the canvas2d `RenderCtx` test
seam, and the `inlineSource` conformance pattern.

| Reuse | Source | Notes |
|---|---|---|
| `packages/runtime/src/emit/emissionsQueue.ts` `pushDiagnostic` | Phase 1 | Reused by `pushDrawing` for `unsupported-drawing-kind` and `drawing-budget-exceeded` diagnostics. |
| `packages/runtime/src/emit/hash.ts` `hashStringStable` (FNV-1a) | Phase 1 | Reused by the new `drawing-hash` `ScenarioAssertion` helper in Task 3 (canonical JSON-stringification → FNV1a for the slotId#subId derivation; SHA-256 for the assertion value mirrors `plot-hash`). |
| `packages/adapter-kit/src/validation/validateEmission.ts` `walkMeta` | Phase 1 | Reused as-is for the `DrawingState.style.*` field walks plus any `meta` payload a drawing kind carries (e.g. `text.body`, `marker.value`). |
| `packages/core/src/types.ts` `Time`, `Price`, `Color`, `LineStyle`, `JsonValue` | Phase 1 | The full coordinate + style alphabet. `WorldPoint` (Task 1) is `{ time: Time; price: Price }`; every `DrawingState` field is `JsonValue`-clean. |
| `packages/conformance/src/runConformanceSuite.ts` `Scenario.inlineSource` | Phase 2 | The per-kind scenarios (Tasks 5–18, 75 files total) use `inlineSource` exactly as Phase 2 ports did. `runConformanceSuite`'s `resolveSource` handles the path uniformly. |
| `packages/conformance/src/runConformanceSuite.ts` `evalAssertion` switch | Phase 1 | Task 3 adds a sixth `case "drawing-hash":` branch; the existing five cases remain unchanged. |
| `examples/canvas2d-adapter/src/render/coords.ts` | Phase 1 | The existing world→canvas projector pins x = `(time - timeLeft) / (timeRight - timeLeft) * width`. Task 4 extends this with `priceToY` (already implemented for plots) and adds the `worldPointToCanvas` helper used by every drawing renderer. |
| `examples/canvas2d-adapter/src/render/lineDash.ts` | Phase 1 | LineStyle → dash array. Reused by every drawing renderer that strokes with a `LineStyle`. |
| `examples/canvas2d-adapter/src/render/clear.ts` `RenderCtx` test seam | Phase 1 | Drawing renderers consume the same `RenderCtx` (the `MockCanvas2DContext` is reused under tests). |
| `packages/conformance/fixtures/goldenBars.json` (10 000-bar fixture) | Phase 1 | Every per-kind drawing scenario picks its anchor `(time, price)` from this fixture — `bars[0]`, `bars[500]`, `bars[1000]` are canonical anchors for the `inlineSource` examples. |
| `STATEFUL_PRIMITIVES` shape (`{ name; slot: boolean }`) | Phase 2 Task 5 | Pre-existing widening; the 61 new draw entries all carry `slot: true`. |
| Compiler `callsiteIdInjection` + `statefulCallInLoop` passes | Phase 1 | Consume `STATEFUL_PRIMITIVES` by name; no behaviour change needed, just the new entries from Task 1. |
| `scripts/scaffold.ts` | Phase 0 | No new packages in Phase 3 — no scaffold edits needed. |
| `scripts/docs-check.ts` | Phase 1 | Continues to execute `@example` blocks in JSDoc — every new `draw.*` `@example` runs through it. |
| `examples/scripts/{ema-cross,bollinger-bands,rsi-divergence-alert}.chart.ts` | Phase 1 | Untouched by Phase 3. Task 19 adds the fourth file (`fib-retracement.chart.ts`) alongside them. |

Phase-3-introduced reusable artefacts (consumed by Tasks 5–18 ports):

| New artefact | Location | Rationale |
|---|---|---|
| `packages/core/src/draw/drawingKind.ts` `DRAWING_KINDS` array + camelCase/kebab-case maps | Task 1 | Single source-of-truth for the 61 kebab-case wire names + camelCase TS surface. Every consumer (validator dispatch, decoder, renderer, gen-docs walk) iterates this array. |
| `packages/core/src/draw/drawingState.ts` `DrawingState` discriminated union | Task 1 | One typed variant per kind. Consumed by adapter-kit decoder, runtime handle merge, canvas2d renderer dispatch. |
| `packages/adapter-kit/src/validation/decodeDrawing.ts` real impl | Task 2 | Switch over `e.drawingKind` returning the typed `DrawingState`. Consumed by every adapter that wants typed access to drawing payloads. |
| `packages/adapter-kit/src/bucketFor.ts` `bucketFor(kind): keyof DrawingCounts` | Task 1 + 2 (declared in core, re-exported from adapter-kit) | Canonical kind → bucket map. Consumed by the runtime budget enforcer + by adapters that pre-budget. |
| `packages/adapter-kit/src/capabilities/capabilities.ts` per-kind + category-group builders + `allPhase3Drawings()` | Task 2 | Mirrors `allPhase2Plots()`. Consumed by every adapter declaration. |
| `packages/runtime/src/emit/draw/handle.ts` `DrawingHandle` impl + slot store | Task 3 | Stable cross-bar handle keyed by `slotId#subId`. Consumed by every per-kind emit function (Tasks 5–18). |
| `packages/runtime/src/emit/draw/pushDrawing.ts` budget + dedup helper | Task 3 | Per-bucket `drawing-budget-exceeded`, per-kind `unsupported-drawing-kind`, last-write-wins on `(handleId, op)` per bar. Consumed by every per-kind emit function. |
| `packages/conformance/src/runConformanceSuite.ts` `drawing-hash` `ScenarioAssertion` | Task 3 | Sixth assertion variant. Pinning workflow identical to `plot-hash`. Consumed by every per-kind + category-bundle scenario. |
| `examples/canvas2d-adapter/src/render/draw/worldToCanvas.ts` | Task 4 | World `(time, price)` → canvas `(x, y)` projection. Consumed by every drawing renderer. |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Task 4 | Routes a `DrawingEmission` to its renderer based on `drawingKind`. Single switch over the 61-entry `DRAWING_KINDS` array. |
| `examples/canvas2d-adapter/src/render/draw/fibLevels.ts` | Task 4 | The canonical fib-level ratios array (0.236 / 0.382 / 0.5 / 0.618 / 0.786 / 1.0 / 1.272 / 1.618 / 2.618 / 4.236). Consumed by every fib renderer in Tasks 11–12. |
| `examples/canvas2d-adapter/src/render/draw/bezier.ts` | Task 4 | Quadratic + cubic Bezier helpers. Consumed by `arc` / `curve` / `doubleCurve` (Task 8), `fibSpiral` (Task 12), and pattern-leg projections (Task 15). |

## Provenance

All anchor semantics + edit-handle behaviour trace to `../invinite/`
at commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`:

- `../invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts` —
  schema source-of-truth (61 drawing TypeScript types). Each
  Phase-3 port task lifts the per-kind `DrawingState` variant from
  here; collab-only fields (Yjs `id`, `layerId`, `createdAt`,
  `authorId`, `parentGroupId`, `parentFrameId`,
  `visibleIntervals`) are stripped per §10.4.
- `../invinite/src/components/trading-chart/tools/<name>-tool.ts`
  — behavior source-of-truth (anchor count, anchor semantics,
  hit-test rules, snap-to-OHLC behavior). Each port task lifts
  parameter shapes + anchor tuple shapes from here.
- `../invinite/src/components/trading-chart/CLAUDE.md` —
  coordinate-frame contract: world `(time, price)` is the only
  persisted frame; CSS-pixel / device-pixel projections live in
  the adapter.

Each ported `<kind>.ts` (and its renderer / scenario) carries the
4-line CONTRIBUTING §4 provenance + relicense header, mirroring the
Phase-2 convention pinned in
`packages/runtime/src/ta/CLAUDE.md`:

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchors + state shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite),
// behavior from
//   invinite/src/components/trading-chart/tools/<name>-tool.ts.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the shape is the reference, the code style
// is not.
```

Kinds without a single-file invinite source (the four pitchfork
variants collapse to one kind; `ray` / `extendedLine` collapse into
`line`; `cypherPattern` has no standalone tool) cite the multi-file
provenance in their header — see the per-task spec for the exact
file list per kind.

## Deferred / Follow-Up Work

Anything tagged Phase 4+ in PLAN.md §19 stays out of scope. Items
consciously **not** in Phase 3 (with §19 references):

- **`draw.table` + `DrawingKind = "table"` (Phase 5 / §10.2).**
  Tables are status panels that position in CSS-pixel viewport
  coordinates (not world space) and need the `TableCell` row/col
  schema. Deferred with the rest of the Tier-2 ergonomic surface.
  The 61-kind count in this phase excludes `table`.
- **Editor language-service surfaces for `draw.*` (Phase 4 /
  §14).** Hover docs / completions for every drawing kind land
  when the editor lands. Phase-3 JSDoc is structured (`@anchors`,
  `@since`, `@example`, stability marker) so the language service
  can consume it without rework.
- **Anchored drawings driven by `input.time({ pickFromChart: true })`
  (Phase 4 / §10.1.1).** `anchoredVwap` / `anchoredVolumeProfile`
  / `fixedRangeVolumeProfile` are anchored *indicators*, not
  drawings, and live in the `ta.*` namespace — they shipped in
  Phase 2 (`ta.anchoredVwap`) or defer to Phase 5 (volume-profile
  family). Drawing kinds that script-authors anchor manually (fib
  retracement, harmonic patterns) take world points as direct
  arguments in Phase 3 and need no input plumbing.
- **`defineDrawing` UI integration (Phase 4 / §14).** Phase 3
  ships the constructor + the interactive-update flow at the
  runtime level (Task 20) but the editor surface for
  user-pickable anchors lands in Phase 4. Phase-3 scripts wire
  fixed anchors directly.
- **Drawing kinds that require viewport/session/anchor input
  plumbing (Phase 5 / §10.1.1).** None of the 61 Phase-3 kinds
  need this — the volume-profile family is the only such surface
  and lives in `ta.*`.
- **Sandbox-escape coverage for the new draw surface in
  `host-quickjs` (Phase 5).** `host-quickjs` is deferred; once
  it ships, its sandbox-escape suite extends to cover `draw.*`
  emissions per §16.3.
- **VitePress build (`pnpm docs:build`).** Phase 3 generates
  `docs/primitives/draw/<kind>.md` markdown but does not stand
  up the vitepress config or theme. That lands in Phase 4
  alongside the editor.
- **Lower-timeframe + multi-timeframe drawing emissions (Phase
  4–5).** Drawings emitted from `request.security` callbacks
  defer to those phases.

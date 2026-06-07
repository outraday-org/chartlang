---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-conformance": minor
---

Phase 3 Task 20 — `defineDrawing` constructor + interactive-tool
conformance scenarios.

- **core** — new `defineDrawing(opts)` constructor + `DefineDrawingOpts`
  type. Mirrors `defineIndicator` structurally; the only differences are
  `manifest.kind === "drawing"` and `manifest.capabilities ===
  ["drawings"]`. The runtime treats indicator and drawing scripts
  identically at the per-bar level — the discriminator is a host-side
  hint the editor uses to distinguish drawing scripts in the
  script-picker UI (PLAN.md §4.1). The constructor accepts the same
  Phase-3 `maxDrawings?: DrawingCounts` per-bucket cap propagation as
  `defineIndicator`.
- **compiler** — `analysis/structuralChecks.ts` widens its recognised
  constructor set to include `defineDrawing` and maps it to
  `manifest.kind === "drawing"`. `StructuralCheckResult.kind` widens
  to `"indicator" | "drawing" | "alert"` (matches `buildManifest`'s
  existing type). The in-memory ambient `.d.ts` shim in `program.ts`
  declares `DefineDrawingOpts` + `defineDrawing` so a `defineDrawing`
  script type-checks under the host-machine-independent program.
  `extractCapabilities` now takes a `kind` parameter and seeds with
  `"drawings"` (or `"alerts"`) when the script is a `defineDrawing`
  (or `defineAlert`) — previously every script unconditionally
  declared `"indicators"`. Error messages on
  `missing-default-export` / `api-version-mismatch` now mention all
  three constructor names.
- **conformance** — three new bundled scenarios, all default-exporting
  through `defineDrawing`:
  - `DEFINE_DRAWING_BASIC_SCENARIO` — single `draw.fibRetracement(...)`
    emission on bar 0 through the new constructor. Verifies the
    constructor + compiler structural-check + capability extraction
    + runtime emit path end-to-end. Pinned `drawing-hash`:
    `eae59a6d44c41ef3b08b20728a9ee723bf0a0cd62e1107c9ab19aa4efa27b488`.
  - `DRAW_INTERACTIVE_UPDATE_SCENARIO` — captures the
    `draw.horizontalLine(bar.close)` handle in module-level state
    on bar 0, then calls `handle.update({ price: bar.close })` on
    every subsequent bar across the 10 000-bar goldenBars stream.
    Pins handle-id stability + the full emission sequence (1
    `create` + 9 999 `update`s). Pinned `drawing-hash`:
    `797d159809da91f43fc32149998da9e5d71b011134564d42c3e5da2027c22e6f`.
  - `DRAW_HANDLE_REMOVE_SCENARIO` — creates a `draw.text(...)` on
    bar 0, calls `handle.remove()` on bar 100 (= time
    `1_708_640_000_000`; goldenBars are 1-day intervals). Pinned
    `drawing-hash` captures both the `op: "create"` and
    `op: "remove"` emissions; `drawing-budget-exceeded` absent.
    Pinned `drawing-hash`:
    `b742d39fe5d03cb211b57bc26f0d24a89f9db966c481279368cc083932394a09`.

  Scenario cardinality after Task 20: **61 per-kind + 12 task-bundles
  + 3 (smoke + budget + capability) + 3 (Task-20 constructor) = 79**,
  of which 78 are in `ALL_SCENARIOS` (the Task-19
  `DRAW_UNSUPPORTED_KIND_SCENARIO` remains opt-in only).

### Divergences from spec (`tasks/phase-3-drawing-parity/20-define-drawing.md`)

1. **Spec § Requirements §1 sketches a `compute` shape and a separate
   `onCreate(ctx, anchors)` / `onUpdate(handle, ctx, anchors)`
   callback pair.** Per the team-lead brief + the spec's own example
   (lines 53–58, which uses `compute`), Phase 3 ships the
   `compute`-based shape only. The `onCreate`/`onUpdate` interactive-
   editor callbacks are Phase 4 sugar layered on top of the
   constructor (PLAN.md §10.1.1).
2. **Spec § Requirements §4.2 asks for a new `manifest-kind`
   `ScenarioAssertion` variant.** Deferred — adding a new assertion
   variant is a runner-API change out of scope here. The
   `manifest.kind === "drawing"` contract is covered by unit tests:
   `defineDrawing.test.ts` (constructor side), `manifest.test.ts`
   (compiler-builder side), `structuralChecks.test.ts` (AST-walk
   side), and `compile.test.ts` (end-to-end compile of a
   `defineDrawing` script). Flag as a Phase-4 follow-up if
   downstream adapter authors accumulate similar capability/manifest
   assertions.
3. **Spec § Files lists `defineDrawing.types.test.ts`.** Not created.
   The sibling `defineIndicator.ts` / `defineAlert.ts` don't have
   `.types.test.ts` files; the typings are covered through the
   runtime tests' `script.manifest.kind` access.
4. **Spec § Requirements §6 mentions a "manifest extractor test in
   compiler package".** Covered by widening
   `structuralChecks.test.ts` (which captures `kind` from the
   AST) + extending `manifest.test.ts` + adding the `compile.test.ts`
   end-to-end row. No new file needed.
5. **`extractCapabilities` widening was not in the original task
   list** — but is required so a `defineDrawing` script emits
   `capabilities: ["drawings"]` instead of `["indicators"]`. The
   change is backwards-compatible (the new `kind` parameter
   defaults to `"indicator"`) and pinned with new test rows.

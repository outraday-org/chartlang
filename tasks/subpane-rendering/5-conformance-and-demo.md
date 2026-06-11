# Task 5 — Conformance scenario + React demo

> **Status: TODO**

## Goal

Pin the new pane-routing contract with a conformance scenario, lift
the existing carve-out in `packages/conformance/CLAUDE.md`, and add
a demo script to `examples/react-demo/` that exercises explicit
per-call `pane` routing. The two existing RSI demo scripts already
declare `overlay: false` and need no edits — they should render in
a subpane automatically once Tasks 1-4 land.

## Prerequisites

Task 4 (canvas2d adapter renders pane-routed emissions end-to-end).

## Current Behavior

- `packages/conformance/src/scenarios/index.ts` re-exports a
  Phase-1+2 scenario list (`PHASE_1_SCENARIOS`); no subpane
  scenario exists.
- `packages/conformance/CLAUDE.md` documents the carve-out: "The
  `unsupported-pane` diagnostic is NOT asserted on the RSI-
  divergence scenario." A synthetic explicit-`pane: "new"` test in
  `runConformanceSuite.test.ts` exercises the diagnostic path
  against an `subPanes: 0` adapter only.
- `examples/react-demo/src/scripts.ts` lists four demo scripts;
  none use an explicit `pane` opt.

## Desired Behavior

- `packages/conformance/src/scenarios/rsiSubpaneRouting.scenario.ts`
  is a new inline-source scenario. The script declares `overlay:
  false`, plots `ta.rsi(close, 14)`, and emits two hlines at 30 /
  70. Assertions:
  - Every `PlotEmission.pane` field equals the script's resolved
    default pane key (`"script:rsi-subpane-routing"` after the
    sanitiser).
  - No `unsupported-pane` diagnostic is emitted (the adapter
    declares `subPanes >= 1`).
  - All emissions (plots + hlines) carry the same pane key.
- `PHASE_1_SCENARIOS` includes the new scenario.
- `packages/conformance/CLAUDE.md` is rewritten — the carve-out
  paragraph documents the post-Task-2 contract.
- `examples/react-demo/src/scripts.ts` gains one new demo entry
  (`explicit-pane-routing`) with `overlay: true` that emits a plot
  to the price pane + a plot to an explicit named subpane. The
  existing `rsi-divergence-alert` and `smoothed-rsi-cross` entries
  are untouched (their `overlay: false` flag now actually routes).

## Requirements

### 1. `packages/conformance/src/scenarios/rsiSubpaneRouting.scenario.ts` — new file

Follow the Phase-2 inline-source pattern (see e.g.
`taWma.scenario.ts` for the canonical shape):

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `
import { defineIndicator, plot, hline, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "rsi-subpane-routing",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline }) {
        const rsi = ta.rsi(bar.close, 14);
        plot(rsi, { title: "RSI(14)" });
        hline(70, { title: "Overbought" });
        hline(30, { title: "Oversold" });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = [
    {
        kind: "all-plots-on-pane",
        pane: "script:rsi-subpane-routing",
    },
    {
        kind: "diagnostic-code-absent",
        code: "unsupported-pane",
    },
];

export const RSI_SUBPANE_ROUTING_SCENARIO: Scenario = Object.freeze({
    id: "rsi-subpane-routing",
    inlineSource: INLINE_SOURCE,
    sourcePath: "<inline:rsi-subpane-routing>.chart.ts",
    barCount: 200,
    assertions: ASSERTIONS,
});
```

**Two new `ScenarioAssertion` variants** likely don't exist yet —
look up the existing shape in `runConformanceSuite.ts` (search for
`type ScenarioAssertion`). Add `"all-plots-on-pane"` (asserts that
every accumulated `PlotEmission.pane` equals the given string) and
`"diagnostic-code-absent"` (asserts the absence of a given
diagnostic code) if missing. If the existing shape already supports
generic "all emissions match this predicate" via a function, use it
and skip the new variants.

### 2. `packages/conformance/src/runConformanceSuite.ts` — assertion handlers

If new variants were added in step 1, extend the dispatch in
`runConformanceSuite.ts` (the switch / handler that turns each
`ScenarioAssertion` into a pass/fail check). Each new variant gets
a `case "..."` block, the runner walks the accumulated emissions,
and on failure reports `expected` vs `actual` per the existing
re-pin workflow (see `packages/conformance/CLAUDE.md`).

### 3. `packages/conformance/src/scenarios/index.ts` — register

Import `RSI_SUBPANE_ROUTING_SCENARIO` and append it to the
`PHASE_1_SCENARIOS` frozen array. Keep alphabetical order (or
match whichever order the file already uses for newly-added
scenarios).

### 4. `packages/conformance/src/scenarios/rsiSubpaneRouting.scenario.test.ts` — sanity unit

A scenario file is not a test by itself; mirror the per-scenario
sanity unit (any of `taWma.scenario.test.ts` / similar) that
imports the scenario constant, asserts `assertions.length > 0`,
asserts `inlineSource` is non-empty, and asserts the
`sourcePath` literal matches the inline convention.

### 5. `packages/conformance/CLAUDE.md` — lift the carve-out

Locate the paragraph:

> **The `unsupported-pane` diagnostic is NOT asserted on the RSI-
> divergence scenario.** Phase 1's `paneResolver` only emits the
> diagnostic when a `plot(..., { pane: "new" })` call explicitly
> requests a non-overlay pane; …

Replace with:

> **Pane routing is exercised by the `rsi-subpane-routing`
> scenario.** Scripts declaring `defineIndicator({ overlay: false })`
> emit on the script-level default pane key (`script:<sanitised-
> name>`); the scenario asserts every `PlotEmission.pane` equals
> that key and **no** `unsupported-pane` diagnostic is pushed.
> Adapters declaring `subPanes: 0` see the `unsupported-pane`
> warning + the overlay fold (exercised by
> `runConformanceSuite.test.ts` against a synthetic capability bag).

Keep the file at its existing length budget.

### 6. `packages/conformance/src/runConformanceSuite.test.ts` — adjust synthetic check

The existing synthetic `pane: "new"` check against `subPanes: 0`
stays valid (the fallback path is preserved by Task 2). If the
test was wired against the old fold-to-overlay path for `subPanes
>= 1`, lift that assertion — the diagnostic is no longer pushed
when capability permits the pane.

### 7. `examples/react-demo/src/scripts.ts` — new demo entry

Append after `SMOOTHED_RSI_CROSS`:

```ts
const EXPLICIT_PANE_ROUTING = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Explicit Pane Routing",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // Overlay (price) pane: an EMA(20) overlaid on the candles.
        plot(ta.ema(bar.close, 20), {
            color: "#26a69a",
            title: "EMA(20)",
        });
        // Explicit subpane: RSI(14) on its own y-scale.
        plot(ta.rsi(bar.close, 14), {
            color: "#9c27b0",
            title: "RSI(14)",
            pane: "rsi",
        });
    },
});
`;

export const DEMO_SCRIPTS: ReadonlyArray<DemoScript> = [
    { id: "ema-cross", label: "EMA Cross", source: EMA_CROSS },
    { id: "bollinger-bands", label: "Bollinger Bands", source: BOLLINGER_BANDS },
    { id: "rsi-divergence-alert", label: "RSI Divergence Alert", source: RSI_DIVERGENCE_ALERT },
    { id: "smoothed-rsi-cross", label: "Smoothed RSI Cross", source: SMOOTHED_RSI_CROSS },
    { id: "explicit-pane-routing", label: "Explicit Pane Routing", source: EXPLICIT_PANE_ROUTING },
];
```

### 8. `examples/react-demo/src/scripts.test.ts` (if present)

If the demo carries a test that walks `DEMO_SCRIPTS` and verifies
each compiles, the new entry is exercised automatically. Otherwise
no new test is required — the demo is not a published package.

### 9. README touch-ups

- `examples/react-demo/README.md` — if the file lists demo scripts
  by name, append the new entry. Otherwise skip.
- Root `README.md` — if it features the demo, no edit needed
  unless the screenshots are stale. Defer screenshot refresh.

### Edge cases

- **Scenario script name → pane key sanitiser** — `"rsi-subpane-
  routing"` has no special characters, so the resolved key is
  `"script:rsi-subpane-routing"`. The assertion in step 1 pins
  that literal; if Task 2's sanitiser collapses spaces / colons
  differently, update the assertion.
- **Bar count** — 200 bars is enough for RSI(14) to fully warm
  (warmup = 14). Smaller counts (e.g. 30) would leave too many
  warmup NaNs on the pinned hashes.
- **Sandbox boundary** — none touched; the scenario goes through
  the standard `runConformanceSuite` path which loads via
  `file://` tmp file per the conformance CLAUDE.md invariant.
- **JSDoc gate** — the new scenario file has no exported types,
  only the frozen `Scenario` constant; the JSDoc gate enforces
  the `@since` / `@stable` / `@example` on the constant. Mirror
  the Phase-2 scenarios' header comment.
- **§16.3 test layers** — the scenario itself is a fixture, not a
  primitive, so the §22.10 set does not apply. The sanity unit in
  step 4 is the only test layer required.
- **Coverage gate** — the new scenario adds branches inside
  `runConformanceSuite.ts` only if new `ScenarioAssertion`
  variants were added; those branches need direct unit tests in
  `runConformanceSuite.test.ts`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/scenarios/rsiSubpaneRouting.scenario.ts` | Create | Inline-source RSI subpane scenario |
| `packages/conformance/src/scenarios/rsiSubpaneRouting.scenario.test.ts` | Create | Per-scenario sanity unit |
| `packages/conformance/src/scenarios/index.ts` | Modify | Register the new scenario in `PHASE_1_SCENARIOS` |
| `packages/conformance/src/runConformanceSuite.ts` | Modify (if needed) | New assertion variants + dispatch |
| `packages/conformance/src/runConformanceSuite.test.ts` | Modify | Cover new assertion handlers; adjust synthetic subPanes path |
| `packages/conformance/CLAUDE.md` | Modify | Rewrite the carve-out paragraph |
| `examples/react-demo/src/scripts.ts` | Modify | Append `explicit-pane-routing` demo entry |
| `examples/react-demo/README.md` | Modify (if applicable) | List the new demo entry |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-conformance test` (coverage 100%)
- `pnpm conformance` — must include the new scenario and pass.
- `pnpm docs:check`
- `pnpm readme:check` (if README files changed)

## Changeset

`.changeset/subpane-4-conformance-demo.md` —
`@invinite-org/chartlang-conformance` gets a `minor` bump (new
scenario + possibly new assertion variants). The React demo and
adapter packages are private; include unscoped entries for the
changelog stream only.

## Acceptance Criteria

- `RSI_SUBPANE_ROUTING_SCENARIO` is registered in `PHASE_1_SCENARIOS`.
- `pnpm conformance` runs the scenario through the canvas2d
  reference adapter and passes — every plot emits on the
  `"script:rsi-subpane-routing"` pane key; no `unsupported-pane`
  diagnostic.
- The carve-out in `packages/conformance/CLAUDE.md` is rewritten.
- `examples/react-demo/src/scripts.ts` carries the new
  `explicit-pane-routing` entry; running the demo and selecting it
  renders the EMA on the price pane and RSI in a subpane.
- The existing `rsi-divergence-alert` and `smoothed-rsi-cross`
  demo scripts now render in a subpane (visual smoke — confirmed
  by running the React demo locally).
- Coverage stays at 100% on `conformance`.
- `pnpm docs:check` / `pnpm readme:check` green.
- Changeset committed; semver bump `minor`.

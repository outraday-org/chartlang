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

- `packages/conformance/src/scenarios/index.ts:478` exports a frozen
  `ALL_SCENARIOS` array (the registry name in the file; PLAN.md /
  README colloquially calls it the "Phase-1+2 scenario list"). No
  subpane scenario is included.
- `packages/conformance/src/runConformanceSuite.ts:206-232` declares
  `ScenarioAssertion`. `diagnostic-code-absent` and
  `diagnostic-code-present` **already exist** — no new variant
  needed for the absence case. The currently-shipped variants are
  `plot-hash`, `plot-field`, `alert-count`,
  `alert-message-contains`, `log-emission-count`,
  `diagnostic-code-absent`, `diagnostic-code-present`,
  `alert-condition-fired-at-bar`, `drawing-hash`.
- `runConformanceSuite.test.ts` exercises the synthetic
  `pane: "new"` + `subPanes: 0` path via
  `diagnostic-code-present: "unsupported-pane"`.
- `packages/conformance/CLAUDE.md` documents the carve-out: "The
  `unsupported-pane` diagnostic is NOT asserted on the RSI-
  divergence scenario."
- `examples/react-demo/src/scripts.ts:162-168` exports five demo
  scripts (`ema-cross`, `bollinger-bands`, `rsi-divergence-alert`,
  `smoothed-rsi-cross`, `trend-composition`). The two RSI scripts
  carry `overlay: false` (lines 69 and 95 of the same file) but the
  flag is currently dropped by `defineIndicator` (Task 1 fixes this).
- `examples/react-demo/src/scripts.test.ts` does **not** exist.
- `examples/react-demo/README.md` exists but lists components
  (editor, server, esbuild, chart) — it does NOT list demo scripts
  by name, so no edit is required.
- The `Scenario` type (`packages/conformance/src/runConformanceSuite.ts:68-116`)
  has **no `barCount` field and no `sourcePath` field**. Required
  field is `intervalCount: number`; optional `candleLimit?: number`
  overrides the default 10 000-bar fixture length. The inline
  `sourcePath` is auto-derived as `<inline:${scenario.id}>.chart.ts`
  by the runner (per `packages/conformance/CLAUDE.md` Phase-2
  invariant).

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
- `ALL_SCENARIOS` (the registry array) includes the new scenario.
- `packages/conformance/CLAUDE.md` is rewritten — the carve-out
  paragraph documents the post-Task-2 contract.
- `examples/react-demo/src/scripts.ts` gains one new demo entry
  (`explicit-pane-routing`) with `overlay: true` that emits a plot
  to the price pane + a plot to an explicit named subpane. The
  existing `rsi-divergence-alert` and `smoothed-rsi-cross` entries
  are untouched (their `overlay: false` flag now actually routes).

## Requirements

### 1. `packages/conformance/src/scenarios/rsiSubpaneRouting.scenario.ts` — new file

Follow the Phase-2 inline-source pattern in `taWma.scenario.ts`
exactly. The `Scenario` type has no `barCount` or `sourcePath`
field — the runner auto-derives `sourcePath` as
`<inline:${scenario.id}>.chart.ts`, and bar count defaults to the
10 000-bar `goldenBars.json` fixture (use `candleLimit` to trim if
needed — not required here since RSI(14) is well-warmed by the
default fixture):

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, plot, hline, ta } from "@invinite-org/chartlang-core";
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

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "all-plots-on-pane", pane: "script:rsi-subpane-routing" },
    { kind: "diagnostic-code-absent", code: "unsupported-pane" },
]);

/**
 * RSI(14) on a script-level subpane. Pins the post-Task-2 contract:
 * `defineIndicator({ overlay: false })` routes every plot + hline
 * to `script:<sanitised-name>`, and adapters with `subPanes >= 1`
 * (canvas2d declares unlimited) do not push `unsupported-pane`.
 *
 * @since 0.9
 * @stable
 * @example
 *     import { RSI_SUBPANE_ROUTING_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void RSI_SUBPANE_ROUTING_SCENARIO;
 */
export const RSI_SUBPANE_ROUTING_SCENARIO: Scenario = Object.freeze({
    id: "rsi-subpane-routing",
    title: "RSI(14) routed to script-level subpane",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
```

**`diagnostic-code-absent` already exists** as a `ScenarioAssertion`
variant in `runConformanceSuite.ts:218` — no new variant required
for that case.

**`all-plots-on-pane` is genuinely new.** Add it as a new
`ScenarioAssertion` variant in step 2; the runner dispatcher gains
one new `case "all-plots-on-pane"` block.

The `ASSERTIONS` const is declared above the `Scenario` literal per
`packages/conformance/CLAUDE.md` ("`assertions: ReadonlyArray<
ScenarioAssertion>` is declared ABOVE each `Scenario` literal, not
inlined") — keep that pattern.

### 2. `packages/conformance/src/runConformanceSuite.ts` — assertion handler

Add a single new `ScenarioAssertion` variant + dispatch case.

(a) Type — extend the union (lines 206-232):

```ts
| { readonly kind: "all-plots-on-pane"; readonly pane: string }
```

Update the `ScenarioAssertion`-level JSDoc (lines 171-205) to
mention the new variant.

(b) Dispatch — extend the switch in `runScenarioAssertion` (the
function at lines 417-530+ that turns each `ScenarioAssertion` into
a pass/fail check). Add:

```ts
case "all-plots-on-pane": {
    const wrong = emissions.plots.filter((p) => p.pane !== assertion.pane);
    if (wrong.length === 0) return null; // pass
    return {
        scenarioId: scenario.id,
        assertionKind: "all-plots-on-pane",
        message: `all-plots-on-pane: expected every plot.pane === "${assertion.pane}", got ${wrong.length} divergent (first divergent slotId=${wrong[0].slotId}, pane="${wrong[0].pane}")`,
    };
}
```

On failure the message must carry both expected and actual per the
`packages/conformance/CLAUDE.md` re-pin invariant.

### 3. `packages/conformance/src/scenarios/index.ts` — register

Import `RSI_SUBPANE_ROUTING_SCENARIO` and append it to the
`ALL_SCENARIOS` frozen array (line 478 of the file). Re-export the
scenario constant at the top of the file matching the existing
`export { TA_WMA_SCENARIO } from "./taWma.scenario.js";` pattern.
Place the new entry near the end of the array (the file already
appends new scenarios in chronological landing order; alphabetical
order is **not** enforced).

### 4. `packages/conformance/src/scenarios/rsiSubpaneRouting.scenario.test.ts` — sanity unit

A scenario file is not a test by itself; mirror the per-scenario
sanity unit pattern (the three existing `*.scenario.test.ts` files
in `packages/conformance/src/scenarios/`) which import the scenario
constant, run it through `runConformanceSuite` against the canvas2d
default adapter export, and assert `report.failures === []` /
`report.passed === true`. Drop any expectations on a `sourcePath`
field — that field does not exist on `Scenario`.

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

Append after `SMOOTHED_RSI_CROSS` (the current source string
constants end before line 162). Add the new `DemoScript` entry to
the `DEMO_SCRIPTS` array (currently at lines 162-168, with five
entries: `ema-cross`, `bollinger-bands`, `rsi-divergence-alert`,
`smoothed-rsi-cross`, `trend-composition`). Place the new entry
between `smoothed-rsi-cross` and `trend-composition` so the
RSI / pane-routing demos are visually grouped:

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
    { id: "trend-composition", label: "Trend Composition", source: TREND_COMPOSITION },
];
```

### 8. `examples/react-demo/src/scripts.test.ts`

The file does **not** exist. The demo is not a published package and
carries no test surface; do not add one.

### 9. README touch-ups

- `examples/react-demo/README.md` — the file does not list demo
  scripts by name (it lists functional components: editor, server,
  esbuild, chart). No edit required.
- Root `README.md` — if it features the demo, no edit needed
  unless the screenshots are stale. Defer screenshot refresh.

### Edge cases

- **Scenario script name → pane key sanitiser** — `"rsi-subpane-
  routing"` has no special characters, so the resolved key is
  `"script:rsi-subpane-routing"`. The assertion in step 1 pins
  that literal; if Task 2's sanitiser collapses spaces / colons
  differently, update the assertion.
- **Bar count** — the runner defaults to the 10 000-bar
  `goldenBars.json` fixture, which is more than enough for RSI(14)
  to fully warm (warmup = 14). `candleLimit` could trim if a
  smaller fixture were desired; not needed here.
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
  `runConformanceSuite.ts` via the `all-plots-on-pane` dispatch
  case; that case needs direct unit coverage in
  `runConformanceSuite.test.ts` (both the all-match pass path and
  the divergent-emission fail path).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/scenarios/rsiSubpaneRouting.scenario.ts` | Create | Inline-source RSI subpane scenario |
| `packages/conformance/src/scenarios/rsiSubpaneRouting.scenario.test.ts` | Create | Per-scenario sanity unit |
| `packages/conformance/src/scenarios/index.ts` | Modify | Register + re-export the new scenario; append to `ALL_SCENARIOS` |
| `packages/conformance/src/runConformanceSuite.ts` | Modify | Add `all-plots-on-pane` variant + dispatch case |
| `packages/conformance/src/runConformanceSuite.test.ts` | Modify | Cover `all-plots-on-pane` pass + fail paths |
| `packages/conformance/CLAUDE.md` | Modify | Rewrite the carve-out paragraph |
| `examples/react-demo/src/scripts.ts` | Modify | Append `explicit-pane-routing` demo entry between `smoothed-rsi-cross` and `trend-composition` |

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

- `RSI_SUBPANE_ROUTING_SCENARIO` is registered in `ALL_SCENARIOS`.
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

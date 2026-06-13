# Task 16 — Conformance scenarios: state / barstate / syminfo / timeframe / inputs / request.security

> **Status: TODO**

## Goal

Add eight conformance scenarios covering every Phase-4 runtime
surface. All use the `inlineSource` pattern established in Phase 2
+ 3 (small synthetic `defineIndicator` body inlined in the
scenario file). Assertions reuse the existing 5 variants —
`plot-hash`, `drawing-hash`, `alert-count`,
`diagnostic-code-present`, `diagnostic-code-absent`. No new
`ScenarioAssertion` variant required.

## Prerequisites

- Task 15 (editor + inputs UI shipped — completes the Phase-4
  user-facing surface).

## Current Behavior

- `packages/conformance/src/scenarios/` ships every Phase-2 +
  Phase-3 scenario.
- No Phase-4 scenarios.

## Desired Behavior

Eight new scenarios, each ≤ 80 lines:

1. **`stateSessionHigh.scenario.ts`** — `state.float(NaN)` slot
   tracks session high; verify cold/warm byte-equivalent plot
   hashes; verify per-bar advances.
2. **`stateTickCounter.scenario.ts`** — `state.tick.int(0)` ++
   on every tick; verify final counter value after N ticks.
3. **`barstateConfirmed.scenario.ts`** — script that alerts only
   when `barstate.isconfirmed`; verify alert-count matches
   expected; verify no alerts on tick-only events.
4. **`syminfoMintick.scenario.ts`** — script that plots a value
   snapped to `syminfo.mintick`; verify the plot hash matches an
   expected value (using canvas2d's `mintick: 0.01`).
5. **`timeframeIsdaily.scenario.ts`** — script that plots only on
   `timeframe.isdaily`; verify plot-hash on a `1D` candle fixture
   and `diagnostic-code-absent: unsupported-interval`.
6. **`inputInterval.scenario.ts`** — script declares
   `input.interval("1D")`; verify `manifest.userPickableInterval
   === true` and the resolved `inputs.tf === "1D"`.
7. **`requestSecurityNanFallback.scenario.ts`** — script calls
   `request.security({ interval: "1D" })` on the canvas2d
   adapter (`multiTimeframe: false`); verify
   `diagnostic-code-present: multi-timeframe-not-supported` +
   resulting plot is NaN-derived (no `plot-hash` because the
   `Series<number>` `current` is NaN → the runtime emits
   `value: null` → SHA over the resulting payload is a fixed
   pinned hash).
8. **`unsupportedInterval.scenario.ts`** — script calls
   `request.security({ interval: "37s" })` (not in canvas2d's
   intervals); verify `diagnostic-code-present:
   unsupported-interval`.

## Requirements

### 1. Add scenarios

Each file follows the Phase-3 pattern:

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const SOURCE = `
import { defineIndicator, state, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "session-high", apiVersion: 1,
    compute({ bar, state, plot, barstate }) {
        const high = state.float(NaN);
        if (barstate.isfirst || Number.isNaN(high.value) || bar.high > high.value) {
            high.value = bar.high;
        }
        plot(high.value, { color: "#ff9900", title: "Session high" });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "plot-hash", slotId: "<inline>:9:9#0", sha256: "<pin-after-first-run>" },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "input-coercion-failed" },
]);

export const STATE_SESSION_HIGH_SCENARIO: Scenario = Object.freeze({
    id: "state-session-high",
    title: "state.float — session-high tracker",
    inlineSource: SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
```

Re-pin SHA values from the failure message on first run — same
workflow as Phase 3 `drawing-hash` re-pinning.

### 2. `runConformanceSuite` — capability override surface

`requestSecurityNanFallback` and `unsupportedInterval` need to
override the canvas2d capabilities for their scenario run.
Today's `Scenario` shape (`{ id, title, scriptPath?,
inlineSource?, intervalCount, assertions }`) carries no
`capabilitiesOverride` field. This task **adds**
`capabilitiesOverride?: Partial<Capabilities>` to `Scenario` and
threads it through `runConformanceSuite` so it merges over the
runtime's effective capability bag for that scenario only.
`RunConformanceSuiteOpts.adapterOverride` already exists (Phase 3)
and stays — `Scenario.capabilitiesOverride` is per-scenario and
finer-grained.

### 3. Goldens

Add per-scenario golden assertions:

- `state*` / `barstate*` / `syminfo*` / `timeframe*` /
  `inputInterval` use the existing 10 000-bar `goldenBars.json`
  fixture.
- `requestSecurityNanFallback` and `unsupportedInterval` use a
  minimal 100-bar fixture to keep the diagnostic-emit path
  fast.

### 4. `scenarios/index.ts` — re-export

Add 8 new constants to the export list, in alphabetical order.

### 5. Tests

- **`runConformanceSuite.test.ts`** — extend with end-to-end
  invocation of each new scenario against the canvas2d adapter,
  verifying every assertion fires.

### 6. JSDoc gate

Every scenario carries a JSDoc summary + `@example` showing the
import path.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/scenarios/stateSessionHigh.scenario.ts` | Create | state.float scenario |
| `packages/conformance/src/scenarios/stateTickCounter.scenario.ts` | Create | state.tick.int scenario |
| `packages/conformance/src/scenarios/barstateConfirmed.scenario.ts` | Create | barstate.isconfirmed scenario |
| `packages/conformance/src/scenarios/syminfoMintick.scenario.ts` | Create | syminfo.mintick scenario |
| `packages/conformance/src/scenarios/timeframeIsdaily.scenario.ts` | Create | timeframe.isdaily scenario |
| `packages/conformance/src/scenarios/inputInterval.scenario.ts` | Create | input.interval scenario |
| `packages/conformance/src/scenarios/requestSecurityNanFallback.scenario.ts` | Create | request.security NaN-fallback |
| `packages/conformance/src/scenarios/unsupportedInterval.scenario.ts` | Create | unsupported-interval gate |
| `packages/conformance/src/scenarios/index.ts` | Modify | Re-export 8 new scenarios |
| `packages/conformance/src/index.ts` | Modify | Re-export 8 new constants |
| `packages/conformance/src/runConformanceSuite.test.ts` | Modify | End-to-end coverage |
| `packages/conformance/src/runConformanceSuite.ts` | Modify | Add `Scenario.capabilitiesOverride?: Partial<Capabilities>` and thread it through the suite runner |
| `packages/conformance/src/runConformanceSuite.test.ts` | Modify | Cover the override merging path |

## Edge Cases

- **Re-pin workflow** — every new scenario's `plot-hash` /
  `drawing-hash` SHA is pinned to a placeholder on first commit;
  CI fails on first run; developer re-pins from the failure
  message; commit the pinned SHA. Existing Phase-3 doc covers
  this; reference it in this task's PR description.
- **`inputInterval` scenario does NOT exercise the adapter UI**
  — it verifies the manifest + the resolved `inputs.tf` only.
  UI rendering is a Task-17 example-script smoke.
- **`requestSecurityNanFallback` `plot-hash`** — even with NaN
  data, the runtime emits `value: null` per the wire schema. The
  resulting `RuntimeEmissions.plots` array is non-empty;
  hashing the JSON-stringified payload yields a deterministic
  SHA. Pin on first run.
- **`syminfo.meta` is not tested here** — opaque adapter blob;
  no scenario coverage.
- **No new assertion variants** — reuse the 5 existing ones.
- **Coverage** — `scenarios/index.ts` exempt.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm docs:check`, `pnpm readme:check`,
  `pnpm conformance` (all 8 new scenarios pass).

## Changeset

`.changeset/phase-4-task-16-conformance-scenarios.md` —
**minor** on `@invinite-org/chartlang-conformance` (8 new
scenarios).

## Acceptance Criteria

- 8 new scenarios land + are re-exported.
- `runConformanceSuite` passes every new scenario.
- All Phase-3 scenarios still pass (no regressions).
- 100% coverage on `packages/conformance/`.
- Changeset committed.

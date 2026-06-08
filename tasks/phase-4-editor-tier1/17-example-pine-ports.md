# Task 17 — Example Pine-port scripts (×3) + integration coverage

> **Status: TODO**

## Goal

Ship the three median-Pine-indicator example scripts under
`examples/scripts/` that prove the "rewrite the median Pine
indicator in chartlang without reaching for unmodelled features"
done-criterion from the Phase-4 README. Each script exercises a
distinct Tier-1 surface: `state.*` for cross-bar memory,
`barstate.*` for confirmed-vs-tick gating, `syminfo.*` /
`timeframe.*` for portable cross-symbol logic. Wire them through
`packages/cli/src/e2e.test.ts` and
`examples/canvas2d-adapter/src/integration.test.ts`.

## Prerequisites

- Task 16 (conformance scenarios pin the Phase-4 surface).

## Current Behavior

- `examples/scripts/` ships
  - `ema-cross.chart.ts` (Phase 1)
  - `bollinger-bands.chart.ts` (Phase 1)
  - `rsi-divergence-alert.chart.ts` (Phase 1)
  - `fib-retracement.chart.ts` (Phase 3)
- `packages/cli/src/e2e.test.ts` smoke-compiles those four.
- `examples/canvas2d-adapter/src/integration.test.ts` renders
  them.

## Desired Behavior

Three new scripts land under `examples/scripts/`:

1. **`session-high-alert.chart.ts`** — Pine-parity "highest high
   since session open." Uses `state.float(NaN)` for cross-bar
   memory + `barstate.isfirst` / `bar.time % 86_400_000` for
   session reset. Plots the running high; alerts on crossover.
2. **`daily-rsi-divergence.chart.ts`** — Pine-parity "only run on
   daily timeframe." Uses `timeframe.isdaily` to short-circuit;
   `input.interval("1D")` lets the user pin the timeframe; uses
   `state.int(0)` to count bars since divergence.
3. **`mintick-snapped-entry.chart.ts`** — Pine-parity "round
   entries to mintick." Uses `syminfo.mintick` for portable
   snap-to-tick; `input.float(2)` for the percentage offset.

Each script ≤ 40 lines. Top-level imports + destructured
`compute({ … })` per the convention in
`examples/scripts/CLAUDE.md`.

## Requirements

### 1. `examples/scripts/session-high-alert.chart.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pine-parity reference: "Session High" — running highest high
// reset on session open, alerts on crossover. Translated from
// public Pine documentation idioms (no specific source SHA).

import { alert, defineIndicator, input, plot, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Session High Alert",
    apiVersion: 1,
    overlay: true,
    inputs: {
        alertOnCross: input.bool(true, { title: "Alert on cross" }),
    },
    compute({ bar, state, alert, plot, ta, barstate, inputs }) {
        const high = state.float(NaN);
        const isSessionOpen = barstate.isfirst || bar.time % 86_400_000 === 0;
        if (isSessionOpen) {
            high.value = bar.high;
        } else if (Number.isNaN(high.value) || bar.high > high.value) {
            high.value = bar.high;
        }
        plot(high.value, { color: "#ff9900", title: "Session high" });
        if (inputs.alertOnCross && ta.crossover(bar.close, high.value)) {
            alert("Close crossed session high", { severity: "info" });
        }
    },
});
```

### 2. `examples/scripts/daily-rsi-divergence.chart.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pine-parity reference: "Daily RSI Divergence" — runs only on
// daily timeframe, counts bars since last divergence using a
// state.int slot. Translated from public Pine documentation.

import { defineIndicator, input, plot, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Daily RSI Divergence",
    apiVersion: 1,
    inputs: {
        tf: input.interval("1D", { title: "Main timeframe" }),
        length: input.int(14, { min: 2, max: 200, title: "RSI length" }),
    },
    compute({ bar, ta, plot, state, timeframe, inputs }) {
        if (!timeframe.isdaily) return;
        const rsi = ta.rsi(bar.close, inputs.length);
        const barsSince = state.int(0);
        const overbought = rsi.current > 70;
        const oversold = rsi.current < 30;
        barsSince.value = (overbought || oversold) ? 0 : barsSince.value + 1;
        plot(rsi.current, { color: "#7c3aed", title: "RSI", pane: "rsi" });
        plot(barsSince.value, { color: "#94a3b8", title: "Bars since divergence", pane: "rsi" });
    },
});
```

### 3. `examples/scripts/mintick-snapped-entry.chart.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pine-parity reference: "Mintick Snapped Entry" — projects a
// target price N% above close, snapped to the symbol's mintick.
// Translated from public Pine documentation.

import { defineIndicator, input, plot, syminfo } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Mintick Snapped Entry",
    apiVersion: 1,
    overlay: true,
    inputs: {
        offsetPercent: input.float(2, { min: 0, max: 50, step: 0.1, title: "Offset (%)" }),
    },
    compute({ bar, syminfo, plot, inputs }) {
        if (!Number.isFinite(syminfo.mintick)) {
            plot(bar.close * (1 + inputs.offsetPercent / 100), { color: "#10b981", title: "Target (raw)" });
            return;
        }
        const target = bar.close * (1 + inputs.offsetPercent / 100);
        const snapped = Math.round(target / syminfo.mintick) * syminfo.mintick;
        plot(snapped, { color: "#10b981", title: "Target (snapped)" });
    },
});
```

### 4. `packages/cli/src/e2e.test.ts` — extend

The file already enumerates scripts via an `EXAMPLE_SCRIPTS`
const. Append the three new entries inline:

```ts
const EXAMPLE_SCRIPTS = [
    "examples/scripts/ema-cross.chart.ts",
    "examples/scripts/bollinger-bands.chart.ts",
    "examples/scripts/rsi-divergence-alert.chart.ts",
    "examples/scripts/fib-retracement.chart.ts",
    "examples/scripts/session-high-alert.chart.ts",       // Phase 4
    "examples/scripts/daily-rsi-divergence.chart.ts",     // Phase 4
    "examples/scripts/mintick-snapped-entry.chart.ts",    // Phase 4
];
```

The existing per-script `it(...)` loop covers the new entries
without further changes; verify the loop produces a passing
`diagnostics.length === 0` assertion for each.

### 5. `examples/canvas2d-adapter/src/integration.test.ts` — extend

Walk the canvas2d adapter through the three new scripts on a
small candle fixture. Verify:

- No diagnostic-level errors.
- Plots emit (`plots.length > 0`).
- Alerts emit for `session-high-alert.chart.ts` on crossover.

### 6. `examples/scripts/CLAUDE.md` — update layout note

Bump the script list inside `examples/scripts/CLAUDE.md` (root
`examples/README.md` does not exist — `examples/CLAUDE.md` is
the workspace-level convention doc and is left as-is). Note the
Phase-4 trio under "Phase 4 ships" with one-line summaries.

### 7. JSDoc gate

The example scripts are excluded from `docs-check.ts` by design
(see `examples/CLAUDE.md`). No `@example`-execution requirement.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/session-high-alert.chart.ts` | Create | state.* + barstate scenario |
| `examples/scripts/daily-rsi-divergence.chart.ts` | Create | timeframe.* + input.interval scenario |
| `examples/scripts/mintick-snapped-entry.chart.ts` | Create | syminfo.* scenario |
| `packages/cli/src/e2e.test.ts` | Modify | Smoke-compile new scripts |
| `examples/canvas2d-adapter/src/integration.test.ts` | Modify | Walk new scripts through canvas2d |
| `examples/scripts/CLAUDE.md` | Modify | Update layout note |
| `examples/scripts/CLAUDE.md` | Modify | Append script entries to the layout note (root `examples/README.md` does not exist; folder convention lives in CLAUDE.md) |

## Edge Cases

- **`mintick-snapped-entry` covers both branches** — capability-
  present (snapped path) and capability-absent (raw path). The
  conformance scenario from Task 16 already covers the
  capability-gated path; this script ships the raw path in the
  `!isFinite` branch.
- **`daily-rsi-divergence` short-circuits on non-daily
  timeframes** — running the script on a `5m` candle stream
  produces zero plots, no diagnostics. Add a unit test verifying
  this behavior.
- **`session-high-alert.chart.ts` uses both `state.*` and
  `barstate.*`** — the most thorough end-to-end Tier-1 example.
  Verifies the runtime correctly threads both views through
  `ComputeContext`.
- **Provenance** — each script's header carries the "Translated
  from public Pine documentation idioms (no specific source
  SHA)" line. No `../invinite/` math port involved.
- **Coverage** — example scripts are user-author-style, excluded
  from per-package coverage gates per `examples/CLAUDE.md`. The
  CLI's e2e test is their gate.
- **`input.bool` default `true`** in `session-high-alert.chart.
  ts` — the conformance suite's default-only path covers the
  enabled branch; an explicit override test in
  `cli/e2e.test.ts` covers the disabled branch.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm docs:check`, `pnpm readme:check`,
  `pnpm conformance`,
  `pnpm bench:ci`.
- `packages/cli/src/e2e.test.ts` compiles all 7 example scripts
  (4 Phase-1/3 + 3 Phase-4).
- `examples/canvas2d-adapter/src/integration.test.ts` runs all 7.

## Changeset

`.changeset/phase-4-task-17-example-pine-ports.md` — no version
bump (examples are private). Note the 3 new scripts in the
description.

## Acceptance Criteria

- 3 new scripts ship + compile cleanly.
- Each script exercises a distinct Tier-1 surface.
- `packages/cli/src/e2e.test.ts` runs all 7 scripts.
- `examples/canvas2d-adapter/src/integration.test.ts` walks all
  7 through the canvas2d adapter.
- README + CLAUDE.md updates land.
- Changeset committed (no version bump on private packages).

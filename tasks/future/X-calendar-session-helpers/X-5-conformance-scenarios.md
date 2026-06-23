# Task 5 — Conformance: calendar + session scenarios

> **Status: TODO**

## Goal

Add one (or two) inline-source conformance scenario(s) that prove `time.*`
calendar fields and `session.isOpen` membership compile + run + emit a stable
finite series over the **fixed UTC `goldenBars.json` fixture**, with pinned
`plot-hash` assertions and a `tz-dst-unsupported`-absent guard (the happy path
uses UTC, so no DST diagnostic should fire).

## Prerequisites

Task 2 (`time.*` runtime) and Task 4 (`session.isOpen` runtime) — the
primitives must execute end-to-end through `createScriptRunner`.

## Current Behavior

- `runConformanceSuite` compiles each `Scenario` and drives it through
  `createScriptRunner` against the canvas2d capability bag, asserting pinned
  `plot-hash` (`{ bar, value }` SHA-256 in emission order), alert counts, and
  diagnostic codes (`packages/conformance/CLAUDE.md`).
- Inline scenarios use the virtual `<inline:${id}>.chart.ts` `sourcePath` so
  slot ids are pinnable (`barCloseDirectIndex.scenario.ts` is the template).
- `goldenBars.json` (10 000 bars) is the shared fixture; `bar.time` is a real
  UTC ms epoch per bar.
- The capability bag must expose `syminfo.timezone` for the default-tz path to
  be exercised — confirm the canvas2d bag's `symInfoFields` includes
  `"timezone"`; if it does not, the scenario passes an explicit `tz` of `"UTC"`
  so it does not depend on adapter syminfo (simpler + deterministic). Prefer
  the explicit `"UTC"` form for a hermetic golden.

## Desired Behavior

- A `calendar-session` scenario whose inline `compute` reads `bar.time`,
  derives several calendar fields, tests session membership, and plots a
  finite numeric series that depends on those fields — so the pinned hash
  proves the whole path (compile → buffer-free stateless call → emit).
- The `tz-dst-unsupported` diagnostic is asserted **absent** (the script uses
  `"UTC"`), and `lookback-exceeded` absent (no buffering involved).

## Requirements

### 1. Scenario source (`packages/conformance/src/scenarios/calendarSession.scenario.ts`, new)

Mirror `barCloseDirectIndex.scenario.ts` exactly (header, `SOURCE`,
top-of-file `const ASSERTIONS: ReadonlyArray<ScenarioAssertion>`, frozen
`Scenario`). Inline source, for example:

```ts
const SOURCE = `import { defineIndicator, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Calendar session",
    apiVersion: 1,
    overlay: true,
    compute({ bar, time, session, plot }) {
        const t = bar.time;
        const dow = time.dayofweek(t, "UTC");      // 1=Sun..7=Sat
        const hh = time.hour(t, "UTC");
        const open = session.isOpen(t, "0000-1200", "UTC");
        // finite series that depends on the calendar fields:
        plot(open ? bar.close + dow * 100 + hh : bar.close, { title: "Calendar" });
        plot(time.month(t, "UTC"), { title: "Month" });
    },
});
`;
```

> The `compute` destructures `time` / `session` off the context (they are
> `ComputeContext` members from Task 1). `time.*` / `session.*` carry no slot
> id, so the emitted bundle calls them with the author args directly — exactly
> what the runtime impls expect.

### 2. Pin the hashes

Pin `plot-hash` for both plot slot ids (`<inline:calendar-session>.chart.ts:
<line>:<col>#0`) by running the suite once and copying the `actual` SHA-256
from the runner's "expected vs actual" failure message (the repo's standard
pinning workflow — no regenerate script). Add:

```ts
{ kind: "diagnostic-code-absent", code: "tz-dst-unsupported" },
{ kind: "diagnostic-code-absent", code: "lookback-exceeded" },
```

> If `diagnostic-code-absent` does not yet accept `"tz-dst-unsupported"` /
> `"session-spec-malformed"` as a known `DiagnosticCode`, ensure those codes
> were registered in the shared diagnostic-code union in Tasks 2/4 so the
> conformance assertion type accepts them.

### 3. Register the scenario

Add `CALENDAR_SESSION_SCENARIO` to `ALL_SCENARIOS` (and any phase grouping
array that the end-to-end `runConformanceSuite.test.ts` iterates), following
how `BAR_CLOSE_DIRECT_INDEX_SCENARIO` is wired into the registry + barrel.

### 4. (Optional) second scenario — session boundary

If the single scenario does not cleanly exercise the half-open boundary, add a
`session-membership` scenario whose plot is `session.isOpen(...) ? 1 : 0` so the
emitted 0/1 series pins membership transitions over the fixture. Keep it only
if it adds coverage the combined scenario misses.

## Edge cases

- The golden fixture's bar timestamps determine which bars are "in session" —
  the hash captures that deterministically; re-pin if the fixture changes
  (standard workflow).
- Use `"UTC"` explicitly so the scenario never touches the DST path — the
  whole point of asserting `tz-dst-unsupported` **absent**.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/scenarios/calendarSession.scenario.ts` | Create | Inline calendar + session scenario. |
| `packages/conformance/src/scenarios/index.ts` (or registry barrel) | Modify | Export the scenario. |
| `packages/conformance/src/runConformanceSuite.test.ts` (or the registry array) | Modify | Add to `ALL_SCENARIOS` / phase group. |

## Gates

- `pnpm -F @invinite-org/chartlang-conformance test`
- `pnpm typecheck`, `pnpm lint`

## Changeset

No package changeset (conformance is a private test package — confirm it is not
in the published scope; if it ships, it is already covered by Task 1's runtime
minor only as a consumer). Add a changeset line only if conformance is a
published package.

## Acceptance Criteria

- The `calendar-session` scenario compiles + runs end-to-end, with pinned
  `plot-hash` assertions for both plots and `tz-dst-unsupported` /
  `lookback-exceeded` asserted absent.
- Registered in `ALL_SCENARIOS`; suite + typecheck + lint green.

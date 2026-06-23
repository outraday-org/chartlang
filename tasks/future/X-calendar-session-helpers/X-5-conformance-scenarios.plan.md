# Task 5 — Conformance: calendar + session scenario — Implementation Plan

## Context

Add an inline-source conformance scenario that proves `time.*` calendar
fields + `session.isOpen` membership compile → run → emit a stable finite
series over the FIXED UTC `goldenBars.json` fixture, with pinned `plot-hash`
assertions and `tz-dst-unsupported` / `lookback-exceeded` asserted absent
(the happy path uses `"UTC"`, no buffering).

## Pre-existing work (verified, DO NOT touch)

- **Task 1** (core): `time` / `session` sentinel holes in
  `packages/core/src/time-accessors/`; `ComputeContext.time: TimeNamespace`
  + `ComputeContext.session: SessionNamespace` mirrored in the compiler shim
  (`program.ts:1418-1419`). `bar.time` is a scalar `Time` (`program.ts:66`).
- **Task 2** (runtime): UTC/fixed-offset `civil_from_days` impl, installed
  per-mount via `buildComputeContext.ts`; `tz-dst-unsupported` diagnostic.
- **Task 4** (runtime): `session.isOpen(t, spec, tz?)` via the shared
  `time-accessors/sessionWindow.ts:parseSessionWindowMinutes`. Membership is
  **half-open `[start, end)`**, wrap-aware.
- `tz-dst-unsupported` + `lookback-exceeded` are both in the adapter-kit
  `DiagnosticCode` union (`adapter-kit/src/types.ts:806`), so the
  `diagnostic-code-absent` assertions typecheck. (`session-spec-malformed`
  was NOT added by Task 4 and is not needed here.)
- Changeset `.changeset/calendar-session-helpers.md` already exists (core /
  compiler / runtime / adapter-kit / pine-converter minor + cli patch). It
  does NOT yet list conformance.

## Key fixture facts (load-bearing for hash determinism)

- `generateGoldenBars.ts`: 10 000 **daily** bars, `START_TIME =
  1_700_000_000_000`, spaced exactly `MS_PER_DAY` (`86_400_000`).
- `1_700_000_000_000 % 86_400_000 = 80_000_000` ms = **22:13:20 UTC** — EVERY
  bar shares that time-of-day. So `time.hour=22`, `time.minute=13`,
  `time.second=20` are CONSTANT; `year/month/dayofmonth/dayofweek` VARY daily.
- A session whose window CONTAINS 22:13:20 is open on every bar; one that does
  not is closed on every bar (no transitions possible on a fixed-time-of-day
  fixture). Use `"2000-2300"` (= `[1200, 1380)` min; 22:13:20 = 1333 min ⇒
  IN). So `session.isOpen(t, "2000-2300", "UTC") === true` every bar — the
  open branch (which depends on the VARYING `dayofweek`) is the one emitted,
  the stronger proof. The optional 0/1 membership scenario is SKIPPED (it
  would be a constant series — no added coverage, per the task's "keep only if
  it adds coverage" rule).

## Issues found

- No `phase2Coverage.test.ts` exists; `ALL_SCENARIOS.length` is computed (not a
  hardcoded count) in both `scenarios.test.ts:189` and
  `runConformanceSuite.test.ts:207`, so adding to `ALL_SCENARIOS` is
  self-counting — **no count constant to bump**. Phase grouping arrays
  (`PHASE_4_SCENARIOS`, …) are feature-scoped; a calendar scenario belongs in
  `ALL_SCENARIOS` only (exercised end-to-end by both full-suite tests).

## Steps

1. Create `packages/conformance/src/scenarios/calendarSession.scenario.ts`
   mirroring `barCloseDirectIndex.scenario.ts` exactly: MIT header,
   `import type { Scenario, ScenarioAssertion }`, `SOURCE` const,
   top-of-file `const ASSERTIONS: ReadonlyArray<ScenarioAssertion>`, frozen
   `Scenario` with JSDoc (`@since`, `@stable`, `@example`). Two plots:
   - plot 0: `open ? bar.close + dow * 100 + hh : bar.close` (open is always
     true here, so the dow-varying branch emits) — `{ title: "Calendar" }`.
   - plot 1: `time.month(t, "UTC")` — `{ title: "Month" }`.
   Use `"UTC"` explicitly everywhere (hermetic; never touches the DST path).
2. Pin both `plot-hash`es by running the suite once and copying the `actual`
   SHA-256 from the runner's expected-vs-actual failure message. Slot ids:
   `<inline:calendar-session>.chart.ts:<line>:<col>#0` for each plot.
   Add `diagnostic-code-absent` for `tz-dst-unsupported` + `lookback-exceeded`.
3. Register: barrel `scenarios/index.ts` (import + export, alphabetical block),
   package `src/index.ts` (the re-export list, alphabetical), and append
   `CALENDAR_SESSION_SCENARIO` to `ALL_SCENARIOS` with a one-line why-comment.
4. Run `pnpm --filter @invinite-org/chartlang-conformance test`; re-pin hashes
   from the first failure; re-run green.
5. Regenerate `CONFORMANCE.md` + `conformance-report.json` via the harness
   command, run `conformance:check` green across all adapters.
6. Add `"@invinite-org/chartlang-conformance": patch` to the existing
   `.changeset/calendar-session-helpers.md` (matches the multi-symbol-security
   precedent: a published conformance package gaining a shipped scenario takes
   a patch). Do NOT create a second changeset.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/scenarios/calendarSession.scenario.ts` | Create | Inline calendar + session scenario, pinned hashes. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Import + re-export `CALENDAR_SESSION_SCENARIO`; add to `ALL_SCENARIOS`. |
| `packages/conformance/src/index.ts` | Modify | Re-export `CALENDAR_SESSION_SCENARIO` from the package barrel. |
| `CONFORMANCE.md` | Regenerate | Harness-generated report (count + scenario row). |
| `conformance-report.json` | Regenerate | Harness-generated machine report. |
| `.changeset/calendar-session-helpers.md` | Modify | Add conformance patch line. |

## Gates to keep green

- `pnpm --filter @invinite-org/chartlang-conformance test`
- the conformance harness + `conformance:check` across all 5 adapters
- `pnpm typecheck`, `pnpm lint` (scoped — do NOT run full-workspace)

## Changeset

Extend `.changeset/calendar-session-helpers.md` with
`"@invinite-org/chartlang-conformance": patch`.

## Acceptance criteria

- `calendar-session` scenario compiles + runs end-to-end; both plots pinned;
  `tz-dst-unsupported` + `lookback-exceeded` asserted absent.
- Registered in `ALL_SCENARIOS` + both barrels; suite + typecheck + lint green;
  conformance + conformance:check green across all adapters; total count +1.

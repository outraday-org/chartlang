# Phase 6 — `0.6` Tier-3 Ergonomics + Lower-Timeframe

> **Plan reference:** PLAN.md §19 Phase 6, with cross-cuts into §4.5
> (`request.lowerTf`), §4.4 (`@invinite-org/chartlang-core/time`
> subpath).
> **Prerequisite:** Phase 5 server-side alerts shipped (multi-
> timeframe streaming on).
> **Version target:** `0.6`.

## Goal

Close the remaining Pine ergonomic gap: lower-timeframe arrays and
session/timezone helpers. Land the Pine→chartlang migration guide so
external Pine authors have a real on-ramp.

## Deliverables

### `request.lowerTf({ interval })` per §4.5

- Returns `Series<ReadonlyArray<Bar>>` of contained lower-tf bars
  bucketed by main-bar containment.
- Compile-time check: lower-tf value must be smaller than main
  interval, ordered via `IntervalDescriptor` (§7.2). Failures emit
  `lower-tf-not-lower`.
- Gated by `Capabilities.multiTimeframe: true`.
- Adapter delivers stream identically to `request.security`; runtime
  buckets emissions.

### Session helpers in `@invinite-org/chartlang-core/time` (§4.4)

- `session.regular(tz, t)`, `session.extended(tz, t)`,
  `session.isOpen(tz, t, type)`.
- `weekday(tz, t)`, `nyDayKey(t)`, `nySessionBounds(t)`,
  `weekKey(tz, t)`.
- Ported from `../invinite/src/components/trading-chart/indicators/
  lib/ny-day-key.ts` + `session-boundaries.ts` (§3.1).

### Pine → chartlang migration guide

- Draft document under `docs/spec/` covering the most common Pine
  idioms with chartlang equivalents.
- One worked example per category: indicators, drawings, alerts,
  inputs, state, multi-timeframe.
- Flag gaps (e.g. strategy primitives — out until Beyond 1.0).

## Done criteria

- `request.lowerTf` round-trips through conformance with bucketed
  lower-tf bars matching invinite's behaviour.
- `lower-tf-not-lower` diagnostic fires for invalid combinations at
  compile time, not runtime.
- Session helpers match invinite golden outputs for NY trading
  hours, including DST transitions.
- Migration guide reviewed against at least 5 real Pine scripts —
  every idiom either has a documented equivalent or an explicit
  "not supported, see roadmap" note.

## Notes for `/write-tasks`

- Lower-tf bucketing reuses the §6.8 alignment kernel from Phase 5 —
  changes the policy from "take most recent" to "collect all
  contained".
- Session helpers should be pure functions over `Time` — no implicit
  global TZ. Always pass `tz` explicitly.
- Migration guide is documentation but should be PR-gated through
  `pnpm docs:check` like every other doc page (§17.6).

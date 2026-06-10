# Spec: `semantics.md`

> **Status: Complete**

## Goal

Expand `docs/spec/semantics.md` from its 14-line stub into the
canonical execution-model specification: the per-bar `compute`
contract, series indexing and warmup, NaN propagation, determinism
guarantees, emission ordering, state persistence, multi-stream
alignment (HTF + LTF), drawing handle lifecycle, alert deduplication,
and capability fallback. This is the document an alternate runtime
implementation must satisfy to run existing scripts byte-identically.

## Prerequisites

- Task 4 (`grammar.md` + `versioning.md`) — semantics cross-links
  both.

## Current Behavior

The stub says "Content lands with the Phase 1 runtime PR." The actual
semantics live in PLAN.md §6 (runtime), §4.3 (series), §6.8
(multi-stream alignment), §6.9 (persistence), §7.4 (capability
fallback) and the shipped implementation
(`packages/runtime/src/`).

## Desired Behavior

A complete `docs/spec/semantics.md`, self-contained, normative,
link-checked.

## Requirements

### 1. Required sections

1. **Execution model.** A script's `compute(ctx)` runs once per bar
   event. Define the event kinds (bar close, tick / in-progress
   update) and the runner's ordering guarantee: events are processed
   in delivery order, single-threaded, no re-entrancy.
2. **Series and indexing.** `Series<T>` semantics per PLAN §4.3:
   index `0` is the current bar, positive indices look back; reads
   beyond the lookback bound; how `maxLookback` is derived at compile
   time and enforced at runtime. Document the
   `dynamic-series-index` interplay (grammar.md owns the rejection;
   semantics.md owns the runtime bound).
3. **Warmup and NaN.** Every `ta.*` primitive declares a warmup
   window (`@warmup` JSDoc, surfaced on its primitive page); before
   warmup the value is NaN; NaN propagates through arithmetic and
   comparisons per IEEE-754; plots carry NaN gaps rather than
   dropping points. Float64 everywhere — no Decimal (PLAN §20.5);
   cumulative primitives document their rounding-error envelope on
   their own pages.
4. **Determinism.** Same script + same candle stream + same inputs +
   same capabilities ⇒ byte-identical emissions. Enumerate the
   determinism preconditions (no wall clock, no randomness, no host
   globals — enforced by grammar) and the conformance suite's
   determinism check (two runs diffed).
5. **Callsite-id stability and state slots.** Each stateful call
   site owns one state slot keyed by its callsite id; slots survive
   bar-to-bar; ticks use `state.tick.*` semantics (reset contract
   between in-progress updates of the same bar).
6. **State persistence (warm start).** The `StateStore` snapshot
   contract per PLAN §6.9: cache key fields (scriptHash,
   compilerVersion, apiVersion, capabilitiesHash, symbol,
   mainInterval, requestedIntervals — mirror
   `StateStoreKey` in the compiler shim), restore + gap-replay, and
   the guarantee: warm start produces byte-identical emissions to
   cold start.
7. **Multi-stream alignment.** Both directions:
   - HTF (`request.security`): *take most recent HTF value at or
     before each main-bar time*; in-progress HTF bar exposure.
   - LTF (`request.lowerTf`): *collect all contained* — each main
     bar's bucket holds LTF bars whose time falls in
     `[mainBar.time, nextMainBar.time)`, including the in-progress
     LTF bar in the current window.
   Diagnostics for unsupported configurations
   (`multi-timeframe-not-supported`, `unsupported-interval`,
   `unknown-secondary-stream`) and the capability gate
   (`Capabilities.multiTimeframe`).
8. **Emission ordering.** Within one bar event: plots, then
   drawings, then alerts/alert-conditions, then logs (verify the
   actual order in `packages/runtime/src/emit/` at writing time and
   spec what ships — the implementation is the source of truth for
   1.0; the spec freezes it).
9. **Drawing handle lifecycle.** Create / update / delete semantics
   of `draw.*` handles, sub-id allocation for composite drawings,
   and the budget-overflow behaviour (`drawBudgetOverflow`
   conformance scenario semantics).
10. **Alert deduplication.** When an alert fires once vs repeatedly
    across ticks of the same bar; `defineAlertCondition` gating.
11. **Capability fallback — silent no-op.** An emission whose kind
    the adapter's `Capabilities` does not declare is dropped with the
    matching `unsupported-*` runtime diagnostic — never thrown,
    never silently rendered (PLAN §15.3's capability-honesty rule,
    stated from the runtime's perspective).

### 2. Style rules

Same as Task 4: normative voice, self-contained, no source links,
front-matter (`since: "1.0"`, `status: "stable"`), closing
**Conformance checklist** for alternate-runtime implementers.

### 3. Verification against implementation

For sections 7–10 the spec author MUST verify each claim against the
shipped runtime (read `packages/runtime/src/request/`,
`emit/`, `state/`) and the conformance scenarios — the spec freezes
*actual* behaviour, not intended behaviour. Discrepancies between
PLAN.md and the implementation are resolved in favour of the
implementation (and noted in the PR description).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/spec/semantics.md` | Rewrite | Canonical execution-model spec. |
| `docs/language/series-and-indexing.md` | Modify | One-line pointer to the spec page. |

## Gates

- `pnpm docs:build`
- `pnpm docs:check`
- `pnpm readme:check`
- `pnpm lint`

## Changeset

None — docs-only.

## Acceptance Criteria

- [ ] All eleven required sections present.
- [ ] Sections 7–10 verified against the shipped runtime; any
      PLAN-vs-implementation discrepancy noted in the PR description.
- [ ] Self-contained; normative voice; conformance checklist at the
      end.
- [ ] `pnpm docs:build` green.

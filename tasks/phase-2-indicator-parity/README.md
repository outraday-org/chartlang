# Phase 2 — `0.2` Full Indicator Parity

> **Plan reference:** PLAN.md §19 Phase 2, with cross-cuts into §9
> (full primitive list), §3.1 (invinite reference paths), §16.6
> (math port coverage).
> **Prerequisite:** Phase 1 walking skeleton shipped.
> **Version target:** `0.2`.

## Goal

Port every indicator from the invinite reference math library into
`packages/runtime/src/ta/` so a Pine author can rewrite the median
indicator script in chartlang without missing primitives.

## Deliverables

- Every primitive listed in §9.2 implemented in
  `packages/runtime/src/ta/<id>.ts` against the `Series<T>` shape.
- Shared math helpers ported from
  `../invinite/src/components/trading-chart/indicators/lib/` per the
  ordering in §3.1 (chained-MA family first, then volatility/stats,
  then universal helpers).
- `ta.nz(value, replacement)` (§9) — NaN-to-default helper.
- Universal `opts.offset` on every `ta.*` primitive (§9.1).
- External-data primitives per §9.5 (where they don't require
  multi-timeframe — defer those to Phase 5).
- Canvas2d reference adapter's `Capabilities.plots` extended with
  any new plot kinds the ports introduce (so the conformance suite
  covers them).
- Conformance fixtures added for every new primitive (one script per
  primitive at minimum).

## Done criteria

- Every indicator in `invinite/src/components/trading-chart/
  indicators/<id>.ts` has a chartlang counterpart.
- Every port ships the §16.6 five-file set: implementation, golden
  fixture, property test, bench, conformance scenario.
- `pnpm bench:ci` passes — no regression vs invinite's bench baseline
  on the hot primitives (sma/ema/bb/rsi/macd/volume).
- `pnpm conformance` green against the canvas2d ref adapter for all
  new primitives.
- Primitive registry in `@invinite-org/chartlang-core` regenerated;
  TS declaration merging picks up the typed surface automatically.
- Docs (§17): every primitive has a JSDoc block + a doc page under
  `docs/primitives/`.

## Notes for `/write-tasks`

- Read `../invinite/src/components/trading-chart/indicators/
  CLAUDE.md` before starting — it walks through a VWAP port as a
  worked example.
- Order: helpers first (the chained-MA family unblocks ~half the
  indicators), then port indicators alphabetically or by usage
  weight — your call.
- Each indicator is roughly one task. ~90 invinite files = roughly
  ~90 tasks plus ~15 helper tasks plus the registry/regeneration
  task. Consider grouping by category (trend, momentum, volume,
  volatility) into sub-tasklists if the flat list gets unwieldy.
- Provenance: every ported file must carry the §3.1 origin header
  comment.
- Strictly behavioural ports — keep chartlang's primitive shape
  (single function returning `Series<T>`) per §3.1's "translate,
  don't transcribe".

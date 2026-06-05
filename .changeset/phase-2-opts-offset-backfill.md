---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-compiler": patch
---

Phase-2 Task 29 — Universal `opts.offset` backfill on Phase-1 primitives.

Wires the universal `opts.offset` (PLAN.md §9.1) onto every Phase-1
`ta.*` primitive: `sma`, `ema`, `stdev`, `bb`, `rsi`, `macd`, `atr`,
`crossover`, `crossunder`. Positive `offset` shifts the returned
series so `series.current` reads the value `offset` bars ago
(matching `lib/applyOffset`'s `out[i] = values[i − offset]`
semantics); negative `offset` reads into the future (NaN /
undefined at the head). `offset === 0` is the strict identity
fast path — returns the slot's cached un-shifted Series with the
same reference as before this change (existing identity-pinned
tests continue to pass).

Surface expansion (core, minor):

- `offset?: number` added to `SmaOpts`, `EmaOpts`, `StdevOpts`,
  `BbOpts`, `RsiOpts`, `MacdOpts`, `AtrOpts` (Phase-1 opts types
  that previously had no `offset` field).
- New `CrossoverOpts` / `CrossunderOpts` types (the two cross
  primitives previously took no opts bag); `TaNamespace.crossover`
  / `crossunder` signatures gain an optional 3rd opts arg.
- New `makeShiftedSeriesView` runtime helper next to
  `makeSeriesView` (in `packages/runtime/src/seriesView.ts`,
  re-exported from the runtime barrel) — wraps a `RingBufferLike<T>`
  in a Proxy that adjusts `at(n)` reads by `offset`.

Composite primitives (`bb`, `macd`) shift all outputs in lockstep
under a single `offset` value, returning a frozen result record
cached per offset on the slot. Sub-slot outputs (sma's middle,
ema's signal) are accessed through their captured ring-buffer
reference so the parent primitive doesn't re-enter the sub-slot's
compute on the shifted-view lookup.

Compiler patch: the ambient shim in `packages/compiler/src/program.ts`
mirrors the core type changes (new `offset?` fields + new
`CrossoverOpts` / `CrossunderOpts` types + extended `TaNamespace`
signatures).

Goldens, bench thresholds, and conformance scenarios are
unchanged — `offset === 0` is the default and exercises the
existing code paths. New per-primitive `<id>.test.ts` and
`<id>.property.test.ts` cases cover positive, negative, zero, and
identity-cache behaviour for offset.

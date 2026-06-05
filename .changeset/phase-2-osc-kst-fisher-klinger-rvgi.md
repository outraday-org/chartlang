---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 12 — oscillator ports: `ta.kst`, `ta.fisher`,
`ta.klinger`, `ta.rvgi`.

Ships four more multi-output oscillator primitives under
`packages/runtime/src/ta/`:

- `ta.kst(source, opts?)` — Know Sure Thing (Martin Pring, 1992).
  Weighted sum of four SMA-smoothed percentage ROCs plus an SMA
  signal line. Composes 4 `ta.sma` sub-slots for the per-ROC
  smoothing plus one `ta.sma` for the signal; the four percentage
  ROCs are computed inline against a shared `sourceWindow` ring
  (mirrors `ta.coppock` — `ta.change` emits absolute deltas, while
  KST needs percentage rate-of-change). Defaults
  `(10, 15, 20, 30, 10, 10, 10, 15, 9)`.
- `ta.fisher(length, opts?)` — John Ehlers' Fisher Transform over
  rolling `bar.hl2`. Composes `ta.highest` + `ta.lowest` sub-slots;
  the clamp / atanh / EMA-blend recurrence is bespoke. The `trigger`
  output is the prior bar's `fisher` value (1-bar lag); first bar's
  `trigger` is NaN. Diverges from invinite's ±0.999 clamp per task
  spec — when the recurrence would drive `|x| ≥ 1` we emit NaN at
  `fisher` and hold the recurrence state.
- `ta.klinger(opts?)` — Klinger Volume Oscillator. Per-bar Volume
  Force accumulator drives the difference of two `ta.ema` sub-slots
  (`fastLength` / `slowLength`); the `signal` is a third
  `ta.ema(klinger, signalLength)`. Defaults `(34, 55, 13)`.
- `ta.rvgi(opts?)` — Relative Vigor Index (John Ehlers, 2002).
  4-bar `(1, 2, 2, 1) / 6` weighted numerator (`close − open`) and
  denominator (`high − low`), each smoothed via `ta.sma` sub-slot;
  `rvgi = numSma / denSma`. Signal is a 4-bar weighted sum of the
  rvgi line. Defaults `length = 10`; flat-range bars emit NaN.

Each primitive ships the §22.10 set: impl + unit + property + golden
+ bench pair + conformance scenario (inlined per Task 1) +
auto-generated `docs/primitives/ta/<id>.md`.

Extends `TA_REGISTRY_METADATA` with four new entries (all
`primarySeriesKey` + `visibleSeriesKeys`; all `yDomain: { kind:
"auto" }` per task §5):

- `kst`: `primarySeriesKey: "kst"`, `visibleSeriesKeys: ["kst", "signal"]`.
- `fisher`: `primarySeriesKey: "fisher"`, `visibleSeriesKeys: ["fisher", "trigger"]`.
- `klinger`: `primarySeriesKey: "klinger"`, `visibleSeriesKeys: ["klinger", "signal"]`.
- `rvgi`: `primarySeriesKey: "rvgi"`, `visibleSeriesKeys: ["rvgi", "signal"]`.

Core surface widens with `KstOpts`, `FisherOpts`, `KlingerOpts`,
`RvgiOpts` opts bags + `KstResult`, `FisherResult`, `KlingerResult`,
`RvgiResult` two-output types, plus the matching `TaNamespace`
methods and throw-sentinel stubs. `STATEFUL_PRIMITIVES` extends
with `ta.kst` / `ta.fisher` / `ta.klinger` / `ta.rvgi` (all
`slot: true`). Compiler shim mirrors the new core surface.

Four conformance scenarios (`taKst.scenario.ts`,
`taFisher.scenario.ts`, `taKlinger.scenario.ts`,
`taRvgi.scenario.ts`) registered against `PHASE_1_SCENARIOS` via the
Task-1 `inlineSource` extension. Plot-hash pinning deferred to
Phase-2 closeout (Task 30) per the established multi-output scenario
convention.

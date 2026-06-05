---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 28 — statistical `ta.*` ports: `ta.median`, `ta.adr`,
`ta.ulcerIndex`.

Ships three new statistical primitives under
`packages/runtime/src/ta/`:

- `ta.median(source, length, opts?)` — rolling median over the
  trailing `length` source values. Odd-`length` → middle value;
  even-`length` → mean of the two middle values. NaN slots are
  dropped from the sort (window length effectively shrinks). Range
  invariant pinned: `min(window) ≤ out ≤ max(window)`. Tick-mode
  substitutes the head value before sorting (closed window
  unchanged).
- `ta.adr(opts?)` — Average Daily Range. SMA of `high − low` over
  the trailing `length` (default `14`) completed UTC calendar days.
  Reads `bar.high` / `bar.low` / `bar.time` directly (no `source`
  param). Phase-2 keys "daily" on the UTC midnight boundary
  (`Math.floor(bar.time / 86_400_000)`); Phase 4 lifts this onto
  `syminfo.session`. The in-progress (currently-aggregating) day is
  NEVER included in the average — matches invinite's "completed N
  daily bars" semantics. Tick mode emits the cached SMA (no day-
  boundary advance per the runtime tick invariant).
- `ta.ulcerIndex(source, length, opts?)` — drawdown-based volatility
  (rolling RMS of percent declines from the rolling-window high).
  Composes `ta.highest` via sub-slot id `${slotId}/highest`. Range
  invariant pinned: `out ≥ 0`. NaN source → NaN output (window
  unchanged).

Each primitive ships the §22.10 set: impl + unit + property +
golden + bench pair + conformance scenario (inline-source per Task
1's extension) + auto-generated `docs/primitives/ta/<id>.md`.

`STATEFUL_PRIMITIVES` grows by `+3` (`ta.median`, `ta.adr`,
`ta.ulcerIndex` — all `slot: true`). `TA_REGISTRY` grows by `+3`.
`TaNamespace` and `RuntimeTaNamespace` extend in lockstep with
`MedianOpts`, `AdrOpts` (`{ length?: number; offset?: number;
lineStyle?: PlotLineStyle }`), and `UlcerIndexOpts`.

`PHASE_1_SCENARIOS` (conformance) grows by `+3`. The three new
scenarios assert `alert-count: 0` + the standard
`lookback-exceeded` / `malformed-emission` diagnostic-absent gates
(no `plot-hash` — the rolling primitives' outputs are pinned
elsewhere via the runtime golden tests).

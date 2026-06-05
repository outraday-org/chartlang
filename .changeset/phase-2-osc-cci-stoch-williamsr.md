---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 9 — oscillator ports: `ta.cci`, `ta.stoch`, `ta.williamsR`.

Ships three foundational momentum / oscillator primitives under
`packages/runtime/src/ta/`:

- `ta.cci(source, length, opts?)` — Commodity Channel Index over a
  configurable source (typically `bar.hlc3`). Lambert constant
  `scaling = 0.015` hard-coded; flat-window (`meanDev === 0`) emits
  `NaN`. Unbounded by construction.
- `ta.stoch(opts?)` — Stochastic Oscillator (`%K` + `%D`) over
  `bar.high` / `bar.low` / `bar.close`. Composes `ta.highest` +
  `ta.lowest` + two chained `ta.sma` smoothing layers via sub-slot
  ids. Bounded `[0, 100]` (or `NaN`). Defaults `(kLength=14,
  kSmoothing=3, dLength=3)`.
- `ta.williamsR(length, opts?)` — Williams %R over `bar.high` /
  `bar.low` / `bar.close`. Composes `ta.highest` + `ta.lowest`.
  Bounded `[-100, 0]` (or `NaN`).

Each primitive ships the §22.10 set: impl + unit + property + golden
+ bench pair + conformance scenario (inlined per Task 1) +
auto-generated `docs/primitives/ta/<id>.md`.

Introduces a new metadata layer on the runtime registry:

- `TA_REGISTRY_METADATA: Readonly<Partial<Record<keyof typeof
  TA_REGISTRY, PrimitiveMetadata>>>` — per-primitive `primarySeriesKey`,
  `visibleSeriesKeys`, and `yDomain` hints for renderers (pane layout,
  legend ordering, y-axis scaling). `ta.stoch` records
  `primarySeriesKey: "k"`, `visibleSeriesKeys: ["k", "d"]`,
  `yDomain: { kind: "fixed", min: 0, max: 100 }`; `ta.williamsR`
  records `yDomain: { kind: "fixed", min: -100, max: 0 }`. Unbounded
  primitives (e.g. `ta.cci`, `ta.sma`) carry no metadata entry —
  consumers default to `auto`.

Core surface widens with `CciOpts`, `StochOpts`, `WilliamsROpts` opts
bags + `StochResult` two-output type, plus the matching `TaNamespace`
methods and throw-sentinel stubs. `STATEFUL_PRIMITIVES` extends with
`ta.cci` / `ta.stoch` / `ta.williamsR` (all `slot: true`). Compiler
shim mirrors the new core surface.

Three conformance scenarios (`taCci.scenario.ts`, `taStoch.scenario.ts`,
`taWilliamsR.scenario.ts`) registered against `PHASE_1_SCENARIOS` via
the Task-1 `inlineSource` extension. Plot-hash pinning deferred to
Phase-2 closeout (Task 30) per the established cross-functional
scenario convention.

DIVERGENCE from invinite reference (`stoch.ts`): the spec requires
flat-window (`hh === ll`) → `NaN` at `k`, whereas invinite falls back
to the prior valid kRaw (or 50 on the first slot, per TradingView).
The task spec overrides; documented in the impl's provenance header.

`CciOpts` intentionally narrows away invinite's `scaling` knob —
chartlang hard-codes the canonical Lambert constant.

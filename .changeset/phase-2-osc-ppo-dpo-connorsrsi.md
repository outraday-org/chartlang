---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 10 — oscillator ports: `ta.ppo`, `ta.dpo`,
`ta.connorsRsi`.

Ships three derived oscillator primitives under
`packages/runtime/src/ta/`:

- `ta.ppo(source, opts?)` — Percentage Price Oscillator, the
  scale-invariant cousin of MACD. Three outputs (`{ ppo, signal,
  hist }`) over `100 * (fastEma - slowEma) / slowEma`. Composes three
  `ta.ema` sub-slots (`${slotId}/fast`, `${slotId}/slow`,
  `${slotId}/signal`) per §9.4 — folds invinite's private EMA copy
  onto the canonical primitive. Defaults `(12, 26, 9)`. `slow === 0`
  emits `NaN` at the PPO line; signal can still be defined off prior
  values.
- `ta.dpo(source, length, opts?)` — Detrended Price Oscillator
  (non-centered, TradingView default). `dpo[i] = source[i -
  displacement] - sma[i]` with `displacement = floor(length / 2) +
  1`. Composes one `ta.sma` sub-slot plus a per-slot source-window
  Float64RingBuffer for the O(1) per-bar shifted-source lookup.
- `ta.connorsRsi(source, opts?)` — Connors RSI, a `[0, 100]`-bounded
  blend of `RSI(source, rsiLength)`, `RSI(streak, streakLength)`,
  and `PercentRank(ROC(source, 1), rocLength)`. Composes two
  `ta.rsi` sub-slots — no private RSI math duplication. Defaults
  `(3, 2, 100)`. Sub-component NaN → component skipped in the
  average (per task spec §6, diverges from invinite's stricter
  all-finite requirement to align with the Pine semantic).

Each primitive ships the §22.10 set: impl + unit + property +
golden + bench pair + conformance scenario (inlined per Task 1) +
auto-generated `docs/primitives/ta/<id>.md`.

`TA_REGISTRY_METADATA` extends with:

- `ppo`: `primarySeriesKey: "ppo"`, `visibleSeriesKeys: ["ppo",
  "signal", "hist"]`, `yDomain: { kind: "auto" }`.
- `connorsRsi`: `yDomain: { kind: "fixed", min: 0, max: 100 }`.
- `dpo`: no metadata entry (unbounded — consumers default to
  `auto`).

Core surface widens with `PpoOpts`, `DpoOpts`, `ConnorsRsiOpts`
opts bags + `PpoResult` three-output type, plus the matching
`TaNamespace` methods and throw-sentinel stubs.
`STATEFUL_PRIMITIVES` extends with `ta.ppo` / `ta.dpo` /
`ta.connorsRsi` (all `slot: true`). Compiler shim mirrors the new
core surface.

Three conformance scenarios (`taPpo.scenario.ts`,
`taDpo.scenario.ts`, `taConnorsRsi.scenario.ts`) registered against
`PHASE_1_SCENARIOS` via the Task-1 `inlineSource` extension.
Plot-hash pinning deferred to Phase-2 closeout (Task 30) per the
established cross-functional scenario convention.

DEVIATIONS from invinite reference (commit
`078f41fe2569d659d5aba726da8bcb5d3e2ced02`):

- `ppo.ts` — invinite carries a private EMA copy
  (`computeMaSeries(oscillatorMaType, ...)`); chartlang routes
  through the canonical `ta.ema` primitive via sub-slot
  composition (matches `ta.macd`). §9.4 fold satisfied.
- `dpo.ts` — only the non-centered (TradingView default) render
  mode is shipped. Invinite's `centered: true` mode emits
  `dpo[i] = src[i] - sma[i + displacement]`, which depends on the
  future SMA; chartlang's append-only ring-buffer contract can't
  backfill, so that mode is deferred. Documented in the impl's
  provenance header.
- `connorsRsi.ts` — invinite requires all three components finite
  for the CRSI line to define; the task spec (§6) overrides with
  "sub-component NaN → component skipped in the average". We
  follow the spec, which tightens alignment with the Pine
  `ta.connorsRsi` semantic where streak-RSI warmup doesn't gate
  the rsi-on-close component.

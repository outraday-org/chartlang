---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-cli": minor
---

Phase 2 — `0.2` full indicator parity.

- 81 new `ta.*` primitives (6 cross-functional + 75 §9.2 ports);
  `TA_REGISTRY` cardinality 9 -> 90; `STATEFUL_PRIMITIVES`
  cardinality 12 -> 93.
- 5 new chained-MA helpers + 5 new stats/volatility helpers in
  `packages/runtime/src/ta/lib/`.
- 6 new `PlotKind`s (histogram, bars, area, filled-band, label,
  marker) + canvas2d renderers + `validateEmission` arms.
- `Bar` extended with `hl2` / `hlc3` / `ohlc4` / `hlcc4` derived
  source fields — runtime already pre-computes on `BarView`.
- `Scenario` extended with `inlineSource?: string` so Phase-2
  scenarios stay self-contained without bloating
  `examples/scripts/`.
- `STATEFUL_PRIMITIVES` shape widened from `ReadonlySet<string>`
  to `ReadonlySet<{ name: string; slot: boolean }>` to support
  `ta.nz` (the only stateless `ta.*`).
- Universal `opts.offset` honoured on every `ta.*` primitive
  (Phase-1 backfill in Task 29).
- `chartlang docs` subcommand generates
  `docs/primitives/ta/<id>.md` per primitive.
- `PHASE_2_INDICATORS` + `PHASE_5_DEFERRED` inventories exported
  from `@invinite-org/chartlang-conformance` and pinned by
  `phase2Coverage.test.ts` (Task 30).
- 100% coverage maintained across every published package.
- `apiVersion: 1` script header unchanged; Phase 2 is additive
  at runtime.

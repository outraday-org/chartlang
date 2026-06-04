# Task 10 — Oscillator ports: `ta.ppo`, `ta.dpo`, `ta.connorsRsi`

> **Status: TODO**

## Goal

Port three derived oscillators: PPO (Percentage Price Oscillator),
DPO (Detrended Price Oscillator), Connors RSI.

## Prerequisites

- Task 7 (`ta.dema`, `ta.tema` and the broader EMA backbone).
- Task 9 (foundational oscillator surface).

## Current Behavior

`ta.ppo`, `ta.dpo`, `ta.connorsRsi` absent.

## Desired Behavior

- `TaNamespace` extends with three new methods.
- `TA_REGISTRY` cardinality 29 → 32.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.ppo(source: Series<number>, opts?: PpoOpts): PpoResult;     // { ppo, signal, hist }
ta.dpo(source: Series<number>, length: number, opts?: DpoOpts): Series<number>;
ta.connorsRsi(source: Series<number>, opts?: ConnorsRsiOpts): Series<number>;
```

- `PpoOpts`: `{ fastLength?: number; slowLength?: number; signalLength?: number; offset?: number }` (defaults 12, 26, 9).
- `DpoOpts`: `{ offset?: number; lineStyle?: PlotLineStyle }`.
- `ConnorsRsiOpts`: `{ rsiLength?: number; streakLength?: number; rocLength?: number; offset?: number }` (defaults 3, 2, 100).

`PpoResult = Readonly<{ ppo: Series<number>; signal: Series<number>; hist: Series<number> }>`.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.ppo` | `indicators/ppo.ts` | `slowLength + signalLength - 2` |
| `ta.dpo` | `indicators/dpo.ts` | `length` |
| `ta.connorsRsi` | `indicators/connors-rsi.ts` | `max(rsiLength, streakLength, rocLength) + 1` |

- PPO: `100 · (EMA(src, fast) − EMA(src, slow)) / EMA(src, slow)`,
  signal = `EMA(ppo, signalLength)`, hist = `ppo − signal`. Folds
  the private EMA copy onto `lib/emaFloat64` (§9.4 says invinite's
  `ppo.ts` keeps its own EMA — fold it).
- DPO: `src − SMA(src, length, offset = length/2 + 1)`. Uses the
  Phase-1 SMA helper.
- Connors RSI: `(RSI(src, rsiLength) + RSI(streak, streakLength) +
  PercentRank(ROC(src, 1), rocLength)) / 3`. Composes Phase-1 RSI
  + a streak helper (new private helper inside connorsRsi.ts —
  not factored to lib until a second consumer appears).

### 4. Slot value shapes

- `ta.ppo`: `{ outputs: { ppo, signal, hist }, fastEmaSub, slowEmaSub, signalEmaSub }` — sub-slot composition.
- `ta.dpo`: `{ outBuffer, series, smaSub, sourceWindow }`.
- `ta.connorsRsi`: `{ outBuffer, series, rsiSub, streakRsiSub, streakState: { sign: 1 | -1 | 0; runLength: number }, rocWindow, percentRankWindow }`.

### 5. Multi-output for `ta.ppo`

- `primarySeriesKey: "ppo"`.
- `getVisibleSeriesKeys`: `["ppo", "signal", "hist"]`.
- `yDomain: { kind: "auto" }`.

### 6. NaN handling

PPO: zero-denominator (zero-EMA) → NaN. DPO: source NaN →
NaN output. Connors RSI: sub-component NaN → component skipped
in the average (matches invinite); fully-NaN → NaN.

### 7. §22.10 set + scenarios

| File | Script |
|---|---|
| `taPpo.scenario.ts` | `const p = ta.ppo(bar.close); plot(p.ppo); plot(p.signal); plot(p.hist);`. |
| `taDpo.scenario.ts` | `plot(ta.dpo(bar.close, 21))`. |
| `taConnorsRsi.scenario.ts` | `plot(ta.connorsRsi(bar.close))`. |

### 8. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + PpoResult. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Three entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{ppo,dpo,connorsRsi}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×3 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 32; metadata for `ppo`. |
| `packages/runtime/src/ta/registry.test.ts` | Modify | Cardinality. |
| `packages/conformance/src/scenarios/<id>.scenario.ts` | Create (×3) | Scenarios. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Re-export. |
| `packages/conformance/src/scenarios/scenarios.test.ts` | Modify | Add. |
| `docs/primitives/ta/<id>.md` | Generate (×3) | Pages. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage),
`pnpm bench:ci`, `pnpm docs:check`, `pnpm docs:gate`,
`pnpm readme:check`, `pnpm conformance`.

## Changeset

`.changeset/phase-2-osc-ppo-dpo-connorsrsi.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Three primitives exported + registered (cardinality 32).
- PPO's private EMA copy folded onto `lib/emaFloat64` (§9.4).
- Connors RSI's streak-RSI sub-component uses `ta.rsi` sub-slot
  rather than re-implementing RSI math.
- §22.10 set complete; 100% coverage.
- Changeset committed.

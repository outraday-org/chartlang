# TA — Momentum Oscillators II

> **Status: TODO**

## Goal

One runnable example per remaining momentum / cycle oscillator, category
`ta-momentum`; shrink the allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Per [Task 3](./3-ta-moving-averages.md). Oscillators use
`overlay: false`. Multi-component outputs (MACD histogram + signal, PPO,
KST) plot each component; add `hline(0)` zero lines where idiomatic.

## Primitives

| Primitive id | Status | Example concept |
|--------------|--------|-----------------|
| `ta.macd` | new | MACD line + signal + histogram (3 plots). |
| `ta.ppo` | new | Percentage Price Oscillator + signal. |
| `ta.pvo` | new | Percentage Volume Oscillator (needs volume). |
| `ta.ao` | new | Awesome Oscillator histogram. |
| `ta.bop` | new | Balance of Power oscillator. |
| `ta.fisher` | new | Fisher Transform + trigger line. |
| `ta.connorsRsi` | new | Connors RSI composite. |
| `ta.coppock` | new | Coppock Curve. |
| `ta.kst` | new | Know Sure Thing + signal. |
| `ta.pmo` | new | Price Momentum Oscillator + signal. |
| `ta.trix` | new | TRIX(15) + signal. |
| `ta.rvi` | new | Relative Vigor Index + signal. |
| `ta.rvgi` | new | Relative Vigor (RVGI) variant + signal. |
| `ta.dpo` | new | Detrended Price Oscillator. |
| `ta.ultimateOsc` | new | Ultimate Oscillator(7,14,28). |
| `ta.chop` | new | Choppiness Index with 38.2/61.8 guides. |
| `ta.trendStrengthIndex` | new | Trend Strength Index oscillator. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×17) | Create | One per id. |
| `examples/catalogue/ta-momentum-ii.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×17) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-ta-momentum-ii.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per id; catalogue + allowlist
  updated; generators re-run; gates green.

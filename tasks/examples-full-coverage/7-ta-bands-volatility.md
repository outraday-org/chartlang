# TA — Bands, Channels & Volatility

> **Status: TODO**

## Goal

One runnable example per band/channel/volatility `ta.*` primitive,
category `ta-bands-volatility`; shrink the allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Per [Task 3](./3-ta-moving-averages.md). Bands/channels overlay on price
(`overlay: true`, plot upper/middle/lower); pure volatility measures
(ATR, stdev, etc.) are oscillators (`overlay: false`).

## Primitives

| Primitive id | Status | Example concept |
|--------------|--------|-----------------|
| `ta.bb` | covered (`bollinger-bands`) | — |
| `ta.bbw` | new | Bollinger Bandwidth oscillator. |
| `ta.bbPercentB` | new | Bollinger %B with 0/1 guides. |
| `ta.keltner` | new | Keltner Channel(20,2) overlay. |
| `ta.donchian` | new | Donchian Channel(20) high/low/mid overlay. |
| `ta.envelope` | new | Moving-average envelope(20, 2.5%) overlay. |
| `ta.atr` | new | Average True Range(14) oscillator. |
| `ta.adr` | new | Average Daily Range. |
| `ta.stdev` | new | Rolling standard deviation(20). |
| `ta.historicalVolatility` | new | Historical Volatility(%). |
| `ta.ulcerIndex` | new | Ulcer Index drawdown-risk oscillator. |
| `ta.massIndex` | new | Mass Index with 27/26.5 reversal bulge guides. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×11 new) | Create | One per uncovered id. |
| `examples/catalogue/ta-bands-volatility.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×11) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-ta-bands-volatility.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per uncovered id; catalogue +
  allowlist updated; generators re-run; gates green.

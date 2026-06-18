# TA — Momentum Oscillators I

> **Status: TODO**

## Goal

One runnable example per momentum oscillator in this batch, category
`ta-momentum`, wired into `examples/scripts/`, the catalogue, demo, and
docs; shrink the coverage allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Follow the full playbook in [Task 3](./3-ta-moving-averages.md) (MIT
header; top-level imports + destructured params together;
`defineIndicator({ apiVersion: 1, … })`; compiles clean + runs without
throwing on demo daily candles; per-id catalogue entry + allowlist
removal + `pnpm examples:generate` + `pnpm examples:coverage`).
Oscillators use `overlay: false` (separate pane). Pair multi-line
outputs (`%K`/`%D`, signal lines) with multiple `plot`s and `hline`
guide levels where idiomatic.

## Primitives

| Primitive id | Status | Example concept |
|--------------|--------|-----------------|
| `ta.rsi` | covered (`rsi-divergence-alert`) | — |
| `ta.stochRsi` | new | Stoch RSI %K/%D with 80/20 `hline`s. |
| `ta.stoch` | new | Stochastic %K/%D(14,3,3). |
| `ta.smi` | new | Stochastic Momentum Index + signal. |
| `ta.williamsR` | new | Williams %R(14) with -20/-80 guides. |
| `ta.cci` | new | CCI(20) with ±100 `hline`s. |
| `ta.cmo` | new | Chande Momentum Oscillator(9). |
| `ta.momentum` | new | Momentum(10) zero-line oscillator. |
| `ta.roc` | new | Rate of Change(12) percent oscillator. |
| `ta.tsi` | new | True Strength Index + signal line. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×9 new) | Create | One per uncovered id. |
| `examples/catalogue/ta-momentum-i.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove this family's ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×9) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-ta-momentum-i.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per uncovered id.
- Catalogue + allowlist updated; generators re-run; all gates green.

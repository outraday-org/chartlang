# TA — Trend, Directional & Stops

> **Status: TODO**

## Goal

One runnable example per trend / directional / trailing-stop `ta.*`
primitive, category `ta-trend`; shrink the allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Per [Task 3](./3-ta-moving-averages.md). Trailing-stop, SAR and
Ichimoku draw on the price scale (`overlay: true`, multi-line for
Ichimoku); ADX/DMI/Aroon are oscillators (`overlay: false`). Stops that emit a single trailing series
plot it directly; directional indices plot their +DI/-DI/ADX or up/down
components separately.

## Primitives

| Primitive id | Status | Example concept |
|--------------|--------|-----------------|
| `ta.ichimoku` | new | Ichimoku Cloud overlay — Tenkan/Kijun/Senkou A·B/Chikou (`overlay: true`, multi-`plot`). |
| `ta.adx` | new | ADX(14) trend-strength oscillator with 25 `hline`. |
| `ta.dmi` | new | +DI / -DI / ADX three-line directional plot. |
| `ta.aroon` | new | Aroon Up / Aroon Down(25). |
| `ta.aroonOsc` | new | Aroon Oscillator (Up − Down). |
| `ta.psar` | new | Parabolic SAR dots overlay on price. |
| `ta.supertrend` | new | Supertrend(10,3) trailing line overlay. |
| `ta.vortex` | new | Vortex VI+ / VI−(14). |
| `ta.chandeKrollStop` | new | Chande–Kroll long/short stop overlay. |
| `ta.volatilityStop` | new | ATR volatility stop trailing line overlay. |
| `ta.chandelier` | new | Chandelier Exit long/short stops overlay. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×11) | Create | One per id. |
| `examples/catalogue/ta-trend-directional.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×11) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-ta-trend-directional.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per id; catalogue + allowlist
  updated; generators re-run; gates green.

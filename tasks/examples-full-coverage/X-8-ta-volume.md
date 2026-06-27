# TA — Volume & Flow

> **Status: TODO**

## Goal

One runnable example per volume / money-flow `ta.*` primitive, category
`ta-volume`; shrink the allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Per [Task 3](./3-ta-moving-averages.md). **Edge case — volume data:**
these primitives read `bar.volume`. Confirm the demo candles carry
volume (`apps/site` demo bar source); if a series renders all-NaN
because the demo lacks volume, that is acceptable — the script must
still compile and run without throwing. Most volume oscillators use
`overlay: false`; VWAP overlays on price (`overlay: true`).

## Primitives

| Primitive id | Status | Example concept |
|--------------|--------|-----------------|
| `ta.obv` | new | On-Balance Volume cumulative line. |
| `ta.vwap` | new | Session VWAP overlay on price. |
| `ta.anchoredVwap` | new | Anchored VWAP from a fixed bar/time anchor. |
| `ta.cmf` | new | Chaikin Money Flow(20) with zero line. |
| `ta.mfi` | new | Money Flow Index(14) with 80/20 guides. |
| `ta.eom` | new | Ease of Movement(14). |
| `ta.nvi` | new | Negative Volume Index. |
| `ta.pvi` | new | Positive Volume Index. |
| `ta.pvt` | new | Price Volume Trend. |
| `ta.klinger` | new | Klinger Volume Oscillator + signal. |
| `ta.chaikinOsc` | new | Chaikin Oscillator. |
| `ta.adl` | new | Accumulation/Distribution Line. |
| `ta.netVolume` | new | Net Volume (up − down). |
| `ta.vol` | new | Raw volume series plot. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×14) | Create | One per id. |
| `examples/catalogue/ta-volume.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×14) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-ta-volume.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per id (volume-NaN render
  tolerated, no throw); catalogue + allowlist updated; generators
  re-run; gates green.

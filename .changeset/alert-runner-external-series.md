---
"@invinite-org/chartlang-alert-runner": minor
---

Script chains in the alert runner.

- `createAlertRunner({ externalSeries: { names } })` feeds the listed
  `input.externalSeries` inputs, by manifest input entry key (translated to
  the descriptor `name`): `warmUp(bars, { externalSeries: { key: number[] } })`
  aligned to the warm-up bars, `onBarClose(bar, { externalSeries: { key: v } })`
  one value per bar (missing / non-finite = `NaN`, a watermark-skipped bar
  appends nothing) and `onPreClose(bar, offsetMs, { externalSeries })` for the
  forming bar (copy only; a lossy replay re-sends each bar's values). Values
  go in as one-value offset windows, never the history (flat cost per bar).
  Unlisted external-series inputs are still refused with the 1.0 text.
  `validateAlertInputs(manifest, inputs, { externalSeries })` applies the
  same rule (and refuses two fed keys sharing one descriptor name). A
  warm-up array may hold up to `max(5,000, capabilities.maxLookback)`
  values; an unexpected host error fails a runner that feeds external
  series.
- `createSeriesRunner({ ...opts, plotSlots })` — a producer sharing the
  runner core: `warmUp` → `{ plots: { slotId: number[] } }`, `onBarClose` →
  `{ folded, events, plots: { slotId: number } }`, `onPreClose` → the
  pre-close result plus `plots`. Unknown / duplicate / empty slots throw
  `"invalid-argument"`.
- A runner that feeds external series is `"lossy"`
  (`snapshotFidelityOf(compiled, { externalSeries: true })`): no snapshot
  export, rebuild by warm-up.

`AlertRunner`'s 1.0 return types are unchanged.

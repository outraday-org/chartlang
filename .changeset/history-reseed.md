---
"@invinite-org/chartlang-runtime": minor
---

Treat a `history` push that **overlaps** already-processed history on a
non-fresh runner (`state.barIndex > 0` and the batch's first bar not strictly
newer than the last closed bar) as a full **re-seed** instead of an append. A
forward-continuation batch (every bar strictly newer — the chunked-history
shape hosts emit, e.g. to interleave secondary closes) still appends,
byte-identically to before. The runner rebuilds its whole state (main +
secondary streams, ta / `state.*` slots, dep / sibling runners, external-series
slots) and replays the supplied bars from bar 0, so re-pushed bars land at
`0..N-1` — not `N..2N-1`. This is the durable fix for external-series feeds and
plot-override maps that changed after the first seed: the latest live
`setExternalSeries` / `setPlotOverrides` maps are **preserved** across the
re-seed and re-read from bar 0, while a fresh runner (`barIndex === 0`) stays
byte-identical to before.

Two behavior caveats:

- **Undrained pre-reseed emissions are dropped** — their bar indices conflict
  with the replayed `0..N-1` range, and a host that re-pushes history has
  abandoned the prior emission stream.
- **Secondary streams reset empty** — the runtime cannot know the host's
  secondary history sources, so a `request.security` script re-seeded without a
  secondary re-push reads warmup-`NaN` until the caller re-pushes the secondary
  history.

A new `resetStateForHistoryReseed(state)` is exported from the runtime entry
(the re-seed mechanism; also the host-bundle preflight marker). The guard fires
identically through both `runner.onHistory(bars)` and
`runner.push({ kind: "history", bars })`. No `warmStart` is auto-run on re-seed.

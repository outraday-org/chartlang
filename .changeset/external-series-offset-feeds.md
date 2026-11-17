---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-host-quickjs": minor
---

External-series feeds can be windows. `ExternalSeriesFeed` gains an optional
`offset` — the absolute primary bar index of `values[0]` (default `0`) — and
the runtime reads bar `i` from `values[i - offset]`; a bar outside the window
reads `NaN`, and a feed whose `offset` is not a non-negative safe integer is
dropped. A host that advances bar by bar sends `{ values: [v], offset: i }`
through the existing `setExternalSeries` before bar `i` instead of re-sending
the whole history, so a long-lived runner costs O(1) per bar. External-series
rings are now also sized to the manifest's `maxLookback + 1` /
`dynamicFallback`, so a `bound[n]` read stays deep when a window feed carries
no length. Feeds without `offset` behave exactly as before. The QuickJS
dispatcher bundle inlines the new runtime; no protocol change.

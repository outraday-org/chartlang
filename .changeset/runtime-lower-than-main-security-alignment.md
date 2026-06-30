---
"@invinite-org/chartlang-runtime": minor
---

Add lower-than-main `request.security` alignment. When the requested secondary
interval is **finer** than the chart's main interval, each main bar now aligns to
the value of the **last secondary bar that closed at/before the main bar's
close** (the most recent sub-bar), read non-repainting. Previously the alignment
kernel always mapped each main bar to the first sub-bar by open time and
repainted as later sub-bars arrived — correct only for a coarser/equal secondary.

The new `alignSecondaryFinerThanMain` branch is a pure O(n+m) two-pointer pass
selected by a `secondaryIsFinerThanMain` flag derived at the `request.security`
call sites from the main (`ctx.stream.bar.interval`) vs secondary interval
durations (via core's `intervalToSeconds`). Coarser/equal secondaries are
byte-identical to before, and there is no new runtime rejection of finer
secondaries. Both the data form and the expression form route through the flag,
and the alignment cache validates it so a finer secondary never reuses a
coarser-aligned array.

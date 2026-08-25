---
"@invinite-org/chartlang-runtime": minor
---

`time.timeClose(t)` now returns the host-supplied close instant when `t` identifies the current bar and the host stated one on `Bar.closeTime`; every other `t`, an absent fact, and a malformed fact keep the existing `t + interval` fallback. The fact is validated at the runtime boundary (finite and strictly after the bar) and ignored otherwise, carried as a scalar on the live `BarView` rather than as a series, revisable by a tick without committing a bar, and deliberately absent from stream snapshots. `createTimeNamespace` gained an optional fifth `getBarCloseTime` argument that defaults to "no fact", so four-argument callers are unchanged.

---
"@invinite-org/chartlang-compiler": minor
---

Mirror `Bar.closeTime` in the ambient core shim, so a script may read the host's real bar-close instant (and so `BarSeries` / `ComputeContext.bar` carry it) instead of the shim drifting out of lockstep with `packages/core/src/`.

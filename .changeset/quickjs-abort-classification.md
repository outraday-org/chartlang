---
"@invinite-org/chartlang-host-quickjs": patch
---

Poison the host only when the interrupt actually fired, not whenever a step ran long.

An aborted step poisons the host, because a computation cut mid-bar leaves `ta` state
truncated and every later bar would be silently wrong. Classifying the abort by asking
whether the deadline had passed was too broad: the budget is WALL-CLOCK, so a step that
merely got descheduled — GC, a loaded machine, a noisy neighbour — overruns it while
running perfectly ordinary code. Any error that step raised on its own (a script
`throw`, a bad input, a guest `TypeError`) was then relabelled as an abort, and a host
whose state was entirely intact refused every subsequent `drain()` /
`exportSnapshot()` / `importSnapshot()` and no-op'd every subsequent `push()`.

Only the interrupt truncates a computation, so only the interrupt now poisons: the
interrupt handler records that it fired, and that flag — armed per call alongside the
deadline — is what `asAbort` reads. Genuine aborts (`maxStepMs` in `compute`,
`maxLoadTimeoutMs` at a module's top level, a stopped job queue) are unchanged, as is
the `step overshoot` host error that still reports a slow-but-complete step.

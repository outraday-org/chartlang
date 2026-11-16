---
"@invinite-org/chartlang-host-quickjs": minor
---

Deterministic step budget: the new optional limit `QuickJsHostLimits.maxSteps` (default `Infinity`, so nothing
changes unless it is set) bounds every `load()` / `push()` by QuickJS interrupt checkpoints, charged
`QUICKJS_STEPS_PER_INTERRUPT_POLL` (10,000, exported) per interrupt poll — the same script on the same bars aborts at
the same place on any machine. `QuickJsStepAbortedError` gains an optional `reason: "time" | "steps"` (constructor
`(message, reason?)`, backwards compatible), set on every interrupt abort and carried onto the refusals of a poisoned
host. `QuickJsAbortReason` is exported.

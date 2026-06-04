---
"@invinite-org/chartlang-host-worker": minor
---

Land the Phase-1 browser-default `ScriptHost`. `createWorkerHost`
boots a Web Worker, loads a compiled chartlang bundle via a
`data:` URL dynamic import, and round-trips `CandleEvent` /
`RunnerEmissions` over a structured-clone-safe postMessage
protocol (`HostToWorker` / `WorkerToHost`). The `load` frame
carries the adapter's `Capabilities` bag and the host's
`HostLimits`; the worker boot is stateless about both. A
measurement-only watchdog times every `candleEvent` dispatch
against `maxCpuMsPerStep` and posts `step-overshoot` (no
preemption — real interrupt-based caps land with the QuickJS
host in Phase 5). Drains validate every plot / alert through
`adapter-kit`'s `validateEmission` before posting; malformed
emissions become `malformed-emission` diagnostics. Replaces the
Phase-0 `PACKAGE_VERSION` placeholder.

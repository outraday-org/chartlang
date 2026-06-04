# packages/host-worker/

`@invinite-org/chartlang-host-worker` — browser-default `ScriptHost`.
Phase-1 walking-skeleton ships the postMessage wire protocol +
measurement-only CPU watchdog. Phase-5's QuickJS host re-uses the
same `ScriptHost` shape with real preemption + hard heap caps.

## Invariants

- **Module load uses `data:` URLs, not `Blob` + `createObjectURL`.**
  A single code path runs in both browsers and Node (vitest tests).
  Production browsers, Node 18+, and the Worker spec all accept
  `import("data:text/javascript;base64,...")`. Do not "fix" this
  back to a `Blob`-based scheme — it would split the production
  and test paths and bring back a coverage exemption.
- **`workerBoot.ts` is the thin `self` adapter; the testable factory
  is `createWorkerBoot.ts`.** Production browsers load
  `dist/worker-boot.js` (bundled via `scripts/buildWorkerBoot.ts`);
  tests drive `createWorkerBoot(scope)` directly against a
  `MessageChannel`-backed `WorkerBootScope`. `workerBoot.ts` and
  `defaultWorkerFactory.ts` are the only files excluded from
  `vitest.config.ts` coverage besides `dist/worker-boot.js`.
- **Validation runs on `drain()`, not on every emit.** The worker's
  `filterEmissions` is the trust boundary into postMessage — it
  walks every plot / alert through adapter-kit's `validateEmission`
  and sinks failures into the diagnostics array. The runtime
  already validates on push (`pushPlot` / `pushAlert` in
  `runtime/src/emit/emissionsQueue.ts`), so `filterEmissions` is a
  defence-in-depth pass against a host-side compromise. Drawings
  pass through unchanged (no `draw.*` in Phase 1).
- **`step-overshoot` is fire-and-forget — no nonce.** Only `drain`
  round-trips carry a nonce. Overshoots happen inside `candleEvent`
  dispatch which is fire-and-forget by design. Adding a nonce
  to overshoot would require a synchronous reply contract per
  push, which Phase 1 explicitly avoids.
- **`HostToWorker.load` carries `limits` alongside `capabilities`.**
  The worker boot is stateless about both — no in-worker default
  capabilities bag, no in-worker default limits. The host is the
  single source of truth.
- **`createWorkerHost` returns a frozen `ScriptHost`.** Mirrors
  `createScriptRunner`'s immutability contract in the runtime so
  consumer-repo adapters cannot monkey-patch methods after
  construction.
- **`dispose()` clears `pendingDrains` after terminating.** A
  drain awaiting a reply post-dispose stays unresolved forever
  (the worker is gone). Tests assert this — adding a "resolve
  with empty emissions on dispose" shortcut would mask resource
  leaks.

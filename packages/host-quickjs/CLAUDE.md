# packages/host-quickjs/

`@invinite-org/chartlang-host-quickjs` — QuickJS-WASM `ScriptHost` for
server-side and untrusted-script execution. It mirrors `host-worker`'s public
`ScriptHost` lifecycle while adding hard QuickJS runtime limits.

## Invariants

- **Dispatcher source is evaluated once per QuickJS context.** The host reads
  `dist/dispatcher.js`, evaluates it during the first `load()`, then calls only
  `__chartlang_load(json)`, `__chartlang_push(json)`,
  `__chartlang_setPlotOverrides(json)`, `__chartlang_drain(json)`, and
  `__chartlang_dispose()` for that context. `__chartlang_setPlotOverrides` is a
  synchronous host→guest call (like `drain`) that swaps the runtime's live
  presentation-override map and replies `ack`; the JSON membrane drops any
  getter / function-shaped fields so no live reference crosses (pinned by
  `sandbox.test.ts`). After changing the dispatcher you MUST rebuild
  (`pnpm -F @invinite-org/chartlang-host-quickjs build:dispatcher`) — the real-
  QuickJS tests load `dist/dispatcher.js`, not `src/`.
- **`ScriptHost` is a type alias of `host-worker`'s `ScriptHost`** (`types.ts`):
  any method added there (e.g. `setPlotOverrides`) is inherited here
  automatically — do not redeclare a divergent shape or cross-host parity
  breaks.
- **Boundary values are JSON strings.** Do not pass host functions or mutable
  host objects into QuickJS. The dispatcher parses host frames and stringifies
  reply frames.
- **Runtime caps are host-owned.** `QuickJsHostLimits.maxHeapBytes` maps to
  `quickjs-emscripten`'s `runtime.setMemoryLimit(...)`; `maxStepMs` drives the
  host-side interrupt handler and step-overshoot reporting.
- **Emission validation happens on `drain()`.** Keep this aligned with
  host-worker's trust boundary: plots and alerts pass through
  `validateEmission`, drawings pass through unchanged, diagnostics append.
- **Cross-host parity is the conformance contract.** Do not intentionally
  diverge from host-worker emission semantics. If QuickJS needs a host-specific
  sandbox rule, surface it as an error path rather than a different emission
  shape.
- **Single-script load adopts the `__manifest` sidecar.**
  `dispatcherCore`'s bundle builder returns `{ ...compiledDefault,
  manifest }` for a single-script module when the object-form
  `__manifest` global is present, mirroring host-worker's
  `buildBundleFromModule`. The compiler's `__manifest` carries fields the
  runtime `defineIndicator` stub zeroes (`requestedIntervals`, `outputs`,
  `plots`, `maxLookback`), so without this an MTF (`request.security`)
  script never registers its secondary streams. The single-object guard
  is `isSingleManifest` (TS #17002 — `Array.isArray` does not subtract a
  `ReadonlyArray` union member). Cross-host parity with host-worker is the
  conformance contract.
- **Compiled source is evaluated directly, not via `data:` URLs.** The
  host-worker `data:` URL invariant is browser-specific; QuickJS receives the
  module source through the JSON membrane and the dispatcher turns supported
  self-contained ESM into an in-realm script object.
- **`dispose()` clears pending drains after disposing the context.** A drain
  awaiting reply post-dispose stays unresolved forever; resolving it with empty
  emissions would hide lifecycle leaks.

## Sandbox Matrix

- `Function` constructor reach is blocked by deleting guest `eval` /
  `Function` before compute.
- Direct `eval` is blocked by the same hardened guest globals.
- Dynamic `import()` has no host module resolver and must surface as a host
  error.
- `globalThis` writes stay inside the QuickJS realm and never mutate host
  globals.
- Host-object capture attempts are constrained by the JSON-string membrane;
  non-JSON members are not returned to the host.
- Infinite loops are bounded by the QuickJS interrupt handler and reported
  through `onHostError`.
- OOM attempts are bounded by `QuickJsHostLimits.maxHeapBytes` and reported as
  `quickjs-oom`.
- Realm reflection stays in the QuickJS realm; host-only methods remain
  unavailable.
- `Symbol.iterator` prototype hijacks must not break emission serialization.
- Revoked Proxies after emit must not corrupt already-serialized drain output.

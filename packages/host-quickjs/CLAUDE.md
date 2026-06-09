# packages/host-quickjs/

`@invinite-org/chartlang-host-quickjs` — QuickJS-WASM `ScriptHost` for
server-side and untrusted-script execution. It mirrors `host-worker`'s public
`ScriptHost` lifecycle while adding hard QuickJS runtime limits.

## Invariants

- **Dispatcher source is evaluated once per QuickJS context.** The host reads
  `dist/dispatcher.js`, evaluates it during the first `load()`, then calls only
  `__chartlang_load(json)`, `__chartlang_push(json)`,
  `__chartlang_drain(json)`, and `__chartlang_dispose()` for that context.
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

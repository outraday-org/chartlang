# packages/host-quickjs/

`@invinite-org/chartlang-host-quickjs` — QuickJS-WASM `ScriptHost` for
server-side and untrusted-script execution. It mirrors `host-worker`'s public
`ScriptHost` lifecycle while adding hard QuickJS runtime limits.

## Invariants

- **Dispatcher source is evaluated once per QuickJS context.** The host reads
  `dist/dispatcher.js`, evaluates it during the first `load()`, then calls only
  `__chartlang_load(json)`, `__chartlang_push(json)`,
  `__chartlang_setPlotOverrides(json)`, `__chartlang_setExternalSeries(json)`,
  `__chartlang_drain(json)`, and `__chartlang_dispose()` for that context.
  `__chartlang_setPlotOverrides` and `__chartlang_setExternalSeries` are
  synchronous host→guest calls (like `drain`) that swap the runtime's live
  maps and reply `ack`; the JSON membrane drops any getter /
  function-shaped fields so no live reference crosses (pinned by
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
- **Module load delegates to the shared runtime loader
  `buildBundleFromModule`.** QuickJS has no ESM importer, so
  `dispatcherCore.loadCompiled` captures `default` / `__manifest` /
  `__dependencies` / each sibling into host globals as the guest evaluates the
  module, then **reassembles a synthetic `CompiledModuleExport`** from those
  globals and calls the SAME `buildBundleFromModule` host-worker uses (imported
  from `@invinite-org/chartlang-runtime`; the local merge + `isSingleManifest`
  were deleted). The loader merges the authoritative `__manifest` (which carries
  fields the runtime `defineIndicator` stub zeroes — `requestedIntervals`,
  `outputs`, `plots`, `maxLookback`, `requestedFeeds`) over the captured
  default, so an MTF (`request.security`) script registers its secondary
  streams; it throws on a stub default with no `__manifest`. Because
  `moduleSourceToScript` rewrites `export const __manifest` into a global (the
  guest realm has no `__manifest` binding), the compiler's default-manifest
  rebind INLINES the manifest JSON rather than referencing `__manifest` — so the
  guest eval never hits a dangling reference. Cross-host parity with host-worker
  is the conformance contract. The whole `__manifest` is spread through, so the
  HTF-expression `request.security(opts, expr)` form (carried by
  `manifest.securityExpressions`) needs no dispatcher change. The multi-symbol
  feature (`manifest.requestedFeeds` + the composite `CandleEvent.streamKey`
  `feedKey(symbol, interval)`) rides the SAME spread with NO dispatcher change —
  `requestedFeeds` carries through the full spread and `streamKey` passes
  untouched, so a two-symbol script routes each composite stream identically to
  host-worker (cross-host parity covered by `integration.test.ts`'s two-symbol
  parity test).
- **Compiled source is evaluated directly, not via `data:` URLs.** The
  host-worker `data:` URL invariant is browser-specific; QuickJS receives the
  module source through the JSON membrane and the dispatcher turns supported
  self-contained ESM into an in-realm script object.
- **A `history` push that OVERLAPS already-processed history on a non-fresh
  runner re-seeds (a forward continuation appends) — the dispatcher forwards
  it verbatim.** Replay-from-bar-0 (with the latest live feed / override maps,
  undrained emissions dropped) is a RUNTIME behavior
  (`resetStateForHistoryReseed`) the guest inherits; the dispatcher has no
  history special-casing. After a runtime change you MUST rebuild
  (`build:dispatcher`) so the re-seed lands in `dist/dispatcher.js` — the
  real-QuickJS `integration.test.ts` loads the bundle, and cross-host parity
  with host-worker's re-seed is the conformance contract. `minify: false`
  keeps `resetStateForHistoryReseed` verbatim in the bundle.
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

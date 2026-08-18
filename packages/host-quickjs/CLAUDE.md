# packages/host-quickjs/

`@invinite-org/chartlang-host-quickjs` — QuickJS-WASM `ScriptHost` for
server-side and untrusted-script execution. It mirrors `host-worker`'s public
`ScriptHost` lifecycle while adding hard QuickJS runtime limits.

## Invariants

- **Dispatcher source is evaluated once per QuickJS context.** The host reads
  `dist/dispatcher.js`, evaluates it during the first `load()`, then calls only
  `__chartlang_load(json)`, `__chartlang_push(json)`,
  `__chartlang_setPlotOverrides(json)`, `__chartlang_setExternalSeries(json)`,
  `__chartlang_drain(json)`, `__chartlang_exportSnapshot(json)`,
  `__chartlang_importSnapshot(json)`, and `__chartlang_dispose()` for that
  context.
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
  breaks. **Inheriting the TYPE is not shipping the VERB**: a downstream
  probe that greps this package's `dist/` for a method name is checking the
  dispatcher, so a new verb needs the `HostToQuickJs` frame kind, the
  `createQuickJsHost` method, the `dispatcherCore` handler, AND the
  regenerated bundle — the type alias alone would let `dist/` mention the name
  while the guest still refuses it.
- **Snapshot verbs mirror host-worker exactly, including every refusal
  message.** `exportSnapshot` / `importSnapshot` are synchronous host→guest
  calls like `drain`; import is legal only after `load`, before the first
  push, and only for a matching `StateStoreKey` (which rides the `load`
  frame). Every refusal is a typed `snapshotError` frame — never `fatal` —
  and the host rethrows it as core's `SnapshotError`. The one DELIBERATE
  protocol divergence from host-worker: `load` carries NO `persistence`
  descriptor, because IndexedDB does not exist in this realm. Automatic
  persistence is host-worker-only; here the caller owns storage and uses the
  verbs.
- **Boundary values are JSON strings.** Do not pass host functions or mutable
  host objects into QuickJS. The dispatcher parses host frames and stringifies
  reply frames.
- **`load.sessionCalendar` mirrors host-worker: ROWS, never a built
  calendar.** `CreateQuickJsHostOpts.sessionCalendar` rides the existing `load`
  frame (no new frame kind) and the dispatcher forwards it to
  `createScriptRunner`, which rebuilds the `lookup()` guest-side — a method
  cannot cross the JSON membrane. This is the half that actually makes a
  server-side alert script's `session.isOpen` holiday-aware, so it needs the
  regenerated bundle like every other dispatcher change.
- **Runtime caps are host-owned, and EVERY guest call must arm one.** The
  interrupt handler reads an armed deadline carrying its own budget, not a fixed
  `maxStepMs`: `push()` arms `maxStepMs`, `load()` arms `maxLoadTimeoutMs`.
  TRAP: a call that arms nothing is not interruptible AT ALL — `load()` ran a
  compiled module's top level unbounded until 1.6, so a script that looped
  before its default export wedged the isolate with no error and no timeout, and
  no caller-side `Promise.race` can rescue a blocked thread. `maxHeapBytes` maps
  to `runtime.setMemoryLimit(...)`.
- **Pump the job queue until it is EMPTY, and never discard the result.**
  `executePendingJobs()` stops on the first exception with jobs still queued and
  returns that exception. Dropping it strands the job that settles the reply
  promise, and the `await` in `resolveStringPromise` then never returns — a
  silent stall, the worst failure shape this package has. Bound: this holds for
  guest-settled promises only; a host-resolved promise would need its own
  wall-clock deadline.
- **An abort is what the INTERRUPT FIRED on, never merely a slow step.** The
  interrupt handler records that it returned `true`, and that flag (armed per
  call next to the deadline) is what classifies a failure — not "has the
  deadline passed", and not the engine's message text. TRAP: the budget is
  wall-clock, so a descheduled step overruns it while running ordinary code;
  classifying on the deadline relabels that step's own `throw` as an abort and
  poisons a host whose `ta` state is intact. A slow-but-complete step is
  reported as `step overshoot` and stays usable.
- **An ABORTED host is poisoned and refuses work.** A step the runtime cut mid
  computation leaves `ta` state truncated, so `drain()` / `exportSnapshot()` /
  `importSnapshot()` throw `QuickJsStepAbortedError` and further `push()`es
  report and no-op. Serving that state would emit silently wrong values forever.
  `dispose()` always works — including poisoned — and clears the deadline first,
  or its own drain is interrupted and QuickJS asserts on `gc_obj_list`. OOM is
  deliberately NOT poisoning: the heap is exhausted, the computation is not
  truncated.
- **TIMING tests and benches must arm their own generous `maxStepMs`.** The
  budget is WALL-CLOCK (the interrupt handler compares `performance.now()`), so
  a scheduler preemption spends it: on a 2-core CI runner with the full suite in
  parallel a single ~0.15 ms bar routinely takes >1 ms of wall time, the step
  aborts, the host poisons, and the next `drain()` throws — a red build that
  says nothing about the ratio the test asserts. `perBarCompute.bench{,.test}.ts`
  and `roundTrip.bench{,.test}.ts` therefore pass
  `limits: { maxStepMs: BENCH_STEP_BUDGET_MS }`; `sandbox.test.ts` is where the
  1 ms default is exercised, against a deliberate infinite loop.
- **Emission validation happens on `drain()`.** Keep this aligned with
  host-worker's trust boundary: plots, alerts, alert-conditions, logs and
  orders pass through `validateEmission`, drawings pass through unchanged,
  diagnostics append. `partitionValidated`'s `slotIdOf` is what decides
  whether a dropped emission is attributable — plots, alerts and **orders**
  hand it their `slotId`, alert-conditions and logs hand it `null`.
- **A `Capabilities` boolean crosses the JSON membrane on the `...value`
  spread; only the five `ReadonlySet` fields are revived.** `stringifyFrame`
  turns a `Set` into an array and `dispatcherCore.reviveCapabilities` turns it
  back for `plots` / `drawings` / `alerts` / `inputs` / `symInfoFields`. Every
  boolean (`alertConditions`, `logs`, `orders`, `multiTimeframe`,
  `multiSymbol`) rides the spread untouched — do NOT add presence-based
  revival for one, because `false` and "absent" would become the same value
  and the runtime gates every `order.*` call on exactly that flag. Pinned by
  `dispatcherCore.test.ts`'s both-states case.
- **The dispatcher bundle inlines the RUNTIME, so a runtime change is
  invisible to the guest until you regenerate it.** `bundleDispatcher()`
  esbuilds `src/dispatcher.ts` with `bundle: true`, which pulls in
  `@invinite-org/chartlang-runtime`'s built `dist` (and core through it). An
  edit to `runtime/src/execution/drain.ts` therefore changes nothing in
  QuickJS until `pnpm build:dispatcher` re-emits
  `dispatcherSource.generated.ts` + `dist/dispatcher.js`.
  `dispatcherFreshness.test.ts` catches it, but its message says "run
  `pnpm build`" and points at this package — read it as "some inlined
  dependency moved", not only "you edited the dispatcher".
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
  emissions would hide lifecycle leaks. It then drains the job queue ONCE more:
  guest runner disposal is async, and freeing the runtime with that job unrun
  trips QuickJS's `list_empty(&rt->gc_obj_list)` assertion.

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
  through `onHostError` — in `compute` by `maxStepMs`, at a module's TOP LEVEL
  by `maxLoadTimeoutMs` (`load()` rejects with `QuickJsStepAbortedError`).
- OOM attempts are bounded by `QuickJsHostLimits.maxHeapBytes` and reported as
  `quickjs-oom`.
- Realm reflection stays in the QuickJS realm; host-only methods remain
  unavailable.
- `Symbol.iterator` prototype hijacks must not break emission serialization.
- Revoked Proxies after emit must not corrupt already-serialized drain output.

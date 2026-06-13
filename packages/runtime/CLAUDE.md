# packages/runtime/

`@invinite-org/chartlang-runtime` — execution engine + ring buffers
+ `ta.*` math primitives (lands incrementally across Tasks 5-8).

## Invariants

- **Property tests run with a pinned `fast-check` seed.**
  `vitest.setup.ts` calls `fc.configureGlobal({ seed: 42, numRuns: 25 })`
  before any test loads. Per-test `fc.assert(prop, { seed, numRuns })`
  overrides still apply. Reason: random seeds caused intermittent CI
  flakes (a 1e-6 tolerance edge case in `stdev.property.test.ts`).
  Bump the seed deliberately to surface fresh counter-examples — don't
  flip back to random unless you want flakes again.

- **`primitives.ts` is the Task 7-8 swap seam.** Task 7 swapped the
  `ta` throw-stub body for `TA_REGISTRY` (re-exported by identity
  from `./ta`); Task 8 swapped `plot` / `hline` / `alert` for the
  `./emit` re-exports. `createScriptRunner`'s `ComputeContext` still
  references these exports by identity — neither
  `createScriptRunner.ts` nor `buildComputeContext.ts` moved. Do not
  introduce intermediate type aliases for these exports — preserving
  identity is the contract.
- **`ta` is `TA_REGISTRY` cast through `TaNamespace`.** Core's
  `TaNamespace` is the script-facing surface (no `slotId`); the
  runtime's `RuntimeTaNamespace` adds a leading `slotId: string` per
  PLAN.md §5.5. The compiler inlines the slot id at every callsite,
  so the runtime function's first arg matches what the bundled script
  emits at runtime — but the type system needs the widening cast to
  satisfy `ComputeContext.ta: TaNamespace`. That cast lives in
  `primitives.ts:ta` and nowhere else; see `src/ta/CLAUDE.md` for
  the port convention every `<id>.ts` follows.
- **`RunnerState.barIndex` is the only mutable field on the runner
  state.** `onBarClose` increments; `onBarTick` does not. Every
  other field is `readonly`. `RuntimeContext.barIndex` is a
  `() => number` closure over `state.barIndex` so primitives always
  see the live counter.
- **`ACTIVE_RUNTIME_CONTEXT.current` is set inside try/finally
  around every `compute` invocation.** Both `onBarClose` and
  `onBarTick` reset it to `null` in `finally` so a throwing
  compute body cannot leak the slot. `onBarTick` additionally
  resets `state.runtimeContext.isTick = false` in `finally`.
- **`onBarTick` does NOT touch `time` / `open` on the OHLCV buffers
  or the `BarView`.** Ticks happen within the in-progress bar
  whose `time` / `open` were set by the preceding `onBarClose`.
  Only close-side and derived sources change.
- **`drain()` reassigns each emission array to `[]`, not
  `.length = 0`.** The adapter holds the snapshot's arrays; the
  runner gets fresh containers for the next step. `Object.freeze`
  the returned snapshot but leave the inner arrays mutable.
- **`state.*` snapshots are host-owned once flushed.** Task 9 added
  `RuntimeContext.stateSlots` for committed/tentative `state.*` and
  immediately-committed `state.tick.*` slots. `onBarClose` commits and
  flushes snapshots to `stateStore`; `onBarTick` resets non-tick
  tentative values before compute; `dispose` flushes and clears only the
  runner-local `stateSlots` map. Do not clear a caller-supplied
  `StateStore` during dispose — warm restart restores from that backing
  store.
- **`PersistentStateStore` is a sibling lifecycle store, not the slot
  store.** `warmStart(currentMainBarTime)` restores a whole PLAN §6.9
  snapshot before the host feeds new bars; close-cadence and dispose
  saves capture stream buffers plus `state.*` slots without changing the
  Phase-1 `StateStore` contract. `barIndex` is restored from the
  snapshot stream's `filled` count only for unsaturated snapshots; once a
  stream has wrapped, `StateSnapshot` has no exact historical bar-index
  field.
- **`request.security` is a Phase-4 NaN fallback.** Task 11 added
  `RuntimeContext.requestSecurityBars` keyed by `slotId|interval` and
  `diagnosedRequestKeys` keyed by `code|slotId|interval`. The cache
  preserves per-callsite `SecurityBar` identity; diagnostics are deduped
  per mount and both maps are cleared on `dispose`. Do not wire real HTF
  alignment here — Phase 5 replaces only the value producer.
- **§6.7 invariants are property-tested.** `onBarClose.test.ts`
  pins `bar.X === series.X[0]` and "all series equal length";
  `onBarTick.test.ts` pins "consecutive ticks don't advance
  length"; `drain.test.ts` pins "second drain returns empty
  arrays". Touching the execution loop without re-running
  `pnpm -F @invinite-org/chartlang-runtime test` is unsafe.
- **`StreamState.interval` stays `""` on the main stream in
  Phase 1.** The runner constructs `createStreamState({ interval:
  "", capacity, symbol: "" })`; the real interval lives on
  `bar.interval` (mutated per close from `rawBar.interval`). Phase 5
  multi-stream gives each `StreamState` its own non-empty
  interval. Do not "fix" this by passing the manifest's
  `requestedIntervals[0]` — Phase 1 indicators have no
  requestedIntervals.
- **Bench files come in pairs: `*.bench.ts` (vitest bench mode) +
  `*.bench.test.ts` (vitest run mode with a `THRESHOLD_MS`
  assertion).** `bench(...)` is not callable outside benchmark
  mode, so the `.test.ts` companion only carries the threshold
  `it(...)`. Both files exist so `pnpm bench` gets a median and
  `pnpm test` gets coverage + a wall-clock gate.
- **`emit/*` primitives ship as TypeScript-overloaded functions
  exposing both `(value, opts?)` (script-facing) and
  `(slotId, value, opts?)` (compiler-injected) signatures.** The
  implementation branches on `typeof arg1 === "string"` to detect
  the compiler-injected slotId path; the script-author overload
  (no slotId) always throws the `"… called outside an active script
  step"` sentinel, as does any call when `ACTIVE_RUNTIME_CONTEXT.current`
  is null. The overload pattern is the seam that lets the runtime
  satisfy core's `ComputeContext.plot = typeof corePlot` typing
  while delivering a slotId-aware impl at runtime.
- **`RuntimeContext.plotOverrides` is the one mutable presentation
  field — frozen entries, swappable container.** Resolved once at mount
  (`args.plotOverrides ?? args.resolvePlotOverrides?.(name) ?? {}`) and
  applied at emit time by `emit/applyPlotOverride.ts` keyed by
  `PlotEmission.slotId`. `ScriptRunner.setPlotOverrides(next)` replaces
  the whole map in place with `Object.freeze({ ...next })` — cheap, no
  recompute, reflected on the next `drain`. It is presentation-only
  (visibility / color / line cosmetics), so unlike `resolvedInputs` it
  is NOT part of the persisted compute snapshot and does not break the
  frozen-input determinism guarantee; a warm start re-resolves it from
  the host. `visible` is only ever written as `false` (never `true`), so
  a no-override or visible-override run is byte-identical to the
  pre-feature baseline. Dep / sibling runners default `plotOverrides` to
  `{}` — overrides target the primary script's slots only in v1.
- **`pushPlot` / `pushAlert` validate via Task 4's
  `validateEmission`; `pushDiagnostic` does not.** Diagnostics are
  the failure sink — recursively validating them would loop. A
  malformed plot or alert becomes a `malformed-emission`
  diagnostic and the original emission is dropped. Dedup runs by
  reverse-linear-scan over the in-bar queue; same `(slotId, bar)`
  collapses last-write-wins.
- **`slotIdPrefix` is the `state.*` slot-key prefix.** Every
  `state.*` / `state.tick.*` call routes through
  `state/stateNamespace.ts:stateKey(ctx, slotId)`, which prepends
  `ctx.slotIdPrefix ?? ""` and writes `${prefix}${slotId}:state`
  into both `runtimeContext.stateSlots` and the runner's
  `StateStore`. The primary runner's prefix is absent (byte-
  identical to the Phase-1 `${slotId}:state` key); `DepRunner`
  contexts carry `dep:<localId>/`; `SiblingRunner` contexts carry
  `export:<exportName>/`. TA slots live on the shared
  `mainStream.taSlots` (not on any stateStore) and do NOT carry
  the prefix — the bundle's deps + siblings share the primary's
  mainStream by the Task-4 bundle-runner invariant, so TA slot
  ids (file-relative `<sourcePath>:<line>:<col>#<callIndex>`)
  can't collide across runners. Reason: this gives bundle
  warm-restart the same byte-identity guarantee as Phase-1 while
  letting each runner's persisted state survive independently.
- **`StateSnapshot` is structured per-runner.** `primary.slots`
  holds the primary's `state.*` slots plus every TA slot from
  the shared mainStream. `siblings[exportName].slots` and
  `dependencies[localId].slots` hold each sub-runner's
  prefix-keyed `state.*` slots only. Sections are absent when
  the bundle has no deps / no siblings. Legacy flat-shape
  snapshots (pre-0.7) still load — `validateSnapshot` accepts
  both, and flat-shape data restores into the primary only.
  Restore drops snapshot sections whose `localId` /
  `exportName` is not declared by the current bundle and pushes
  a single `state-snapshot-malformed` diagnostic per orphan.
- **Bundle runners walk deps → siblings → primary every bar.**
  `onBarClose` / `onBarTick` call `resetBarEmissions(state)` once
  (clearing the parent's queues), then iterate `state.depRunners`
  followed by `state.siblingRunners`, then drive the primary via
  `runComputeBody` (NOT `runComputeStep` — that resets again).
  `DepOutputStore.beginBar()` runs after the parent reset. Single-
  script runners pass through with empty `depRunners`/`siblingRunners`
  arrays and a `null` store. Dep halts flip `state.depErroredThisBar`
  which clears the primary's plots/drawings/alerts/alertConditions/
  logs (NOT diagnostics) after `runComputeBody` returns. Sibling
  halts do NOT propagate. `__chartlang_depOutput` is installed on
  `globalThis` the first time a bundle mounts; the compiler-emitted
  bundle's inline shim resolves to that global reference, and the
  helper reads `ACTIVE_RUNTIME_CONTEXT.current.depOutputStore` per
  step — JavaScript's single-threaded execution model makes the
  shared global safe.

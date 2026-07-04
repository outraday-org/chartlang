# packages/runtime/

`@invinite-org/chartlang-runtime` — execution engine + ring buffers
+ `ta.*` math primitives (lands incrementally across Tasks 5-8).

## Invariants

- **`buildBundleFromModule(mod)` (`loadBundle.ts`) is THE module→runner
  entry — every host calls it, no host re-implements the merge.** Given a
  compiled bundle's module namespace it merges the authoritative `__manifest`
  sidecar (single → the object, multi → `sidecar[0]`) over `mod.default` for
  BOTH the single-script return AND the bundle `primary`, recovers siblings
  (`mod[exportName]` behind a compiled-object guard) + `__dependencies`, and
  returns the `CompiledScriptObject | CompiledScriptBundle` `createScriptRunner`
  expects. It **throws** `manifest-stub: …` when `__manifest` is absent AND
  `mod.default.manifest` is stub-shaped (`maxLookback 0`, no `plots`, empty
  `seriesCapacities`, no `requestedFeeds`) — i.e. a raw `defineIndicator(...)`
  author-eval object was fed instead of a compiled bundle (which would
  otherwise collapse every series ring to capacity 1 → all-NaN, and drop
  secondary feeds, silently). host-worker (`createWorkerBoot`), host-quickjs
  (`dispatcherCore.loadCompiled`, which reassembles a synthetic namespace from
  its guest globals), and conformance (`loadCompiledModuleAt`) ALL call it — do
  not fork a fourth copy. Compiled bundles always carry `__manifest`, and the
  compiler's default-manifest rebind (`bundle.ts:formatCompiledDefaultRebind`)
  also makes `mod.default.manifest` the real manifest, so the merge is
  idempotent on real output; the guard only fires on misuse. `createScriptRunner`
  does NOT re-guard (it cannot tell a stub from a legitimately-trivial script
  without the sidecar).
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
  runtime's `RuntimeTaNamespace` adds a leading `slotId: string`.
  The compiler inlines the slot id at every callsite,
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
- **A `history` push that OVERLAPS already-processed history is a full
  RE-SEED, not an append.** `onHistory` guards at its single choke point
  (both `runner.onHistory()` and `runner.push({ kind: "history" })` route
  through it): `barIndex > 0` AND `bars[0].time <= mainStream.ohlcv.time.at(0)`
  (the batch's first bar does not land strictly after the last closed bar)
  calls `resetStateForHistoryReseed(state)` before the walk, so the re-pushed
  bars replay from bar 0 (`fromBar === 0`) instead of landing at `N..2N-1`.
  A FORWARD CONTINUATION — every incoming bar strictly newer than the last
  close, the shape a host emits when it CHUNKS one conceptual history load
  (canvas2d's `createMultiStreamCandlePump` weaves secondary closes between
  main-history chunks) — appends exactly as before the feature; gating on
  `barIndex > 0` alone would re-seed every chunk after the first and wipe the
  just-pushed secondary streams (the all-NaN weekly-EMA regression). **Preserved:** the latest LIVE `externalSeriesFeeds`
  + `plotOverrides` maps (post-`setExternalSeries`/`setPlotOverrides` — the
  whole point is to re-read them from bar 0) and the persistence handle / `now`
  / caps (by reference via `state.args`; `warmStart` is NOT auto-run).
  **Rebuilt fresh:** everything else — streams, ta/`state.*` slots, dep/sibling
  runners, external-series slots, `diagnosedInputKeys`. **Dropped:** undrained
  pre-reseed emissions (old bar indices conflict with the replayed range).
  **Secondary streams reset empty — the caller re-pushes them** (the runtime
  can't know the host's secondary sources). Mechanism: `buildPrimaryState`
  stashes `args` / `primary` on `RunnerState`, and `resetStateForHistoryReseed`
  does an in-place `Object.assign(state, buildPrimaryState(...))` (re-attaching
  the bundle), then re-points ONLY the `runtimeContext.barIndex` closure at the
  live `state` (it was baked over the throwaway rebuilt object; without the
  re-point every replayed compute reads the discarded object's `barIndex === 0`).
  `execution/onHistory.ts` value-imports the helper directly; this closes a
  runtime import cycle (`createScriptRunner → execution/index → onHistory →
  createScriptRunner`) that is SAFE because the hoisted helper is referenced
  only at call time. A `state` without `args` / `primary` (a dep/sibling
  sub-runner, which never reaches `onHistory`) is a no-op. Fresh runners
  (`barIndex === 0`) and forward continuations stay byte-identical to the
  pre-feature append path.
  `resetStateForHistoryReseed` is exported from the entry (host-bundle
  preflight marker).
- **`ACTIVE_RUNTIME_CONTEXT.current` is set inside try/finally
  around every `compute` invocation.** Both `onBarClose` and
  `onBarTick` reset it to `null` in `finally` so a throwing
  compute body cannot leak the slot. `onBarTick` additionally
  resets `state.runtimeContext.isTick = false` in `finally`.
- **`time` and `session` are frozen namespaces bound to the mount's
  `RuntimeContext`, built in `buildComputeContext.ts`, NOT module-level
  constants like `ta`.**
  Both close over the mount's `RuntimeContext` (default tz from
  `syminfo.timezone`, the shared `tz-dst-unsupported` dedup), and `time.now`
  additionally closes over the runner's host-injected `state.now` clock, so
  `buildTimeNamespace(ctx, state.now)` / `buildSessionNamespace(ctx)`
  (`time-accessors/`) are rebuilt PER BAR by `buildComputeContext` (like
  the `state` / `request` / `runtime` namespaces). The calendar/session
  accessors are pure views over the stable `RuntimeContext`; `time.now()` is
  the deliberate host-variance accessor and is never serialized into
  snapshots. The per-bar rebuild is cheap and identity-stability across bars
  is NOT relied upon (the compiled script receives a fresh `ctx` each bar).
  They are NOT re-exported from
  `primitives.ts` (the core sentinel `session` hole is no longer
  re-exported there). The `tz-dst-unsupported` diagnostic is deduped
  on `ctx.diagnosedTzKeys` via the SINGLE shared reporter
  `buildTzDstReporter(ctx)` (`time-accessors/tzDiagnostic.ts`), so a
  script using BOTH `time.*` and `session.isOpen` on one DST zone warns
  once total. The `"HH:MM-HH:MM"` session-window grammar has ONE source
  of truth — `time-accessors/sessionWindow.ts:parseSessionWindowMinutes`
  — consumed by both `session.isOpen` AND `ta/sessionVolumeProfile.ts`
  (never fork the regex). `session.isOpen` membership is half-open
  `[start, end)`, wrap-aware (`end <= start` ⇒ `[start, 1440) ∪ [0, end)`);
  unlike `ta.sessionVolumeProfile` it takes `spec` explicitly and never
  reads `syminfo.session`.
- **`bar.point(offset, price)` is offset-anchoring sugar that resolves
  to a time-based `WorldPoint` — it adds NO new anchor shape.** The
  method is attached to the mutable `BarView` at `createStreamState`
  construction (`streamState.ts`) and closes over `ohlcv.time` + the live
  `bar.time` / `bar.interval`, so a `const { bar } = ctx` keeps resolving
  against fresh scalars. The resolution lives in `barPoint.ts`
  (`resolveBarPoint`): `offset === 0` → `{ time: bar.time, price }`;
  `offset < 0` → `time.at(-offset)` (the real historical timestamp, `NaN`
  past retained history — NEVER throws); `offset > 0` → `lastTime +
  offset * spacing`, where `spacing` is the median of the most recent
  retained time deltas (cap 100) and falls back to
  `intervalToSeconds(bar.interval) * 1000` (wrapped in try/catch so an
  unparseable interval degrades to `NaN`, not a throw) when fewer than two
  bars are retained. `price` passes through unchanged. `barFromStream`
  (`request/streamBars.ts`) gives each materialised secondary bar a
  `point` anchored at its own `age` (`resolveBarPoint(..., offset - age,
  …)`). Drawing anchors are still ONLY `WorldPoint { time, price }`.
- **`onBarTick` does NOT touch `time` / `open` on the OHLCV buffers
  or the `BarView`.** Ticks happen within the in-progress bar
  whose `time` / `open` were set by the preceding `onBarClose`.
  Only close-side and derived sources change.
- **External-series input feeds are runner-owned rings aligned to the primary
  cursor, not `input.source` fields.** `input.externalSeries(...)` resolves at
  mount to a stable `Series<number>` view backed by an external feed
  `Float64RingBuffer` keyed by the script input key; the host feed map is keyed
  by descriptor `name`. Close/history appends `feeds[name].values[barIndex]`
  before compute, tick replaces the head at the same cursor, and missing,
  short, or non-finite values write `NaN`. `setExternalSeries(feeds)` atomically
  replaces the whole feed map for subsequent computes and never merges partial
  keys. Each external ring is sized to `max(OHLCV-derived capacity, feed
  length)` — the shared `capacity` is OHLCV-only, so a consumer that touches
  OHLCV solely through the feed collapses it to 1 and would starve `bound[n]`
  reads; the reseed rebuild sizes from the LIVE feed so it never reintroduces
  capacity 1. Feed validation is SHAPE-ONLY and per-entry tolerant on EVERY
  entry path: `isExternalSeriesFeed` / `isExternalSeriesFeedMap` accept any
  `{ values: unknown[] }` shape (entries are never type-checked), and
  `replaceExternalSeriesFeedMap` — the single tolerance authority behind
  `args.externalSeriesFeeds`, `resolveExternalSeries`, `setExternalSeries`,
  AND the legacy `inputOverrides` feed path — keeps each array-shaped feed and
  coerces each value to finite-or-`NaN`; a single `null`/`NaN` (e.g. QuickJS
  `JSON.stringify` NaN→null) must NOT nuke the whole map nor trip an
  `input-coercion-failed` diagnostic. Do not reintroduce a strict
  all-entries-numeric guard on any one path — the QuickJS NaN→null bug class
  applies to every serialised entry surface equally.
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
- **`state.series` slots advance in `runComputeBody`, NOT `onBarClose`.**
  `RuntimeContext.seriesSlots` holds one `SeriesSlot` per
  `state.series(init)` callsite (`state/seriesSlot.ts`): a
  `Float64RingBuffer` history ring + an identity-stable
  `NumberSeriesSlot` view (`makeSeriesSlotView` wraps a reused
  `makeSeriesView` and adds `value` get→`buffer.at(0)` / set→
  `replaceHead`) + a `committedHead`. The ring lifecycle is driven inside
  `execution/runComputeStep.ts:runComputeBody` (next to the `state.*`
  hooks), so it runs once **per runner** (primary + each dep + each
  sibling) and once on the HTF expression fold ctx (`securityExprRunner.ts
  :evaluate`) — NOT in `onBarClose`/`onBarTick`. Close: `advanceSeriesSlots`
  (`append(NaN)`) runs **before** compute, `commitSeriesSlots`
  (`committedHead = at(0)`) after; tick: `resetSeriesHeads`
  (`replaceHead(committedHead)`) before compute, no advance. **Order
  invariant:** advance-before-compute means a slot first allocated
  mid-compute on bar K is not present at advance time, so its seeded head
  (`createSeriesSlot` does `append(init)`) is not double-advanced — the
  allocation bar grows `length` by exactly one. Unwritten later bars are
  `NaN` gaps. Snapshot keys use the `:series` suffix (vs `:state` / `ta:`)
  so the restore router (`persistentStateStore.runtime.ts:
  restoreRunnerSlots`) splits them out of the scalar state path;
  `committedHead` is nulled when `NaN` for JSON-cleanliness. There is no
  `stateStore` flush for series (the `seriesSlots` map is the live source
  across bars; snapshots serialise from it directly), unlike scalar
  `state.*` which `flushStateSlots` mirrors into `StateStore`.
- **Non-numeric persistent state (`state.color` / `state.boolSeries` /
  `state.stringSeries`) reuses the numeric machinery — it does NOT introduce a
  new lifecycle shape.** `state.color` is a persistent CSS **string** scalar:
  it binds to the existing `getOrAllocate(...)` scalar `StateSlot` path
  (`stateNamespace.ts`), keyed `${slotIdPrefix}${slotId}:state` like
  `state.float`/`bool`/`string`, and rides the existing scalar
  flush/serialise/restore unchanged (a string is JSON-clean, no new routing).
  `state.boolSeries` / `state.stringSeries` are the non-numeric analogue of
  `state.series`: a parallel `RuntimeContext.objectSeriesSlots` map
  (`Map<string, ObjectSeriesSlot<unknown>>`) keyed
  `${slotIdPrefix}${slotId}:objseries` — **one** map and **one** suffix back
  BOTH element kinds (the entry's `kind: "state.boolSeries" |
  "state.stringSeries"` picks the restore default). Each slot is an
  `ObjectRingBuffer<T>` (`ringBuffer.ts`) — the object-payload sibling of
  `Float64RingBuffer` whose `at()` returns a per-instance `defaultValue` (NOT
  `undefined`) on out-of-range, so the **same** `makeSeriesView` `buf.at(n)`
  path yields the deterministic first-bar / OOR default: `false` for bool
  (Pine v6), `""` for string. **Ring sizing mirrors the numeric series exactly**
  (`new ObjectRingBuffer(ctx.stream.ohlcv.close.capacity, default)`), and the
  lifecycle is byte-for-byte the numeric one — `advanceObjectSeriesSlots`
  (append the default head) BEFORE close compute, `commitObjectSeriesSlots`
  after, `resetObjectSeriesHeads` (replace head with committedHead) before tick
  compute — all driven from `runComputeStep.ts:runComputeBody` next to the
  numeric `*SeriesSlots` hooks. **Snapshots are deterministic with NO host
  variance:** bool/string `values` + `committedHead` ride verbatim (no
  `NaN`→`null` mapping the numeric buffer needs); the empty-map spread yields
  `{}`, so a script with no non-numeric series leaves every numeric/scalar
  snapshot **byte-identical**. `:objseries` cannot collide with `:series`
  (`endsWith(":series")` is false — the char before "series" is "j").
  Restore (`objectSeriesPersistence.ts`) validates `kind` + element type +
  ring shape and degrades a malformed/capacity-incompatible entry to a fresh
  slot (never throws), exactly like the numeric/array/map paths. Cleared on
  `dispose` like `seriesSlots`. Bundle dep/sibling slots ride the
  `slotIdPrefix` isolation like every other `state.*`.
- **`state.array` slots are a parallel `arraySlots` map driven from
  `runComputeBody`, NOT folded into `stateSlots`.**
  `RuntimeContext.arraySlots` holds one `ArrayStateSlot`
  (`state/arrayStateSlot.ts`) per `state.array(capacity)` callsite, keyed
  `${slotIdPrefix}${slotId}:array`. Each slot is **two** `Float64RingBuffer`s
  (`committedRing` / `tentativeRing`) behind an identity-stable
  `MutableArraySlot<number>` handle (`buildArrayHandle`: `push`/`get`/`last`/
  `clear` + `size`/`capacity`, all routed through the **tentative** ring —
  mirroring `StateSlot.set`/`get` reading/writing tentative; committed is the
  rollback source). **Decision: a parallel map (like `seriesSlots`), not a
  `kind`-tagged `stateSlots`** — both collection primitives share the two-ring
  shape, snapshot directly from the live map with no `StateStore` flush, and
  keeping the scalar `stateSlots` generic untouched is cleaner than a
  discriminated union + a special-cased `flushStateSlots`. The two-ring tick
  discipline mirrors `StateSlot`: `onBarClose` copies tentative→committed,
  `onBarTick` copies committed→tentative, via a typed-array
  `Float64RingBuffer.copyFrom` memcpy (`O(capacity)`, bounded by the required
  capacity literal — see `tasks/future/state-array/README.md` Architecture
  Decisions). Lifecycle runs in `execution/runComputeStep.ts:runComputeBody`
  next to the series hooks: `commitArraySlots` after close compute,
  `resetTentativeArraySlots` before tick compute. **There is NO advance hook**
  (unlike `state.series` — the array changes only when the author pushes, so a
  slot first allocated mid-compute on bar K is not pre-advanced; its pushes
  this bar are committed on close). Snapshot keys use the `:array` suffix (vs
  `:state` / `:series` / `ta:`) so `restoreRunnerSlots` routes them out of the
  scalar path; `arrayPersistence.ts` serialises
  `{ kind: "state.array", capacity, committed, tentative }` and restores both
  rings via `restoreBuffer` at the persisted `capacity` — a script-edited
  capacity (ring-shape mismatch) or malformed entry degrades to a fresh slot
  without throwing. There is no `StateStore` flush for arrays (the `arraySlots`
  map is the live source across bars); `dispose` clears the runner-local map
  like `seriesSlots`. Bundle dep/sibling array slots ride the `slotIdPrefix`
  isolation exactly like `state.*`.
- **`state.map` slots are a parallel `mapSlots` map driven from
  `runComputeBody`, mirroring `arraySlots` with two `Map`s instead of two
  rings.** `RuntimeContext.mapSlots` holds one `MapStore`
  (`state/mapStore.ts`) per `state.map(capacity)` callsite, keyed
  `${slotIdPrefix}${slotId}:map`. Each slot is **two** `Map<MapKey, number>`s
  (`committedMap` / `tentativeMap`, `MapKey = string | number`) behind an
  identity-stable `MutableMapSlot<MapKey, number>` handle (`buildMapHandle`:
  `set`/`get`/`has`/`delete`/`clear` + `size`/`keyAt`, all routed through the
  **tentative** map — mirroring the array slot's tentative-ring routing;
  committed is the rollback source). **Eviction is insertion-order FIFO**: JS
  `Map` preserves insertion order, so `set` of a NEW key at `size === capacity`
  evicts `tentativeMap.keys().next().value` (the oldest) before inserting; `set`
  of an EXISTING key updates in place WITHOUT re-aging; `delete` then re-`set`
  re-ages the key to newest. `get` returns `undefined` for an absent key
  (distinct from a stored `0`); `keyAt(index)` walks `keys()` to the
  insertion-order index (`0` = oldest), `undefined` out of range. **Key
  divergence from `ArrayStateSlot`:** a `Map` has no typed-array `copyFrom`, so
  the two map FIELDS are **mutable** and `onBarClose`/`onBarTick` reassign them
  to a `new Map(source)` ordered clone (committed←tentative on close,
  tentative←committed on tick); the handle reads `slot.tentativeMap` fresh per
  call so the reassignment is transparent to handle identity. Lifecycle runs in
  `runComputeStep.ts:runComputeBody` next to the array hooks: `commitMapSlots`
  after close compute, `resetTentativeMapSlots` before tick compute. No advance
  hook (same as `state.array` — the map changes only on author writes). Snapshot
  keys use the `:map` suffix so `restoreRunnerSlots` routes them out of the
  scalar path; `mapPersistence.ts` serialises
  `{ kind: "state.map", capacity, committed, tentative }` where `committed` /
  `tentative` are insertion-ordered `[key, value]` **entry tuples** (NOT a
  `Record` — a JS object would stringify a number key, losing the
  `string`-vs-`number` distinction; non-finite values ride as `null` via
  `finiteOrNull`). Restore rebuilds both maps at the persisted `capacity` in
  order and degrades to a fresh slot (never throws) on a malformed shape or an
  over-`capacity` entry count. No `StateStore` flush (the `mapSlots` map is the
  live source); `dispose` clears the runner-local map. Bundle dep/sibling map
  slots ride the `slotIdPrefix` isolation exactly like `state.array`.
- **`state.array` numeric reductions read the `tentativeRing` directly, never
  the handle's `get(n)`.** The `MutableArraySlot<number>` analytic methods
  (`sum`/`avg`/`min`/`max`/`range`/`variance(biased?)`/`stdev(biased?)`/`median`/
  `percentile(p)`/`indexOf`/`includes`/`sort(order?)`) are wired in
  `buildArrayHandle` (`state/arrayStateSlot.ts`) and delegate 1:1 to pure helpers
  in `state/arrayReductions.ts`. Each helper walks the ring's filled region via
  `ring.at(i)` for `i ∈ [0, length)` (0 = newest) — a direct backing-array read,
  O(size), with no per-element handle-proxy hop — exactly mirroring
  `ta/median.ts`'s `medianOfWindow`. Reads route through the **tentative** ring
  (the author-facing surface), so a reduction during a tick sees the in-progress
  pushes the same way `get`/`last` do. The statistical reductions **skip
  `Number.isNaN`** (NOT `Number.isFinite` — `±Infinity` propagates), matching the
  core interface JSDoc; an empty / all-`NaN` window returns `NaN` (never `0`).
  Variance is the **Welford** single pass (never `Σx² − (Σx)²/n`); population
  denominator `count` by default, sample `count − 1` when `biased === false`
  (`NaN` when `count < 2`). `median`/`percentile` share one
  `quantile(sorted, q)` (linear interpolation between closest ranks; `q = 0.5`
  reproduces `ta.median`'s even/odd midpoint exactly), allocating one scratch
  array (the only allocating reductions — `sum`/`avg`/`min`/`max`/`range`/
  `variance`/`stdev` are scalar-accumulator, allocation-free). `indexOf` is
  strict `===` (cannot find `NaN`); `includes` is SameValueZero (finds `NaN`).
  `sort` is deliberately **not** in the skip-`NaN` set — it copies the whole
  filled region, sorts numerically (`"desc"` reverses), and never touches the
  committed ring nor mutates either ring (the FIFO keeps insertion order for
  eviction; asserted via `get(0)` unchanged). The rolling stdev/median golden
  (`arrayReductions.golden.test.ts`) is the behavioural contract.
- **`PersistentStateStore` is a sibling lifecycle store, not the slot
  store.** `warmStart(currentMainBarTime)` restores a whole PLAN §6.9
  snapshot before the host feeds new bars; close-cadence and dispose
  saves capture stream buffers plus `state.*` slots without changing the
  Phase-1 `StateStore` contract. `barIndex` is restored from the
  snapshot stream's `filled` count only for unsaturated snapshots; once a
  stream has wrapped, `StateSnapshot` has no exact historical bar-index
  field.
- **`request.security` is a Phase-4 NaN fallback.** Task 11 added
  `RuntimeContext.requestSecurityBars` keyed by `slotId|feedKey` and
  `diagnosedRequestKeys` keyed by `code|slotId|feedKey|kind`. The cache
  preserves per-callsite `SecurityBar` identity; diagnostics are deduped
  per mount and both maps are cleared on `dispose`. Do not wire real HTF
  alignment here — Phase 5 replaces only the value producer.
- **Every secondary map/cache is keyed by the composite
  `feedKey(symbol, interval)` (core's single shared helper — NEVER
  re-derived inline).** `secondaryStreams`, `requestSecurityBars`
  (`slotId|feedKey`), `requestSecurityAlignments`
  (`slotId|feedKey|sourceKey`), `requestSecurityExprSeries`
  (`slotId|feedKey`), and `securityExprRunnersByFeed` (the
  secondary-close fan-out index, renamed from `…ByInterval`) all use it.
  `RuntimeContext.chartSymbol` is the chart's own symbol resolved once at
  mount from `args.symInfo?.ticker` (`""` when absent). `createSecondaryStreams`
  iterates `manifest.requestedFeeds ?? legacyFeedsFromIntervals(manifest)`,
  and `requestNamespace.security` resolves `opts.symbol ?? chartSymbol`
  **and collapses `symbol === chartSymbol → undefined` BEFORE keying**, so an
  omitted symbol AND an explicit chart-symbol both produce the bare-interval
  key (`feedKey(undefined, "1D") === "1D"`) — one stream, no duplicate.
  The same chart-symbol collapse runs in `createSecondaryStreams` and
  `buildSecurityExprRunners` so the secondary stream key, expr-runner index,
  caches, and diagnostics for the symbol-omitted path are byte-identical to
  the pre-multi-symbol baseline (existing MTF goldens/snapshots do not move).
  A genuinely different symbol keys as `"<symbol>@<interval>"` (the `@` cannot
  appear in an interval literal, so the two key spaces never collide). The
  host wire `CandleEvent.streamKey` carries this same composite key (Task 4/5),
  so `pushSecondaryEvent` routes by it with no structural change.
- **Pine's empty-interval idiom passes through to the MAIN stream (chart
  symbol only).** `request.security({ interval: "" })` is Pine's
  `request.security(syminfo.tickerid, "", x)` — "the chart's own timeframe".
  `makeSecurityBar` (`request/security.ts`) short-circuits on
  `symbol === undefined && interval === ""` — AFTER the per-callsite cache
  check but BEFORE the symbol gate — returning a `SecurityBar` view over the
  main stream's own `ctx.stream.seriesViews.*` (the existing O(1) head-relative
  views; NO ascending-array rebuild) via `makeMainPassthroughSecurityBar`, with
  the symbol / interval pinned from the live `bar`. This BYPASSES the
  `multiSymbol` / `multiTimeframe` / `unsupported-interval` /
  secondary-stream gates and needs NO adapter capability — the chart symbol on
  the chart clock IS the main stream (core `request.ts` §"empty interval"), so
  the read is the identity it is in Pine / on TradingView (no secondary feed).
  The branch is gated STRICTLY on `symbol === undefined && interval === ""`: a
  genuine same-tf NON-empty request still flows through the secondary path, and
  a DIFFERENT symbol at `interval: ""` ("that instrument on the chart clock")
  stays on the `multiSymbol` secondary path → correct NaN when unsupported. The
  bar is cached on `requestSecurityBars` like every other callsite (stable
  identity across reads in a bar).
  **The `unsupported-interval` capability gate treats `interval === ""` as
  always-known** in BOTH `makeSecurityBar` and `resolveSecondaryOrDiagnose`
  (`const known = interval === "" || capabilities.intervals.some(…)`). `""` is
  the chart-tf sentinel — never a literal interval an adapter lists — so
  validating it against `capabilities.intervals` is wrong. For the CHART symbol
  the passthrough above already ran; for a DIFFERENT symbol at `interval: ""`
  the request flows PAST this gate (gated only by `multiSymbol` + the
  secondary-stream lookup keyed `feedKey(symbol, "")`): with a registered
  secondary stream it reads that stream's aligned data; with NONE it falls back
  to `unknown-secondary-stream` (accurate) rather than the misleading
  `unsupported-interval`. A different-symbol NON-empty unsupported interval
  still trips `unsupported-interval` (the relaxation is strictly `interval === ""`). The conformance proof is
  `empty-interval-passthrough` (its passthrough-close plot-hash is byte-identical
  to a `bar.close` control under `multiTimeframe: false`).
  **EXPRESSION form is intentionally unchanged (scoped follow-up).** The
  compiler emits NO `securityExpressions` descriptor for an empty interval (the
  chart timeframe is the main clock, not an HTF expression clock —
  `extractRequestedIntervals.ts:readLiteralInterval`), so no `SecurityExprRunner`
  is mounted and `requestNamespace.security`'s expr-form chart-tf callsite routes
  into `makeSecurityBar` → this same passthrough (the callback is dropped, no
  all-NaN, no spurious diagnostic). Making the callback actually fold per MAIN
  bar would require driving the HTF fold on main close — the fold-drive machinery
  is keyed on secondary-stream events (`driveSecurityExpressions`) and there is
  no secondary stream for the chart tf — which is non-trivial rework deferred to
  a future epic. The reported data-form bug is fully fixed here.
- **The `multiSymbol` NaN-fallback gate precedes the `multiTimeframe` gate.**
  `makeSecurityBar` / `makeSecurityExprSeries` (`request/security.ts`) gate in
  this order: **symbol** (`multiSymbol`) → **timeframe** (`multiTimeframe`) →
  `unsupported-interval` → `unknown-secondary-stream`. The "is this a DIFFERENT
  symbol?" signal is simply `symbol !== undefined` (`makeSecurityBar`) /
  `isDifferentSymbol` (`makeSecurityExprSeries`), because `requestNamespace`'s
  `resolveSymbol` already collapses an omitted symbol AND the chart's own ticker
  to `undefined`. A different symbol against `capabilities.multiSymbol === false`
  returns an all-NaN bar/series and pushes a single deduped
  `multi-symbol-not-supported` (message: `Adapter declares multiSymbol: false;
  request.security for a different symbol returns NaN`), keyed on the composite
  `feedKey` so SPY-unsupported and QQQ-unsupported each warn once. A request
  that is BOTH a different symbol AND a different interval trips ONLY the symbol
  code (the symbol gate runs first). A chart-symbol request (omitted / chart
  ticker) NEVER trips the symbol gate — it stays `multiTimeframe`-gated,
  byte-identical to the pre-multi-symbol baseline. `multiSymbol: true` +
  `multiTimeframe: false`: a different symbol at the *chart* interval is allowed
  (symbol gate passes, no interval gate); at a *different* interval it still
  trips `multi-timeframe-not-supported`.
- **`request.security(opts, expr)` is driven on HTF bar close, not main
  close.** `createScriptRunner` mounts one
  `request/securityExprRunner.ts:SecurityExprRunner` per
  `manifest.securityExpressions` entry, keyed on
  `RuntimeContext.securityExprRunners` (by `slotId`) +
  `securityExprRunnersByFeed` (keyed by the composite `feedKey(symbol,
  interval)` for the secondary-close fan-out; a symbol-omitted callsite
  collapses to the bare interval). Each
  runner owns a dedicated **fold `StreamState`** clocked on its HTF
  interval, a private `RuntimeContext` (`stream = foldStream`,
  `slotIdPrefix = "security:<slotId>/"`), a fold `SecurityBar` view backed
  by the fold stream's head, and a `Float64RingBuffer` output buffer (one
  sampled value per HTF bar). `ta.*` inside the callback read/write
  `foldStream.taSlots`, so they accumulate on the HTF clock — the whole
  point of the feature. `pushSecondaryEvent` calls
  `driveSecurityExpressions(ctx, streamKey, "close" | "tick", bar)` (where
  `streamKey` is the composite `feedKey` the event carries) right
  after appending/replacing the real secondary stream: a **close** folds
  the bar + appends one output and increments `processedHtfCount`; a
  **tick** replace-heads the fold stream + output (no length advance,
  matching `replaceTickHead`). The callback is captured **lazily** on the
  first `request.security(slotId, opts, expr)` in the main compute (the
  manifest only says "slotId X is an expression on interval I"); on capture,
  `captureAndCatchUp` replays the already-buffered real secondary stream
  oldest→newest until `processedHtfCount === secondary.length`. The real
  secondary stream is never mutated to "present" history — it stays the
  alignment-timestamp source; the fold stream owns expression-local state.
  `evaluate` swaps `ACTIVE_RUNTIME_CONTEXT.current` to the runner's ctx
  inside try/finally that restores the previous value (the
  set-inside-try/finally invariant). Overload dispatch keys off the runner
  registry (not `expr !== undefined`) so compiled output is robust to a
  changed emit shape. `dispose` resets every runner's fold buffers + output
  + taSlots and clears the registry. The aligned return series is cached on
  `requestSecurityExprSeries` (cleared each bar alongside the other
  per-bar request caches).
- **`bar.*` OHLCV + derived fields ARE the cached series views.** The
  `BarView`'s `open/high/low/close/volume/hl2/hlc3/ohlc4/hlcc4` fields are
  the same `makeSeriesView` proxies as `seriesViews.*` (one identity per
  ring buffer), so `bar.close[1]` reads history and `+bar.close` /
  arithmetic / `plot(bar.close)` read the live head. The views are
  number-coercible (`valueOf` + `Symbol.toPrimitive` → `buf.at(0)`), which
  is what lets a `PriceSeries` (`number & Series<number>`) be both. The
  append / replace / tick / restore paths therefore do NOT copy these
  scalars onto the `BarView` — only the scalar `time` / `symbol` /
  `interval` are written. `bar.point(price)` coerces the anchor price via
  `Number(...)`, so `bar.point(0, bar.close)` persists a numeric
  `WorldPoint.price`, not the view object.
- **§6.7 invariants are property-tested.** `onBarClose.test.ts`
  pins `+bar.X === series.X[0]` (coerced — `bar.X` is the series view, so
  it equals `series.X` by identity and `+bar.X` equals `series.X.current`)
  and "all series equal length"; `onBarTick.test.ts` pins "consecutive
  ticks don't advance length"; `drain.test.ts` pins "second drain returns
  empty arrays". Touching the execution loop without re-running
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
- **`draw.fillBetween` is wired into `emit/draw/namespace.ts`
  `KIND_IMPLS` (Boxes-B group, after `path`).** Its emit
  (`emit/draw/boxes/fillBetween.ts`) snapshots both edges + style AS
  GIVEN and never validates at emit time — but `pushDrawing` then runs
  `validateEmission` like every other drawing, so a frame whose edge has
  fewer than 2 finite anchors (empty, single-point, or a `NaN`
  coordinate) is dropped with a `malformed-emission` diagnostic (NOT a
  silent renderer no-op). Scripts guard warmup in-script — accumulate,
  then gate on `length >= 2` + `Number.isFinite`, as
  `examples/scripts/fill-between-band.chart.ts` does. `renderFillBetween`
  additionally guards degenerate geometry as defence-in-depth. The two
  `WorldPoint`
  edges need not share x-coordinates or length; the rendered region is
  the closed polygon `edgeA` forward then `edgeB` reversed. The
  3-overload impl branches on `typeof arg1 === "string"` AND confirms
  both edges are arrays before dispatching (the bare script-facing form
  always throws the active-step sentinel).
- **`resolveInputs.matchesDescriptor`'s `enum` arm accepts a `string` OR
  `number` override.** Core widened `input.enum` to `T extends string |
  number`, so a numeric-enum override (`input.enum(21, [8, 21, 30])` → `30`)
  must coerce instead of falling back with `input-coercion-failed`. The arm is
  `(typeof value === "string" || typeof value === "number") &&
  descriptor.options.includes(value)` — string-enum membership is unchanged, so
  string-enum overrides stay byte-identical. The default path already
  round-trips a numeric default (it is a plain number).
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
- **`opts.visible` is `plotImpl`'s AUTHORING visibility channel, resolved
  onto the same `PlotEmission.visible` wire field the host-override path
  writes — carried as `false` only, dropped for `true`/`undefined`.**
  `plotImpl` (`emit/plot.ts`) reads `opts.visible` and appends
  `...(visible === false ? { visible: false } : {})` to the emission with the
  SAME omit-when-default idiom as `z` / `colorValue`, so an omitted-or-`true`
  plot is byte-identical to the pre-feature wire (every pinned plot golden /
  conformance `plot-hash` (`{ bar, value }` only) holds; `apiVersion: 1`
  snapshots do not move). It composes with `applyPlotOverride`, which runs
  AFTER and also only ever writes `false` — so either source (author or host)
  hides the mark and NEITHER writes `true`. `visible: false` SUPPRESSES the
  mark (adapter render-skip, T8 Task 4); it is NOT substituted as `value: NaN`
  — the real numeric value still rides the wire, and a `value: null` skip-bar
  can co-occur with `visible: false` (the two are orthogonal). `visible` rides
  the same `(slotId, bar)` last-write-wins dedup as `value` and is NOT part of
  any numeric hash. The wire validator (`adapter-kit/validateEmission`)
  already accepts the optional boolean — no runtime-side validation is added.
- **A `ta.*` `opts.offset` is a presentation x-shift carried to
  `PlotEmission.xShift`, not a value-read.** `seriesView.ts`'s
  `makeShiftedSeriesView(buf, offset)` returns the **unshifted** view and
  records `view → offset` in a module-level `WeakMap<Series, number>`
  side-table; `emit/plot.ts` reads it (`seriesOffsetOf`) and sets the
  signed `PlotEmission.xShift` (`+n` right / future, `−n` left / past).
  The series value is unshifted, so alerts / `state.*` / `series.current`
  see the value computed at the current bar and both shift directions are
  expressible. A plain numeric `plot(x)`, an untagged series, or an
  `offset === 0` series omits `xShift` — the no-offset wire and emission
  ORDER are byte-identical to the pre-feature baseline. **ALMA tags
  `opts.barShift`** (its `opts.offset` is the Gaussian centre, never
  tagged). The compiler contributes zero buffer depth for offset (Task 2)
  and the stale `ta/lib/applyOffset.ts` value-shift helper was deleted —
  nothing preserves the old value-read offset semantics.
- **`z` is a presentation-only render-order key carried to
  `PlotEmission.z` / `DrawingEmission.z` with the same omit-when-`0`
  conditional spread as `xShift`.** Unlike `xShift`, `z` is a direct
  **call option** (`opts.z`), not a series tag. `emit/plot.ts` reads
  `opts.z ?? 0` and appends `...(z === 0 ? {} : { z })`. For drawings,
  `z` lives on the `draw.*` opts bag (core's `ZOrdered` mixin) which the
  per-kind impls fold into `state.style`; `emit/draw/handle.ts`'s
  `splitZ` **lifts it back out** of `state.style` — into a **shallow
  clone** with `z` removed (the caller's style object is never mutated)
  — so the wire `state` / `state.style` carries no `z` for ANY kind
  (Task 3 forbids `z` in `DrawingState`). `splitZ` leaves a no-`style`
  state (e.g. `group`) or a no-`z` style **untouched** (same reference),
  keeping the no-`z` path byte-identical. The lifted `z` is persisted on
  the slot record (`DrawingSlot`, `runtimeContext.ts`) **beside**
  `state` and threaded to the top-level `DrawingEmission.z`
  (omit-when-`0`). An `update(patch)` re-runs `splitZ` over the merged
  state, so a patch that re-specifies a non-zero `z` overrides while an
  omitted/`0` `z` retains the slot's last value; a cross-bar re-entry
  re-specifies `z` from the new call; `remove` carries the last-known
  `z` (harmless — no render). Omitted/`0` `z` ⇒ no `z` own-key on the
  wire, byte-identical to the pre-feature baseline; `z` is NOT part of
  any dedup key (`(slotId, bar)` / `(handleId, bar)`). The threading
  lives entirely in `handle.ts` — the ~62 per-kind impls are unchanged.
  **`draw.table` and `draw.group` are intentionally out of scope for `z`
  in v1** (README "Deferred/Follow-Up": z on tables/alerts is deferred):
  `table` hand-picks its state fields (dropping `z` upstream) and
  `group` takes no opts bag, so neither carries `z` — that is correct,
  not a gap to "fix".
  **Known v1 limitation — `z`-out-of-`state` is RUNTIME-enforced, not
  COMPILE-enforced.** Because every `draw.*` style type carries `z` via
  core's `ZOrdered` mixin and `DrawingState.style` is typed as those same
  style types (`LineState.style: LineDrawStyle`, …), the TYPE of
  `DrawingState.style` still admits `z` — so `splitZ` in `handle.ts` is
  the *only* thing keeping `z` off `state` on the wire. A future per-kind
  impl that builds its state and emits WITHOUT routing through
  `createDrawingHandle` (or a regression in `splitZ`) would silently
  re-leak `z` into `DrawingState` and STILL typecheck. The `splitZ` seam
  plus its guard tests in `handle.test.ts` (`"z" in wireState` /
  `"z" in wireState.style` are `false`; no caller mutation; byte-identity)
  are the contract. Compile-enforcing this (tightening every
  `DrawingState.style` to `Omit<…, "z">`, or splitting a z-free
  `DrawingStyle` wire type from the author opts type) was evaluated and
  deferred: it would scatter z-stripping across the ~62 per-kind impls or
  require a DrawingState input/wire type split, defeating the deliberate
  single-file `handle.ts` seam. Accepted for v1; revisit if a third `z`
  re-leak class appears. Any NEW `draw.*` impl MUST construct its state
  via `createDrawingHandle` — never emit a hand-built `DrawingState`
  carrying a folded-in `z`.
- **`colorValue` is `plotImpl`'s per-bar dynamic-color channel, passed as an
  internal 5th arg (NOT on `PlotOpts`) and omitted on the static `plot`
  path.** Only the `bgcolor` / `barcolor` aliases pass `dynamicColor` to
  `plotImpl` (their whole purpose is per-bar color, and they emit
  `value: null` so they never touch the numeric channel); they STILL set the
  static `bg-color` / `bar-color` `style.color` (older-adapter fallback). The
  live color rides the wire as `PlotEmission.colorValue`, appended LAST with
  the same omit-when-absent conditional spread as `xShift` / `z`. `plot`
  passes no `dynamicColor`, so its emission omits the `colorValue` own-key
  entirely — byte-identical to the pre-Deliverable-2 wire, every plot golden /
  conformance `plot-hash` (`{ bar, value }` only) untouched. `colorValue`
  rides the same `(slotId, bar)` last-write-wins dedup as `value`.
  `validateEmission` accepts a non-empty color string OR `null` (sibling to
  the `value` finite-or-`null` check); a malformed `colorValue` drops the
  emission with `malformed-emission`, never a throw. The aliases mirror the
  color onto BOTH `colorValue` and the static `style.color`, so an empty
  (malformed) color trips the STYLE validator and drops the whole emission —
  the `colorValue: null` validator arm is the wire contract for an explicit
  gap a future producer may emit, not something the aliases manufacture.
  Render-time precedence (`colorValue` over `style.color`) is the adapters'
  job (Task 6).
- **`plotcandle` / `plotbar` (`emit/plotCandle.ts`) build a value-carrying
  `candle` / `ohlc-bar` wire style and reuse the shared plot-emit machinery —
  they do NOT fork the gate, reader, or emission assembly.** Each resolves its
  four OHLC sources via `emit/plot.ts:resolveValue` (the ONE reader — number →
  self, `Series<number>` → `.current`, non-finite → `null`), builds the wire
  style with the OHLC quad + colors INSIDE the style object (the `filled-band`
  multi-value precedent — `PlotEmission.value` stays single-channel
  `close ?? null` for the conformance `plot-hash`), and delegates to the
  shared `emit/plot.ts:emitPlot(ctx, slotId, style, fields)` (extracted from
  `plotImpl`) for the `unsupported-plot-kind` gate → pane resolution → the
  omit-when-default `visible`/`xShift`/`z`/`colorValue` spreads → deduped,
  override-applied `pushPlot`. **Quad coherence is `validateEmission`'s job,
  never re-checked in the emit:** an all-null quad is a legit gap emission, a
  partial (mixed finite/null) quad is dropped by `pushPlot` as
  `malformed-emission`. `candle` fills the required `bull`/`bear` from
  `DEFAULT_CANDLE_BULL` (`#26a69a`) / `DEFAULT_CANDLE_BEAR` (`#ef5350`) (the
  ONE place those constants live); `ohlc-bar` resolves its required `color` by
  `close ≥ open` selection (`upColor ?? color ?? bull` up, `downColor ?? color
  ?? bear` down; a fully-null bar counts as up). There is NO tick-specific
  branch — tick/close reconciliation is the downstream `(slotId, bar)`
  last-write-wins dedup, exactly like `plot`. `capabilities.allPhase5Plots()`
  does NOT include `candle`/`ohlc-bar` (frozen `PHASE_5_PLOT_KINDS`), so a
  test emitting them must ADD the two kinds to the cap set.
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

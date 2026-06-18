# Runtime: SecurityExprRunner + output buffer + alignment + host boots

> **Status: TODO**

## Goal

Implement the runtime side: drive each compiled HTF expression callback
**on every secondary (HTF) bar close** against the secondary
`StreamState`, capture one output value per HTF bar into a per-slot
output buffer, and have `request.security(slotId, opts, expr)` return
that output series aligned no-lookahead to the main timeline. Boot the
hoisted unit in both hosts.

## Prerequisites

Task 1 (core overload), Task 2 (manifest `securityExpressions`).

## Current Behavior

- `request/security.ts`: `makeSecurityBar` builds the aligned data
  `SecurityBar`; `makeAlignedNumberSeries` wraps an aligned array in a
  Proxy `Series<number>`; `alignedSeries` caches via `getOrAlign`.
- `requestNamespace.ts`: `security(slotId, opts)` → `makeSecurityBar`.
- Secondary streams are created in `createScriptRunner.ts`
  (`createSecondaryStreams(manifest, capacity)`) and fed via
  `pushSecondaryEvent` → `execution/secondaryStream.ts`
  (`appendSecondaryBar` / `replaceSecondaryHead` / `appendSecondaryHistory`).
  **No compute runs on secondary closes today** — they only buffer.
- `dep/DepRunner.ts`: `buildSubRunnerState` makes a runner with its own
  `RuntimeContext` (shares streams), `executeSubStep` swaps
  `ACTIVE_RUNTIME_CONTEXT.current` and runs a compute body with
  emissions suppressed/forwarded.
- `runtimeContext.ts`: holds `secondaryStreams`, `requestSecurityBars`,
  `requestSecurityAlignments`, `requestSecurityAscendingBars`,
  `diagnosedRequestKeys` — all cleared on `dispose` (alignment caches
  cleared per bar).

## Desired Behavior

- At mount, for each `manifest.securityExpressions` entry, register a
  `SecurityExprRunner` bound to the secondary `StreamState` for its
  interval and an empty `Float64RingBuffer` output buffer (capacity =
  secondary stream capacity).
- The callback closure is captured the **first time** the main compute
  body executes `request.security(slotId, opts, expr)` — store `expr`
  against `slotId`. (The compiled module passes the live callback; the
  manifest only said "slotId X is an expression on interval I".)
- On each secondary **close** for interval `I`: for every registered
  expr-slot on `I`, run its callback with `ctx.stream` swapped to the
  secondary stream and `ACTIVE_RUNTIME_CONTEXT.current` set to the
  expr-runner context, read the returned value (`Series<number>` →
  `.current`, or a raw `number`), and `append` it to that slot's output
  buffer. `ta.*` inside the callback read/write the **secondary
  stream's** `taSlots`, so they accumulate over HTF bars.
- On a secondary **tick**: `replaceHead` the output buffer (mirror the
  `replaceTickHead` semantics — do not advance length).
- `request.security(slotId, opts, expr)` (main compute) returns a
  `Series<number>` whose backing array is the slot's output buffer
  **aligned** to the main timeline via `getOrAlign`
  (`htfBars` = secondary ascending bars, `htfSeries` = output buffer
  ascending values, `ltfBars` = main ascending bars).

## Requirements

### 1. Capture-and-drive ordering (the key subtlety)

The callback is only known once the main compute runs. But secondary
closes arrive (and must drive the callback) **before** the main bar they
precede (the pump interleaves them). Resolve with a **deferred-replay**
that stays O(total HTF bars):

- Maintain per-slot `processedHtfCount` (count of HTF bars already folded
  into the output buffer for this slot).
- When a secondary close for interval `I` is pushed: append the bar to
  the secondary stream (as today). **Do not** run callbacks yet if no
  callback is registered for `I` (none are until first main compute).
- At the **start** of `request.security(slotId, opts, expr)` in main
  compute: store `expr` for `slotId` (first call), then **catch up** —
  while `secondaryStream.length > processedHtfCount`, evaluate the
  callback against the secondary stream *as it stood at that HTF bar*.

  Because `ta.*` are incremental and read the stream **head**, the only
  correct replay is to fold each HTF bar at the moment its head is
  current. Two viable implementations — pick the one matching the
  existing secondary-feed timing and document the choice:

  - **(Preferred) Drive at append time once registered.** Register expr
    callbacks at **mount** by having the runtime call the compute body
    once in a "registration" pass is *not* possible (compute needs a
    bar). Instead: on the **first** main compute, replay the callback
    over all buffered HTF bars by temporarily presenting each historical
    HTF bar as the secondary stream head. Since `ta.*` slots are
    incremental, this requires feeding bars in order through a
    fresh secondary `taSlots` namespace — which is exactly what driving
    on each secondary append would do. **Therefore: register the
    callback lazily, but drive the per-HTF-bar fold inside the secondary
    append/tick path** by checking whether a callback is registered for
    that interval; on the first main compute, immediately fold any
    backlog (bars appended before registration) in order, then every
    later secondary close folds incrementally.

> Implementation guidance: keep a per-interval list of registered
> expr-slots on the `RuntimeContext`. `appendSecondaryBar` (and the
> history loop) calls a new `driveSecurityExpressions(ctx, interval)`
> after the buffer grows; that fn folds exactly the new bar for each
> registered slot whose `processedHtfCount` is now behind. The first
> main compute registers the slot and folds the backlog via the same fn
> (loop until `processedHtfCount === secondaryStream.length`). This makes
> append-time and first-compute paths share one fold routine.

The fold routine for one HTF bar:
1. Set `ACTIVE_RUNTIME_CONTEXT.current = exprRunner.ctx` (ctx whose
   `stream` is the secondary stream), inside try/finally that restores
   the previous active context (honour the runtime CLAUDE.md invariant).
2. Present the target HTF bar as the secondary stream head. When folding
   live (the just-appended bar), the head is already correct. When
   folding a backlog, the buffer already holds all bars — but `ta.*`
   read the head only. **Decision:** drive folding *synchronously inside
   the append path* so there is never a backlog to replay out of order
   (the first registered slot folds its backlog by re-reading buffered
   bars oldest→newest, presenting each as head via a transient cursor).
   If presenting historical bars as head is infeasible without mutating
   the ring buffer, instead **defer secondary-close compute until a
   callback exists** is wrong (misses history). The robust path:
   **register expr slots from the manifest at mount** (the manifest
   lists every expr slotId+interval — Task 2), and have the *module*
   expose its callbacks to the runtime at load (see step 2). Then no
   backlog exists: every secondary close from the very first history bar
   drives the callback.

> **Resolve the chicken-and-egg by exposing callbacks at load (step 2),
> driven by the manifest registry.** This removes the replay problem
> entirely. The deferred-replay text above is the fallback if load-time
> callback exposure proves impossible for a host.

### 2. Expose callbacks at module load (preferred mechanism)

The compiler keeps the callback inline. To register it before the first
secondary close, the emitted module must hand its expr callbacks to the
runtime at load. Mirror the existing `__chartlang_depOutput` global /
bundle-shim mechanism (`packages/runtime` dep wiring): the compiler
emits a registration shim that, at module evaluation, registers
`(slotId) => callback` into a runtime-provided collector keyed by
slotId. The runner reads the manifest's `securityExpressions` to know
which slotIds to expect and pairs each with the registered callback.

- Add `RuntimeContext.securityExprRunners: Map<string, SecurityExprRunner>`
  keyed by `slotId`, and `securityExprOutputs: Map<string, Float64RingBuffer>`
  keyed by `slotId`. Cleared on `dispose`.
- `SecurityExprRunner` (new `packages/runtime/src/request/securityExprRunner.ts`):
  `{ slotId, interval, stream: StreamState (secondary), ctx: RuntimeContext,
  callback: SecurityExpr, output: Float64RingBuffer }`. Build its `ctx`
  with `buildSubRunnerState`-style helper but with `stream =` the
  **secondary** stream (not the main stream) and a distinct
  `slotIdPrefix` (e.g. `security:<slotId>/`) so its `state.*` slots never
  collide; `ta.*` slots live on the secondary stream's `taSlots` and are
  unique by file position regardless.

### 3. Drive on secondary close/tick

In `execution/secondaryStream.ts`:
- `appendSecondaryBar` / `appendSecondaryHistory` per-bar: after the
  buffer grows, call `driveSecurityExpressions(ctx, interval, "close")`,
  which, for each registered `SecurityExprRunner` on `interval`, runs the
  callback in the runner ctx and `append`s the sampled value to
  `runner.output`.
- `replaceSecondaryHead` (tick): call with `"tick"` →
  `runner.output.replaceHead(value)` (no length advance).
- Suppress all emissions from the callback (no plot/alert/draw inside an
  HTF expression in v1; if the body somehow emits, drop it — the
  capture-check in Task 2 already forbids non-`ta`/`math` references, so
  `plot`/`alert` are unreachable, but guard anyway).

### 4. `request.security` overload dispatch

`requestNamespace.ts` `security(slotId, opts, expr?)`:
- `expr === undefined` → existing `makeSecurityBar` path (unchanged).
- `expr` present → return `makeSecurityExprSeries(ctx, slotId, opts.interval)`:
  a Proxy `Series<number>` (reuse the `makeAlignedNumberSeries` shape)
  whose backing array is `getOrAlign(htfBarsForInterval, outputAscending,
  ltfBars)` where `outputAscending` is the slot's `output` buffer in
  ascending order (reuse `ascendingBarsFor`-style materialisation for the
  buffer, or add a small `ascendingValues(buffer)` helper). Cache the
  Proxy identity per `slotId|interval` like `requestSecurityBars`.
- Fallbacks: same capability/interval/secondary-stream gates as
  `makeSecurityBar` (multiTimeframe off → NaN series +
  `multi-timeframe-not-supported`; unknown interval / no secondary stream
  → NaN + existing codes). Reuse `pushOnce`.

### 5. Secondary stream capacity

Confirm `createSecondaryStreams` sizes the secondary stream from a
capacity ≥ the callback's `maxLookback` (Task 2 folds callback lookback
into the whole-file `maxLookback`, and secondary capacity already derives
from that). Add a test that a callback with a deep lookback
(`ta.sma(bar.close, 50)`) produces finite (non-NaN-truncated) HTF output.

### 6. Host boots

- `host-worker` (`buildBundleFromModule`) and `host-quickjs`
  (`dispatcherCore`): verify the load-time callback registration shim
  (step 2) survives the bundle boot for **both** hosts — the
  registration global must be installed before the module evaluates,
  same as `__chartlang_depOutput`. Add/extend a host test that loads a
  module using the expression form and confirms the weekly output series
  is finite and differs from the same-length main EMA.

### 7. Tests (co-located)

- `securityExprRunner.test.ts`: one HTF expression, synthetic main +
  secondary bars; assert the output buffer holds one value per HTF bar
  and equals a hand-computed EMA-over-HTF-bars; assert the aligned
  main-timeline series is stair-stepped (holds within an HTF bucket) and
  **differs** from `ta.ema(mainClose, sameLength)`.
- Tick path: a secondary tick replaces the head output, does not advance
  length.
- Fallbacks: `multiTimeframe: false` → all-NaN expression series +
  one diagnostic.
- Property test: aligned output never reads a future HTF value
  (no-lookahead) — for every main bar, the value equals the most recent
  HTF output at or before that bar's time.
- 100% coverage on every changed runtime file.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/request/securityExprRunner.ts` | Create | Runner type + fold routine + driveSecurityExpressions |
| `packages/runtime/src/request/securityExprRunner.test.ts` | Create | Value, tick, fallback, no-lookahead tests |
| `packages/runtime/src/request/security.ts` | Modify | `makeSecurityExprSeries` |
| `packages/runtime/src/request/requestNamespace.ts` | Modify | Overload dispatch on `expr` |
| `packages/runtime/src/runtimeContext.ts` | Modify | `securityExprRunners` + `securityExprOutputs` maps; clear on dispose |
| `packages/runtime/src/execution/secondaryStream.ts` | Modify | Drive callbacks on close/tick/history |
| `packages/runtime/src/createScriptRunner.ts` | Modify | Build runners from manifest + register callbacks at load |
| `packages/host-worker/src/*` (boot) | Modify/verify | Callback-registration global before module eval |
| `packages/host-quickjs/src/dispatcherCore.ts` | Modify/verify | Same for QuickJS |
| `packages/runtime/CLAUDE.md` | Modify | Document SecurityExprRunner + drive-on-HTF-close invariant |
| `packages/runtime/src/request/CLAUDE.md` | Modify | Output-buffer alignment + fold semantics |
| `packages/host-worker/CLAUDE.md`, `packages/host-quickjs/CLAUDE.md` | Modify | Registration-shim boot note (if changed) |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (runtime + host coverage 100%)
- `pnpm bench:ci` (the secondary-close drive is on the hot path — add/verify a bench if folding per HTF bar measurably changes timing)
- `pnpm docs:check`

## Changeset

Append `@invinite-org/chartlang-runtime`,
`@invinite-org/chartlang-host-worker`,
`@invinite-org/chartlang-host-quickjs` (**minor**) to the feature
changeset.

## Acceptance Criteria

- [ ] HTF callback driven once per HTF bar; output buffer one value/bar.
- [ ] `request.security(opts, expr)` returns a no-lookahead aligned
      `Series<number>` differing from the same-length main EMA.
- [ ] Tick path replaces head without advancing length.
- [ ] Capability/interval/stream fallbacks return NaN + dedup diagnostic.
- [ ] Both hosts boot the expression form; host test green.
- [ ] All changed files 100% coverage; CLAUDE.md files updated.
- [ ] Changeset frontmatter updated.

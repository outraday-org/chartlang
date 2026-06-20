# Runtime: SecurityExprRunner + output buffer + alignment + host boots

> **Status: TODO**

## Goal

Implement the runtime side: drive each compiled HTF expression callback
**once per secondary (HTF) bar** through an isolated fold stream, capture
one output value per HTF bar into a per-slot output buffer, and have
`request.security(slotId, opts, expr)` return that output series aligned
no-lookahead to the main timeline. Verify both hosts carry the normal
compiled module/manifest path through unchanged.

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

- At mount, for each `manifest.securityExpressions` entry, create a
  `SecurityExprRunner` record for its `slotId`/`interval`, an empty
  `Float64RingBuffer` output buffer (capacity = secondary stream
  capacity), and a dedicated fold `StreamState` with the same interval.
- The callback closure is captured the **first time** the main compute
  body executes `request.security(slotId, opts, expr)` — store `expr`
  against `slotId`. (The compiled module passes the live callback; the
  manifest only said "slotId X is an expression on interval I".)
- On first callback capture, replay every already-buffered secondary bar
  for that interval oldest→newest through the runner's dedicated fold
  stream, run the callback once per replayed bar, and append one sampled
  output per HTF bar. This catches up history without mutating the real
  secondary stream's current head.
- On each later secondary **close** for interval `I`: append the same bar
  to every registered runner's fold stream for `I`, run its callback with
  `ACTIVE_RUNTIME_CONTEXT.current` set to the expr-runner context, read
  the returned value (`Series<number>` → `.current`, or a raw `number`),
  and `append` it to that slot's output buffer. `ta.*` inside the
  callback read/write the fold stream's `taSlots`, so they accumulate
  over HTF bars exactly once.
- On a secondary **tick**: `replaceHead` the output buffer (mirror the
  `replaceTickHead` semantics — do not advance length).
- `request.security(slotId, opts, expr)` (main compute) returns a
  `Series<number>` whose backing array is the slot's output buffer
  **aligned** to the main timeline via `getOrAlign`
  (`htfBars` = secondary ascending bars, `htfSeries` = output buffer
  ascending values, `ltfBars` = main ascending bars).

## Requirements

### 1. Capture-and-drive ordering

The callback is only known once the main compute runs. Secondary closes
can arrive before that first main compute because the pump interleaves
secondary streams ahead of the main bar. Resolve this with lazy capture
plus deterministic replay:

- Maintain per-slot `processedHtfCount` (count of HTF bars already folded
  into the output buffer for this slot).
- When a secondary close for interval `I` is pushed: append the bar to
  the real secondary stream as today. For every runner on `I` whose
  callback is already registered, append the bar to that runner's
  dedicated fold stream, evaluate the callback once, append the sampled
  output, and increment `processedHtfCount`.
- At the **start** of `request.security(slotId, opts, expr)` in main
  compute: if the callback has not been stored yet, store it and replay
  the current real secondary stream oldest→newest into the runner's fold
  stream until `processedHtfCount === secondaryStream.length`. This is
  O(total HTF bars) per slot because each historical bar is folded once.

The fold routine for one HTF bar:
1. Append the target HTF bar to the runner's dedicated fold stream
   (or replace its head for tick mode).
2. Set `ACTIVE_RUNTIME_CONTEXT.current = exprRunner.ctx` inside
   try/finally that restores the previous active context (honour the
   runtime CLAUDE.md invariant).
3. Run the stored callback with a `SecurityBar`/bar view backed by the
   fold stream head, sample `Series<number>.current` or the raw number,
   and append/replace the output buffer.

Do not mutate the real secondary stream to "present" historical bars as
the head during replay. The real stream remains the source for alignment
timestamps; the fold stream owns expression-local `taSlots` and callback
state.

### 2. Runner state

- Add `RuntimeContext.securityExprRunners: Map<string, SecurityExprRunner>`
  keyed by `slotId`, plus any per-interval index needed to find runners
  quickly from `appendSecondaryBar`. Cleared on `dispose`.
- `SecurityExprRunner` (new `packages/runtime/src/request/securityExprRunner.ts`):
  `{ slotId, interval, foldStream: StreamState, ctx: RuntimeContext,
  callback?: SecurityExpr, output: Float64RingBuffer, processedHtfCount }`.
  Build its `ctx` with a `buildSubRunnerState`-style helper but with
  `stream = foldStream` and a distinct `slotIdPrefix` (e.g.
  `security:<slotId>/`) so `state.*` slots never collide. `ta.*` slots
  live on `foldStream.taSlots`, making replay and live folding use the
  same incremental state path.

### 3. Drive on secondary close/tick

In `execution/secondaryStream.ts`:
- `appendSecondaryBar` / `appendSecondaryHistory` per-bar still append to
  the real secondary stream. Because those helpers currently accept only a
  `StreamState`, wire `driveSecurityExpressions(ctx, interval, "close",
  bar)` from `createScriptRunner.ts::pushSecondaryEvent` immediately after
  the append, where the `RunnerState.runtimeContext` is available. If you
  choose to widen the helper signatures instead, update their direct unit
  tests and all call sites.
- `replaceSecondaryHead` (tick): call with `"tick"` →
  `runner.output.replaceHead(value)` (no length advance), again from the
  caller path that has the runtime context.
- Suppress all emissions from the callback (no plot/alert/draw inside an
  HTF expression in v1; if the body somehow emits, drop it — the
  capture-check in Task 2 already forbids non-`ta` references, so
  `plot`/`alert` are unreachable, but guard anyway).

### 4. `request.security` overload dispatch

`requestNamespace.ts` `security(slotId, opts, expr?)`:
- If `slotId` is **not** declared in `manifest.securityExpressions` and
  `expr === undefined` → existing `makeSecurityBar` path (unchanged).
- If `slotId` is declared as a security expression, store `expr` when it
  is first provided, catch up the runner backlog, then return
  `makeSecurityExprSeries(ctx, slotId, opts.interval)`. This dispatch
  should key off the manifest runner registry rather than only
  `expr !== undefined`, so compiled output remains robust if the emitted
  call shape changes later.
- `makeSecurityExprSeries(...)` returns
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

- `host-worker` (`packages/host-worker/src/createWorkerBoot.ts`
  `buildBundleFromModule`) and `host-quickjs`
  (`packages/host-quickjs/src/moduleSourceToScript.ts` +
  `packages/host-quickjs/src/dispatcherCore.ts`): verify the existing
  compiled module + `__manifest` sidecar path preserves
  `manifest.securityExpressions` for both hosts. Add/extend a host test
  that loads a compiled module using the expression form and confirms the
  weekly output series is finite and differs from the same-length main
  EMA. No new load-time callback-registration global should be needed.

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
| `packages/runtime/src/runtimeContext.ts` | Modify | `securityExprRunners` registry; clear on dispose |
| `packages/runtime/src/execution/secondaryStream.ts` | Modify as needed | Preserve append/replace helpers or widen signatures deliberately |
| `packages/runtime/src/createScriptRunner.ts` | Modify | Build runners from manifest and drive them from `pushSecondaryEvent` |
| `packages/runtime/src/execution/dispose.ts` | Modify | Clear security-expression runner state on dispose |
| `packages/host-worker/src/createWorkerBoot.ts` | Modify/verify | Preserve `securityExpressions` from `__manifest` sidecar |
| `packages/host-quickjs/src/moduleSourceToScript.ts` | Modify/verify | Preserve any new sidecar exports if added; otherwise confirm no change |
| `packages/host-quickjs/src/dispatcherCore.ts` | Modify/verify | Preserve `securityExpressions` from `__manifest` sidecar |
| `packages/runtime/CLAUDE.md` | Modify | Document SecurityExprRunner + drive-on-HTF-close invariant |
| `packages/runtime/src/request/CLAUDE.md` | Modify | Output-buffer alignment + fold semantics |
| `packages/host-worker/CLAUDE.md`, `packages/host-quickjs/CLAUDE.md` | Modify | Manifest sidecar note if host invariants change |

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

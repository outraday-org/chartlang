# Task 3 — Runtime: composite `(symbol, interval)` keys

> **Status: DONE** (see `3-runtime-composite-key.plan.md` for the as-built audit).

## Goal

Widen every runtime stream-map and per-callsite cache from an `interval`
string key to the composite `feedKey(symbol, interval)`: create one secondary
`StreamState` per `manifest.requestedFeeds` entry (each carrying its real
symbol), key `secondaryStreams` / `requestSecurityBars` /
`requestSecurityAlignments` / the expr-runner indices by `feedKey`, and resolve
a symbol-omitted request to the chart symbol before keying so the back-compat
path stays byte-identical. Keep the runtime's 100% coverage + property + bench
gates green. (The `multiSymbol` capability gate lands in Task 5 alongside the
host wire; this task is pure keying.)

## Prerequisites

Task 1 (`feedKey`, `RequestedFeed`, `manifest.requestedFeeds`,
`RequestSecurityOpts.symbol`) and Task 2 (compiler emits `requestedFeeds` +
descriptor `symbol`).

## Current Behavior

- `createSecondaryStreams`
  (`packages/runtime/src/createScriptRunner.ts:206`) iterates
  `manifest.requestedIntervals` and builds `Map<string, StreamState>` keyed by
  **interval**, each stream constructed with `symbol: ""` hardcoded
  (line 213). `pushSecondaryEvent` (line 244) does
  `ctx.secondaryStreams.get(streamKey)` and fans the event +
  `driveSecurityExpressions(ctx, streamKey, …)`.
- `runtimeContext.ts`: `secondaryStreams` keyed by `IntervalDescriptor.value`
  (line 168); `requestSecurityBars` keyed `slotId|interval` (line 178);
  `requestSecurityAlignments` keyed `slotId|interval|sourceKey` (line 185).
- `request/security.ts`: `makeSecurityBar` (line 199) builds cache key
  `${slotId}|${interval}` (line 204), looks up
  `ctx.secondaryStreams.get(interval)` (line 231), and sets
  `SecurityBar.symbol = makeConstantStringSeries(secondary.bar.symbol)`
  (line 170). `fallbackNaN` (line 175) dedups via `pushOnce(ctx, code, slotId,
  interval, "security", …)`.
- `request/securityExprRunner.ts`: runners keyed by `slotId` + indexed per
  **interval** (`securityExprRunnersByInterval`); each owns a fold
  `StreamState` clocked on its interval.
- `StreamState.symbol` (`streamState.ts:103/227`) is a construction arg; the
  main stream uses `symbol: ""`.
- The runtime knows the chart symbol from… (confirm at implementation: the
  main stream's `symbol`, currently `""`, and/or an adapter-supplied
  `symInfo.ticker`). The chart symbol is whatever the host feeds as the main
  stream's symbol.

## Desired Behavior

- One secondary `StreamState` per `requestedFeeds` entry, keyed
  `feedKey(feed.symbol, feed.interval)`, constructed with `symbol:
  feed.symbol ?? chartSymbol` (no longer hardcoded `""`).
- `makeSecurityBar(ctx, slotId, symbol, interval)` resolves a symbol-omitted
  request to the chart symbol, builds `key = feedKey(resolvedSymbol,
  interval)`, caches under `${slotId}|${key}`, and looks up
  `ctx.secondaryStreams.get(key)`. `SecurityBar.symbol` reflects the resolved
  symbol.
- The expression runner is indexed by `feedKey`; a secondary close for feed
  key K fans out only to runners on K.
- A symbol-omitted (chart-symbol) request produces a `feedKey` equal to the
  bare interval (`feedKey` collapse), so its stream key, cache keys, and
  diagnostics are byte-identical to the pre-feature baseline — existing MTF
  goldens and snapshots must not move.

## Requirements

### 1. Resolve the chart symbol once (`createScriptRunner.ts`)

Determine the chart symbol at mount (read the main stream's configured symbol
/ adapter `symInfo.ticker`; pick the single existing source — do not invent a
new manifest field). Thread it where secondary streams and request kernels
need it. A symbol-omitted feed/request resolves to this value before keying.

### 2. `createSecondaryStreams` iterates `requestedFeeds` (`createScriptRunner.ts:206`)

```ts
function createSecondaryStreams(
    manifest: ScriptManifest,
    capacity: number,
    chartSymbol: string,
): Map<string, StreamState> {
    const streams = new Map<string, StreamState>();
    const feeds = manifest.requestedFeeds ?? legacyFeedsFromIntervals(manifest);
    for (const feed of feeds) {
        const symbol = feed.symbol ?? chartSymbol;
        const key = feedKey(feed.symbol, feed.interval); // omitted ⇒ bare interval
        if (streams.has(key)) continue;
        streams.set(key, createStreamState({ interval: feed.interval, capacity, symbol }));
    }
    return streams;
}
```

`legacyFeedsFromIntervals(manifest)` maps `requestedIntervals` →
`[{ interval }]` so a manifest produced **before** this feature (no
`requestedFeeds` field) still mounts its main-symbol HTF streams — the
`requestedFeeds ?? …` fallback is the apiVersion-1 forward-compat seam. Note:
because `feedKey(undefined, iv) === iv`, the symbol-omitted keys equal today's
interval keys exactly.

### 3. Re-key the request caches (`runtimeContext.ts`)

Update the JSDoc + meaning (no shape change — they stay `Map<string, …>`) of:
- `secondaryStreams` — "keyed by `feedKey(symbol, interval)`",
- `requestSecurityBars` — "keyed `slotId|feedKey`",
- `requestSecurityAlignments` — "keyed `slotId|feedKey|sourceKey`",
- `requestSecurityAscendingBars` — unchanged (keyed by `StreamState`).
- `securityExprRunnersByInterval` → rename/re-document to
  `securityExprRunnersByFeed`, keyed by `feedKey`.

### 4. `makeSecurityBar` + `requestNamespace` take a symbol (`request/security.ts`, `requestNamespace.ts`)

- `requestNamespace.ts`: the runtime `security(slotId, opts, expr?)` reads
  `opts.symbol` and `opts.interval`, resolves `symbol ?? chartSymbol`, and
  threads both into `makeSecurityBar` / `makeSecurityExprSeries`. The slot-id
  injection is unchanged (still first arg).
- `makeSecurityBar(ctx, slotId, symbol, interval)`: build `key =
  feedKey(symbol, interval)` (after chart-symbol resolution); cache key
  `${slotId}|${key}`; look up `ctx.secondaryStreams.get(key)`. Pass `key` (or
  `symbol`+`interval`) through to `fallbackNaN` / `pushOnce` so diagnostics
  dedup per feed, not per interval.
- `SecurityBar.symbol` (line 170) = `makeConstantStringSeries(resolvedSymbol)`
  (the resolved symbol, which for a live stream equals `secondary.bar.symbol`;
  for the chart-symbol case it equals the chart symbol — both correct).
- `requestSecurityAlignments` keys (`makeAlignedNumberSeries`) switch from
  `slotId|interval|sourceKey` to `slotId|feedKey|sourceKey`.

### 5. Expr-runner indexing (`request/securityExprRunner.ts`, `createScriptRunner.ts`)

- Mount one runner per `manifest.securityExpressions` entry; index it under
  `feedKey(entry.symbol, entry.interval)` in
  `securityExprRunnersByFeed`. Each runner's fold `StreamState` carries the
  resolved symbol.
- `driveSecurityExpressions(ctx, streamKey, kind, bar)` already receives the
  secondary stream key from `pushSecondaryEvent`; that `streamKey` IS now the
  composite `feedKey`, so the fan-out looks up `securityExprRunnersByFeed.get(
  streamKey)` with no further change. Confirm the lazy-capture replay
  (`captureAndCatchUp`) walks the secondary stream for the matching `feedKey`.

### 6. `pushSecondaryEvent` routing (`createScriptRunner.ts:244`)

No structural change — `event.streamKey` is now the composite `feedKey`
(Task 4 makes the host produce it; the runtime just routes by it). Add a unit
test that an event tagged with a composite key (`"AMEX:SPY@1D"`) routes to the
right stream and that an unknown composite key still pushes
`unknown-secondary-stream`.

### 7. `feedKey` is imported, never re-derived

Every runtime keying site imports `feedKey` from
`@invinite-org/chartlang-core` (the single source). Grep the runtime for inline
`|interval` / `${interval}` string concatenation that builds a stream/cache
key and route it through `feedKey` (or the `slotId|feedKey` composition). This
is the load-bearing-format invariant (`packages/runtime/CLAUDE.md` /
`compiler/CLAUDE.md` slot-id precedent).

## Edge cases

- **Back-compat byte-identity:** a symbol-omitted script keys everything by
  the bare interval (because `feedKey(undefined, iv) === iv`), so existing MTF
  goldens, snapshots, and diagnostics are unchanged. Add an explicit test
  asserting the symbol-omitted stream/cache keys equal the pre-feature keys.
- A request whose resolved `symbol === chartSymbol` (author passed the chart's
  own ticker explicitly) collapses to the bare-interval key via the
  chart-symbol resolution + `feedKey` — it must hit the same stream as the
  omitted-symbol form, not allocate a duplicate. Resolve symbol→chartSymbol
  **before** `feedKey`, and have `feedKey` collapse `chartSymbol` too (pass
  `symbol === chartSymbol ? undefined : symbol` into `feedKey`).
- Two different symbols at the same interval are two distinct streams + caches
  — assert no cross-talk (SPY close ≠ QQQ close).
- Legacy manifest (no `requestedFeeds`) mounts via `legacyFeedsFromIntervals`.
- A `requestedFeeds` symbol whose stream the host never registers degrades to
  NaN (`unknown-secondary-stream`) — unchanged path, now per-feed.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/createScriptRunner.ts` | Modify | `createSecondaryStreams` over `requestedFeeds`; chart-symbol resolution; legacy fallback; runner indexing by `feedKey`. |
| `packages/runtime/src/runtimeContext.ts` | Modify | Re-document map keys (composite); rename `…ByInterval` → `…ByFeed`. |
| `packages/runtime/src/request/security.ts` | Modify | `makeSecurityBar(…, symbol, interval)`; `feedKey` cache + lookup; resolved-symbol `SecurityBar.symbol`. |
| `packages/runtime/src/request/requestNamespace.ts` | Modify | Read `opts.symbol`; resolve chart symbol; thread to kernels. |
| `packages/runtime/src/request/securityExprRunner.ts` | Modify | Index by `feedKey`; fold stream carries resolved symbol. |
| `packages/runtime/src/**/*.test.ts` | Create/Modify | Composite-key routing, two-symbol no-cross-talk, chart-symbol collapse, legacy fallback, byte-compat. |
| `packages/runtime/CLAUDE.md` | Modify | Update the `request.security` NaN-fallback + secondary-stream + expr-runner invariants to say keys are `feedKey(symbol, interval)` and the symbol-omitted path is byte-identical. |

## Gates

- `pnpm -F @invinite-org/chartlang-runtime test` (coverage **100%**)
- `pnpm -F @invinite-org/chartlang-runtime bench` (no `THRESHOLD_MS`
  regression — `feedKey` is a single string-build on a cold path, but the
  per-bar request cache lookups are hot; confirm no regression or document)
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`

## Changeset

Covered by Task 1's feature changeset (runtime is minor).

## Acceptance Criteria

- One secondary stream per `requestedFeeds` entry, keyed `feedKey`; each
  carries its real symbol (not `""`).
- `requestSecurityBars` / `requestSecurityAlignments` / expr-runner indices
  keyed by the composite; `feedKey` imported, never re-derived.
- Symbol-omitted + explicit-chart-symbol requests both collapse to the
  bare-interval key (one stream); two distinct symbols don't cross-talk.
- Legacy (`requestedFeeds`-absent) manifest still mounts via the interval
  fallback; existing MTF goldens/snapshots unchanged (byte-compat test).
- Runtime coverage 100%; bench within threshold; `packages/runtime/CLAUDE.md`
  updated; typecheck/lint/docs:check green.

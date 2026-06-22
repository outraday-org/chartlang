# Task 3 — Runtime composite `(symbol, interval)` keys — Implementation Plan

> **Status: IMPLEMENTED & GREEN.** Runtime suite 594 files / 3099 tests, 100%
> coverage; typecheck/lint/docs:check + alignment benches pass; existing MTF
> goldens/snapshots unchanged.
>
> **As-built refinement over the plan:** the chart-symbol collapse
> (`symbol === chartSymbol → undefined` before `feedKey`) is applied in THREE
> places, not just `requestNamespace`: `createSecondaryStreams` and
> `buildSecurityExprRunners` must collapse too, because the compiler (Task 2)
> cannot know the runtime mount-time `chartSymbol`, so a `requestedFeeds` /
> `securityExpressions` entry whose literal symbol equals the chart's own ticker
> would otherwise allocate a duplicate `"AAPL@1D"` stream/runner instead of
> collapsing onto the bare-interval one.

## Context

Widen every runtime secondary-stream map and per-callsite request cache from
an `interval` string key to the composite `feedKey(symbol, interval)` built by
core's single shared helper (`packages/core/src/request/feedKey.ts`,
re-exported from `@invinite-org/chartlang-core`). The symbol-omitted path must
stay byte-identical to the pre-feature baseline because
`feedKey(undefined, iv) === iv`.

Four key sites + the expr-runner index:
1. `createSecondaryStreams` (createScriptRunner.ts) — one stream per
   `requestedFeeds` entry, keyed `feedKey(feed.symbol, feed.interval)`,
   carrying its real symbol.
2. `makeSecurityBar` (request/security.ts) — cache `${slotId}|${feedKey}`,
   lookup `secondaryStreams.get(feedKey)`; alignment cache
   `slotId|feedKey|sourceKey`.
3. `requestNamespace.security` — resolve `opts.symbol ?? chartSymbol`, collapse
   `symbol === chartSymbol` to `undefined` before `feedKey`, thread to kernels.
4. `securityExprRunner` — index runners by `feedKey(entry.symbol,
   entry.interval)` (`securityExprRunnersByFeed`); fold stream carries resolved
   symbol; `driveSecurityExpressions` keyed by the composite `streamKey`.
5. `pushSecondaryEvent` (createScriptRunner.ts) — unchanged structurally;
   `event.streamKey` is now the composite feedKey (Task 4/5 produce it).

## Pre-existing work (verified)

- Task 1 DONE: `feedKey(symbol, interval)` in core
  (`request/feedKey.ts`), re-exported from the root barrel
  (`core/dist/index.js:10`). `RequestedFeed { symbol?: string; interval:
  string }` (types.ts:445), `ScriptManifest.requestedFeeds?` (types.ts:680),
  `SecurityExpressionDescriptor.symbol?` (types.ts:427),
  `RequestSecurityOpts.symbol?` (request.ts:33). apiVersion stays 1. Core IS
  built (dist present); runtime typecheck baseline is clean.
- Task 2 DONE: compiler emits `requestedFeeds`.
- Task 4 (adapter-kit) is a sibling, not a dependency of this task — runtime
  only imports `feedKey` from core, not adapter-kit, so it is unaffected.
- Changeset `.changeset/multi-symbol-security.md` already lists runtime minor.

## How the runtime learns the chart symbol

The single existing mount-time source is `args.symInfo?.ticker` (the adapter
`syminfo.ticker`, `views/symInfoView.ts`). The main stream is constructed with
`symbol: ""` and only mutated per-close from `rawBar.symbol`. We read
`chartSymbol = args.symInfo?.ticker ?? ""` at mount — no new manifest field.

This value is load-bearing ONLY for the collapse comparison and for setting an
omitted feed's `secondary.symbol`. For byte-identity the collapse is what
matters: `feedKey(symbol === chartSymbol ? undefined : symbol, interval)`.
- omitted symbol → `feedKey(undefined, iv) === iv` (baseline, always).
- explicit chart symbol → resolves to `chartSymbol`, then collapses to
  `undefined` → bare interval (one stream, no duplicate).
- different symbol → `"<sym>@<iv>"`.

`chartSymbol` is threaded onto `RuntimeContext` (internal context, NOT a
manifest field) so the primary, dep, sibling, and expr-fold contexts all carry
it and `requestNamespace.security` reads `ctx.chartSymbol`.

## Issues found / decisions

1. **`pushOnce` dedupe key + diagnostic message.** `pushOnce`'s 4th arg
   (`interval`) is used only for the dedupe key. Pass the **feedKey** there so
   dedup is per-feed; for the chart-symbol path `feedKey === interval`, so the
   dedupe key stays byte-identical (`...|1D|security`). The diagnostic
   **message** keeps describing the interval (existing wording) to avoid moving
   golden/snapshot diagnostics; a present-symbol feed will naturally carry its
   `@`-suffixed key only in the dedupe set, not the message.
2. **`requestSecurityExprSeries` cache key** is `slotId|interval`
   (security.ts:315). Re-key to `slotId|feedKey` for symbol-distinctness;
   chart-symbol collapse keeps it byte-identical.
3. **`securityExprRunnersByInterval` rename → `securityExprRunnersByFeed`.**
   `runtimeContext.ts` field + `securityExprRunner.ts` `SecurityExprRegistry`
   (`byInterval` → `byFeed`) + `createScriptRunner.ts` assignment + the
   `driveSecurityExpressions` lookup. `dispose.ts:69` comment ("per-interval
   index") updated to "per-feed index".
4. **Dep/sibling runners** share the parent's `secondaryStreams` (composite
   keyed) and build their own `requestSecurityBars`/`Alignments` maps — those
   become composite-keyed automatically once `makeSecurityBar` keys by feedKey.
   Dep contexts have NO `securityExprRunners` (data form only). They DO need
   `chartSymbol` for `security()` symbol resolution → thread `chartSymbol` into
   `buildSubRunnerState` (DepRunner) from the parent. Verified: `CreateDepRunnerArgs`
   has no symbol today; add `chartSymbol` arg passed from `attachBundle`.
5. **`legacyFeedsFromIntervals` fallback** — `manifest.requestedFeeds ??
   manifest.requestedIntervals.map(iv => ({ interval: iv }))`. A manifest
   produced before this feature has no `requestedFeeds` but may have
   `requestedIntervals`; the fallback keeps mounting its main-symbol HTF
   streams. Both fields are omitted on no-`request.security` scripts.
6. **expr-runner mount** must use `requestedFeeds`? No — expr runners mount per
   `manifest.securityExpressions` entry (each now has optional `symbol`), keyed
   by `feedKey(entry.symbol, entry.interval)`. The fold stream's `symbol` =
   `entry.symbol ?? chartSymbol`; `makeFoldBar` symbol series = resolved symbol.

## Numbered steps

1. **core import** — add `import { feedKey } from "@invinite-org/chartlang-core"`
   to `createScriptRunner.ts`, `request/security.ts`,
   `request/requestNamespace.ts`, `request/securityExprRunner.ts`.
   `RequestedFeed` type import where needed.
2. **`runtimeContext.ts`** — add `readonly chartSymbol: string;` field with
   JSDoc. Re-document `secondaryStreams` ("keyed by `feedKey(symbol,
   interval)`"), `requestSecurityBars` ("keyed `slotId|feedKey`"),
   `requestSecurityAlignments` ("keyed `slotId|feedKey|sourceKey`"),
   `requestSecurityExprSeries` ("keyed `slotId|feedKey`"). Rename
   `securityExprRunnersByInterval` → `securityExprRunnersByFeed`, re-document
   "keyed by `feedKey`".
3. **`createScriptRunner.ts`**
   - `createSecondaryStreams(manifest, capacity, chartSymbol)` iterates
     `manifest.requestedFeeds ?? legacyFeedsFromIntervals(manifest)`; key
     `feedKey(feed.symbol, feed.interval)`; `symbol: feed.symbol ?? chartSymbol`.
   - add `legacyFeedsFromIntervals(manifest): RequestedFeed[]`.
   - `buildPrimaryState`: compute `chartSymbol = args.symInfo?.ticker ?? ""`;
     set on ctx; pass to `createSecondaryStreams`.
   - rename ctx assignment `securityExprRunnersByInterval` →
     `securityExprRunnersByFeed` (uses `exprRunners.byFeed`).
   - `attachBundle`: pass `chartSymbol` to dep/sibling factories.
4. **`request/securityExprRunner.ts`**
   - `SecurityExprRegistry`: `byInterval` → `byFeed`.
   - `createSecurityExprRunner` accepts `symbol` (resolved); fold stream +
     `makeFoldBar` use it.
   - `buildSecurityExprRunners`: resolve `symbol = descriptor.symbol ??
     parent.chartSymbol`; key `byFeed` by `feedKey(descriptor.symbol,
     descriptor.interval)` (pass the RAW descriptor.symbol so the collapse
     matches the secondary-stream key, which is built from `feed.symbol`).
   - `driveSecurityExpressions(parent, streamKey, mode, bar)` reads
     `parent.securityExprRunnersByFeed?.get(streamKey)`.
5. **`request/security.ts`**
   - `makeSecurityBar(ctx, slotId, symbol, interval)`: `key = feedKey(symbol,
     interval)` (symbol already chart-resolved+collapsed by caller — see step
     6); cache `${slotId}|${key}`; lookup `secondaryStreams.get(key)`; pass
     `key` to `fallbackNaN`/`pushOnce`. `SecurityBar.symbol` =
     `makeConstantStringSeries(secondary.bar.symbol)` (live) for the live path
     (unchanged — the stream already carries the resolved symbol).
   - `alignmentKey(slotId, feedKey, sourceKey)`; `alignedSeries` /
     `makeAlignedNumberSeries` / `makeLiveSecurityBar` thread `feedKey` instead
     of `interval`. `interval` series on the bar stays the bare interval
     (`makeConstantStringSeries(interval)`).
   - `makeSecurityExprSeries(ctx, runner, feedKey)`: cache `${runner.slotId}|${feedKey}`;
     `resolveSecondaryOrDiagnose(ctx, slotId, feedKey)` lookups
     `secondaryStreams.get(feedKey)` + `pushOnce(..., feedKey, ...)`.
   - `fallbackNaN`/`pushOnce` calls take the composite key as the dedupe arg;
     messages keep the interval text (pass interval separately to the message).
6. **`request/requestNamespace.ts`**
   - `security(slotId, opts, expr)`: `chartSymbol = ctx.chartSymbol`;
     `resolved = opts.symbol === undefined || opts.symbol === chartSymbol ?
     undefined : opts.symbol`; `key = feedKey(resolved, opts.interval)`.
     Data form → `makeSecurityBar(ctx, slotId, resolved, opts.interval)`.
     Expr form → `ctx.secondaryStreams.get(key)` for capture +
     `makeSecurityExprSeries(ctx, runner, key)`.
7. **`dep/DepRunner.ts`** — `CreateDepRunnerArgs` gains `chartSymbol`;
   `buildSubRunnerState` sets `ctx.chartSymbol = args.chartSymbol`. `createDepRunner`
   / `createSiblingRunner` pass it through. `attachBundle` supplies
   `primary.runtimeContext.chartSymbol`.
8. **`dispose.ts`** — comment at line ~69 "per-interval index" → "per-feed
   index". No code change (disposes via `bySlot`).
9. **Tests** (see Files table) — extend requestNamespace.test.ts +
   createScriptRunner.test.ts + securityExprRunner.test.ts; add chartSymbol to
   all `makeContext`/`buildSubRunnerState` test fixtures missing it. New cases:
   composite-key routing (`AMEX:SPY@1D`), two-symbol no-cross-talk,
   chart-symbol collapse (explicit ticker == omitted, one stream), legacy
   fallback, byte-compat (omitted-symbol keys == pre-feature interval keys).
10. **`runtime/CLAUDE.md`** — update the `request.security` NaN-fallback,
    secondary-stream, and expr-runner invariants to say keys are
    `feedKey(symbol, interval)` + the symbol-omitted path is byte-identical.
    **`request/CLAUDE.md`** — note composite-key alignment cache.

## Files table

| File | Action |
|------|--------|
| `packages/runtime/src/runtimeContext.ts` | Modify — `chartSymbol` field; re-doc map keys; rename `…ByInterval`→`…ByFeed`. |
| `packages/runtime/src/createScriptRunner.ts` | Modify — `createSecondaryStreams` over feeds; `legacyFeedsFromIntervals`; chartSymbol; runner index rename; attachBundle threads chartSymbol. |
| `packages/runtime/src/request/security.ts` | Modify — `makeSecurityBar(…, symbol, interval)`; feedKey cache+lookup+alignment; `makeSecurityExprSeries(…, feedKey)`. |
| `packages/runtime/src/request/requestNamespace.ts` | Modify — resolve+collapse symbol; thread feedKey/symbol. |
| `packages/runtime/src/request/securityExprRunner.ts` | Modify — `byFeed`; runner symbol; `driveSecurityExpressions` by feedKey. |
| `packages/runtime/src/dep/DepRunner.ts` | Modify — thread `chartSymbol` into sub-runner contexts. |
| `packages/runtime/src/execution/dispose.ts` | Modify — comment only. |
| `packages/runtime/src/request/requestNamespace.test.ts` | Modify — chartSymbol fixture; multi-symbol + collapse + no-cross-talk cases. |
| `packages/runtime/src/createScriptRunner.test.ts` | Modify — requestedFeeds mount, composite streamKey routing, legacy fallback, byte-compat. |
| `packages/runtime/src/request/securityExprRunner.test.ts` | Modify — byFeed + chartSymbol; symbol-feed drive. |
| `packages/runtime/src/runtimeContext.test.ts` + other fixtures | Modify — add `chartSymbol` where a `RuntimeContext` literal is built. |
| `packages/runtime/CLAUDE.md`, `packages/runtime/src/request/CLAUDE.md` | Modify — composite-key invariants. |

## Gates to keep green

- `pnpm --filter @invinite-org/chartlang-runtime test` (100% coverage incl
  property/golden). Existing MTF goldens MUST NOT move (byte-compat).
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`.
- bench within threshold (feedKey is a cold-path string build; the hot per-bar
  cache lookups change only the key string content, not the structure).

## Changeset

`.changeset/multi-symbol-security.md` already lists `@invinite-org/chartlang-runtime: minor`. No new changeset.

## Acceptance criteria

- One secondary stream per `requestedFeeds` entry, keyed `feedKey`; each carries
  its real symbol (not `""`).
- `requestSecurityBars`/`requestSecurityAlignments`/`requestSecurityExprSeries`
  /expr-runner index keyed by the composite; `feedKey` imported, never
  re-derived.
- Symbol-omitted + explicit-chart-symbol both collapse to the bare-interval key
  (one stream); two distinct symbols don't cross-talk.
- Legacy (`requestedFeeds`-absent) manifest mounts via the interval fallback;
  existing MTF goldens/snapshots unchanged.
- Runtime coverage 100%; typecheck/lint/docs:check green; CLAUDE.md updated.
</content>
</invoke>

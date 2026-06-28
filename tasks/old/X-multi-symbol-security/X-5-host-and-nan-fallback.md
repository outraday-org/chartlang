# Task 5 — Host / reference-adapter wiring + multi-symbol NaN fallback

> **Status: DONE**

## Goal

Wire the composite feed key end-to-end through the hosts and the demo /
reference adapter, and implement the **`multiSymbol` NaN fallback** in the
runtime request kernel: a different-symbol request against an adapter that
does not advertise `multiSymbol` degrades to an all-NaN `SecurityBar` /
expression series with a single deduped `multi-symbol-not-supported`
diagnostic — exactly as `multi-timeframe-not-supported` does today.

## Prerequisites

Task 3 (runtime composite keying) and Task 4 (`CandleEvent.streamKey`
composite + `Capabilities.multiSymbol`).

## Current Behavior

- `makeSecurityBar` (`packages/runtime/src/request/security.ts:199`) gates on
  `ctx.capabilities.multiTimeframe` (line 208) → `fallbackNaN(…,
  "multi-timeframe-not-supported", …)` (line 209), then `intervals.some(…)`
  (line 219) → `unsupported-interval`, then
  `ctx.secondaryStreams.get(interval)` (line 231) →
  `unknown-secondary-stream`. `fallbackNaN` (line 175) calls `pushOnce`.
  Diagnostic-code union here is `"unsupported-interval" |
  "multi-timeframe-not-supported" | "unknown-secondary-stream"` (line 180).
- The demo producer (`apps/site/src/components/demo/secondaryStreams.ts:160`)
  tags `streamKey: interval` (bare interval).
- Hosts (`host-worker` `createWorkerBoot.ts`, `host-quickjs`
  `dispatcherCore.ts`) carry the compiled `__manifest` sidecar and route
  `CandleEvent`s — they pass `streamKey` through but currently only ever see
  bare-interval keys.
- `ctx.capabilities` carries `multiTimeframe`; after Task 4 it also carries
  `multiSymbol`.

## Desired Behavior

- `makeSecurityBar` / `makeSecurityExprSeries` add a `multiSymbol` gate:
  **when the resolved symbol differs from the chart symbol** and
  `ctx.capabilities.multiSymbol === false`, return an all-NaN bar/series and
  push `multi-symbol-not-supported` (deduped per feed via `pushOnce`). A
  chart-symbol (omitted / equal) request never trips this gate — it stays on
  the `multiTimeframe` path, byte-identical to today.
- Gate order: `multiSymbol` (different symbol) → `multiTimeframe` (different
  interval) → `unsupported-interval` → `unknown-secondary-stream`. A
  different-symbol request first fails the symbol gate if unsupported.
- The demo producer and any reference adapter tag secondary events with the
  composite `feedKey` (so the runtime routes different-symbol streams) and
  advertise `multiSymbol` honestly.
- Both hosts pass the composite `streamKey` through unchanged (the manifest
  sidecar already carries `requestedFeeds` from the compiler); add/extend a
  host test that a two-symbol script loads and produces finite, distinct
  series for each symbol.

## Requirements

### 1. `multi-symbol-not-supported` diagnostic (`request/security.ts`)

Add `"multi-symbol-not-supported"` to the `code` union of `fallbackNaN`
(line 180) and to wherever the runtime declares its request diagnostic codes
(grep `multi-timeframe-not-supported`). Message: `Adapter declares
multiSymbol: false; request.security for a different symbol returns NaN`.

### 2. The gate (`makeSecurityBar` + `makeSecurityExprSeries`)

After chart-symbol resolution (Task 3) and before the `multiTimeframe` gate:

```ts
const isDifferentSymbol = resolvedSymbol !== chartSymbol;
if (isDifferentSymbol && !ctx.capabilities.multiSymbol) {
    return fallbackNaN(ctx, cacheKey, slotId, feedKey, "multi-symbol-not-supported", msg);
}
```

`fallbackNaN` already caches the NaN bar under `cacheKey` and dedups via
`pushOnce(ctx, code, slotId, <feedKey>, "security", …)`. Use the composite
`feedKey` as the dedup discriminator so two different unsupported symbols at
the same interval each warn once (and a supported chart-symbol request at the
same interval is unaffected).

Apply the identical gate in `makeSecurityExprSeries` (the expression form)
before it consults its runner/output buffer, returning the all-NaN aligned
series.

### 3. Demo producer (`apps/site/src/components/demo/secondaryStreams.ts`)

- Build each secondary event's `streamKey` via `feedKey(symbol, interval)`
  (import from core / adapter-kit), not the bare `interval` (line 160).
- Extend the demo to produce a second-symbol synthetic stream (a deterministic
  resample of a second seeded series) so a multi-symbol DEMO_SCRIPT (Task 7)
  renders. Advertise `multiSymbol: true` in the demo adapter's capabilities.
- The existing single-interval demo streams keep `feedKey(undefined, iv) ===
  iv`, so their wire is byte-identical.

### 4. Hosts (`host-worker`, `host-quickjs`)

- Confirm `createWorkerBoot.ts` (`buildBundleFromModule`) and
  `dispatcherCore.ts` carry `requestedFeeds` from the `__manifest` sidecar
  (they read the whole manifest — verify nothing strips unknown fields) and
  pass `CandleEvent.streamKey` through untouched. No new global / registration
  needed (mirrors the HTF-expression host work,
  `tasks/old/htf-security-expression/X-3` §6).
- Add/extend a host test (one per host) that loads a compiled two-symbol
  script (SPY/QQQ ratio), feeds two secondary streams tagged with composite
  keys, and asserts both series are finite and distinct.

### 5. Reference / CLI adapter template (`packages/cli/src/adapterTemplate/templates.ts`)

If the CLI scaffolds an adapter template that declares capabilities / handles
`streamKey`, add `multiSymbol` to the template's capability object and a
comment showing the composite `streamKey` format, so scaffolded adapters are
multi-symbol-aware from day one.

### 6. Tests

- runtime: different-symbol request with `multiSymbol: false` → all-NaN bar +
  one `multi-symbol-not-supported`; with `multiSymbol: true` + a registered
  stream → live values. Chart-symbol request with `multiSymbol: false` →
  unaffected (still `multiTimeframe`-gated). Expression form: same gate.
- demo: `feedKey`-tagged streams route; the second-symbol stream renders.
- hosts: two-symbol script loads, both series finite + distinct.

## Edge cases

- A request that is BOTH a different symbol AND a different interval against an
  adapter with `multiSymbol: false` trips `multi-symbol-not-supported` first
  (symbol gate precedes interval gate) — one diagnostic, not both. Document the
  order.
- `multiSymbol: true` + `multiTimeframe: false`: a different symbol at the
  *chart* interval is allowed (symbol gate passes; no interval gate because
  same interval). A different symbol at a *different* interval still needs
  `multiTimeframe` and trips `multi-timeframe-not-supported`.
- Diagnostic dedup must key on the composite `feedKey` so SPY-unsupported and
  QQQ-unsupported each warn once.
- Host sidecar: a manifest with `requestedFeeds` but no `securityExpressions`
  (pure data form, two symbols) must still mount its streams.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/request/security.ts` | Modify | `multi-symbol-not-supported` code + the `multiSymbol` gate (data + expr forms). |
| `apps/site/src/components/demo/secondaryStreams.ts` | Modify | `feedKey`-built `streamKey`; second-symbol synthetic stream. |
| `apps/site/src/components/demo/*` (adapter capabilities) | Modify | Advertise `multiSymbol: true`. |
| `packages/host-worker/src/createWorkerBoot.ts` | Modify/verify | Preserve `requestedFeeds`; pass composite `streamKey`. |
| `packages/host-quickjs/src/dispatcherCore.ts` | Modify/verify | Same. |
| `packages/cli/src/adapterTemplate/templates.ts` | Modify | `multiSymbol` + composite `streamKey` in the scaffold. |
| `packages/runtime/src/request/security.test.ts` + host tests | Create/Modify | Gate + routing + two-symbol host load. |
| `packages/runtime/CLAUDE.md` | Modify | Add `multi-symbol-not-supported` + gate order to the NaN-fallback invariant. |
| `packages/host-worker/CLAUDE.md`, `packages/host-quickjs/CLAUDE.md` | Modify (if invariants change) | Sidecar carries `requestedFeeds`. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-runtime test`,
  `pnpm -F @invinite-org/chartlang-host-worker test`,
  `pnpm -F @invinite-org/chartlang-host-quickjs test` (coverage thresholds)
- `pnpm docs:check`

## Changeset

Covered by Task 1's feature changeset (runtime / host-worker / host-quickjs /
adapter-kit all minor; cli patch if `templates.ts` changes a published
`src/`).

## Acceptance Criteria

- Different-symbol request against `multiSymbol: false` → all-NaN +
  one deduped `multi-symbol-not-supported` (data AND expression forms);
  chart-symbol request unaffected.
- Gate order documented: symbol → timeframe → unsupported-interval →
  unknown-stream.
- Demo + reference adapter tag `streamKey` via `feedKey` and advertise
  `multiSymbol`; second-symbol stream renders.
- Both hosts load a two-symbol script; series finite + distinct.
- Relevant CLAUDE.md files updated; runtime + host tests/docs:check green.

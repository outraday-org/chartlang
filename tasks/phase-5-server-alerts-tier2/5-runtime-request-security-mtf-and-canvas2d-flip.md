# Task 5 — Runtime: `request.security` real HTF path + canvas2d MTF flip

> **Status: TODO**

## Goal

Replace the Phase-4 NaN fallback for `request.security` with a real
HTF-aligned secondary-bar producer that consumes the Task-4 kernel.
Wire one `StreamState` per requested interval, drive secondary
streams from adapter-supplied candle events, flip the canvas2d
reference adapter's `Capabilities.multiTimeframe: true`, and ship
the MTF conformance scenarios.

## Prerequisites

- Task 4: `alignHtfSeriesToLtf` + `alignHtfSeriesCache` ported.

## Current Behavior

- `packages/runtime/src/request/` has `request.security` returning
  a NaN-secondary-bar stub; every callsite emits a
  `multi-timeframe-not-supported` diagnostic.
- `packages/runtime/src/runtimeContext.ts` `RuntimeContext` carries
  `requestSecurityBars` (per-callsite NaN cache) +
  `diagnosedRequestKeys`.
- `packages/runtime/src/streamState.ts` constructs one main-stream
  `StreamState`. No secondary-stream registry.
- `examples/canvas2d-adapter/src/capabilities.ts` declares
  `multiTimeframe: false`.
- No MTF conformance scenarios.

## Desired Behavior

- The runtime maintains a `secondaryStreams: Map<string, StreamState>`
  keyed by `IntervalDescriptor.value` (e.g. `"1D"`). Each stream
  carries its own ring buffer + bar bookkeeping.
- Adapters drive secondary streams via a new
  `CandleEvent.streamKey?` discriminant — `streamKey === undefined`
  means main stream; non-empty means a registered secondary.
- `request.security({ interval })` returns a `SecurityBar` proxy
  reading from the secondary stream's aligned series, computed via
  the Task-4 kernel and cached per callsite. The Phase-4 per-
  callsite `requestSecurityBars` map continues to gate identity
  (the same callsite reads the same proxy object across bars —
  satisfies the runtime CLAUDE.md invariant).
- When `Capabilities.multiTimeframe: false`, the existing NaN
  fallback + `multi-timeframe-not-supported` diagnostic still
  fires (no behavioural regression for adapters that don't flip).
- When `Capabilities.multiTimeframe: true` but the requested
  `interval` is not in `Capabilities.intervals`, emit
  `unsupported-interval` and fall back to NaN.
- The canvas2d-adapter declares `multiTimeframe: true`, configures
  a multi-stream candle pump (one fetch per requested interval),
  and routes `kind: "close"` / `kind: "history"` events through
  the runtime's secondary-stream entry points.
- Three new conformance scenarios cover MTF: a 1D-on-1m
  `request.security` script reading `close[0]`, the same script
  with a `1h` interval not declared in `Capabilities.intervals`
  (expects `unsupported-interval`), and the same script with the
  capability flipped `false` (expects `multi-timeframe-not-supported`).

## Requirements

### 1. `packages/adapter-kit/src/types.ts` — extend `CandleEvent`

Add an optional `streamKey?: string` discriminant to `CandleEvent`:

```ts
export type CandleEvent =
    | { readonly kind: "history"; readonly bars: ReadonlyArray<Bar>; readonly streamKey?: string }
    | { readonly kind: "close";   readonly bar:  Bar;                  readonly streamKey?: string }
    | { readonly kind: "tick";    readonly bar:  Bar;                  readonly streamKey?: string };
```

`streamKey` absent → main stream (unchanged behaviour for Phase 1–4
adapters). Non-empty → secondary stream by interval. Document the
discriminant inline with `@since 0.5`.

### 2. `packages/runtime/src/runtimeContext.ts` — extend

- `secondaryStreams: Map<string, StreamState>` — keyed by interval
  value. Mutation confined to `createScriptRunner`.
- `requestSecurityAlignments: Map<string, ReadonlyArray<number>>` —
  per-callsite cached aligned series (key: `slotId|interval|sourceKey`).
  Cleared on `onBarClose` of the main stream so each compute step
  re-aligns against the latest secondary state.

### 3. `packages/runtime/src/createScriptRunner.ts` — extend

- On mount, walk `manifest.requestedIntervals` and create one
  `StreamState` per interval (reuse Phase-1 `createStreamState`
  with `interval: <value>`).
- `push(event)`:
  - If `event.streamKey` is undefined → existing main-stream path.
  - Else → look up `secondaryStreams.get(event.streamKey)`. If
    absent → emit `unknown-secondary-stream` diagnostic + drop.
    If present → advance ring buffer per `event.kind`.
- `onBarClose` for the main stream clears
  `requestSecurityAlignments` and serialises a snapshot per Task 2
  cadence (the snapshot now carries every secondary stream too).

### 4. `packages/runtime/src/request/security.ts` (replace stub)

- Update the Phase-4 NaN stub to:
  - Check `capabilities.multiTimeframe`. If `false` → existing
    NaN + `multi-timeframe-not-supported` (no change).
  - Check `interval ∈ capabilities.intervals.map(d => d.value)`.
    If not → NaN + `unsupported-interval` (deduped via
    `diagnosedRequestKeys`).
  - Look up the secondary `StreamState`. If absent → NaN +
    `unknown-secondary-stream` (this is a host/adapter bug, not a
    script issue; diagnostic carries the interval).
  - Compute aligned `close` / `open` / `high` / `low` / `volume`
    series via `getOrAlign(htfBars, htfSource, ltfBars)` per Task 4.
    Cache key: `slotId|interval|sourceKey`.
  - Build / reuse the `SecurityBar` proxy with `.close`, `.open`,
    `.high`, `.low`, `.volume`, `.time` accessors backed by the
    aligned arrays at the current LTF bar index.
- Phase-4 per-callsite identity invariant preserved: same `slotId`
  → same proxy object across bars (the proxy reads from the cache;
  the cache's identity is stable across `onBarClose` because the
  arrays are referenced from the secondary `StreamState`'s buffers).

### 5. `examples/canvas2d-adapter/src/capabilities.ts` — flip MTF

- `multiTimeframe: true`.
- Confirm `intervals` includes the six canonical groups from Phase 4
  closeout (the test scenarios depend on `1m`, `1h`, `1D` being
  declared).

### 6. `examples/canvas2d-adapter/src/streamPump.ts` (new)

Build a multi-stream candle pump:

- On mount, the adapter receives the script's `manifest.requestedIntervals`.
- For each interval, register a secondary stream (`streamKey: interval`)
  and start pumping candles from the data source. The example adapter's
  data source is its existing fixture loader — extend it to filter by
  interval. (The fixture loader's interface is described in
  `examples/canvas2d-adapter/CLAUDE.md` — confirm and extend, do not
  re-architect.)
- Each candle event carries `streamKey`. Main-stream events keep
  `streamKey` undefined for backward compat.

### 7. `examples/canvas2d-adapter/src/integration.test.ts` — extend

- Existing tests stay green (main-stream only paths).
- Add an integration test loading a script with
  `request.security("1D", "close")` against a 1m main stream + a 1D
  secondary fixture. Assert the script's emitted `plot` series shows
  the correct daily close at each minute boundary.

### 8. Conformance scenarios

Three new scenarios under `packages/conformance/src/scenarios/`:

#### `mtfRequestSecurityClose.ts`

- `inlineSource` declares a script that calls `request.security("1D", "close")`
  and plots the result.
- Assertions:
  - `plot-hash` matches a captured golden output.
  - No `multi-timeframe-not-supported` diagnostic.
  - No `unsupported-interval` diagnostic.

#### `mtfUnsupportedInterval.ts`

- Script requests `"7D"` (not in `Capabilities.intervals`).
- Assertions:
  - `diagnostic-code-present`: `unsupported-interval` once
    per callsite mount.
  - `plot-hash`: NaN-only series.

#### `mtfCapabilityFalse.ts`

- Script requests `"1D"` but the conformance harness configures
  `multiTimeframe: false`.
- Assertions:
  - `diagnostic-code-present`: `multi-timeframe-not-supported`.
  - `plot-hash`: NaN-only series.

### 9. Tests

- `packages/runtime/src/request/security.test.ts` extends with:
  - Each new diagnostic emitted exactly once per callsite mount.
  - Aligned series identity stable across `onBarClose`.
  - Snapshot persistence covers secondary streams — Task 2's
    determinism test re-runs with a MTF script and asserts byte-
    identical warm-vs-cold past the snapshot.
- `packages/runtime/src/createScriptRunner.test.ts` extends with:
  - Multi-stream registration: 3 requested intervals → 3
    `secondaryStreams` entries.
  - Unknown `streamKey` → `unknown-secondary-stream` diagnostic.

### 10. JSDoc

- `request.security` JSDoc updates to drop the "Phase 4 NaN
  fallback" language; documents the real path + diagnostic
  triggers.
- `CandleEvent.streamKey` documented with `@since 0.5`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/types.ts` | Modify | Add `CandleEvent.streamKey?: string` |
| `packages/runtime/src/runtimeContext.ts` | Modify | `secondaryStreams`, `requestSecurityAlignments` |
| `packages/runtime/src/createScriptRunner.ts` | Modify | Mount secondary streams; route events; per-bar align cache clear |
| `packages/runtime/src/request/security.ts` | Modify | Replace NaN stub with real HTF path |
| `packages/runtime/src/request/security.test.ts` | Modify | New diagnostic cases + identity test |
| `packages/runtime/src/createScriptRunner.test.ts` | Modify | Multi-stream mount tests |
| `examples/canvas2d-adapter/src/capabilities.ts` | Modify | `multiTimeframe: true` |
| `examples/canvas2d-adapter/src/streamPump.ts` | Create | Multi-stream candle pump |
| `examples/canvas2d-adapter/src/integration.test.ts` | Modify | MTF integration test |
| `packages/conformance/src/scenarios/mtfRequestSecurityClose.ts` | Create | Happy-path MTF scenario |
| `packages/conformance/src/scenarios/mtfUnsupportedInterval.ts` | Create | `unsupported-interval` scenario |
| `packages/conformance/src/scenarios/mtfCapabilityFalse.ts` | Create | `multi-timeframe-not-supported` scenario |
| `packages/conformance/src/scenarios/index.ts` | Modify | Register the 3 new scenarios |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage on touched files)
- `pnpm docs:check`
- `pnpm conformance` (all 3 new MTF scenarios green against canvas2d)
- `pnpm readme:check`

## Changeset

`.changeset/phase5-runtime-request-security-mtf.md` — `minor` bump
for `@invinite-org/chartlang-runtime`,
`@invinite-org/chartlang-adapter-kit` (CandleEvent change), and the
canvas2d-adapter (capability flip). Body cites PLAN §6.8 + §7.2.

## Acceptance Criteria

- [ ] `request.security` returns real HTF-aligned series when
      `multiTimeframe: true` + interval declared.
- [ ] Three diagnostic codes fire under documented conditions:
      `multi-timeframe-not-supported`, `unsupported-interval`,
      `unknown-secondary-stream`.
- [ ] Phase-4 NaN fallback semantics preserved when
      `multiTimeframe: false`.
- [ ] Per-callsite proxy identity preserved across bars (existing
      CLAUDE.md invariant).
- [ ] canvas2d-adapter flips `multiTimeframe: true`; integration test
      pins a real HTF script.
- [ ] All 3 new conformance scenarios green; `pnpm conformance` exit
      code 0.
- [ ] Snapshot persistence covers secondary streams (verified by
      Task 2's determinism test re-run with an MTF script).
- [ ] Changeset committed.

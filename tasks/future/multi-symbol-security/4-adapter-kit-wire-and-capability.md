# Task 4 — Adapter-kit: `streamKey` composite + `multiSymbol` capability

> **Status: TODO**

## Goal

Re-document `CandleEvent.streamKey` as the composite **feed key** (not just an
interval), add the new `Capabilities.multiSymbol: boolean` gate, and update the
adapter-kit base adapters / validation / mocks so the wire and the capability
surface the new dimension. This is the host-facing contract Task 5 wires into
real hosts.

## Prerequisites

Task 1 (`feedKey` exported from core — adapters re-export / consume it).

## Current Behavior

- `CandleEvent` (`packages/adapter-kit/src/types.ts:33`) has a `streamKey?:
  string` on each of its three variants (lines 43/54/65), documented "set to a
  requested interval value such as `"1D"` for MTF candles".
- `Capabilities.multiTimeframe` (`packages/adapter-kit/src/types.ts:304`):
  "Whether the adapter can deliver more than one candle stream per script
  load. `false` triggers the Phase 4 all-NaN fallback for `request.security`."
  There is **no** `multiSymbol`.
- `Adapter.candles(opts: { interval: string | "chart" })` (line 833) is the
  single stream entry point.
- Base adapters: `base/bufferingAdapter.ts`, `base/passThroughAdapter.ts`
  reference `streamKey` / `multiTimeframe`. Capability builders in
  `capabilities/capabilities.ts`. Mock candle source in
  `mocks/mockCandleSource.ts`.
- `IntervalDescriptor` is exported (line 15/292).

## Desired Behavior

- `CandleEvent.streamKey` is documented as the composite feed key produced by
  core's `feedKey(symbol, interval)` — bare interval (`"1D"`) for a
  chart-symbol higher-timeframe stream, `"AMEX:SPY@1D"` for a different-symbol
  stream. The wire **type** is unchanged (`string`), only the meaning + docs
  widen; omitting `streamKey` still = main stream.
- `Capabilities.multiSymbol: boolean` exists, documented as gating non-chart
  symbol requests (a strictly larger ask than `multiTimeframe`); `false`
  triggers the all-NaN fallback for a *different-symbol* `request.security`.
- Base adapters / mocks / validation account for the new capability (defaults,
  validation, examples) without changing the byte-shape of an adapter that
  only does single-symbol MTF.

## Requirements

### 1. Re-document `CandleEvent.streamKey` (`adapter-kit/src/types.ts:43/54/65`)

Update each of the three JSDoc blocks to:

```
/**
 * Secondary-stream feed key. Omit for the main stream; otherwise set to the
 * composite key built by core's `feedKey(symbol, interval)` — the bare
 * interval (`"1D"`) for a higher-timeframe stream of the chart's own symbol,
 * or `"<symbol>@<interval>"` (`"AMEX:SPY@1D"`) for a different-symbol stream.
 * Must match the runtime's secondary-stream key byte-for-byte.
 *
 * @since 0.5
 */
```

Bump nothing about the type. Cross-reference `feedKey` so adapter authors know
the canonical source.

### 2. Add `Capabilities.multiSymbol` (`adapter-kit/src/types.ts`)

Next to `multiTimeframe` (line 304):

```ts
/**
 * Whether the adapter can deliver candle streams for a **different symbol**
 * than the chart's own (e.g. a cross-instrument ratio). A strictly larger
 * capability than {@link Capabilities.multiTimeframe} — an adapter can
 * resample its own symbol to a higher timeframe without being able to fetch
 * another instrument. `false` triggers the all-NaN fallback for any
 * `request.security({ symbol })` whose symbol differs from the chart symbol
 * (a chart-symbol / interval-only request stays gated only by
 * `multiTimeframe`).
 *
 * @since 1.2
 * @stable
 * @example
 *     const enabled: Capabilities["multiSymbol"] = false;
 *     void enabled;
 */
readonly multiSymbol: boolean;
```

Update the `Capabilities` `@example` (line ~243) to include `multiSymbol:
false` so the doc example stays complete.

### 3. Capability builders + defaults (`capabilities/capabilities.ts`)

Wherever a default `Capabilities` is assembled (helper builders, the
"no-MTF" default), add `multiSymbol` with a sensible default (`false` —
conservative; an adapter opts in). Ensure a builder that sets
`multiTimeframe: true` does not implicitly enable `multiSymbol` (they are
independent).

### 4. Base adapters + mocks

- `base/bufferingAdapter.ts` / `base/passThroughAdapter.ts`: if they construct
  or forward capabilities, thread `multiSymbol`. If they tag secondary events
  with `streamKey`, route through `feedKey` (import from core) rather than a
  bare interval — so the base adapters model the composite wire correctly.
- `mocks/mockCandleSource.ts`: allow producing different-symbol streams (tag
  events via `feedKey`), so runtime/conformance tests can drive a two-symbol
  scenario through the standard mock.

### 5. Validation (`validation/`)

If adapter validation checks `streamKey` shapes or capability completeness,
add `multiSymbol` to the required-capability set (it is a required boolean,
like `multiTimeframe`). A validation error for a missing `multiSymbol` keeps
adapters honest. Confirm existing fixtures/mocks set it.

### 6. Re-export `feedKey` (optional convenience)

Re-export `feedKey` from the adapter-kit barrel (`src/index.ts`) so adapter
authors import the canonical key-builder from the kit they already depend on
(it is the same identity as core's). Do not fork it.

### 7. Tests (`types.types.test.ts`, `*.test.ts`, mocks)

- `Capabilities` now requires `multiSymbol` (type test: an object missing it
  is a type error).
- A `CandleEvent` with `streamKey: "AMEX:SPY@1D"` type-checks.
- Mock candle source emits a different-symbol stream with the right
  `feedKey`-built `streamKey`.
- Existing single-symbol-MTF adapter/mocks still pass with
  `multiSymbol: false` (byte-compat).

## Edge cases

- An adapter advertising `multiSymbol: true` but `multiTimeframe: false` is
  legal-but-odd (a different symbol at the *same* interval). Don't forbid it;
  the runtime gates per-request (symbol differs ⇒ `multiSymbol`; interval
  differs ⇒ `multiTimeframe`; a different-symbol-AND-different-interval request
  needs both — Task 5 decides the precise gate order, but adapter-kit just
  surfaces both booleans).
- `streamKey: ""` is not "main stream" — omission is. An empty string is an
  invalid feed key; validation may reject it.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/types.ts` | Modify | Re-doc `streamKey` (composite); add `Capabilities.multiSymbol`. |
| `packages/adapter-kit/src/capabilities/capabilities.ts` | Modify | Default + thread `multiSymbol`. |
| `packages/adapter-kit/src/base/bufferingAdapter.ts`, `base/passThroughAdapter.ts` | Modify | Thread capability; tag `streamKey` via `feedKey`. |
| `packages/adapter-kit/src/mocks/mockCandleSource.ts` | Modify | Emit different-symbol streams. |
| `packages/adapter-kit/src/validation/*` | Modify | Validate `multiSymbol`. |
| `packages/adapter-kit/src/index.ts` | Modify | Re-export `feedKey` (identity from core). |
| `packages/adapter-kit/src/types.types.test.ts`, `*.test.ts` | Modify | Capability + wire type/behavior tests. |
| `packages/adapter-kit/CLAUDE.md` (if present) | Modify | Document composite `streamKey` + `multiSymbol`. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-adapter-kit test` (coverage thresholds)
- `pnpm docs:check`

## Changeset

Covered by Task 1's feature changeset (adapter-kit is minor).

## Acceptance Criteria

- `CandleEvent.streamKey` documented as the composite `feedKey`; type
  unchanged; omission still = main stream.
- `Capabilities.multiSymbol` added + defaulted (`false`); independent of
  `multiTimeframe`; validated.
- Base adapters + mocks build secondary `streamKey` through `feedKey`;
  `feedKey` re-exported from the kit (identity from core).
- Single-symbol-MTF adapters unchanged with `multiSymbol: false`.
- adapter-kit tests/docs:check green; CLAUDE.md (if present) updated.

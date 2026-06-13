# Task 3 — Helpers: chained-MA family (wma / smma / vwma / computeMa)

> **Status: TODO**

## Goal

Port the chained-MA helper family from
`../invinite/src/components/trading-chart/indicators/lib/` into
`packages/runtime/src/ta/lib/`. These helpers back ~22 of the
§9.2 ports (every moving average + BB middle override + Keltner
middle + Envelope middle + Chop denominator + Donchian midpoint).
Phase 1 already shipped `smaFloat64` + `emaFloat64`; this task
adds the remaining four cores + the MA-kind dispatcher.

## Prerequisites

- Task 2 (`gen-docs.ts` is in place — though helpers don't
  generate doc pages; primitives that consume them do).

## Current Behavior

`packages/runtime/src/ta/lib/` carries `smaFloat64.ts` and
`emaFloat64.ts`. No WMA / SMMA / VWMA core. No MA dispatcher.
Every Phase-2 MA port would re-port its own math unless these
helpers land first.

## Desired Behavior

After this task:

- `lib/wmaFloat64.ts` — linearly-weighted MA, weights `1..N`.
- `lib/smmaFloat64.ts` — Wilder-smoothed MA, α = 1/N.
- `lib/vwmaFloat64.ts` — volume-weighted MA.
- `lib/computeMaOfFloat64.ts` — the chained-MA dispatcher
  (excludes `vwma` at the type level — VWMA needs volume; dispatch
  routes via the volume-aware sibling).
- `lib/computeMa.ts` — the volume-aware dispatcher that includes
  VWMA.
- `lib/maTypes.ts` — the `MaType` union + per-type opts shape.

Each helper:
- Float64Array-in / Float64Array-out (no `Series<T>` here — the
  primitives wrap them into Series).
- Independent of `RuntimeContext` — no `ACTIVE_RUNTIME_CONTEXT`
  access. Helpers are pure functions over Float64Array windows.
- 100% line + branch + statement + function coverage via the
  helper's own `<helper>.test.ts`.

## Requirements

### 1. Provenance header

Every ported helper carries the 4-line CONTRIBUTING §4 header
(reference commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`).
`packages/runtime/src/ta/CLAUDE.md` already documents the
convention; no edits required.

### 2. `lib/wmaFloat64.ts`

Source: `../invinite/src/components/trading-chart/indicators/lib/
wma-of-float64.ts`. Signature:

```ts
export function wmaFloat64(
    source: Float64Array,
    length: number,
): Float64Array;
```

Warmup: `length - 1` NaN slots. Math: linear weights `1..N`
normalised by `N(N+1)/2`. Tests pin the math against a hand-rolled
fixture (`buildVisualBaselineCandles`-equivalent from the §17.4
canonical inputs).

### 3. `lib/smmaFloat64.ts`

Source: `../invinite/src/components/trading-chart/indicators/lib/
smma-of-float64.ts`. Signature:

```ts
export function smmaFloat64(
    source: Float64Array,
    length: number,
): Float64Array;
```

Math: `SMMA[t] = (SMMA[t-1] * (N-1) + x[t]) / N`. Seed:
`SMA(length)` over the first `length` slots. Warmup: `length - 1`
NaN. Property test: SMMA equals EMA with α = 1/N for large N.

### 4. `lib/vwmaFloat64.ts`

Source: `../invinite/src/components/trading-chart/indicators/lib/
vwma-of-float64.ts`. Signature:

```ts
export function vwmaFloat64(
    source: Float64Array,
    volume: Float64Array,
    length: number,
): Float64Array;
```

Math: `Σ(price * volume) / Σ(volume)` over the trailing `length`
window. Warmup: `length - 1`. Tests cover the zero-volume edge
(returns NaN for that bar — matches invinite).

### 5. `lib/maTypes.ts`

Types-only file (excluded from coverage per §16.1):

```ts
export type MaType = "sma" | "ema" | "wma" | "smma" | "vwma";
export type MaTypeNoVolume = Exclude<MaType, "vwma">;
```

### 6. `lib/computeMaOfFloat64.ts`

Source: `../invinite/src/components/trading-chart/indicators/lib/
compute-ma-of-float64.ts`. Signature:

```ts
export function computeMaOfFloat64(
    kind: MaTypeNoVolume,
    source: Float64Array,
    length: number,
): Float64Array;
```

`switch` over `kind` → `sma | ema | wma | smma`. Each arm
re-exports the matching core. Tests cover every arm.

### 7. `lib/computeMa.ts`

Source: `../invinite/src/components/trading-chart/indicators/lib/
compute-ma.ts`. Signature:

```ts
export function computeMa(
    kind: MaType,
    source: Float64Array,
    length: number,
    volume: Float64Array | null,
): Float64Array;
```

Routes `vwma` to `vwmaFloat64(source, volume!, length)` and every
other kind to `computeMaOfFloat64(kind, source, length)`. Throws
a structured error (with code `"ta-lib-vwma-requires-volume"`) if
`kind === "vwma"` and `volume === null`. The thrower's test
asserts the error code + message.

### 8. Test layers per §16.3

For each new helper:

| File | Coverage |
|---|---|
| `<helper>.test.ts` | Unit tests pinning the math against the existing 100-bar visual baseline fixture (`buildVisualBaselineCandles`-equivalent). |
| `<helper>.property.test.ts` | `fast-check` invariants — length invariance, warmup NaN, determinism, large-N equivalence assertions (SMMA ≈ EMA(α=1/N) for N≥30, WMA → SMA as weights become uniform — n/a here but tested for SMA equivalence on degenerate inputs). |
| `<helper>.bench.ts` + `.bench.test.ts` | Vitest bench pair; `THRESHOLD_MS = ceil(median × 3)` post-port. |

Goldens are NOT shipped at the helper level — they live on the
consumer primitives in Tasks 6–28. Bench tests are mandatory
because these helpers run in the hot path of every consumer
primitive (§16.2 bench list).

### 9. Coverage

- `wmaFloat64.ts`, `smmaFloat64.ts`, `vwmaFloat64.ts`,
  `computeMaOfFloat64.ts`, `computeMa.ts` — 100% line + branch +
  statement + function via their `.test.ts` files.
- `maTypes.ts` — types-only, excluded.

### 10. NaN propagation

Every helper handles a NaN source slot the same way: if the input
slot at index `i` is NaN, the helper's output at `i` is NaN, and
the rolling state ignores that slot. This matches invinite's
behaviour and is asserted in the property tests.

### 11. JSDoc

Each exported helper carries `@since 0.2`, `@stable`, `@formula`
(see PLAN §9.2 conventions), `@warmup` (count formula), and one
`@example` block. Helper `@example` blocks are intentionally
comment-only (no `defineIndicator(...)` call) so `pnpm docs:check`
skips compilation — same convention as Phase-1 lib helpers.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/runtime/src/ta/lib/wmaFloat64.ts` | Create | WMA core. |
| `packages/runtime/src/ta/lib/wmaFloat64.test.ts` | Create | Unit. |
| `packages/runtime/src/ta/lib/wmaFloat64.property.test.ts` | Create | Property. |
| `packages/runtime/src/ta/lib/wmaFloat64.bench.ts` | Create | Bench. |
| `packages/runtime/src/ta/lib/wmaFloat64.bench.test.ts` | Create | Bench threshold. |
| `packages/runtime/src/ta/lib/smmaFloat64.ts` | Create | SMMA core. |
| `packages/runtime/src/ta/lib/smmaFloat64.{test,property.test,bench,bench.test}.ts` | Create | 4 test files. |
| `packages/runtime/src/ta/lib/vwmaFloat64.ts` | Create | VWMA core. |
| `packages/runtime/src/ta/lib/vwmaFloat64.{test,property.test,bench,bench.test}.ts` | Create | 4 test files. |
| `packages/runtime/src/ta/lib/maTypes.ts` | Create | Types. |
| `packages/runtime/src/ta/lib/computeMaOfFloat64.ts` | Create | Dispatcher (no vol). |
| `packages/runtime/src/ta/lib/computeMaOfFloat64.test.ts` | Create | Unit. |
| `packages/runtime/src/ta/lib/computeMa.ts` | Create | Dispatcher (vol). |
| `packages/runtime/src/ta/lib/computeMa.test.ts` | Create | Unit (incl. error path). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage on `@invinite-org/chartlang-runtime`)
- `pnpm bench:ci` (new helpers join the bench matrix)
- `pnpm docs:check` (helpers' `@example` blocks)
- `pnpm readme:check`

Note: `pnpm conformance` is intentionally **not** in this task's
gates — helpers don't expose script-author surfaces, so they ship
no conformance scenarios. Their consumer primitives in Tasks 6–28
cover the conformance surface.

## Changeset

`.changeset/phase-2-helpers-chained-ma.md` — `minor` for
`@invinite-org/chartlang-runtime` (new internal helpers, no public
surface change yet — primitives in Tasks 6+ are the public
delta).

## Acceptance Criteria

- Five new helper files compile + pass unit + property + bench
  tests.
- `maTypes.ts` exports `MaType` + `MaTypeNoVolume`.
- 100% coverage maintained on the runtime package.
- Provenance header present on every ported helper (invinite
  commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`).
- Changeset committed.

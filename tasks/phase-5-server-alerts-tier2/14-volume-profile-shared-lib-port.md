# Task 14 — Volume-profile shared lib port

> **Status: TODO**

## Goal

Port the shared volume-profile math from
`../invinite/src/components/trading-chart/indicators/lib/volume-profile/`
into `packages/runtime/src/ta/_lib/volume-profile/`. The four VP
indicators (Tasks 15–18) all consume this lib; landing it first
means each indicator task is a clean §22.10 set against a stable
helper surface.

## Prerequisites

- Task 13: Color helpers landed (the entire Tier-2 ergonomics cluster
  is complete; volume-profile work follows).

## Current Behavior

- `packages/runtime/src/ta/_lib/` does not yet exist as a `volume-profile`
  sub-directory (other helpers like `applyOffset.ts`, `tr-series.ts`
  exist directly in `_lib/` from Phase 2).
- Invinite's volume-profile lib at
  `../invinite/src/components/trading-chart/indicators/lib/volume-profile/`
  contains:
  - `bucket-edges.ts` + `.test.ts`
  - `bucketize-volume.ts` + `.test.ts`
  - `developing-series.ts` + `.test.ts`
  - `intercept.ts` + `.test.ts`
  - `too-heavy.ts` + `.test.ts`
  - `types.ts`
  - `value-area.ts` + `.test.ts`
  - `volume-profile-shared.ts`

## Desired Behavior

- `packages/runtime/src/ta/_lib/volume-profile/` ships every helper
  ported 1:1 with the 4-line provenance header.
- Each helper retains its invinite test, retargeted at the chartlang
  `Series<T>` shape where applicable (the helpers are mostly numeric-
  array math; minimal retargeting).
- Property tests pin the documented invariants (value-area sum, bucket
  monotonicity, etc.).
- Bench pair on the hot path (`bucketizeVolume`).
- No public export from the package barrel — these are package-private
  helpers used by Tasks 15–18.

## Requirements

### 1. Provenance header (each file)

```
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/<name>.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.
```

### 2. Ports (in dependency order)

#### `packages/runtime/src/ta/_lib/volume-profile/types.ts`

Pure types — bucket shape (`{ low, high, volume, mid }`), value-area
result (`{ valHigh, valLow, poc }`), config (`{ rowSize, valueAreaPct }`).
Mirror the invinite shape exactly.

#### `packages/runtime/src/ta/_lib/volume-profile/bucketEdges.ts`

Pure math producing bucket edges given `[lowPrice, highPrice]` and
`rowSize`. JSDoc references the math.

#### `packages/runtime/src/ta/_lib/volume-profile/bucketizeVolume.ts`

The hot-path function: walks an OHLCV slice + bucket edges and
distributes each bar's volume across buckets it overlaps. Returns
a `ReadonlyArray<{ price: number, volume: number }>` per the PLAN
`horizontal-histogram` `buckets` shape.

#### `packages/runtime/src/ta/_lib/volume-profile/valueArea.ts`

Computes the value-area high/low + point-of-control (POC) given
the bucket array and a `valueAreaPct` (default 70%). Pure
greedy expansion from POC.

#### `packages/runtime/src/ta/_lib/volume-profile/intercept.ts`

Helper for the volume-at-price intersection (used by anchored /
session VPs to detect "developing" interest at the current price).

#### `packages/runtime/src/ta/_lib/volume-profile/tooHeavy.ts`

Guard preventing pathological bucket counts (e.g. an asset with
huge price range + small rowSize → millions of buckets). Returns
a boolean + a recommended fallback `rowSize` if too heavy.

#### `packages/runtime/src/ta/_lib/volume-profile/developingSeries.ts`

Computes per-bar series for "developing" POC / value-area (used by
the anchored / session VPs for time-series plot overlays).

#### `packages/runtime/src/ta/_lib/volume-profile/volumeProfileShared.ts`

Top-level utilities consumed by the indicators — `computeProfile(opts)`
glueing the above into one call.

### 3. Tests

Each helper ships:

- `.test.ts` — port of the invinite test, retargeted at the new
  signatures. Goldens (small captured outputs) land under
  `__fixtures__/`.
- `.property.test.ts` (`bucketizeVolume`, `valueArea`,
  `developingSeries`) — pin invariants:
  - `bucketizeVolume`: sum of bucket volumes = sum of input bar
    volumes (conservation).
  - `bucketizeVolume`: buckets are monotonic in price.
  - `valueArea`: `poc` is inside the bucket array; sum of buckets in
    the value area ≥ `valueAreaPct × totalVolume`.
  - `developingSeries`: length equals input bar count.

### 4. Bench pair

- `bucketizeVolume.bench.ts` — 5,000 bars × 200 buckets, single run.
- `bucketizeVolume.bench.test.ts` — `THRESHOLD_MS = 10` (per
  invinite's perf characteristics; document the budget rationale).

### 5. `packages/runtime/src/ta/_lib/volume-profile/index.ts`

Barrel re-exporting every helper for the indicator tasks (15–18) to
import as a single `_lib/volume-profile` module. Package-private —
the parent `packages/runtime/src/index.ts` does NOT re-export.

### 6. JSDoc

Every exported helper carries `@since 0.5`, `@example`,
`@internal` (these are not user-facing surfaces). The implementations
also carry `@formula` references back to PLAN §9.2 / §10.1.1 where
relevant.

### 7. Tests for invariants per `packages/runtime/CLAUDE.md`

- Property tests use the pinned `fast-check` seed.
- Bench-pair pattern.
- 100% coverage maintained.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/ta/_lib/volume-profile/types.ts` | Create | Type aliases |
| `packages/runtime/src/ta/_lib/volume-profile/bucketEdges.ts` | Create | Port |
| `packages/runtime/src/ta/_lib/volume-profile/bucketEdges.test.ts` | Create | Port |
| `packages/runtime/src/ta/_lib/volume-profile/bucketizeVolume.ts` | Create | Port |
| `packages/runtime/src/ta/_lib/volume-profile/bucketizeVolume.test.ts` | Create | Port |
| `packages/runtime/src/ta/_lib/volume-profile/bucketizeVolume.property.test.ts` | Create | Property invariants |
| `packages/runtime/src/ta/_lib/volume-profile/bucketizeVolume.bench.ts` | Create | Bench |
| `packages/runtime/src/ta/_lib/volume-profile/bucketizeVolume.bench.test.ts` | Create | Threshold gate |
| `packages/runtime/src/ta/_lib/volume-profile/valueArea.ts` | Create | Port |
| `packages/runtime/src/ta/_lib/volume-profile/valueArea.test.ts` | Create | Port |
| `packages/runtime/src/ta/_lib/volume-profile/valueArea.property.test.ts` | Create | Property |
| `packages/runtime/src/ta/_lib/volume-profile/intercept.ts` | Create | Port |
| `packages/runtime/src/ta/_lib/volume-profile/intercept.test.ts` | Create | Port |
| `packages/runtime/src/ta/_lib/volume-profile/tooHeavy.ts` | Create | Port |
| `packages/runtime/src/ta/_lib/volume-profile/tooHeavy.test.ts` | Create | Port |
| `packages/runtime/src/ta/_lib/volume-profile/developingSeries.ts` | Create | Port |
| `packages/runtime/src/ta/_lib/volume-profile/developingSeries.test.ts` | Create | Port |
| `packages/runtime/src/ta/_lib/volume-profile/developingSeries.property.test.ts` | Create | Property |
| `packages/runtime/src/ta/_lib/volume-profile/volumeProfileShared.ts` | Create | Top-level glue |
| `packages/runtime/src/ta/_lib/volume-profile/index.ts` | Create | Package-private barrel |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-runtime test --coverage` (100%)
- `pnpm docs:check`
- `pnpm bench:ci`

## Changeset

`.changeset/phase5-volume-profile-shared-lib.md` — `patch` bump for
`@invinite-org/chartlang-runtime` (internal helpers, no public
surface). Body cites PLAN §9.2 + invinite commit SHA.

## Acceptance Criteria

- [ ] Every file ships the 4-line provenance header.
- [ ] Each helper retains its invinite test, retargeted; new
      property tests pin the listed invariants.
- [ ] `bucketizeVolume` bench under threshold.
- [ ] No public re-export from the package barrel — helpers are
      package-private.
- [ ] 100% coverage on touched files.
- [ ] Gates green.
- [ ] Changeset committed.

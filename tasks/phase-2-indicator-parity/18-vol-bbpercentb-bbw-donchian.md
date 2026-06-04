# Task 18 — Volatility ports: `ta.bbPercentB`, `ta.bbw`, `ta.donchian`

> **Status: TODO**

## Goal

Port three Bollinger-/Donchian-derivative volatility primitives.

## Prerequisites

- Task 4 (`donchianMid`).
- Task 5 (`ta.highest` / `ta.lowest`).
- Phase 1 (`ta.bb` for percent-B / BBW middle reuse).

## Current Behavior

`ta.bbPercentB`, `ta.bbw`, `ta.donchian` absent.

## Desired Behavior

- `TaNamespace` extends with three new methods.
- `TA_REGISTRY` cardinality 54 → 57.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.bbPercentB(source: Series<number>, length: number, opts?: BbPercentBOpts): Series<number>;
ta.bbw(source: Series<number>, length: number, opts?: BbwOpts): Series<number>;
ta.donchian(length: number, opts?: DonchianOpts): DonchianResult;       // { upper, middle, lower }
```

Defaults `multiplier = 2` for `BbPercentBOpts` / `BbwOpts`.

`DonchianResult` is a three-output record.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.bbPercentB` | `indicators/bb-percent-b.ts` | `length - 1` |
| `ta.bbw` | `indicators/bbw.ts` | `length - 1` |
| `ta.donchian` | `indicators/donchian.ts` + `lib/donchianMid` | `length - 1` |

- BB %B: `(src − lower) / (upper − lower)`. Composes `ta.bb` via
  sub-slot.
- BBW: `(upper − lower) / middle`. Same composition.
- Donchian: `upper = highest(high, N)`, `lower = lowest(low, N)`,
  `middle = (upper + lower) / 2` (or `donchianMid(high, low, N)`
  — same math).

### 4. Slot value shapes

- `ta.bbPercentB`: `{ outBuffer, series, bbSub }`.
- `ta.bbw`: `{ outBuffer, series, bbSub }`.
- `ta.donchian`: `{ outputs: { upper, middle, lower }, highestSub, lowestSub }`.

### 5. Multi-output for `ta.donchian`

- `primarySeriesKey: "middle"`.
- `getVisibleSeriesKeys`: `["upper", "middle", "lower"]`.
- `yDomain: { kind: "auto" }`.

### 6. NaN / edge handling

- BB %B with zero band width → NaN.
- BBW with zero middle → NaN.
- Donchian with NaN inputs → NaN at all outputs for that bar.

### 7. §22.10 set + scenarios

| File | Script |
|---|---|
| `taBbPercentB.scenario.ts` | `plot(ta.bbPercentB(bar.close, 20))`. |
| `taBbw.scenario.ts` | `plot(ta.bbw(bar.close, 20))`. |
| `taDonchian.scenario.ts` | `const d = ta.donchian(20); plot(d.upper); plot(d.middle); plot(d.lower);`. |

### 8. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + DonchianResult. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Three entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{bbPercentB,bbw,donchian}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×3 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 57 + metadata for `donchian`. |
| `packages/runtime/src/ta/registry.test.ts` | Modify | Cardinality. |
| `packages/conformance/src/scenarios/<id>.scenario.ts` | Create (×3) | Scenarios. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Re-export. |
| `packages/conformance/src/scenarios/scenarios.test.ts` | Modify | Add. |
| `docs/primitives/ta/<id>.md` | Generate (×3) | Pages. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage),
`pnpm bench:ci`, `pnpm docs:check`, `pnpm docs:gate`,
`pnpm readme:check`, `pnpm conformance`.

## Changeset

`.changeset/phase-2-vol-bbpercentb-bbw-donchian.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Three primitives exported + registered (cardinality 57).
- BB %B + BBW compose `ta.bb` via sub-slot.
- Donchian uses `lib/donchianMid` (no private highest/lowest
  math).
- §22.10 set complete; 100% coverage.
- Changeset committed.

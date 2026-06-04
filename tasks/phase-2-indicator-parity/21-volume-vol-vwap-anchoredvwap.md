# Task 21 — Volume ports: `ta.vol`, `ta.vwap`, `ta.anchoredVwap`

> **Status: TODO**

## Goal

Port the trio of foundational volume primitives. Each uses the
Task-1 `histogram` PlotKind for the canonical default style.
`anchoredVwap` introduces the simplest variant of an
input-anchored primitive — the anchor is a literal time the
script author passes, not a runtime input (deferred to Phase 4).

## Prerequisites

- Task 1 (`histogram` PlotKind for `ta.vol`).
- Task 5 (`ta.nz` for guarded division).

## Current Behavior

`ta.vol`, `ta.vwap`, `ta.anchoredVwap` absent.

## Desired Behavior

- `TaNamespace` extends with three new methods.
- `TA_REGISTRY` cardinality 63 → 66.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.vol(opts?: VolOpts): Series<number>;
ta.vwap(opts?: VwapOpts): Series<number>;
ta.anchoredVwap(anchorTime: number, opts?: AnchoredVwapOpts): Series<number>;
```

- `VolOpts`: `{ offset?: number }`.
- `VwapOpts`: `{ source?: "hlc3" | "close" | "hl2" | "ohlc4" | "hlcc4"; offset?: number }` (default `"hlc3"`).
- `AnchoredVwapOpts`: `{ source?: …; offset?: number }`.

`anchorTime` is a millisecond UTC epoch the script author hard-codes (or computes from a literal). Phase-4's `input.time()` will lift this to a user input.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.vol` | `indicators/vol.ts` | 0 (volume passthrough; uses histogram style at adapter) |
| `ta.vwap` | `indicators/vwap.ts` | 0 (running cumulative from session start; uses `bar.time` boundary to reset per day per invinite convention) |
| `ta.anchoredVwap` | `indicators/anchored-vwap.ts` | 0 (NaN until first bar with `bar.time >= anchorTime`) |

VWAP session-reset convention: VWAP accumulators reset at the
start of each `syminfo.session.regularStart` per invinite. Phase
1 lacks `syminfo` (deferred to Phase 4). For Phase 2,
`ta.vwap` operates as a **session-anchored VWAP** keyed on UTC
calendar day boundary (00:00 UTC). Phase 4 lifts session
detection to `syminfo`. Document the boundary in the JSDoc.

### 4. Slot value shapes

- `ta.vol`: `{ outBuffer, series }` — pure passthrough of `bar.volume`.
- `ta.vwap`: `{ outBuffer, series, cumPV, cumV, currentDayKey: number }` (`currentDayKey = floor(bar.time / 86400000)`).
- `ta.anchoredVwap`: `{ outBuffer, series, cumPV, cumV, anchorTime, started: boolean }`.

### 5. NaN / edge handling

- `ta.vol`: NaN volume (rare) → NaN output.
- `ta.vwap`: zero-cumulative-volume → NaN.
- `ta.anchoredVwap`: any bar with `bar.time < anchorTime` → NaN; first bar with `bar.time >= anchorTime` starts accumulation.

### 6. PlotKind usage

`ta.vol`'s conformance scenario plots with `style: { kind:
"histogram", baseline: 0 }` to exercise Task-1's new kind end-to-
end. `ta.vwap` / `ta.anchoredVwap` plot as line.

### 7. §22.10 set + scenarios

| File | Script |
|---|---|
| `taVol.scenario.ts` | `plot(ta.vol(), { style: { kind: "histogram", baseline: 0 } })`. |
| `taVwap.scenario.ts` | `plot(ta.vwap({ source: "hlc3" }))`. |
| `taAnchoredVwap.scenario.ts` | `plot(ta.anchoredVwap(1_700_000_000_000))`. |

### 8. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.
`ta.vwap` JSDoc explicitly notes the Phase-2 calendar-day
boundary + the Phase-4 `syminfo` lift.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Three entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{vol,vwap,anchoredVwap}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×3 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 66. |
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

`.changeset/phase-2-volume-vol-vwap-anchoredvwap.md` — `minor`
for core / runtime / conformance.

## Acceptance Criteria

- Three primitives exported + registered (cardinality 66).
- `ta.vol` conformance scenario uses `histogram` PlotKind end-to-
  end.
- VWAP session-reset documented (calendar-day in Phase 2;
  syminfo.session in Phase 4).
- §22.10 set complete; 100% coverage.
- Changeset committed.

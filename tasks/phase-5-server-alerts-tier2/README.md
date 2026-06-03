# Phase 5 — `0.5` Server-side Alerts + Tier-2 Ergonomics

> **Plan reference:** PLAN.md §19 Phase 5, with cross-cuts into §8.3
> (QuickJS host), §6.9 (state persistence), §11.2 (alert
> conditions), §11.3 (logging), §10.2 (`draw.table`), §7.2 (new
> `PlotKind`s), §9.2 / §10.1.1 (volume-profile).
> **Prerequisite:** Phase 4 editor + Tier-1 shipped.
> **Version target:** `0.5`.

## Goal

Run scripts server-side via QuickJS for untrusted alert evaluation,
with state persistence dropping per-tick compute ~500×. Light up
multi-timeframe streaming so `request.security` becomes useful in
practice. Ship Tier-2 ergonomics — the nice-to-haves that make
real-world scripts cleaner.

## Deliverables

### `@invinite-org/chartlang-host-quickjs`

- `createQuickJsHost()` per §8.3 with memory + CPU caps.
- QuickJS-WASM membrane; JsonValue-clean payloads matching the
  Worker host's wire format byte-for-byte.
- Server-side alert evaluation path.

### State persistence (`StateStore`)

- `StateStore` contract per §6.9 — `load`, `save`, `clear` with the
  `StateStoreKey` identity.
- `idbStateStore` for browser hosts.
- Caller-supplied backings for server hosts (interface, not impl).
- `StateSnapshot` schema per §6.1 — `lastBarTime`, `streams`,
  `slots`, `savedAt`, `snapshotVersion: 1`. JsonValue-clean.
- Snapshot/restore round-trips byte-identically for every primitive
  (existing primitives audited; new ones tested as added).
- Save cadence per §6.9; explicit `dispose()` save.

### Multi-timeframe streaming (flip the switch)

- Consumer adapters wire multi-stream candle fetch and flip
  `Capabilities.multiTimeframe: true`.
- Multi-stream time alignment per §6.8 — `align-htf-series-to-ltf`
  kernel port (referenced in §3.1 helpers list).
- Conformance scenarios covering MTF scripts.

### Tier-2 Pine primitives

- `defineAlertCondition` per §11.2 + `Capabilities.alertConditions`
  — user-wired alerts (script declares named conditions, user wires
  them in the adapter UI).
- `runtime.log.*` per §11.3 + `Capabilities.logs` — editor log
  pane support.
- `runtime.error()` per §11.3 — script-throwable halt.
- `draw.table` + `DrawingKind = "table"` per §10.2 — dashboard
  panels.

### New `PlotKind`s (per §7.2)

- `shape`, `character`, `arrow`, `candle-override`, `bar-override`,
  `bg-color`, `bar-color`, `horizontal-histogram`.
- Canvas2d ref adapter renders each at acceptable fidelity.

### Volume-profile primitives (§9.2, §10.1.1)

- `visibleRangeVolumeProfile`, `anchoredVolumeProfile`,
  `sessionVolumeProfile`, `fixedRangeVolumeProfile`.
- All emit via `horizontal-histogram` PlotKind.

### Color helpers (§11.4)

- `color.fromGradient`, `color.withAlpha`, `color.rgb`, `color.hsl`.

## Done criteria

- A script running under `host-quickjs` produces byte-identical
  emissions vs `host-worker` for the same input candles.
- An alert eval cron running the same script over the same head
  bars cold-vs-warm shows ~500× compute drop from snapshot reuse.
- `Capabilities.multiTimeframe: true` paths covered by conformance;
  HTF→LTF alignment matches invinite's reference outputs.
- `defineAlertCondition` round-trip: script declares, manifest
  surfaces it, adapter UI exposes it.
- `runtime.log.*` and `runtime.error()` visible in the editor log
  pane.
- `draw.table` renders in canvas2d ref adapter.
- All new PlotKinds covered by conformance.
- Volume-profile primitives match invinite golden outputs.

## Notes for `/write-tasks`

- QuickJS host needs careful JsonValue audit — anything that
  survives postMessage must survive the QuickJS membrane.
- Persistence: lock the snapshot schema *before* shipping —
  bumping `snapshotVersion` later means migration code.
- MTF alignment is the biggest single risk in this phase. Port
  `align-htf-series-to-ltf.ts` first and pin its tests.
- New `PlotKind`s expand the adapter contract — existing consumer
  adapters need a grace period to add support (additive only,
  never breaking).

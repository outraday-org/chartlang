# Task 17 — `ta.sessionVolumeProfile` port + full §22.10 set

> **Status: TODO**

## Goal

Port `sessionVolumeProfile` from
`../invinite/.../indicators/session-volume-profile.ts` (385 LOC)
into `packages/runtime/src/ta/sessionVolumeProfile.ts`. The
"session" variant derives its window from `bar.time` against the
adapter's `syminfo.session` descriptor — per-session bucketization
that resets each session. Ships the full §22.10 set.

## Prerequisites

- Task 16: `ta.anchoredVolumeProfile` shipped.

## Current Behavior

- `packages/runtime/src/ta/` has no `sessionVolumeProfile.ts`.
- The TA registry does not include `sessionVolumeProfile`.
- Phase 4 wired `syminfo.session` reads through the runtime's syminfo
  view. The session descriptor's exact shape is in
  `packages/core/src/views/syminfo.ts` — confirm and consume.

## Desired Behavior

- `ta.sessionVolumeProfile(opts)` walks the current session's bars
  (from `syminfo.session.start` of the most recent session to the
  current bar) and bucketizes their volume. The result resets at
  each session boundary.
- Emits `PlotKind = "horizontal-histogram"` for the bucket histogram
  + the developing series (`poc` / `valHigh` / `valLow`).
- Pre-first-session bars produce NaN POC / VAH / VAL.
- Registered in `STATEFUL_PRIMITIVES`; cardinality bumps to **170**.

## Requirements

### 1. Provenance header

```
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/session-volume-profile.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — Series<T> shape, opts.offset, JSDoc.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.
```

### 2. `packages/runtime/src/ta/sessionVolumeProfile.ts`

```ts
import { computeProfile, developingSeries } from "./_lib/volume-profile";
import type { Series, ComputeContext } from "@invinite-org/chartlang-core";

export type SessionVolumeProfileOpts = Readonly<{
    rowSize?: number;
    valueAreaPct?: number;
    offset?: number;
    bucketColor?: string;
    // Optional: explicit session boundary timestamp. Defaults to
    // `ctx.syminfo.session.start` of the current session.
    sessionStart?: number;
}>;

export type SessionVolumeProfileResult = Readonly<{
    poc: Series<number>;
    valHigh: Series<number>;
    valLow: Series<number>;
    buckets: ReadonlyArray<Readonly<{ price: number; volume: number }>>;
}>;

/**
 * Session Volume Profile — bucketizes the current session's volume
 * by price. Resets at each session boundary derived from
 * `syminfo.session`.
 *
 * @formula  See `../invinite/.../session-volume-profile.ts`.
 * @anchors  `syminfo.session.start` (or `opts.sessionStart` override).
 * @warmup   Until the first session boundary is crossed (NaN before).
 * @since 0.5
 * @example
 *     const vp = ta.sessionVolumeProfile();
 *     plot(vp.poc, { style: { kind: "horizontal-histogram", buckets: vp.buckets } });
 */
export function sessionVolumeProfile(
    slotId: string,
    ctx: ComputeContext,
    opts?: SessionVolumeProfileOpts,
): SessionVolumeProfileResult {
    // … 1:1 port of the invinite math, retargeted at Series<T>
}
```

### 3. Session boundary detection

Two paths:

- **Default**: read `ctx.syminfo.session.start` (Phase-4 view).
  The runtime tracks the current session's start in `RuntimeContext`;
  Phase-4 left this as an adapter-supplied field on `AdapterSymInfo`.
- **Override**: `opts.sessionStart` lets the script pin a specific
  timestamp (useful for testing + non-standard sessions).

When `syminfo.session` is undefined (adapters that don't support it),
the implementation falls back to a UTC-day boundary
(`Math.floor(bar.time / 86_400_000) * 86_400_000`) and emits a
`session-info-missing` diagnostic once per mount.

### 4. Multi-output contract (PLAN §9.1)

- `primarySeriesKey: "poc"`.
- `getVisibleSeriesKeys`: full set when in-session, empty before
  first boundary.
- `yDomain: { kind: "auto" }`.

### 5. Registry + STATEFUL_PRIMITIVES

- Register in `packages/runtime/src/ta/registry.ts`.
- Append `{ name: "ta.sessionVolumeProfile", slot: true }` to
  `STATEFUL_PRIMITIVES`. Bump test to **170**.

### 6. Tests (§22.10 set)

#### `packages/runtime/src/ta/sessionVolumeProfile.test.ts`

- Single-session input → identical to `visibleRangeVolumeProfile`
  windowed at session start.
- Multi-session input (3 days of 1m bars with 9:30 / 16:00
  session) → 3 distinct POCs, one per session.
- Session boundary mid-bar (rare; document) → handled per the
  invinite source (resets on bar with `time >= sessionStart`).
- Missing `syminfo.session` → UTC-day fallback + diagnostic emitted
  once.
- `opts.sessionStart` override takes precedence over `syminfo.session.start`.

#### `packages/runtime/src/ta/sessionVolumeProfile.property.test.ts`

- Per-session conservation: sum of bucket volumes in any one session
  equals sum of that session's bar volumes.
- Session reset: POC at first bar of new session is NaN.
- Monotonic POC under monotonic price input within a session.

#### `packages/runtime/src/ta/sessionVolumeProfile.golden.test.ts`

- Three captured invinite reference outputs:
  - 1 day of 1m bars with NYSE session (9:30–16:00 ET).
  - 3 days of 5m bars with crypto 24h session (no boundary).
  - 2 days of 15m bars with FX session (boundary at 17:00 NYT).

#### `packages/runtime/src/ta/sessionVolumeProfile.bench.ts` (+ pair)

- 5,000-bar profile spanning 5 sessions.
- `THRESHOLD_MS = 20` (sessions add boundary-detection overhead
  vs visible-range; document the rationale).

### 7. Conformance scenario

`packages/conformance/src/scenarios/taSessionVolumeProfile.ts`:

- Script: `defineIndicator` calling `ta.sessionVolumeProfile()`.
- Harness configures `syminfo.session` per scenario.
- Assertions: `plot-hash` against captured golden + no diagnostic.

Second scenario `taSessionVolumeProfileNoSession.ts`:

- Same script with `syminfo.session` undefined.
- Assertions: `plot-hash` against UTC-day-fallback golden +
  `diagnostic-code-present`: `session-info-missing`.

### 8. Docs + CORE_AMBIENT_SHIM

JSDoc with full tag set; mirror in `CORE_AMBIENT_SHIM`.

### 9. Capability gating

- `Capabilities.symInfoFields` must include `"session"` for the
  default path. Otherwise the diagnostic fallback path runs (no
  hard error — graceful degradation).
- `Capabilities.plots` must include `"horizontal-histogram"`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/ta/sessionVolumeProfile.ts` | Create | Port |
| `packages/runtime/src/ta/sessionVolumeProfile.test.ts` | Create | Unit |
| `packages/runtime/src/ta/sessionVolumeProfile.property.test.ts` | Create | Property |
| `packages/runtime/src/ta/sessionVolumeProfile.golden.test.ts` | Create | Golden |
| `packages/runtime/src/ta/__fixtures__/sessionVolumeProfile/*.json` | Create | Goldens (3) |
| `packages/runtime/src/ta/sessionVolumeProfile.bench.ts` | Create | Bench |
| `packages/runtime/src/ta/sessionVolumeProfile.bench.test.ts` | Create | Threshold |
| `packages/runtime/src/ta/registry.ts` | Modify | Register |
| `packages/core/src/ta/index.ts` (namespace) | Modify | Add to `ta` namespace |
| `packages/core/src/statefulPrimitives.ts` | Modify | Append; bump to 170 |
| `packages/compiler/src/program.ts` | Modify | Mirror in `CORE_AMBIENT_SHIM` |
| `packages/conformance/src/scenarios/taSessionVolumeProfile.ts` | Create | Scenario |
| `packages/conformance/src/scenarios/taSessionVolumeProfileNoSession.ts` | Create | Fallback |
| `packages/conformance/src/scenarios/index.ts` | Modify | Register |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100%)
- `pnpm docs:check`
- `pnpm conformance`
- `pnpm bench:ci`
- `pnpm readme:check`

## Changeset

`.changeset/phase5-ta-session-volume-profile.md` — `minor` bump for
core + runtime. Body cites PLAN §9.2 + §4.8 + invinite commit SHA.

## Acceptance Criteria

- [ ] Port shipped with 4-line provenance header.
- [ ] Full §22.10 set landed; multi-session test case + property
      conservation invariant green.
- [ ] UTC-day fallback path works when `syminfo.session` is
      undefined; diagnostic fires once.
- [ ] `STATEFUL_PRIMITIVES.size === 170`.
- [ ] Bench under threshold.
- [ ] Both conformance scenarios green.
- [ ] 100% coverage; all gates green.
- [ ] Changeset committed.

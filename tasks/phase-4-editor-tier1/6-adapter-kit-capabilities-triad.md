# Task 6 — Adapter-kit: Capabilities triad + builders + canvas2d wiring

> **Status: TODO**

## Goal

Land the 7 missing `capabilities.*` builders that match the
PLAN.md §7.2 + §4.5 + §4.8 fields the shape already declares.
**The fields themselves are already declared** in
`packages/adapter-kit/src/types.ts` (`intervals`, `multiTimeframe`,
`subPanes`, `symInfoFields`, `maxDrawingsPerScript`,
`alertConditions`, `logs`) — Phase 3 closeout pinned the shape;
this task adds the builders and tightens
`examples/canvas2d-adapter/`'s `CANVAS2D_CAPABILITIES` values
(6-entry `intervals` re-keyed to canonical PLAN §4.9 groups,
`subPanes: Number.MAX_SAFE_INTEGER`, full `symInfoFields` set).
`validateEmission` is unchanged — Phase 4 lands no new emission
kinds; capability gating for `request.security` lives in the
runtime (Task 11), not in `validateEmission`.

## Prerequisites

- Task 5 (so core's `request` / `SecurityBar` types exist for the
  builder JSDoc to reference).

## Current Behavior

- `packages/adapter-kit/src/types.ts` `Capabilities` already
  declares every field: `plots`, `drawings`, `alerts`,
  `alertConditions`, `logs`, `inputs`, `intervals`,
  `multiTimeframe`, `subPanes`, `symInfoFields`,
  `maxDrawingsPerScript`, `maxLookback`, `maxTickHz`.
- `packages/adapter-kit/src/types.ts` `SymInfoField` is already
  exported (`"ticker" | "type" | "mintick" | "currency" |
  "basecurrency" | "exchange" | "timezone" | "session" | "meta"`).
- `packages/adapter-kit/src/capabilities/capabilities.ts` ships
  Phase-2 plot builders + Phase-3 drawing builders + category
  groupers. The 7 Phase-4 builders (`intervals`,
  `multiTimeframe`, `subPanes`, `symInfoFields`,
  `maxDrawingsPerScript`, `alertConditions`, `logs`) are missing.
- `examples/canvas2d-adapter/src/capabilities.ts`
  `CANVAS2D_CAPABILITIES` populates every Phase-4 field with weak
  defaults: 3-entry `intervals` using `group: "intraday"`,
  `subPanes: 0`, empty `symInfoFields: new Set()`,
  `maxDrawingsPerScript: { lines: 200, labels: 200, boxes: 100,
  polylines: 100, other: 100 }`, `alertConditions: false`,
  `logs: false`, `multiTimeframe: false`.
- `packages/adapter-kit/src/defineAdapter.ts` does **not** declare
  a `DEFAULT_CAPABILITIES` constant — `defineAdapter` wraps the
  caller's supplied object verbatim and only defaults `dispose`.
  Phase 4 does not add a default-fill path; the new builders are
  composable, callers union them via spread.
- `validateEmission` does not gate against the new capability
  fields (no Phase-4 emission kinds land here).

## Desired Behavior

- `Capabilities` shape unchanged — all 7 Phase-4 fields are
  already declared.
- 7 new builders ship: `capabilities.intervals(...)`,
  `capabilities.multiTimeframe(...)`,
  `capabilities.subPanes(...)`, `capabilities.symInfoFields(...)`,
  `capabilities.maxDrawingsPerScript(...)`,
  `capabilities.alertConditions(...)`, `capabilities.logs(...)`.
- Canvas2d adapter re-tunes its Phase-4 field values:
  - 6-entry `intervals` list re-keyed to canonical PLAN §4.9
    groups (`"minute"` / `"hour"` / `"daily"` / `"weekly"`).
  - `subPanes: Number.MAX_SAFE_INTEGER`.
  - Full `symInfoFields` set covering every `SymInfoField`
    literal.
  - `maxDrawingsPerScript` values preserved as-is (no change).
  - `alertConditions: false`, `logs: false`, `multiTimeframe:
    false` preserved as-is.

## Requirements

### 1. `packages/adapter-kit/src/types.ts` — verify only

Confirm `Capabilities`, `SymInfoField`, and the relevant
`DiagnosticCode` codes (`unsupported-interval`,
`multi-timeframe-not-supported`) are already declared as expected.
If JSDoc on any Phase-4 field is missing `@since 0.4` or PLAN
section anchors, patch them in this task. No structural change.

### 2. `packages/adapter-kit/src/capabilities/capabilities.ts` — new builders

Append:

```ts
import type {
    DrawingCounts, IntervalDescriptor,
} from "@invinite-org/chartlang-core";
import type { SymInfoField } from "../types";

/** @since 0.4 — PLAN §4.5. */
export function intervals(list: ReadonlyArray<IntervalDescriptor>): { intervals: ReadonlyArray<IntervalDescriptor> } {
    return { intervals: Object.freeze(list.slice()) };
}

/** @since 0.4 — PLAN §4.5. */
export function multiTimeframe(enabled: boolean): { multiTimeframe: boolean } {
    return { multiTimeframe: enabled };
}

/** @since 0.4 — PLAN §7.2. */
export function subPanes(max: number): { subPanes: number } {
    return { subPanes: max };
}

/** @since 0.4 — PLAN §4.8. */
export function symInfoFields(fields: ReadonlyArray<SymInfoField>): { symInfoFields: ReadonlySet<SymInfoField> } {
    return { symInfoFields: new Set(fields) };
}

/** @since 0.4 — PLAN §10. */
export function maxDrawingsPerScript(counts: DrawingCounts): { maxDrawingsPerScript: DrawingCounts } {
    return { maxDrawingsPerScript: Object.freeze({ ...counts }) };
}

/** @since 0.4 — PLAN §11.2 (Phase-5 wiring stub). */
export function alertConditions(enabled: boolean): { alertConditions: boolean } {
    return { alertConditions: enabled };
}

/** @since 0.4 — PLAN §11.3 (Phase-5 wiring stub). */
export function logs(enabled: boolean): { logs: boolean } {
    return { logs: enabled };
}
```

Append to the existing `capabilities` namespace export.

### 3. `packages/adapter-kit/src/defineAdapter.ts` — unchanged

`defineAdapter` does not declare a `DEFAULT_CAPABILITIES`
constant today; it wraps the caller's payload verbatim and only
defaults `dispose`. The new builders are composable — adapters
spread them into their capability literal. No default-fill path
is added in Phase 4.

### 4. `examples/canvas2d-adapter/src/capabilities.ts` — Phase-4 wiring

Use the new builders to declare the canvas2d capability bag:

Re-tune the existing `CANVAS2D_CAPABILITIES` literal in place
(the file currently composes from Phase-2/3 builders + manually-
written Phase-4 fields). Re-key the existing `intervals` array
from 3 entries with `group: "intraday"` to 6 entries with
canonical PLAN §4.9 groups; replace `subPanes: 0` with
`Number.MAX_SAFE_INTEGER`; populate `symInfoFields` with every
literal. Keep `maxDrawingsPerScript`, `alertConditions: false`,
`logs: false`, `multiTimeframe: false` unchanged.

```ts
import { capabilities } from "@invinite-org/chartlang-adapter-kit";

const CANVAS2D_INTERVALS = [
    { value: "1m", label: "1 minute", group: "minute" },
    { value: "5m", label: "5 minutes", group: "minute" },
    { value: "15m", label: "15 minutes", group: "minute" },
    { value: "1h", label: "1 hour", group: "hour" },
    { value: "1D", label: "1 day", group: "daily" },
    { value: "1W", label: "1 week", group: "weekly" },
] as const;

export const CANVAS2D_CAPABILITIES = {
    plots: capabilities.allPhase2Plots(),
    drawings: capabilities.allPhase3Drawings(),
    alerts: capabilities.alerts("log", "toast"),
    inputs: new Set<InputKind>(),
    maxLookback: 1000,
    maxTickHz: 30,
    ...capabilities.intervals(CANVAS2D_INTERVALS),
    ...capabilities.multiTimeframe(false),
    ...capabilities.subPanes(Number.MAX_SAFE_INTEGER),
    ...capabilities.symInfoFields([
        "ticker", "type", "mintick", "currency", "basecurrency",
        "exchange", "timezone", "session", "meta",
    ]),
    ...capabilities.maxDrawingsPerScript({
        lines: 200, labels: 200, boxes: 100,
        polylines: 100, other: 100,
    }),
    ...capabilities.alertConditions(false),
    ...capabilities.logs(false),
};
```

The composition mirrors the file's current Phase-3 style.
Existing builder names: `allPhase2Plots`, `allPhase3Drawings`,
`alerts`. The Phase-4 builders are added in §2 above.

### 5. Tests

- **`capabilities.test.ts`** — extend with 7 new builder tests:
  each builds the expected partial; `Object.isFrozen` on the
  returned array / Set / record.
- **`capabilities.types.test.ts`** — `expect-type` over the
  return shapes (`intervals` returns
  `ReadonlyArray<IntervalDescriptor>`, etc.).
- **`examples/canvas2d-adapter/src/capabilities.test.ts`** —
  re-pin tests against the Phase-4 values
  (`CANVAS2D_CAPABILITIES.intervals.length === 6`,
  canonical `group` strings, `subPanes ===
  Number.MAX_SAFE_INTEGER`, `symInfoFields.size === 9`, etc.).

### 6. JSDoc gate

Every new field + every new builder carries `@since 0.4` +
compileable `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/types.ts` | Modify (JSDoc only, if needed) | Confirm `@since 0.4` on every Phase-4 field |
| `packages/adapter-kit/src/capabilities/capabilities.ts` | Modify | Add 7 builders |
| `packages/adapter-kit/src/capabilities/capabilities.test.ts` | Modify | Cover new builders |
| `packages/adapter-kit/src/capabilities/capabilities.types.test.ts` | Modify | `expect-type` over returns |
| `examples/canvas2d-adapter/src/capabilities.ts` | Modify | Re-tune Phase-4 values |
| `examples/canvas2d-adapter/src/capabilities.test.ts` | Modify | Verify retuned values |

## Edge Cases

- **`subPanes: Number.MAX_SAFE_INTEGER`** — adapters that
  effectively support unlimited sub-panes use this sentinel per
  PLAN §7.2. Runtime treats it as "no cap." Document in JSDoc.
- **`multiTimeframe: false`** is the canvas2d default — request.
  security calls return all-NaN bars + emit
  `multi-timeframe-not-supported`. The conformance suite (Task
  16) verifies the diagnostic flows.
- **`intervals` ordering is meaningful** — drives the editor's
  timeframe picker order (Task 13). Adapter ordering is preserved.
- **`maxDrawingsPerScript` canonical shape** lives in
  `@invinite-org/chartlang-core` (`DrawingCounts`). Adapter-kit
  re-exports the type but does not redeclare it.
- **`alertConditions` and `logs` are stubs** — Phase 4 lands the
  shape so consumer adapters can declare the value today; Phase
  5 wires the runtime emission paths.
- **No existing emissions are gated by the new flags in this
  task** — Phase 4 emissions are unchanged; runtime gates land in
  Tasks 9–12 as each surface lights up.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`
  (`@invinite-org/chartlang-adapter-kit` + `examples/canvas2d-
  adapter` at 100%),
  `pnpm docs:check`, `pnpm readme:check`,
  `pnpm conformance` (existing scenarios still pass — Phase-4
  fields are additive).

## Changeset

`.changeset/phase-4-task-06-adapter-kit-capabilities-triad.md` —
**minor** on `@invinite-org/chartlang-adapter-kit`; no version
bump on `examples/canvas2d-adapter` (private).

## Acceptance Criteria

- `Capabilities` carries 7 new fields with the documented
  defaults.
- 7 new builders ship under `capabilities.*`.
- `CANVAS2D_CAPABILITIES` declares the Phase-4 triad with the
  values from the spec.
- 100% coverage on touched packages.
- JSDoc + `pnpm docs:check` green.
- All Phase-3 conformance scenarios still pass.
- Changeset committed.

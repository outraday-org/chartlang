# Task 4 — Core: `defineIndicator` overrides + `ScriptManifest` extensions

> **Status: TODO**

## Goal

Extend `DefineIndicatorOpts` with the seven Pine-parity script-
author override fields from PLAN.md §4.1: `maxBarsBack`, `format`,
`precision`, `scale`, `requiresIntervals`, `shortName` (plus the
already-shipped `maxDrawings`). Mirror the new fields on
`ScriptManifest` so the compiler's `manifest.ts` carries them and
the runtime can size lookback budgets + the adapter UI can render
human-readable script labels. The override fields land on
`defineAlert` / `defineDrawing` where applicable in the same
shape.

## Prerequisites

- Task 3 (so `ComputeContext` is at the Phase-4 baseline; the
  manifest extension lands cleanly on top).

## Current Behavior

- `packages/core/src/define/defineIndicator.ts` ships
  `DefineIndicatorOpts` with `name`, `apiVersion`, `overlay?`,
  `inputs?`, `compute`, `maxDrawings?` (Phase 3).
- `packages/core/src/types.ts` `ScriptManifest` has
  `apiVersion`, `kind`, `name`, `inputs`, `capabilities`,
  `requestedIntervals`, `userPickableInterval`, `seriesCapacities`,
  `maxLookback`, `maxDrawings?`.
- No `format` / `precision` / `scale` / `shortName` /
  `requiresIntervals` / `maxBarsBack` surface anywhere.

## Desired Behavior

- `defineIndicator({ ... })` accepts the six new opts. Each is
  optional. Each defaults documented per PLAN §4.1.
- `defineAlert` and `defineDrawing` accept the applicable subset
  (alerts skip `scale`/`format`/`precision`; drawings skip
  `maxBarsBack`/`scale`).
- `ScriptManifest` carries the override fields. The compiler
  copies them through `buildManifest` verbatim.
- `manifest.format` / `precision` / `scale` are typed unions, not
  free-form strings.

## Requirements

### 1. `packages/core/src/define/overrides.ts`

A new shared overrides shape. Both `DefineIndicatorOpts` and
`ScriptManifest` reference it.

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Value-format hint the adapter uses for axis-label rendering. PLAN
 * §4.1. `"price"` formats with the symbol's quote-currency rules;
 * `"volume"` uses K/M/B compact notation; `"percent"` appends `%`;
 * `"compact"` falls back to K/M/B for generic non-volume values.
 *
 * @since 0.4
 * @example
 *     const f: ValueFormat = "percent";
 *     void f;
 */
export type ValueFormat = "price" | "volume" | "percent" | "compact";

/**
 * Scale axis the indicator should bind to. PLAN §4.1.
 *
 * - `"price"` — overlay on the main price pane (default for
 *   `overlay: true` indicators).
 * - `"left"` / `"right"` — sub-pane axis side.
 * - `"new"` — request a fresh sub-pane keyed by the script id.
 *
 * @since 0.4
 * @example
 *     const s: ScaleAxis = "right";
 *     void s;
 */
export type ScaleAxis = "price" | "left" | "right" | "new";

/**
 * Author-supplied display + budget overrides — PLAN.md §4.1.
 * Every field is optional; missing fields fall back to the
 * adapter's defaults.
 *
 * @since 0.4
 * @example
 *     const o: ScriptOverrides = {
 *         shortName: "EMA(20)",
 *         precision: 4,
 *         format: "price",
 *     };
 *     void o;
 */
export type ScriptOverrides = Readonly<{
    /**
     * Max bars of historical lookback the script needs. Caps the
     * runtime's ring-buffer size for any series the script reads.
     * `0` keeps the runtime default. Pine `max_bars_back` parity.
     */
    maxBarsBack?: number;
    /**
     * Value-formatting hint for axis labels + cursor read-out.
     * Defaults to `"price"` for `overlay: true`, `"compact"` for
     * sub-pane indicators.
     */
    format?: ValueFormat;
    /**
     * Decimal precision the adapter renders the indicator at.
     * `0`–`10`. `undefined` follows the symbol's default precision.
     */
    precision?: number;
    /**
     * Scale-axis binding. Defaults to `"price"` for overlay
     * indicators, `"right"` for sub-pane.
     */
    scale?: ScaleAxis;
    /**
     * Intervals the script *requires* the adapter to ship in
     * `Capabilities.intervals`. The compiler bakes this into
     * `manifest.requestedIntervals`; the editor warns at compile
     * time when the target adapter is missing one. Mirrors Pine's
     * `request.security` static-set requirement.
     */
    requiresIntervals?: ReadonlyArray<string>;
    /**
     * Compact display label — fits in the legend chip. Defaults to
     * the truncated `name`.
     */
    shortName?: string;
}>;
```

### 2. `packages/core/src/define/defineIndicator.ts` updates

Add the override fields + `maxBarsBack` to `DefineIndicatorOpts`,
preserve the existing `name` / `apiVersion` / `overlay` /
`inputs` / `compute` / `maxDrawings` fields. The function body
echoes the opts back; it does not perform schema validation
(compiler is the validator).

```ts
import type { DrawingCounts } from "../types";
import type { ScriptOverrides } from "./overrides";

export type DefineIndicatorOpts = Readonly<{
    name: string;
    apiVersion: 1;
    overlay?: boolean;
    inputs?: InputSchema;
    compute: ComputeFn;
    maxDrawings?: DrawingCounts;
}> & ScriptOverrides;
```

`defineIndicator(opts)` returns the opts frozen — same Phase-3
behaviour, just with the wider type signature.

`defineAlert` and `defineDrawing` get the same treatment with
field-set subsets:

- `defineAlert`: omit `scale`, `format`, `precision`.
- `defineDrawing`: omit `maxBarsBack`, `scale` (drawings are
  ephemeral, no lookback; pane is determined by anchor).

### 3. `packages/core/src/types.ts` — extend `ScriptManifest`

```ts
import type { ScaleAxis, ValueFormat } from "./define/overrides";

export type ScriptManifest = {
    readonly apiVersion: 1;
    readonly kind: "indicator" | "drawing" | "alert";
    readonly name: string;
    readonly inputs: InputSchema;
    readonly capabilities: ReadonlyArray<CapabilityId>;
    readonly requestedIntervals: ReadonlyArray<string>;
    readonly userPickableInterval: boolean;
    readonly seriesCapacities: Readonly<Record<string, number>>;
    readonly maxLookback: number;
    readonly maxDrawings?: DrawingCounts;
    /** @since 0.4 */ readonly maxBarsBack?: number;
    /** @since 0.4 */ readonly format?: ValueFormat;
    /** @since 0.4 */ readonly precision?: number;
    /** @since 0.4 */ readonly scale?: ScaleAxis;
    /** @since 0.4 */ readonly shortName?: string;
    /**
     * Static set of intervals the script REQUIRES the target
     * adapter to ship in `Capabilities.intervals`. The compiler
     * unions this with the literal-only set extracted from
     * `request.security` calls and the `input.interval` default,
     * deduped + sorted. Disjoint from `requestedIntervals`'s
     * existing role — `requestedIntervals` is the *full* extracted
     * set (Phase 4 unchanged); `requiresIntervals` is the
     * *author-declared* subset (a hard editor-warning trigger).
     * @since 0.4
     */
    readonly requiresIntervals?: ReadonlyArray<string>;
};
```

### 4. `packages/core/src/index.ts` — re-exports

```ts
export type {
    DefineAlertOpts, DefineDrawingOpts, DefineIndicatorOpts,
    ScriptOverrides, ScaleAxis, ValueFormat,
} from "./define";
```

### 5. Tests

- **`defineIndicator.test.ts`** — extend the existing suite. Add
  cases verifying the new fields round-trip through the frozen
  return value (`defineIndicator({ ..., precision: 4 })`
  preserves `precision`).
- **`defineIndicator.types.test.ts`** — `expect-type` over the
  widened opts (optional fields, `requiresIntervals` is
  `ReadonlyArray<string>`).
- **`defineAlert.test.ts`** — verify `scale` / `format` /
  `precision` are NOT in the opts type (negative `expect-type`
  via `@ts-expect-error`).
- **`defineDrawing.test.ts`** — verify `maxBarsBack` / `scale`
  are NOT in the opts type.
- **`overrides.types.test.ts`** — `expect-type` over `ValueFormat`
  + `ScaleAxis` union narrowing.

### 6. JSDoc gate

Every new field + every new type has `@since 0.4` + compileable
`@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/define/overrides.ts` | Create | `ScriptOverrides` + `ValueFormat` + `ScaleAxis` |
| `packages/core/src/define/defineIndicator.ts` | Modify | Add override fields |
| `packages/core/src/define/defineAlert.ts` | Modify | Add applicable override fields |
| `packages/core/src/define/defineDrawing.ts` | Modify | Add applicable override fields |
| `packages/core/src/define/overrides.types.test.ts` | Create | `expect-type` over unions |
| `packages/core/src/define/defineIndicator.test.ts` | Modify | Cover new field round-trip |
| `packages/core/src/define/defineIndicator.types.test.ts` | Modify | `expect-type` over widened opts |
| `packages/core/src/define/defineAlert.test.ts` | Modify | Negative coverage of excluded fields |
| `packages/core/src/define/defineDrawing.test.ts` | Modify | Negative coverage of excluded fields |
| `packages/core/src/define/index.ts` | Modify | Export `ScriptOverrides` + format types |
| `packages/core/src/types.ts` | Modify | Add 6 new optional fields to `ScriptManifest` |
| `packages/core/src/index.ts` | Modify | Re-export overrides types |

## Edge Cases

- **`requiresIntervals` is the author-declared subset**; the
  compiler-extracted full set lives in
  `manifest.requestedIntervals`. Task 8 unions them at compile
  time; this task only carries the field.
- **`maxBarsBack` is per-script** — the runtime takes
  `min(manifest.maxBarsBack, Capabilities.maxLookback)`. No new
  capability check lands here; the existing `maxLookback` cap is
  reused.
- **`scale: "new"` requests a fresh sub-pane** — gated against
  `Capabilities.subPanes` at runtime (Task 11). This task just
  carries the field.
- **`format: "volume"` is the canvas2d adapter's default for
  `ta.vol` plots** — no special handling needed in this task; the
  adapter consumes `manifest.format` in its renderer.
- **`precision` range** — JSDoc clamps to `0`–`10`. The compiler
  *does not* enforce; the adapter is free to clamp.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage),
  `pnpm docs:check`, `pnpm readme:check`.

## Changeset

`.changeset/phase-4-task-04-core-define-overrides.md` — **minor**
on `@invinite-org/chartlang-core`. Additive — every new field is
optional; Phase-1/2/3 scripts typecheck unchanged.

## Acceptance Criteria

- `defineIndicator({ name, apiVersion: 1, shortName: "x",
  precision: 4, format: "percent", compute() {} })` typechecks.
- `defineAlert({ ..., scale: "right" })` errors with the negative
  `@ts-expect-error`.
- `ScriptManifest` carries the 6 new optional fields.
- 100% coverage on touched files.
- JSDoc + `pnpm docs:check` green.
- Changeset committed.

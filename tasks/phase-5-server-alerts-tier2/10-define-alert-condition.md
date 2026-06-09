# Task 10 — `defineAlertCondition` + `AlertConditionEmission` + capability gating

> **Status: TODO**

## Goal

Ship Pine's `alertcondition()` analogue: the script declares named
conditions; the adapter UI surfaces them; users wire delivery.
Lands `defineAlertCondition` in core, a compiler pass extracting
`manifest.alertConditions`, the runtime `ComputeContext.signal()`
extension + `AlertConditionEmission` plumbing, the
`Capabilities.alertConditions` gate, and the canvas2d-adapter
surface that consumes them. One conformance scenario covers each
gating mode.

## Prerequisites

- Task 9: PlotKind expansion landed; conformance scenario infra +
  capability gating pattern proven.

## Current Behavior

- `packages/core/src/define/` ships `defineIndicator`, `defineAlert`,
  `defineDrawing`. No `defineAlertCondition`.
- `packages/compiler/src/analysis/` ships `extractInputs`,
  `extractCapabilities`. No `extractAlertConditions`.
- `packages/runtime/src/buildComputeContext.ts` builds the script's
  `ComputeContext` with `bar`, `ta`, `plot`, …, `alert`, `draw`,
  `state`, `state.tick`, `barstate`, `syminfo`, `timeframe`,
  `request`, `inputs`. No `signal`.
- `packages/adapter-kit/src/types.ts` declares
  `Capabilities.alertConditions: boolean` (Phase-4) but no
  `AlertConditionEmission`, no `RunnerEmissions.alertConditions`
  field.
- `Capabilities.alertConditions: false` is the canvas2d default.
- `ScriptManifest` carries `kind: "indicator" | "drawing" | "alert"`;
  no `"alertCondition"` discriminant.

## Desired Behavior

- `@invinite-org/chartlang-core` exports
  `defineAlertCondition(opts)` returning a frozen
  `CompiledScriptObject` whose `manifest.kind === "alertCondition"`
  with `manifest.alertConditions: ReadonlyArray<{ id, title, description, defaultMessage }>`.
- The compiler's `extractAlertConditions` pass walks the
  `defineAlertCondition({ conditions })` object literal and
  populates `manifest.alertConditions`. Dynamic / non-literal
  condition maps fail compilation with
  `alert-condition-not-literal`.
- The runtime's `ComputeContext` gains
  `signal(conditionId: string, fired: boolean): void`. Calls with
  unknown `conditionId` emit `unknown-alert-condition` diagnostic.
  Calls under `Capabilities.alertConditions: false` are silent
  no-ops + emit `alert-conditions-not-supported` (deduped per
  callsite).
- `RunnerEmissions` grows an `alertConditions: ReadonlyArray<AlertConditionEmission>` field.
- canvas2d-adapter flips `alertConditions: true` and renders a tiny
  side panel listing fired conditions per bar.
- Three conformance scenarios cover happy-path,
  capability-disabled, and unknown-condition error.

## Requirements

### 1. `packages/core/src/define/defineAlertCondition.ts` (new)

```ts
import type {
    AlertConditionDescriptor,
    CompiledScriptObject,
    ComputeFn,
    InputSchema,
    ScriptManifest,
} from "../types";

/**
 * Per-condition descriptor on `DefineAlertConditionOpts.conditions`.
 *
 * @since 0.5
 */
export type AlertConditionDescriptor = Readonly<{
    title: string;
    description: string;
    defaultMessage: string;
}>;

/**
 * Author-supplied options for `defineAlertCondition(...)`. Mirrors
 * `DefineAlertOpts` plus the `conditions` map.
 *
 * @since 0.5
 * @example
 *     const opts: DefineAlertConditionOpts = {
 *         name: "EMA cross",
 *         apiVersion: 1,
 *         conditions: {
 *             bullishCross: { title: "Up", description: "…", defaultMessage: "{{ticker}} up" },
 *         },
 *         compute: () => {},
 *     };
 *     void opts;
 */
export type DefineAlertConditionOpts = Readonly<{
    name: string;
    apiVersion: 1;
    inputs?: InputSchema;
    conditions: Readonly<Record<string, AlertConditionDescriptor>>;
    compute: ComputeFn;
}>;

/**
 * Construct a Phase-5 alert-condition script. Returns a frozen
 * `CompiledScriptObject` whose `manifest.kind === "alertCondition"`.
 *
 * @since 0.5
 * @example
 * ```ts
 * import { defineAlertCondition, input, ta } from "@invinite-org/chartlang-core";
 *
 * export default defineAlertCondition({
 *     name: "EMA cross",
 *     apiVersion: 1,
 *     inputs: { length: input.int(20) },
 *     conditions: {
 *         up: { title: "Up", description: "Close > EMA", defaultMessage: "{{ticker}} up" },
 *         down: { title: "Down", description: "Close < EMA", defaultMessage: "{{ticker}} down" },
 *     },
 *     compute({ bar, ta, inputs, signal }) {
 *         const ema = ta.ema(bar.close, inputs.length);
 *         signal("up", ta.crossover(bar.close, ema));
 *         signal("down", ta.crossunder(bar.close, ema));
 *     },
 * });
 * ```
 */
export function defineAlertCondition(opts: DefineAlertConditionOpts): CompiledScriptObject {
    const conditionEntries = Object.entries(opts.conditions).map(([id, d]) =>
        Object.freeze({ id, ...d })
    );
    const alertConditions = Object.freeze(conditionEntries);
    const capabilities = Object.freeze<ReadonlyArray<"alertConditions">>(["alertConditions"]);
    const manifest: ScriptManifest = Object.freeze({
        apiVersion: 1,
        kind: "alertCondition",
        name: opts.name,
        inputs: opts.inputs ?? {},
        capabilities,
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: {},
        maxLookback: 0,
        alertConditions,
    });
    return Object.freeze({ manifest, compute: opts.compute });
}
```

### 2. `packages/core/src/types.ts` — extend `ScriptManifest`

- Add `"alertCondition"` to the `manifest.kind` union.
- Add `alertConditions?: ReadonlyArray<Readonly<{ id: string; title: string; description: string; defaultMessage: string }>>`.

### 3. `packages/core/src/types.ts` — extend `ComputeContext`

Add `signal(conditionId: string, fired: boolean): void` as an
optional field (the runtime's `buildComputeContext` populates it
only when the script is an `alertCondition`).

### 4. `packages/compiler/src/analysis/extractAlertConditions.ts` (new)

Pure TS AST pass:

- Walks the script's `defineAlertCondition({ conditions: { … } })`
  call. If the `conditions` argument is not an object literal,
  fails with diagnostic code `alert-condition-not-literal`.
- For each key in the object literal, expects a nested object
  literal with `title`, `description`, `defaultMessage` string
  literal values. Non-literal values fail with
  `alert-condition-field-not-literal`.
- Returns `ReadonlyArray<{ id, title, description, defaultMessage }>`
  consumed by the compiler's manifest builder.

### 5. `packages/compiler/src/buildManifest.ts` (or equivalent) — wire pass

Compose `extractAlertConditions` into the manifest pipeline. The
output populates `manifest.alertConditions` for
`defineAlertCondition` scripts.

### 6. `packages/adapter-kit/src/types.ts` — add `AlertConditionEmission`

```ts
/**
 * Per-bar emission produced by `ComputeContext.signal(conditionId, fired)`.
 * The adapter routes these to whatever delivery channels the user
 * wired in the UI.
 *
 * @since 0.5
 * @example
 *     const e: AlertConditionEmission = {
 *         kind: "alert-condition",
 *         conditionId: "bullishCross",
 *         fired: true,
 *         bar: 42,
 *         time: 1700000000_000,
 *     };
 *     void e;
 */
export type AlertConditionEmission = Readonly<{
    kind: "alert-condition";
    conditionId: string;
    fired: boolean;
    bar: number;
    time: number;
}>;
```

Add `alertConditions: ReadonlyArray<AlertConditionEmission>` to
`RunnerEmissions`.

### 7. `packages/adapter-kit/src/validation/validateEmission.ts` — extend

`validateAlertConditionEmission` checks the shape; reject empty
`conditionId` or non-finite `bar` / `time`.

### 8. `packages/adapter-kit/src/capabilities/capabilities.ts` — verify builder

The `capabilities.alertConditions(enabled)` builder already exists
(line ~186, shipped in Phase 4 as part of the boolean-builder pattern).
Confirm it is correctly wired by the conformance scenarios; no new
builder is added in this task. Update its JSDoc only if it still
says "Phase 5 will wire the runtime semantics" — bump to reflect that
those semantics now ship.

### 9. `packages/runtime/src/emit/alertConditionEmission.ts` (new)

Emit path mirroring `alertEmission.ts`:

- Validates the conditionId is known (lookup against
  `manifest.alertConditions`); unknown → `unknown-alert-condition`
  diagnostic, drop emission.
- Gates on `capabilities.alertConditions`; if false → silent no-op
  + `alert-conditions-not-supported` (deduped per `(slotId, conditionId)`).
- On `fired === false`, emit a `fired: false` emission so the
  adapter sees the state transition (useful for "on rising edge"
  UI rendering). Document this rationale.

### 10. `packages/runtime/src/buildComputeContext.ts` — wire `signal`

For `manifest.kind === "alertCondition"` scripts, attach
`ctx.signal = (conditionId, fired) => alertConditionEmission.emit(...)`.
For other kinds, `signal` is undefined.

### 11. `packages/runtime/src/runtimeContext.ts` — add registry

Carry the manifest's `alertConditions` array on `RuntimeContext`
so the emit path can do the validity lookup without re-parsing
the manifest each bar.

### 12. `packages/core/src/statefulPrimitives.ts` — register

Append `{ name: "defineAlertCondition.signal", slot: false }` (no
slot id needed — the conditionId is the identity). Bump the
cardinality test assertion to **164**.

### 13. `examples/canvas2d-adapter/src/capabilities.ts`

`alertConditions: true`.

### 14. `examples/canvas2d-adapter/src/render/alertConditions.ts` (new) — add UI surface

The reference adapter uses per-surface files under `src/render/`
(`alertBadge.ts`, `area.ts`, `bars.ts`, …); follow the same pattern.
Create `render/alertConditions.ts` rendering a tiny side-panel for
fired alert conditions on the latest bar. Behaviour: lists
`conditionId` + `defaultMessage` for each fired emission. Wire it
from the existing `createCanvas2dAdapter.ts` render loop.
Non-rendering test posture: assert the canvas op sequence includes
the expected `fillText` calls when emissions are present, none when
absent. Land matching `render/alertConditions.test.ts`.

### 15. Conformance scenarios

Existing scenarios sit flat under `packages/conformance/src/scenarios/`
with the `<name>.scenario.ts` suffix
(e.g. `barstateConfirmed.scenario.ts`); follow the same convention.

- `defineAlertConditionFires.scenario.ts` — script declares 2
  conditions; fixture exercises both. Assertion:
  `alert-condition-fired-at-bar` matches expected bar indices. The
  assertion variant is **new** — extend the `ScenarioAssertion`
  discriminated union in `packages/conformance/src/runConformanceSuite.ts`
  (~lines 122–137) with a kind comparing the emission's
  `(conditionId, fired, bar)` tuple against a golden set. Minimal
  shape: `{ kind: "alert-condition-fired-at-bar"; expected: ReadonlyArray<{ conditionId: string; fired: boolean; bar: number }> }`.
- `defineAlertConditionGated.scenario.ts` — same script with
  `alertConditions: false`. Assertion: `diagnostic-code-present`:
  `alert-conditions-not-supported` deduped per `(slotId, conditionId)` tuple.
- `defineAlertConditionUnknown.scenario.ts` — script signals an
  undeclared conditionId. Assertion: `diagnostic-code-present`:
  `unknown-alert-condition`.

### 16. JSDoc + ambient shim

- `defineAlertCondition` + supporting types — `@since 0.5`,
  `@example`, `@experimental`.
- `CORE_AMBIENT_SHIM` mirrors the new types.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/define/defineAlertCondition.ts` | Create | Script-side constructor |
| `packages/core/src/define/defineAlertCondition.test.ts` | Create | Unit tests |
| `packages/core/src/define/index.ts` | Modify | Re-export |
| `packages/core/src/index.ts` | Modify | Re-export |
| `packages/core/src/types.ts` | Modify | `kind: "alertCondition"`, `alertConditions` field, `ComputeContext.signal` |
| `packages/core/src/statefulPrimitives.ts` | Modify | Append entry; bump test to 164 |
| `packages/compiler/src/analysis/extractAlertConditions.ts` | Create | Manifest extraction pass |
| `packages/compiler/src/analysis/extractAlertConditions.test.ts` | Create | Unit tests for the pass |
| `packages/compiler/src/buildManifest.ts` | Modify | Wire pass |
| `packages/compiler/src/program.ts` | Modify | Mirror types in ambient shim |
| `packages/adapter-kit/src/types.ts` | Modify | `AlertConditionEmission`, `RunnerEmissions.alertConditions` |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify | New validator |
| `packages/adapter-kit/src/capabilities/capabilities.ts` | (Verify only) | Phase-4 `alertConditions` builder already exists; confirm JSDoc reflects Phase-5 runtime semantics |
| `packages/runtime/src/emit/alertConditionEmission.ts` | Create | Emit path |
| `packages/runtime/src/emit/alertConditionEmission.test.ts` | Create | Unit tests |
| `packages/runtime/src/buildComputeContext.ts` | Modify | Wire `signal` |
| `packages/runtime/src/runtimeContext.ts` | Modify | Carry condition registry |
| `examples/canvas2d-adapter/src/capabilities.ts` | Modify | `alertConditions: true` |
| `examples/canvas2d-adapter/src/render/alertConditions.ts` | Create | Side-panel rendering |
| `examples/canvas2d-adapter/src/render/alertConditions.test.ts` | Create | Op-sequence test |
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | Modify | Wire side-panel renderer into render loop |
| `packages/conformance/src/scenarios/defineAlertConditionFires.scenario.ts` | Create | Happy path |
| `packages/conformance/src/scenarios/defineAlertConditionGated.scenario.ts` | Create | Capability gated |
| `packages/conformance/src/scenarios/defineAlertConditionUnknown.scenario.ts` | Create | Unknown condition |
| `packages/conformance/src/scenarios/index.ts` | Modify | Register scenarios |
| `packages/conformance/src/runConformanceSuite.ts` | Modify | New `alert-condition-fired-at-bar` assertion variant |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100%)
- `pnpm docs:check`
- `pnpm conformance`
- `pnpm readme:check`

## Changeset

`.changeset/phase5-define-alert-condition.md` — `minor` bump for
core, compiler, adapter-kit, runtime, conformance. Body cites
PLAN §11.2.

## Acceptance Criteria

- [ ] `defineAlertCondition` exported from core with full JSDoc.
- [ ] Compiler extracts `manifest.alertConditions` from object-literal
      conditions; non-literal fails with `alert-condition-not-literal`.
- [ ] `STATEFUL_PRIMITIVES.size === 164` after this task.
- [ ] Runtime `signal(conditionId, fired)` emits per documented
      semantics; unknown / disabled cases emit the right diagnostics.
- [ ] `RunnerEmissions.alertConditions` populated; validator covers
      shape.
- [ ] All 3 conformance scenarios green.
- [ ] canvas2d-adapter renders side panel; integration test pins ops.
- [ ] 100% coverage; gates green.
- [ ] Changeset committed.

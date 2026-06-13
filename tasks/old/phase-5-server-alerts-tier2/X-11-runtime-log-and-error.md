# Task 11 — `runtime.log.*` + `runtime.error()` + `LogEmission`

> **Status: TODO**

## Goal

Ship Pine's debug-grade logging surface plus the script-throwable
fatal halt. Scripts call `runtime.log.info/warn/error(message, meta?)`
to surface messages in the editor's log pane, and `runtime.error(msg)`
to abort compute for the current bar. New `LogEmission` joins
`RunnerEmissions.logs`. Capability-gated by `Capabilities.logs`;
1000-log cap per `compute` step; `runtime.error()` halts the bar's
compute, drops partial emissions, and emits a fatal `RuntimeDiagnostic`.

## Prerequisites

- Task 10: `defineAlertCondition` landed. Capability-gating pattern
  proven; `RunnerEmissions` already extended once this phase.

## Current Behavior

- `@invinite-org/chartlang-core` has no `runtime` namespace.
- `packages/adapter-kit/src/types.ts` declares
  `Capabilities.logs: boolean` (Phase-4) but no `LogEmission`,
  no `RunnerEmissions.logs`.
- canvas2d-adapter declares `logs: false`.
- Scripts misuse `alert()` for debugging — no editor log pane.

## Desired Behavior

- `@invinite-org/chartlang-core` exports a `runtime` namespace with:
  - `runtime.log.info(message, meta?)` / `.warn` / `.error` — emit
    a `LogEmission` of the named level.
  - `runtime.error(message)` — emit a fatal `RuntimeDiagnostic`
    with code `runtime-error-thrown`, halt compute for the bar
    (subsequent primitives in the same bar's compute become silent
    no-ops). The runtime catches the halt sentinel; the script stays
    mounted; the next bar runs normally.
- The runtime emits `LogEmission` and exposes `runtime.error()` via
  a halt sentinel pattern.
- `Capabilities.logs: false` → `runtime.log.*` is a silent no-op
  (per PLAN §11.3: "no diagnostic — logs are debugging, not signal").
  `runtime.error()` is **not** capability-gated (fatal halts always
  fire — there's no "disable runtime.error" semantics).
- 1000 logs / compute step cap. 1001th log dropped with
  `runtime-log-budget-exceeded` diagnostic.
- canvas2d-adapter flips `logs: true`; its render UI surfaces a log
  pane stub (the language-service editor will pick this up in a
  later phase; canvas2d gets a one-line render-text fallback).

## Requirements

### 1. `packages/core/src/runtime/runtime.ts` (new)

Two-line MIT header, then:

```ts
import type { JsonValue } from "../types";

export type LogLevel = "info" | "warn" | "error";

/**
 * Per-step log message. Pine's `runtime.log.*` analogue. Capability-
 * gated by `Capabilities.logs`; silent no-op when false.
 *
 * @since 0.5
 * @example
 *     // Inside compute:
 *     // runtime.log.info(`ema=${ema.current}`, { ema: ema.current });
 */
function _logInfo(_message: string, _meta?: Readonly<Record<string, JsonValue>>): void {
    throw new Error("runtime.log.info called outside compiled runtime");
}
function _logWarn(_message: string, _meta?: Readonly<Record<string, JsonValue>>): void {
    throw new Error("runtime.log.warn called outside compiled runtime");
}
function _logError(_message: string, _meta?: Readonly<Record<string, JsonValue>>): void {
    throw new Error("runtime.log.error called outside compiled runtime");
}

/**
 * Halt the current bar's compute. Emits a fatal `RuntimeDiagnostic`
 * with code `runtime-error-thrown`. The script stays mounted; the
 * next bar runs normally. Use for invariant violations the script
 * cannot continue past.
 *
 * @since 0.5
 * @example
 *     // Inside compute:
 *     // if (inputs.length < 1) runtime.error("length must be >= 1");
 */
function _error(_message: string): never {
    throw new Error("runtime.error called outside compiled runtime");
}

export const runtime = Object.freeze({
    log: Object.freeze({
        info: _logInfo,
        warn: _logWarn,
        error: _logError,
    }),
    error: _error,
});

export type RuntimeNamespace = typeof runtime;
```

(Following the established compile-time-hole pattern from
`plot.ts` / `alert.ts`.)

### 2. `packages/core/src/runtime/index.ts` (new)

One-line re-export.

### 3. `packages/core/src/index.ts`

Re-export `{ runtime }` (the value) + `{ LogLevel, RuntimeNamespace }`
(the types).

### 4. `packages/core/src/types.ts` — extend `ComputeContext`

Add `runtime: RuntimeNamespace`.

### 5. `packages/adapter-kit/src/types.ts` — add `LogEmission`

```ts
export type LogEmission = Readonly<{
    kind: "log";
    level: "info" | "warn" | "error";
    message: string;
    meta?: Readonly<Record<string, import("@invinite-org/chartlang-core").JsonValue>>;
    bar: number;
    time: number;
}>;
```

Add `logs: ReadonlyArray<LogEmission>` to `RunnerEmissions`.

### 6. `packages/adapter-kit/src/validation/validateEmission.ts`

`validateLogEmission`:
- `kind === "log"`
- `level ∈ {"info", "warn", "error"}`
- `message` is a non-empty string
- `meta` (if present) is `JsonValue`-clean
- `bar` / `time` are finite numbers

Failures sink into `malformed-emission` diagnostic + drop emission.

### 7. `packages/adapter-kit/src/capabilities/capabilities.ts` — verify builder

The `capabilities.logs(enabled)` builder already exists
(line ~200, shipped in Phase 4 as part of the boolean-builder pattern).
Confirm it is correctly wired by the conformance scenarios; no new
builder is added in this task. Update its JSDoc only if it still
says "Phase 5 will wire the runtime semantics" — bump to reflect that
those semantics now ship.

### 8. `packages/runtime/src/emit/logEmission.ts` (new)

The runtime swaps `runtime.log.*` for slot-aware implementations
during `buildComputeContext`:

- `runtime.log.<level>(message, meta?)`:
  - If `!capabilities.logs` → silent no-op. Return early.
  - If `runtime.logBudget >= 1000` → emit
    `runtime-log-budget-exceeded` diagnostic once per step (deduped),
    drop emission.
  - Validate `meta` is `JsonValue`-clean via a structural guard. If
    not, emit `malformed-log-meta` diagnostic and drop.
  - Push `LogEmission { kind: "log", level, message, meta?, bar: barIndex, time: bar.time }`
    onto `runtimeContext.emissions.logs`.
  - Increment `runtimeContext.logBudget`.
- `runtimeContext.logBudget` resets to 0 at the start of each
  `compute` step (both `onBarClose` and `onBarTick`).

### 9. `packages/runtime/src/emit/runtimeError.ts` (new)

Halt sentinel mechanism:

- A module-private `RUNTIME_ERROR_SENTINEL = Symbol("runtime-error-halt")`.
- `runtime.error(message)` throws `{ sentinel: RUNTIME_ERROR_SENTINEL, message }`.
- `createScriptRunner`'s `try` around `compute(ctx)` catches the
  sentinel:
  - Recognises by `typeof err === "object" && err?.sentinel === RUNTIME_ERROR_SENTINEL`.
  - Emits a fatal `RuntimeDiagnostic` with code `runtime-error-thrown`
    carrying `err.message`.
  - **Drops** the bar's accumulated emissions (plots, alerts, drawings,
    logs, alertConditions). The runtime CLAUDE.md invariant about
    `pushPlot` validation is unchanged — this drop is at the runner
    boundary, after the compute body has thrown.
  - The script stays mounted; `barIndex` still increments per the
    Phase-1 invariant.

### 10. `packages/runtime/src/buildComputeContext.ts` — wire `runtime`

For every script kind, `ctx.runtime` is an object with the four
methods bound to the runtime emit helpers above. The script-side
hole + runtime-side impl pattern matches `plot` / `alert`.

### 11. `packages/runtime/src/runtimeContext.ts` — add `logBudget`

`logBudget: number` field, reset by the runner per step.

### 12. `packages/core/src/statefulPrimitives.ts` — register

Append `{ name: "runtime.log", slot: false }` and
`{ name: "runtime.error", slot: false }` (no slot — both are
identity-free). Bump cardinality test to **166**.

### 13. `examples/canvas2d-adapter/src/capabilities.ts`

`logs: true`.

### 14. `examples/canvas2d-adapter/src/render/logPane.ts` (new) — log pane stub

The reference adapter uses per-surface files under `src/render/`;
follow the same pattern. Create `render/logPane.ts` rendering a
small text box at the bottom of the chart pane carrying the latest
5 log entries. Wire it from the existing `createCanvas2dAdapter.ts`
render loop. Behaviour test asserts the canvas ops include the
expected `fillText` calls when emissions are present. Land matching
`render/logPane.test.ts`.

### 15. Conformance scenarios

Existing scenarios sit flat under `packages/conformance/src/scenarios/`
with the `<name>.scenario.ts` suffix
(e.g. `barstateConfirmed.scenario.ts`); follow the same convention.

The `log-emission-count` assertion variant is **new** — extend the
`ScenarioAssertion` discriminated union in
`packages/conformance/src/runConformanceSuite.ts` (~lines 122–137)
with `{ kind: "log-emission-count"; expected: number }`.

- `runtimeLogInfo.scenario.ts` — script logs an info message every
  bar. Assertion: `log-emission-count` = bar count.
- `runtimeLogGated.scenario.ts` — same script with `logs: false`.
  Assertion: `log-emission-count` = 0; no
  `alert-conditions-not-supported`-style diagnostic (logs are silent
  when gated).
- `runtimeLogBudget.scenario.ts` — script logs 1100 times in one
  bar. Assertion: `log-emission-count` = 1000;
  `diagnostic-code-present`: `runtime-log-budget-exceeded`.
- `runtimeError.scenario.ts` — script calls `runtime.error("invariant")`
  unconditionally. Assertion: bar's emissions are empty;
  `diagnostic-code-present`: `runtime-error-thrown`.

### 16. JSDoc + ambient shim

- `runtime` namespace + types — `@since 0.5`, `@example`,
  `@experimental`.
- `CORE_AMBIENT_SHIM` mirrors the namespace.

### 17. Tests

- `packages/core/src/runtime/runtime.test.ts` — out-of-runtime
  throws sentinel.
- `packages/runtime/src/emit/logEmission.test.ts` — cap, gating,
  dedup, JsonValue-clean.
- `packages/runtime/src/emit/runtimeError.test.ts` — halt drops
  bar's emissions, diagnostic emitted, next bar runs normally.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/runtime/runtime.ts` | Create | Namespace + compile-time holes |
| `packages/core/src/runtime/runtime.test.ts` | Create | Unit tests |
| `packages/core/src/runtime/index.ts` | Create | Barrel |
| `packages/core/src/index.ts` | Modify | Re-export |
| `packages/core/src/types.ts` | Modify | `ComputeContext.runtime` |
| `packages/core/src/statefulPrimitives.ts` | Modify | Append 2 entries; bump to 166 |
| `packages/adapter-kit/src/types.ts` | Modify | `LogEmission` + `RunnerEmissions.logs` |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify | `validateLogEmission` |
| `packages/adapter-kit/src/capabilities/capabilities.ts` | (Verify only) | Phase-4 `logs` builder already exists; confirm JSDoc reflects Phase-5 runtime semantics |
| `packages/runtime/src/emit/logEmission.ts` | Create | Emit + cap + gating |
| `packages/runtime/src/emit/logEmission.test.ts` | Create | Unit tests |
| `packages/runtime/src/emit/runtimeError.ts` | Create | Halt sentinel |
| `packages/runtime/src/emit/runtimeError.test.ts` | Create | Unit tests |
| `packages/runtime/src/buildComputeContext.ts` | Modify | Wire `runtime` |
| `packages/runtime/src/runtimeContext.ts` | Modify | `logBudget` field |
| `packages/runtime/src/createScriptRunner.ts` | Modify | Catch halt sentinel; drop bar emissions; reset `logBudget` per step |
| `packages/compiler/src/program.ts` | Modify | Mirror in `CORE_AMBIENT_SHIM` |
| `examples/canvas2d-adapter/src/capabilities.ts` | Modify | `logs: true` |
| `examples/canvas2d-adapter/src/render/logPane.ts` | Create | Log pane stub |
| `examples/canvas2d-adapter/src/render/logPane.test.ts` | Create | Op-sequence test |
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | Modify | Wire log-pane renderer into render loop |
| `packages/conformance/src/scenarios/runtimeLogInfo.scenario.ts` | Create | Happy |
| `packages/conformance/src/scenarios/runtimeLogGated.scenario.ts` | Create | Capability gate |
| `packages/conformance/src/scenarios/runtimeLogBudget.scenario.ts` | Create | 1000-cap |
| `packages/conformance/src/scenarios/runtimeError.scenario.ts` | Create | Halt |
| `packages/conformance/src/scenarios/index.ts` | Modify | Register |
| `packages/conformance/src/runConformanceSuite.ts` | Modify | New `log-emission-count` assertion variant |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100%)
- `pnpm docs:check`
- `pnpm conformance`
- `pnpm readme:check`

## Changeset

`.changeset/phase5-runtime-log-and-error.md` — `minor` bump for
core, adapter-kit, runtime, compiler, conformance. Body cites
PLAN §11.3.


- [x] `runtime.log.{info,warn,error}` + `runtime.error` exported and
      wired.
- [x] `Capabilities.logs: false` → silent no-op (no diagnostic).
- [x] 1000-log cap fires with `runtime-log-budget-exceeded`.
- [x] `runtime.error()` halts compute, drops bar emissions, emits
      `runtime-error-thrown`, next bar runs.
- [x] `STATEFUL_PRIMITIVES.size === 166`.
- [x] All 4 conformance scenarios green.
- [x] 100% coverage; gates green.
- [x] Changeset committed.

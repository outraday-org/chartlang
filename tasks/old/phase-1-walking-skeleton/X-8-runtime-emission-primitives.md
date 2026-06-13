# Task 8 — Runtime: Emission Primitives (`plot` / `hline` / `alert`) + Emissions Queue

> **Status: TODO**

## Goal

Land the three Phase-1 emission primitives — `plot`, `hline`,
`alert` — that scripts call from inside `compute` to produce
renderable output. Each runs against the engine from Tasks 5-6,
uses the compiler-injected slot id from Task 2, validates its
payload through Task 4's `validateEmission`, and pushes onto the
runtime's emissions queue that `drain()` returns.

## Prerequisites

- Tasks 5-6 (engine: `RuntimeContext`, `ACTIVE_RUNTIME_CONTEXT`,
  emissions queue, BarView, `ScriptRunner`).
- Task 4 (`PlotEmission`, `AlertEmission`, `validateEmission`,
  `AlertChannel`, `DiagnosticCode`).
- Task 1 (`AlertSeverity`, `Color`, `LineStyle`).

## Desired Behavior

After this task:

- `runtime.plot(slotId, value, opts)` pushes a validated
  `PlotEmission` onto the active runtime context's plot queue, with
  the script's bar/time auto-filled.
- `runtime.hline(slotId, price, opts)` pushes a `horizontal-line`
  PlotEmission.
- `runtime.alert(slotId, message, opts)` pushes a validated
  `AlertEmission` with a computed `dedupeKey`.
- Each primitive gates against `RuntimeContext.capabilities` per
  §7.4 silent-no-op semantics:
  - `plot` with `style.kind ∉ capabilities.plots` → drop +
    `unsupported-plot-kind` diagnostic.
  - `alert` with empty `capabilities.alerts` → drop +
    `unsupported-alert-channel` diagnostic.
- Per-bar dedup: two plots from the same slot on the same bar →
  the second wins (latest write). Same for alerts.
- 100% coverage including every silent-no-op branch.

## Requirements

### 1. `src/emit/emissionsQueue.ts`

`MutableRunnerEmissions` is owned by Task 5
(`packages/runtime/src/runtimeContext.ts`) — this module
**imports** it rather than redeclaring. It owns only the push
helpers:

```ts
import type { MutableRunnerEmissions } from "../runtimeContext";

export function pushPlot(queue: MutableRunnerEmissions, e: PlotEmission): void;
export function pushAlert(queue: MutableRunnerEmissions, e: AlertEmission): void;
export function pushDiagnostic(queue: MutableRunnerEmissions, d: RuntimeDiagnostic): void;
```

Each push validates via `validateEmission` from Task 4. On
failure, the helper pushes a `malformed-emission` diagnostic
instead and drops the emission. This single layer of defence runs
on every emission regardless of source.

Dedup: on `pushPlot`, if the queue already has a `PlotEmission`
with the same `slotId` AND `bar`, **replace** in place. Same for
`pushAlert`.

Task 4's `RuntimeDiagnostic.slotId` is typed `string | null`
(diagnostics from outside any primitive — say, a manifest
validation failure — carry `null`). Primitive-emitted diagnostics
always carry their slot id, so the explicit `slotId` shorthand in
the snippets below is a `string`, which satisfies the wider type.

### 2. `src/emit/plot.ts`

```ts
export function plot(
    slotId: string,
    value: number | Series<number>,
    opts: PlotOpts = {},
): void {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error("plot called outside an active script step");

    const resolvedValue = typeof value === "number" ? value : value.current;
    const numericValue = Number.isFinite(resolvedValue) ? (resolvedValue as number) : null;

    const style: PlotStyle = {
        kind: "line",
        lineWidth: opts.lineWidth ?? 1,
        lineStyle: opts.lineStyle ?? "solid",
    };

    if (!ctx.capabilities.plots.has(style.kind)) {
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "unsupported-plot-kind",
            message: `Adapter cannot render plot kind "${style.kind}".`,
            slotId, bar: ctx.barIndex(),
        });
        return;
    }

    const emission: PlotEmission = {
        kind: "plot",
        slotId,
        title: opts.title ?? "",
        style,
        bar: ctx.barIndex(),
        time: ctx.stream.bar.time,
        value: numericValue,
        color: opts.color ?? null,
        meta: opts.meta ?? {},
        pane: opts.pane ?? "overlay",
    };

    pushPlot(ctx.emissions, emission);
}
```

- Phase-1 `PlotKind` is always `"line"` (or `"step-line"` if `opts.lineStyle: "step"` — but Phase 1's `LineStyle` doesn't include "step"; that's a §7.3 `PlotLineStyle` distinction. Keep Phase 1 simple: `kind: "line"` always for `plot`).
- `value: number | null` — `null` for NaN.
- `pane: "overlay"` is the Phase-1 default and the only value the
  canvas2d adapter renders. `"new"` and named sub-panes drop with
  `unsupported-pane` diagnostic if `capabilities.subPanes === 0`.

### 3. `src/emit/hline.ts`

```ts
export function hline(
    slotId: string,
    price: number,
    opts: HLineOpts = {},
): void {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error("hline called outside an active script step");

    const style: PlotStyle = {
        kind: "horizontal-line",
        lineWidth: opts.lineWidth ?? 1,
        lineStyle: opts.lineStyle ?? "solid",
    };

    if (!ctx.capabilities.plots.has("horizontal-line")) {
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "unsupported-plot-kind",
            message: 'Adapter cannot render plot kind "horizontal-line".',
            slotId, bar: ctx.barIndex(),
        });
        return;
    }

    const emission: PlotEmission = {
        kind: "plot",
        slotId,
        title: opts.title ?? "",
        style,
        bar: ctx.barIndex(),
        time: ctx.stream.bar.time,
        value: Number.isFinite(price) ? price : null,
        color: opts.color ?? null,
        meta: {},
        pane: "overlay",
    };

    pushPlot(ctx.emissions, emission);
}
```

### 4. `src/emit/alert.ts`

```ts
export function alert(
    slotId: string,
    message: string,
    opts: AlertOpts = {},
): void {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error("alert called outside an active script step");

    if (ctx.capabilities.alerts.size === 0) {
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "unsupported-alert-channel",
            message: "Adapter declares no alert channels; alert dropped.",
            slotId, bar: ctx.barIndex(),
        });
        return;
    }

    const channels: AlertChannel[] = Array.from(ctx.capabilities.alerts);
    const bar = ctx.barIndex();
    const meta = opts.meta ?? {};
    const dedupeKey = computeDedupeKey(slotId, bar, message, meta);

    const emission: AlertEmission = {
        kind: "alert",
        slotId,
        severity: opts.severity ?? "info",
        message,
        bar,
        time: ctx.stream.bar.time,
        meta,
        channels: Object.freeze(channels.slice()),
        dedupeKey,
    };

    pushAlert(ctx.emissions, emission);
}

function computeDedupeKey(
    slotId: string,
    bar: number,
    message: string,
    meta: Readonly<Record<string, JsonValue>>,
): string {
    return `${slotId}::${bar}::${hashStringStable(message + JSON.stringify(meta))}`;
}
```

`hashStringStable` is a tiny FNV-1a 32-bit hash in
`src/emit/hash.ts` — no external dep, deterministic, exhibits the
property "same input → same key across machines". Property test
asserts stability.

`channels` is a snapshot of `capabilities.alerts` at emission time
— the canonical Phase-1 routing decision. Adapters that gate on
specific channels filter downstream.

### 5. `src/emit/index.ts` and runtime barrel wire-up

```ts
// packages/runtime/src/emit/index.ts
export { plot } from "./plot";
export { hline } from "./hline";
export { alert } from "./alert";
```

Update `packages/runtime/src/index.ts` to re-export:

```ts
export { plot, hline, alert } from "./emit";
export { ta } from "./ta";          // Task 7
export { createScriptRunner } from "./createScriptRunner";  // Task 6
export type {
    ScriptRunner, CreateScriptRunnerArgs, StateStore,
} from "./createScriptRunner";
export { inMemoryStateStore } from "./stateStore";
```

The compiler's emitted bundle imports `{ plot, hline, alert, ta }
from "@invinite-org/chartlang-runtime"`. Each call already carries
the `slotId` literal as the first argument (Task 2's transformer).

### 6. Pane validation

`PlotEmission.pane` can be `"overlay" | "new" | <id>`. Phase 1's
canvas2d adapter declares `subPanes: 0`, so any non-overlay value
falls back to overlay with `unsupported-pane`:

```ts
function resolvePane(
    requested: string | undefined,
    ctx: RuntimeContext,
    slotId: string,
): "overlay" {
    const pane = requested ?? "overlay";
    if (pane === "overlay") return "overlay";
    if (ctx.capabilities.subPanes >= 1) {
        // Phase 1: still flatten to "overlay" (canvas2d declares subPanes: 0).
        // Phase 2+ can return non-overlay; the runtime stops folding here.
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic", severity: "warning",
            code: "unsupported-pane",
            message: `Pane "${pane}" requested but Phase-1 runtime flattens to overlay.`,
            slotId, bar: ctx.barIndex(),
        });
        return "overlay";
    }
    pushDiagnostic(ctx.emissions, {
        kind: "diagnostic", severity: "warning",
        code: "unsupported-pane",
        message: `Adapter declares subPanes: 0; pane "${pane}" folded to overlay.`,
        slotId, bar: ctx.barIndex(),
    });
    return "overlay";
}
```

(Pulls out logic that's otherwise duplicated between `plot` and
`hline`.)

### 7. Tests (§16.2 layers: unit + property + golden + bench)

For each primitive:

- **Unit tests:**
  - Happy path: emit with finite value → queue has 1 PlotEmission /
    AlertEmission with expected fields.
  - `NaN` value path → `value: null`.
  - Capability mismatch path → emission dropped + diagnostic
    pushed.
  - Slot dedup: emit twice on the same bar → queue retains the
    second.
  - Calling outside active context → throws sentinel error.
- **Property tests (`<id>.property.test.ts`):**
  - `pushPlot` followed by `pushPlot` with same `(slotId, bar)`
    leaves exactly one plot.
  - `computeDedupeKey` returns the same key for identical args
    across N runs.
  - Emissions queue is empty after `drain()`.
- **Golden tests (`<id>.golden.test.ts`):**
  - Run a fixture script (`plot(close)` on the goldenBars fixture
    from Task 12) and pin the SHA-256 hash of the resulting
    `RunnerEmissions.plots` array.
- **Bench tests:** measure throughput of `plot` over 10 000
  emissions; threshold `ceil(median × 3)`.

100% coverage. Every diagnostic branch has both a positive (gate
fires) and a negative (gate passes) test.

### 8. JSDoc per §17.2

`plot` / `hline` / `alert` carry `@since 0.1` + `@example`. The
example for `plot` uses the script-author surface (`import { plot }
from "@invinite-org/chartlang-core"`) so the Task-3 docs-check
executor exercises the full pipeline.

```ts
/**
 * Emit a plot line for the current bar.
 *
 * @since 0.1
 * @example
 *     import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "EMA(20)",
 *         apiVersion: 1,
 *         compute({ bar, ta, plot }) {
 *             plot(ta.ema(bar.close, 20), { color: "#26a69a", title: "EMA" });
 *         },
 *     });
 */
export function plot(...): void;
```

### 9. Determinism test extension

Extend `src/determinism.test.ts` (Task 6) with a primitive
emission test: run a 500-bar script that calls `plot(bar.close)`
and `alert("...")` twice — assert the two `RunnerEmissions[]`
arrays are structurally identical.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/emit/emissionsQueue.ts` | Create | Dedup + validation helpers. |
| `packages/runtime/src/emit/plot.ts` | Create | Plot emission primitive. |
| `packages/runtime/src/emit/hline.ts` | Create | Horizontal-line emission. |
| `packages/runtime/src/emit/alert.ts` | Create | Alert emission + dedupeKey. |
| `packages/runtime/src/emit/hash.ts` | Create | FNV-1a 32-bit string hash. |
| `packages/runtime/src/emit/paneResolver.ts` | Create | Shared pane-validation logic. |
| `packages/runtime/src/emit/index.ts` | Create | Barrel. |
| `packages/runtime/src/emit/<file>.test.ts` | Create | Per-module unit tests. |
| `packages/runtime/src/emit/<id>.property.test.ts` | Create (×3) | Property tests for plot/hline/alert. |
| `packages/runtime/src/emit/<id>.golden.test.ts` | Create (×3) | SHA-256 pinning against goldenBars (uses Task 12's fixture; since Task 12 ships later, ship this with an inline 50-bar mini-fixture and graduate when Task 12 lands). |
| `packages/runtime/src/emit/<id>.bench.test.ts` | Create (×3) | Bench + threshold. |
| `packages/runtime/src/index.ts` | Modify | Export `plot`, `hline`, `alert`. |
| `packages/runtime/src/determinism.test.ts` | Modify | Add primitive emission coverage. |
| `packages/runtime/README.md` | Modify | Add emission section to public-surface listing. |

## Acceptance Criteria

- `pnpm -F @invinite-org/chartlang-runtime typecheck && pnpm -F
  @invinite-org/chartlang-runtime test` pass with 100% coverage.
- `plot(slotId, ta.ema(slotIdA, bar.close, 20))` from inside an
  active runtime step pushes 1 `PlotEmission` with the EMA's
  current value.
- `alert(slotId, "Test")` pushes an `AlertEmission` whose
  `dedupeKey` matches `${slotId}::<bar>::<FNV1a(message+meta)>`.
- A `plot` on an adapter with `capabilities.plots` not containing
  `"line"` drops the emission and pushes an `unsupported-plot-kind`
  diagnostic.
- A `hline` on an adapter without `"horizontal-line"` similarly
  drops + diagnoses.
- An `alert` on an adapter with empty `capabilities.alerts` drops
  + diagnoses.
- Calling any primitive outside `ACTIVE_RUNTIME_CONTEXT` throws
  the sentinel error.
- `pnpm docs:check` succeeds — `plot` / `hline` / `alert` examples
  compile through the Task-3 doc-check executor.
- Phase-0 + Tasks 1-7 gates remain green.

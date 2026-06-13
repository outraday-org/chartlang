# Task 3 — Runtime: `emit/draw/` infrastructure + `drawing-hash` conformance assertion

> **Status: TODO**

## Goal

Land the runtime-side drawing emission infrastructure: the
`packages/runtime/src/emit/draw/` subtree with the
`DrawingHandle` impl, the per-handle slot-state store, the
`pushDrawing` queue helper (validation + capability gating +
bucket budget + per-bar `(handleId, op)` dedup), and the
runtime-side `draw` namespace SHELL (per-kind functions stubbed —
filled in by Tasks 5–18). Plus the sixth `ScenarioAssertion`
variant — `"drawing-hash"` — in
`@invinite-org/chartlang-conformance` so per-kind scenarios
(Tasks 5–18) can pin SHA-256 hashes over drawing-emission tuples.

## Prerequisites

- Task 2 (adapter-kit: `DrawingEmission.state: DrawingState`,
  per-kind validators, `bucketFor`, `capabilities.allPhase3Drawings`).

## Current Behavior

- `RunnerEmissions.drawings: ReadonlyArray<DrawingEmission>` is
  declared but always empty — no runtime path emits drawings.
- `packages/runtime/src/emit/` ships `plot`, `hline`, `alert`,
  `emissionsQueue`, `hash`, `paneResolver`. No `draw/` subdir.
- `packages/runtime/src/primitives.ts` exports `plot`, `hline`,
  `alert`, `ta` — no `draw` export.
- `packages/conformance/src/runConformanceSuite.ts`
  `ScenarioAssertion` has 5 variants; `evalAssertion` switches
  over them. No drawing assertion.

## Desired Behavior

- `draw.<kind>(...)` (where the runtime's actual functions land
  per Tasks 5–18) returns a `DrawingHandle` whose
  `slotId#subId`-keyed slot persists `DrawingState` across bars.
- `handle.update(patch)` pushes a `DrawingEmission` with `op:
  "update"` and the FULL merged state.
- `handle.remove()` pushes one final emission with `op: "remove"`
  and the last-known state.
- `pushDrawing` enforces: (1) capability via
  `ctx.capabilities.drawings.has(kind)` (drop +
  `unsupported-drawing-kind`); (2) bucket budget via
  `min(defineIndicator.maxDrawings[bucket],
  capabilities.maxDrawingsPerScript[bucket])` (drop +
  `drawing-budget-exceeded`); (3) per-bar `(handleId, op)` dedup
  (last-write-wins).
- `runConformanceSuite` accepts `drawing-hash` assertions and
  produces re-pinnable failure messages mirroring `plot-hash`.

## Requirements

### 1. `packages/runtime/src/emit/draw/handle.ts`

```ts
import type {
    DrawingHandle as CoreDrawingHandle,
    DrawingKind,
    DrawingState,
} from "@invinite-org/chartlang-core";
import { ACTIVE_RUNTIME_CONTEXT } from "../../runtimeContext";
import { pushDrawing } from "./pushDrawing";

/** Internal slot store entry — one per `slotId#subId`. */
export type DrawingSlot = {
    readonly handleId: string;
    readonly kind: DrawingKind;
    state: DrawingState;
    removed: boolean;
};

/** Construct a handle for `slotId#subId`. Allocates the slot in
 *  `ctx.drawingSlots` if absent. */
export function createDrawingHandle(
    slotId: string,
    subId: number,
    kind: DrawingKind,
    initialState: DrawingState,
): CoreDrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error("draw called outside an active script step");

    const handleId = `${slotId}#${subId}`;
    let slot = ctx.drawingSlots.get(handleId);

    const op: "create" | "update" = slot === undefined ? "create" : "update";
    if (slot === undefined) {
        slot = { handleId, kind, state: initialState, removed: false };
        ctx.drawingSlots.set(handleId, slot);
    } else {
        slot.state = mergeDrawingState(slot.state, initialState);
        slot.removed = false;
    }

    pushDrawing(ctx, {
        kind: "drawing",
        handleId,
        drawingKind: kind,
        op,
        state: slot.state,
        bar: ctx.barIndex(),
        time: ctx.stream.bar.time,
    });

    return {
        id: handleId,
        update(patch) {
            const s = ctx.drawingSlots.get(handleId);
            if (s === undefined || s.removed) return;  // post-remove update is no-op
            s.state = mergeDrawingState(s.state, patch);
            pushDrawing(ctx, {
                kind: "drawing",
                handleId,
                drawingKind: kind,
                op: "update",
                state: s.state,
                bar: ctx.barIndex(),
                time: ctx.stream.bar.time,
            });
        },
        remove() {
            const s = ctx.drawingSlots.get(handleId);
            if (s === undefined || s.removed) return;
            s.removed = true;
            pushDrawing(ctx, {
                kind: "drawing",
                handleId,
                drawingKind: kind,
                op: "remove",
                state: s.state,
                bar: ctx.barIndex(),
                time: ctx.stream.bar.time,
            });
        },
    };
}

function mergeDrawingState(prev: DrawingState, patch: Partial<DrawingState>): DrawingState {
    // Shallow merge preserving `kind` discriminant. The cast is
    // safe because per-kind emit fns supply a Partial<the same
    // variant>, never a cross-variant patch — the compiler
    // injects the kind at the callsite.
    return { ...prev, ...(patch as object), kind: prev.kind } as DrawingState;
}
```

`ctx.drawingSlots: Map<string, DrawingSlot>` is added to
`runtimeContext.ts` (sibling to the existing
`MutableRunnerEmissions`) in this task. Lifetime: cleared on
`createScriptRunner` boot and on `dispose`. Cross-bar:
intentionally retained so handles stay stable across bars (§10.3).

### 2. Sub-id allocator — `packages/runtime/src/emit/draw/subIdAllocator.ts`

A script's `for (let i = 0; i < N; i++) draw.text(...)` loop
needs N stable handles. The compiler injects ONE slotId per
call-site; the runtime increments a `subId` counter the first
time a callsite fires within a bar, resets on
`runner.onBarClose` / `onBarTick` entry. Cross-bar: i-th call at
the same callsite yields the same `slotId#i` regardless of bar.

```ts
import type { RuntimeContext } from "../../runtimeContext";

export function nextSubId(ctx: RuntimeContext, slotId: string): number {
    const counters = ctx.drawingSubIdCounters;
    const current = counters.get(slotId) ?? 0;
    counters.set(slotId, current + 1);
    return current;
}

/** Called at the top of `onBarClose` / `onBarTick`. */
export function resetSubIdCounters(ctx: RuntimeContext): void {
    ctx.drawingSubIdCounters.clear();
}
```

`ctx.drawingSubIdCounters: Map<string, number>` added to
`runtimeContext.ts` alongside `drawingSlots`.
`packages/runtime/src/execution/onBarClose.ts` and
`onBarTick.ts` reset the counters in the same `try` block that
sets `ACTIVE_RUNTIME_CONTEXT.current`.

### 3. `packages/runtime/src/emit/draw/pushDrawing.ts`

```ts
import { bucketFor, type DrawingBucket } from "@invinite-org/chartlang-core";
import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import { validateEmission } from "@invinite-org/chartlang-adapter-kit";

export function pushDrawing(ctx: RuntimeContext, e: DrawingEmission): void {
    // 1. Capability gate.
    if (!ctx.capabilities.drawings.has(e.drawingKind)) {
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "unsupported-drawing-kind",
            message: `Adapter cannot render drawing kind "${e.drawingKind}".`,
            slotId: e.handleId,
            bar: e.bar,
        });
        return;
    }

    // 2. Bucket budget — only on `op: "create"` (update / remove are free).
    if (e.op === "create") {
        const bucket: DrawingBucket = bucketFor(e.drawingKind);
        const used = ctx.drawingBucketCounters[bucket];
        const cap = effectiveBudget(ctx, bucket);
        if (used >= cap) {
            pushDiagnostic(ctx.emissions, {
                kind: "diagnostic",
                severity: "warning",
                code: "drawing-budget-exceeded",
                message: `Bucket '${bucket}' budget (${cap}) exhausted; drawing dropped.`,
                slotId: e.handleId,
                bar: e.bar,
            });
            return;
        }
        ctx.drawingBucketCounters[bucket] = used + 1;
    }
    if (e.op === "remove") {
        const bucket: DrawingBucket = bucketFor(e.drawingKind);
        // Decrement does not under-flow — `remove` only fires once per
        // create per the handle impl.
        ctx.drawingBucketCounters[bucket] = Math.max(
            0, ctx.drawingBucketCounters[bucket] - 1,
        );
    }

    // 3. Validate the wire payload.
    const v = validateEmission(e as unknown);
    if (!v.ok) {
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: v.code,
            message: v.message,
            slotId: e.handleId,
            bar: e.bar,
        });
        return;
    }

    // 4. Per-bar (handleId, op) dedup — replace existing entry in place.
    const drawings = ctx.emissions.drawings;
    for (let i = drawings.length - 1; i >= 0; i--) {
        if (drawings[i].handleId === e.handleId && drawings[i].bar === e.bar) {
            drawings[i] = e;
            return;
        }
    }
    drawings.push(e);
}

function effectiveBudget(ctx: RuntimeContext, bucket: DrawingBucket): number {
    const adapter = ctx.capabilities.maxDrawingsPerScript[bucket];
    const script = ctx.scriptMaxDrawings?.[bucket] ?? Infinity;
    return Math.min(adapter, script);
}
```

`ctx.drawingBucketCounters: Record<DrawingBucket, number>` and
`ctx.scriptMaxDrawings: DrawingCounts | null` added to
`runtimeContext.ts`. The script-side budget comes from
`defineIndicator({ maxDrawings: {...} })` / `defineDrawing({
maxDrawings: {...} })` — Task 1 lands `ScriptManifest.maxDrawings?:
DrawingCounts` and the `DefineIndicatorOpts` propagation; Task
20 mirrors it on `DefineDrawingOpts`. The runner reads
`compiled.manifest.maxDrawings ?? null` in `createScriptRunner`
and populates `ctx.scriptMaxDrawings`.

`ctx.emissions.drawings` is widened from
`ReadonlyArray<DrawingEmission>` to a mutable
`Array<DrawingEmission>` inside `MutableRunnerEmissions` (mirrors
how `plots` / `alerts` / `diagnostics` are already mutable).
`drain()` already snapshots-and-resets, so the public
`RunnerEmissions.drawings: ReadonlyArray<DrawingEmission>` shape
is unchanged.

### 4. `packages/runtime/src/emit/draw/index.ts` — namespace skeleton

```ts
import type { DrawNamespace } from "@invinite-org/chartlang-core";

/**
 * Runtime-side `draw.*` namespace. Phase-3 Task 3 ships an empty
 * shell — every method throws "not yet implemented" at runtime.
 * Tasks 5–18 fill in the per-category functions.
 *
 * The TypeScript surface (`DrawNamespace`) is fully declared in
 * `@invinite-org/chartlang-core`; the runtime widens each method
 * with a leading `slotId: string` per PLAN.md §5.5 — the compiler
 * injects the slot id at every call site.
 */
export const draw: DrawNamespace = {
    line: notYetImplemented("line"),
    horizontalLine: notYetImplemented("horizontal-line"),
    // … 59 more — Tasks 5–18 each replace their kinds with the real impl.
    fib: { /* sub-namespace; same shape */ },
    gann: { /* … */ },
    elliott: { /* … */ },
    pattern: { /* … */ },
} as unknown as DrawNamespace;

function notYetImplemented(kind: string): never {
    return (() => {
        throw new Error(`draw.${kind} not yet implemented — see Phase 3 Tasks 5–18`);
    }) as never;
}
```

Per-category tasks (5–18) replace `notYetImplemented(<kind>)`
with the real per-kind function from
`packages/runtime/src/emit/draw/<kind>.ts`. Each per-kind file
follows the §22.10 set: impl + unit + property + golden + bench
+ JSDoc + scenario + auto-generated docs page. Property +
golden + bench files land in the per-kind PR — Task 3 ships only
the infrastructure.

### 5. `packages/runtime/src/primitives.ts` + `index.ts`

Re-export `draw`:

```ts
// primitives.ts
export { draw } from "./emit/draw";

// index.ts
export { alert, draw, hline, plot } from "./emit";
```

`packages/runtime/src/buildComputeContext.ts` adds `draw` to the
`ComputeContext` it constructs (mirroring how Phase 2 added `ta`).
`ComputeContext.draw: typeof import("@invinite-org/chartlang-core/draw").draw`
in `packages/core/src/types.ts` — Task 1 should already have wired
this on `ComputeContext`; if not, add it here as a single line.

### 6. `packages/runtime/src/runtimeContext.ts` extension

Add three new fields:

```ts
export type MutableRunnerEmissions = {
    plots: PlotEmission[];
    alerts: AlertEmission[];
    drawings: DrawingEmission[];  // already declared in Phase 1
    diagnostics: RuntimeDiagnostic[];
    fromBar: number;
    toBar: number;
};

export type RuntimeContext = {
    // … existing fields
    readonly drawingSlots: Map<string, DrawingSlot>;
    readonly drawingSubIdCounters: Map<string, number>;
    readonly drawingBucketCounters: Record<DrawingBucket, number>;
    readonly scriptMaxDrawings: DrawingCounts | null;
};
```

`createScriptRunner` initialises:

```ts
drawingSlots: new Map(),
drawingSubIdCounters: new Map(),
drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
scriptMaxDrawings: compiled.manifest.maxDrawings ?? null,  // wire from manifest
```

Disposal: `dispose()` clears `drawingSlots` (releases handle
references) and resets counters. The runner is per-script so
cross-script leakage isn't a risk; the clear is correctness for
multi-`dispose`-replay tests.

### 7. Conformance — `drawing-hash` `ScenarioAssertion` variant

`packages/conformance/src/runConformanceSuite.ts`:

```ts
export type ScenarioAssertion =
    | { readonly kind: "plot-hash"; readonly slotId?: string; readonly sha256: string }
    | { readonly kind: "alert-count"; readonly count: number }
    | { readonly kind: "alert-message-contains"; readonly pattern: string; readonly min: number }
    | { readonly kind: "diagnostic-code-absent"; readonly code: DiagnosticCode }
    | { readonly kind: "diagnostic-code-present"; readonly code: DiagnosticCode }
    | { readonly kind: "drawing-hash"; readonly handleId?: string; readonly sha256: string };
```

`evalAssertion` gains a `case "drawing-hash":` arm:

```ts
case "drawing-hash": {
    const { hash, count } = hashDrawingSeries(run.drawings, assertion.handleId);
    if (hash === assertion.sha256) return null;
    const label = assertion.handleId ?? "<all>";
    return {
        scenarioId,
        assertionKind: "drawing-hash",
        message: `drawing-hash[${label}]: expected ${assertion.sha256}, actual ${hash} (${count} emissions)`,
    };
}
```

`hashDrawingSeries` mirrors `hashPlotSeries`:

```ts
function hashDrawingSeries(
    drawings: ReadonlyArray<DrawingEmission>,
    handleId: string | undefined,
): { readonly hash: string; readonly count: number } {
    const filtered = handleId === undefined ? drawings : drawings.filter((d) => d.handleId === handleId);
    const tuples = filtered.map((d) => ({
        handleId: d.handleId,
        kind: d.drawingKind,
        op: d.op,
        state: d.state,
        bar: d.bar,
    }));
    const hash = createHash("sha256").update(JSON.stringify(tuples)).digest("hex");
    return { hash, count: tuples.length };
}
```

`BufferedRun` extends with `drawings: ReadonlyArray<DrawingEmission>`,
populated from `drained.drawings` in `runOne`'s loop.

### 8. Tests (§16.3: unit + property + golden + bench)

- `handle.test.ts` — create / update / remove flow; `update` on
  removed handle is no-op; cross-bar same-`subId` returns same
  handle id.
- `subIdAllocator.test.ts` — N-iteration loop produces N
  distinct ids; reset clears counters; cross-bar same-loop
  identical ids.
- `pushDrawing.test.ts` — capability gate (no-op + diagnostic);
  budget gate per bucket (drop + diagnostic on overflow); dedup
  on same `(handleId, bar)` last-write-wins; `validateEmission`
  failure path (malformed-emission diagnostic).
- `pushDrawing.property.test.ts` — `pushDrawing` N times on the
  same `(handleId, bar)` leaves exactly one entry in `drawings`;
  `op: "create"` followed by `op: "remove"` followed by `op:
  "create"` on the same bucket counts as +1 −1 +1 (net +1) bucket
  consumption.
- `pushDrawing.golden.test.ts` — emit 100 mixed drawings against
  the `goldenBars` fixture; pin SHA-256 of the drawings array.
- `pushDrawing.bench.test.ts` — `pushDrawing` × 10 000 with the
  `THRESHOLD_MS = ceil(median × 3)` pattern.
- `runConformanceSuite.test.ts` — extend with a `drawing-hash`
  scenario (synthetic, one emission); assert pass + failure
  message format.

100% coverage on every new file. The line-budget tests use
synthetic `Capabilities.maxDrawingsPerScript = { lines: 2, … }`
so 3 emissions test the overflow branch.

### 9. JSDoc per §17.2

- `createDrawingHandle` — `@since 0.3`, `@experimental`,
  `@example` showing a `defineIndicator` that creates a handle
  and updates it the next bar.
- `pushDrawing` — `@since 0.3`, `@experimental`.
- `ScenarioAssertion` variant for `drawing-hash` — `@since 0.3`,
  `@example`.

### 10. README extensions

- `packages/runtime/README.md` — "Drawing emission (Phase 3)"
  entry. Cap 100 lines.
- `packages/conformance/README.md` — `drawing-hash` assertion
  entry. Cap 100 lines.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/emit/draw/handle.ts` | Create | `createDrawingHandle` + slot store + merge. |
| `packages/runtime/src/emit/draw/subIdAllocator.ts` | Create | Per-callsite per-bar counter. |
| `packages/runtime/src/emit/draw/pushDrawing.ts` | Create | Validation + budget + dedup. |
| `packages/runtime/src/emit/draw/index.ts` | Create | `draw` namespace shell (61 `notYetImplemented` slots). |
| `packages/runtime/src/emit/draw/*.test.ts` | Create | Unit / property / golden / bench tests. |
| `packages/runtime/src/runtimeContext.ts` | Modify | Add `drawingSlots`, `drawingSubIdCounters`, `drawingBucketCounters`, `scriptMaxDrawings`; widen `MutableRunnerEmissions.drawings` to mutable. |
| `packages/runtime/src/createScriptRunner.ts` | Modify | Initialise the four new context fields; wire `manifest.maxDrawings`. |
| `packages/runtime/src/execution/onBarClose.ts` | Modify | `resetSubIdCounters(ctx)` at top of try block. |
| `packages/runtime/src/execution/onBarTick.ts` | Modify | Same reset call. |
| `packages/runtime/src/execution/dispose.ts` | Modify | Clear `drawingSlots`. |
| `packages/runtime/src/primitives.ts` | Modify | Export `draw`. |
| `packages/runtime/src/buildComputeContext.ts` | Modify | Inject `draw` into `ComputeContext`. |
| `packages/runtime/src/index.ts` | Modify | Re-export `draw`. |
| `packages/conformance/src/runConformanceSuite.ts` | Modify | Add `drawing-hash` variant + `hashDrawingSeries` + `BufferedRun.drawings`. |
| `packages/conformance/src/runConformanceSuite.test.ts` | Modify | `drawing-hash` scenario coverage. |
| `packages/core/src/types.ts` | Modify | Add `draw: DrawNamespace` to `ComputeContext`. |
| `packages/runtime/README.md` | Modify | "Drawing emission (Phase 3)" entry. |
| `packages/conformance/README.md` | Modify | `drawing-hash` entry. |
| `.changeset/phase-3-task-3-runtime-emit.md` | Create | Three minor bumps (`runtime`, `core`, `conformance`). |

## Gates

- `pnpm -F @invinite-org/chartlang-runtime typecheck && test`
  (100% coverage).
- `pnpm -F @invinite-org/chartlang-conformance typecheck && test`
  (100% coverage).
- `pnpm -F @invinite-org/chartlang-core test` (`ComputeContext`
  field add doesn't break tests).
- `pnpm typecheck` workspace-wide.
- `pnpm lint`, `pnpm docs:check`, `pnpm readme:check`.
- `pnpm conformance` green — the existing Phase-1/-2 scenarios
  still pass (no behaviour change for them). The new
  `drawing-hash` scenario added in `runConformanceSuite.test.ts`
  passes against a synthetic adapter.

## Changeset

Minor bumps on `@invinite-org/chartlang-runtime`,
`@invinite-org/chartlang-core` (`ComputeContext.draw` field),
and `@invinite-org/chartlang-conformance` (`drawing-hash`
assertion). Description: "Runtime `draw.*` emission
infrastructure — `DrawingHandle` impl, per-handle slot store,
`pushDrawing` (capability + bucket budget + dedup), `draw`
namespace shell (per-kind methods land in Tasks 5–18). New
`drawing-hash` `ScenarioAssertion` variant in conformance."

## Acceptance Criteria

- `pushDrawing` enforces capability gating, bucket budget,
  validation, and per-bar dedup. Every branch has at least one
  test.
- `DrawingHandle.update` re-emits the full merged state under
  `op: "update"`.
- Calling any `draw.<kind>` (the shell) throws "not yet
  implemented" — the per-kind tasks replace these throws.
- The `drawing-hash` assertion produces re-pinnable failure
  messages with the actual hash + emission count.
- 100% coverage on every file touched.
- `pnpm conformance` still green against Phase-1/-2 scenarios.
- Phase-1/-2 gates remain green.
- Changeset committed.

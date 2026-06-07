// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertEmission,
    Capabilities,
    DrawingEmission,
    PlotEmission,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";
import type {
    DrawingBucket,
    DrawingCounts,
    DrawingKind,
    DrawingState,
} from "@invinite-org/chartlang-core";

import type { StateStore } from "./stateStore";
import type { StreamState } from "./streamState";

/**
 * Per-handle drawing slot the runtime persists across bars. The key is
 * `slotId#subId` (compiler-injected callsite id + per-bar sub-id from
 * {@link nextSubId}). `state` holds the last full {@link DrawingState}
 * emitted for the handle; subsequent `update(patch)` calls merge into
 * it and re-emit the full payload per PLAN.md §10.3. `removed: true`
 * is sticky — further `update` / `remove` on the handle no-op.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const slot: DrawingSlot = {
 *     //     handleId: "x.chart.ts:1:1#0",
 *     //     kind: "line",
 *     //     state: { kind: "line", anchors: [...], style: {} },
 *     //     removed: false,
 *     // };
 */
export type DrawingSlot = {
    readonly handleId: string;
    readonly kind: DrawingKind;
    state: DrawingState;
    removed: boolean;
};

/**
 * Mutable counterpart of `RunnerEmissions` (from adapter-kit) that the
 * runtime accumulates into per bar. Task 6's execution loop pushes
 * here during `compute`; `drain()` snapshots into the readonly
 * `RunnerEmissions` shape the adapter receives.
 *
 * @since 0.1
 * @example
 *     // const emissions: MutableRunnerEmissions = {
 *     //     plots: [],
 *     //     drawings: [],
 *     //     alerts: [],
 *     //     diagnostics: [],
 *     //     fromBar: 0,
 *     //     toBar: 0,
 *     // };
 */
export type MutableRunnerEmissions = {
    plots: PlotEmission[];
    drawings: DrawingEmission[];
    alerts: AlertEmission[];
    diagnostics: RuntimeDiagnostic[];
    fromBar: number;
    toBar: number;
};

/**
 * The contract Task 6's execution loop hands to stateful primitives
 * (Tasks 7-8) inside a single `compute` step. Tasks 7-8 read this
 * through {@link ACTIVE_RUNTIME_CONTEXT} — the runtime sets `.current`
 * around `compute` in a `try/finally`, so primitives can find their
 * series, slot store, capability bag, emission destination, and bar
 * index without an explicit argument.
 *
 * `isTick` discriminates `onBarTick` calls (head-replace mode) from
 * `onBarClose` / `onHistory` (append mode). Stateful primitives in
 * Task 7 use it to swap append vs replace-head behaviour.
 *
 * @since 0.1
 * @example
 *     // const ctx: RuntimeContext = {
 *     //     stream, stateStore, capabilities, emissions,
 *     //     barIndex: () => 0,
 *     //     isTick: false,
 *     // };
 */
export type RuntimeContext = {
    readonly stream: StreamState;
    readonly stateStore: StateStore;
    readonly capabilities: Capabilities;
    readonly emissions: MutableRunnerEmissions;
    readonly barIndex: () => number;
    isTick: boolean;
    /**
     * Per-handle drawing slot store keyed by `slotId#subId`. Allocated
     * on first `op: "create"`; mutated by `update(patch)` to merge the
     * patch into the slot's `state`; flagged `removed: true` on
     * `remove()`. Cleared on `dispose`. Persists across bars per
     * PLAN.md §10.3. @since 0.3
     */
    readonly drawingSlots: Map<string, DrawingSlot>;
    /**
     * Per-callsite per-bar sub-id counter. Each `draw.<kind>(...)` call
     * inside a bar reads `nextSubId(ctx, slotId)`; the counter resets
     * at the top of each `onBarClose` / `onBarTick` so iteration `i` at
     * the same callsite yields the same `slotId#i` across bars.
     * Cleared on `dispose`. @since 0.3
     */
    readonly drawingSubIdCounters: Map<string, number>;
    /**
     * Live per-bucket allocation tally for the current script. Each
     * `op: "create"` increments the relevant bucket; each
     * `op: "remove"` decrements (clamped at 0). `op: "update"` is
     * free. `pushDrawing` drops the emission with
     * `drawing-budget-exceeded` once a bucket hits its effective
     * budget (min of adapter cap + `scriptMaxDrawings`). Reset to
     * zero on `dispose`. @since 0.3
     */
    readonly drawingBucketCounters: Record<DrawingBucket, number>;
    /**
     * The script's per-bucket cap from `defineIndicator({ maxDrawings:
     * ... })` / `defineDrawing({ maxDrawings: ... })`. `null` when
     * omitted — `pushDrawing` then enforces the adapter cap alone.
     * Effective budget is `min(scriptMaxDrawings[b],
     * capabilities.maxDrawingsPerScript[b])`. @since 0.3
     */
    readonly scriptMaxDrawings: DrawingCounts | null;
};

/**
 * Process-wide context slot. Task 6's `createScriptRunner` mutates
 * `.current` inside `try { ... } finally { current = null }` around
 * every `compute` invocation; Tasks 7-8 read it inside primitive
 * implementations. JavaScript's single-threaded execution model
 * guarantees only one `compute` runs at a time, so this ambient
 * slot is safe.
 *
 * The export is intentionally just a holder — no class, no methods,
 * no validation. Responsibility for setting and clearing lives in
 * Task 6.
 *
 * @since 0.1
 * @example
 *     // import { ACTIVE_RUNTIME_CONTEXT }
 *     //     from "@invinite-org/chartlang-runtime";
 *     // ACTIVE_RUNTIME_CONTEXT.current; // null at module load
 */
export const ACTIVE_RUNTIME_CONTEXT: { current: RuntimeContext | null } = {
    current: null,
};

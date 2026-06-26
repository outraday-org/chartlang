// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertConditionEmission,
    AlertEmission,
    Capabilities,
    DrawingEmission,
    LogEmission,
    PlotEmission,
    PlotOverride,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";
import type {
    AlertConditionDefinition,
    Bar,
    DrawingBucket,
    DrawingCounts,
    DrawingKind,
    DrawingState,
    SecurityBar,
    Series,
} from "@invinite-org/chartlang-core";

import type { DepOutputStore } from "./dep/DepOutputStore.js";
import type { PersistentStateStore } from "./persistentStateStore.js";
import type { SecurityExprRunner } from "./request/securityExprRunner.js";
import type { ArrayStateSlot } from "./state/arrayStateSlot.js";
import type { MapStore } from "./state/mapStore.js";
import type { SeriesSlot } from "./state/seriesSlot.js";
import type { StateSlot } from "./state/stateSlot.js";
import type { StateStore } from "./stateStore.js";
import type { StreamState } from "./streamState.js";
import type { RuntimeViews } from "./views/index.js";

/**
 * Per-handle drawing slot the runtime persists across bars. The key is
 * `slotId#subId` (compiler-injected callsite id + per-bar sub-id from
 * {@link nextSubId}). `state` holds the last full {@link DrawingState}
 * emitted for the handle; subsequent `update(patch)` calls merge into
 * it and re-emit the full payload. `removed: true`
 * is sticky — further `update` / `remove` on the handle no-op.
 *
 * `z` is the presentation-only render-order key `handle.ts`'s `splitZ`
 * lifted out of the drawing's `state.style` (default `0`). It is stored
 * **beside** `state` — never inside `state` / `state.style` — because
 * the wire carries it as the top-level {@link DrawingEmission.z} field,
 * not as part of {@link DrawingState}. It persists across bars; an
 * `update` that does not re-specify a non-zero `z` retains it, a
 * re-specified non-zero `z` overrides, and a cross-bar re-entry
 * re-specifies it from the new call.
 *
 * @since 0.3
 * @stable
 * @example
 *     // const slot: DrawingSlot = {
 *     //     handleId: "x.chart.ts:1:1#0",
 *     //     kind: "line",
 *     //     state: { kind: "line", anchors: [...], style: {} },
 *     //     z: 0,
 *     //     removed: false,
 *     // };
 */
export type DrawingSlot = {
    readonly handleId: string;
    readonly kind: DrawingKind;
    state: DrawingState;
    z: number;
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
    alertConditions?: AlertConditionEmission[];
    logs: LogEmission[];
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
 * `stateSlots` stores Phase-4 `state.*` / `state.tick.*` slots keyed by
 * `${slotId}:state`; values flush into `stateStore` at close/dispose.
 *
 * `views` is a mutable container whose fields are replaced with fresh frozen
 * `barstate.*`, `syminfo.*`, and `timeframe.*` snapshots as the runner
 * advances.
 *
 * `resolvedInputs` is the frozen bag handed to `compute({ inputs })`,
 * resolved once at mount from manifest defaults plus adapter overrides.
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
    readonly persistentStateStore?: PersistentStateStore;
    lastPersistTime: number;
    readonly capabilities: Capabilities;
    readonly emissions: MutableRunnerEmissions;
    readonly barIndex: () => number;
    isTick: boolean;
    /**
     * Per-handle drawing slot store keyed by `slotId#subId`. Allocated
     * on first `op: "create"`; mutated by `update(patch)` to merge the
     * patch into the slot's `state`; flagged `removed: true` on
     * `remove()`. Cleared on `dispose`. Persists across bars.
     * @since 0.3
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
    /**
     * Runtime `state.*` / `state.tick.*` slot store keyed by
     * `${slotIdPrefix ?? ""}${slotId}:state`. Non-tick slots keep
     * committed/tentative values; tick slots commit writes immediately.
     * Cleared on `dispose` after flushing snapshots to `stateStore`.
     * @since 0.4
     */
    readonly stateSlots: Map<string, StateSlot<unknown>>;
    /**
     * Runtime `state.series` slot store keyed by
     * `${slotIdPrefix ?? ""}${slotId}:series`. Each holds a history ring +
     * the identity-stable script-facing view + the last committed head.
     * The ring advances once per close (script-invisible lockstep), so
     * `s[1]` is always one committed bar back. Cleared on `dispose` after
     * the final snapshot captures it. @since 0.9
     */
    readonly seriesSlots: Map<string, SeriesSlot>;
    /**
     * Runtime `state.array` slot store keyed by
     * `${slotIdPrefix ?? ""}${slotId}:array`. Each holds two
     * `Float64RingBuffer`s (committed + tentative) behind an identity-stable
     * bounded-FIFO handle. A parallel map (vs folding into `stateSlots`)
     * mirrors the `state.series` precedent — both collection primitives share
     * the two-ring shape and snapshot directly from the live map with no
     * `StateStore` flush. Cleared on `dispose`. @since 1.3
     */
    readonly arraySlots: Map<string, ArrayStateSlot>;
    /**
     * Runtime `state.map` slot store keyed by
     * `${slotIdPrefix ?? ""}${slotId}:map`. Each holds two `Map<MapKey, number>`s
     * (committed + tentative) behind an identity-stable bounded keyed handle. A
     * parallel map (vs folding into `stateSlots`) mirrors the `state.array` /
     * `state.series` precedent — the collection primitives share the
     * two-snapshot shape and serialise directly from the live map with no
     * `StateStore` flush. Cleared on `dispose`. @since 1.4
     */
    readonly mapSlots: Map<string, MapStore>;
    /**
     * The chart's own symbol, resolved once at mount from the adapter
     * `syminfo.ticker` (`""` when the adapter supplies none). A
     * `request.security` call that omits `symbol` — or passes this exact
     * ticker — resolves to it and collapses to the bare-interval
     * {@link feedKey}, so the chart-symbol path is byte-identical to the
     * pre-multi-symbol baseline. Only a *different* symbol allocates a
     * `"<symbol>@<interval>"` feed. @since 1.3
     */
    readonly chartSymbol: string;
    /**
     * Secondary candle streams keyed by the composite
     * `feedKey(symbol, interval)` (the shared core helper). A symbol-omitted
     * feed collapses to the bare interval — `feedKey(undefined, "1D") === "1D"`
     * — so the chart-symbol path is byte-identical to the pre-multi-symbol
     * baseline; a non-chart symbol keys as `"<symbol>@<interval>"`. Mutated only
     * by `createScriptRunner` mount/restore/routing. @since 0.5
     */
    readonly secondaryStreams: Map<string, StreamState>;
    /**
     * Per-`request.security` slot cache keyed by `slotId|feedKey`. Phase 4
     * stores NaN fallback bars here; Phase 5 replaces the value producer with
     * aligned secondary stream series while preserving stable identity. The
     * `feedKey` collapses to the bare interval for chart-symbol requests, so
     * the omitted-symbol cache key is byte-identical to the baseline.
     * @since 0.4
     */
    readonly requestSecurityBars: Map<string, SecurityBar>;
    /**
     * Per-compute aligned numeric arrays keyed by
     * `slotId|feedKey|sourceKey`. Cleared on main-stream close/tick before
     * `compute` so `request.security` re-aligns against the latest
     * secondary buffers. @since 0.5
     */
    readonly requestSecurityAlignments: Map<string, ReadonlyArray<number>>;
    /**
     * Per-compute cache of ascending `Bar[]` materialisations keyed by the
     * source `StreamState`. Shared by `request.security` and `request.lowerTf`
     * (via `request/streamBars.ts:ascendingBarsFor`) so a stable bar-array
     * identity is reused across every consumer in a bar — the `getOrAlign` /
     * `getOrBucket` WeakMap caches actually hit and the same ring buffer is
     * walked once per bar instead of 10×. Cleared alongside
     * {@link requestSecurityAlignments}. @since 0.5
     */
    readonly requestSecurityAscendingBars: Map<StreamState, ReadonlyArray<Bar>>;
    /**
     * Mounted HTF expression runners keyed by `slotId`. One entry per
     * `manifest.securityExpressions` callsite. `request.security(slotId,
     * opts, expr)` dispatches the expression overload off this registry
     * (rather than `expr !== undefined`) and captures the callback here.
     * Absent on dep / sibling contexts and single-timeframe scripts.
     * Cleared on `dispose`. @since 0.7
     */
    securityExprRunners?: Map<string, SecurityExprRunner>;
    /**
     * Per-feed index into {@link securityExprRunners}, keyed by the composite
     * `feedKey(symbol, interval)`. `driveSecurityExpressions` fans a secondary
     * close / tick (tagged with that same composite key on
     * `CandleEvent.streamKey`) out to every runner on that feed. A
     * symbol-omitted callsite collapses to the bare interval, byte-identical to
     * the pre-multi-symbol baseline. Absent when no expression callsites are
     * declared. Cleared on `dispose`. @since 0.7
     */
    securityExprRunnersByFeed?: ReadonlyMap<string, ReadonlyArray<SecurityExprRunner>>;
    /**
     * Per-compute aligned expression-output series cache keyed by
     * `slotId|feedKey`. Holds the stable `Series<number>` Proxy each
     * expression-form `request.security` returns; cleared each bar
     * (alongside {@link requestSecurityAlignments}) so the proxy re-aligns
     * the runner's output buffer against the latest secondary buffers.
     * @since 0.7
     */
    requestSecurityExprSeries?: Map<string, Series<number>>;
    /**
     * Per-`request.lowerTf` slot cache keyed by `slotId|interval`. Values are
     * stable `Series<ReadonlyArray<Bar>>` proxies over the latest LTF bucket
     * materialisation. @since 0.6
     */
    readonly requestLowerTfViews: Map<string, Series<ReadonlyArray<Bar>>>;
    /**
     * Runtime diagnostic dedupe for `request.*` capability gates, keyed by
     * `code|slotId|interval|kind`. Cleared on `dispose`. @since 0.4
     */
    readonly diagnosedRequestKeys: Set<string>;
    /**
     * Runtime diagnostic dedupe for `time.*` / `session.*` DST-zone
     * fallbacks, keyed by `tz-dst-unsupported|<tz>`. The calendar accessors
     * are `slot: false` (no slotId to key on), so they dedupe on the
     * timezone string here — a DST zone warns at most once per distinct tz
     * per mount. Cleared on `dispose`. @since 1.5
     */
    readonly diagnosedTzKeys: Set<string>;
    /**
     * Manifest-declared alert conditions keyed by condition id. Used by
     * `signal(conditionId, fired)` to reject unknown ids without
     * re-reading the manifest each bar. @since 0.5
     */
    readonly alertConditions?: ReadonlyMap<string, AlertConditionDefinition>;
    /**
     * Dedupe for alert-condition capability/unknown-id diagnostics, keyed
     * by `code|conditionId`. Cleared on dispose. @since 0.5
     */
    readonly diagnosedAlertConditionKeys?: Set<string>;
    /**
     * Number of `runtime.log.*` emissions accepted in the active compute
     * step. Reset at the start of each close/tick. @since 0.5
     */
    logBudget: number;
    /**
     * Per-step dedupe flag for `runtime-log-budget-exceeded`. Reset with
     * `logBudget` at the start of each close/tick. @since 0.5
     */
    logBudgetExceededDiagnosed: boolean;
    /**
     * Frozen effective input values keyed by script input name. Resolved once
     * at mount and reused by every compute step. @since 0.4
     */
    resolvedInputs: Readonly<Record<string, unknown>>;
    /**
     * Mount-time script pane default. The runner sets it from
     * `manifest.overlay`:
     *   - `overlay` absent / `true` → `"overlay"`.
     *   - `overlay === false` → `"script:<sanitised(manifest.name)>"`.
     * `resolvePane` reads this value when a `plot()` / `hline()` call
     * has no explicit `pane` opt.
     * @since 0.2
     */
    readonly defaultPane: string;
    /**
     * Stable non-overlay pane key for this script. Explicit
     * `pane: "new"` resolves here even when `defaultPane === "overlay"`
     * so every `"new"` plot in a script joins one script-owned subpane.
     * @since 0.2
     */
    readonly scriptPane: string;
    /**
     * Host-supplied per-slot presentation overrides, keyed by
     * `PlotEmission.slotId`. Applied at emit time by `applyPlotOverride`.
     * Mutable — `setPlotOverrides` swaps it live (presentation-only, so
     * it does not break the frozen-input determinism guarantee). Entries
     * themselves are frozen. @since 0.8
     */
    plotOverrides: Readonly<Record<string, PlotOverride>>;
    /**
     * Runtime diagnostic dedupe for mount-time input override failures,
     * keyed by manifest input key. Cleared on `dispose`. @since 0.4
     */
    readonly diagnosedInputKeys: Set<string>;
    /**
     * Runtime `barstate.*`, `syminfo.*`, and `timeframe.*` views. The
     * container is mutable; each assigned view snapshot is frozen.
     * @since 0.4
     */
    readonly views: RuntimeViews;
    /**
     * Prefix prepended when emissions from this context flow into the
     * parent runner's queues, and mirrored into every `stateSlots` /
     * `StateStore` key written by `state.*` / `state.tick.*` so each
     * runner's persisted state is isolated. `"dep:<localId>/"` for
     * private dep runners, `"export:<exportName>/"` for sibling
     * runners, and `""` (or absent) for primary single-script and
     * bundle-primary runners.
     *
     * @since 0.7
     */
    slotIdPrefix?: string;
    /**
     * `true` when this context belongs to a private dep runner — its
     * emissions are dropped (or captured into the dep output store) by
     * `applyDepEmissionPolicy`. `false` / absent for primary and
     * sibling runners.
     *
     * @since 0.7
     */
    isDep?: boolean;
    /**
     * Per-bar titled-output buffer shared by the primary and every
     * sibling of a `CompiledScriptBundle`. Populated by
     * `applyDepEmissionPolicy` after each dep/sibling's compute; read
     * by `__chartlang_depOutput` during the consumer's compute. `null`
     * / absent for single-script runners with no deps.
     *
     * @since 0.7
     */
    depOutputStore?: DepOutputStore | null;
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

// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertEmission,
    Capabilities,
    DrawingEmission,
    PlotEmission,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";

import type { StateStore } from "./stateStore";
import type { StreamState } from "./streamState";

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
